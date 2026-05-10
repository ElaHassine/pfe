import os
import cv2
import numpy as np
import torch
import torch.nn as nn
import timm
import matplotlib.pyplot as plt

from torchvision import transforms
from scipy.spatial.distance import cosine
from sklearn.cluster import KMeans

# ==============================
# CONFIG
# ==============================
MODEL_PATH = r"C:\Users\pc\Documents\ela format pc\LSI3\PFE\models\best_model_b4_benign_0.81.pth"
IMAGE_SIZE  = 380
DEVICE      = "cuda" if torch.cuda.is_available() else "cpu"
MEAN        = [0.485, 0.456, 0.406]
STD         = [0.229, 0.224, 0.225]

# Malignant classes — used for correct risk scoring
# Only these classes contribute to the CNN risk component
MALIGNANT_CLASSES = [
    'Melanoma',
    'Basal cell carcinoma',
    'Squamous cell carcinoma',
    'Actinic keratosis'
]

# ==============================
# TRANSFORM
# ==============================
transform = transforms.Compose([
    transforms.ToPILImage(),
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=MEAN, std=STD)
])

# ==============================
# 1. LOAD MODEL
# ==============================
def load_model():
    # Load checkpoint first to get class names and count
    checkpoint  = torch.load(MODEL_PATH, map_location=DEVICE)
    class_names = checkpoint.get('class_names', None)
    num_classes = len(class_names) if class_names else 5

    print(f"✅ Classes from checkpoint : {class_names}")
    print(f"✅ Num classes             : {num_classes}")

    # Build full model — matches training architecture exactly
    model = timm.create_model(
        'efficientnet_b4',
        pretrained=False,
        num_classes=0,
        drop_rate=0.4,
        drop_path_rate=0.2
    )
    in_features = model.num_features   # 1792 for B4

    model.classifier = nn.Sequential(
        nn.BatchNorm1d(in_features),
        nn.Dropout(0.4),
        nn.Linear(in_features, 512),
        nn.SiLU(),
        nn.Dropout(0.3),
        nn.Linear(512, num_classes)
    )

    model.load_state_dict(checkpoint['model_state_dict'])
    model.to(DEVICE)
    model.eval()

    # Build backbone-only model for feature extraction
    backbone = timm.create_model(
        'efficientnet_b4',
        pretrained=False,
        num_classes=0
    )
    backbone_state = {
        k: v for k, v in model.state_dict().items()
        if not k.startswith('classifier')
    }
    backbone.load_state_dict(backbone_state, strict=False)
    backbone.to(DEVICE)
    backbone.eval()

    return model, backbone, class_names


# ==============================
# 2. SEGMENTATION
# ==============================
def segment_lesion(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)

    _, thresh = cv2.threshold(
        blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
    )

    kernel = np.ones((5, 5), np.uint8)
    mask   = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    mask   = cv2.morphologyEx(mask,   cv2.MORPH_OPEN,  kernel)

    return mask


# ==============================
# 3. ABCD FEATURES
# ==============================
def compute_asymmetry(mask):
    vertical_flip   = cv2.flip(mask, 1)
    horizontal_flip = cv2.flip(mask, 0)
    overlap_v = np.sum((mask > 0) & (vertical_flip > 0))
    overlap_h = np.sum((mask > 0) & (horizontal_flip > 0))
    total     = np.sum(mask > 0) + 1e-6
    score     = 1 - ((overlap_v + overlap_h) / (2 * total))
    return float(np.clip(score, 0, 1))


def compute_border(mask):
    contours, _ = cv2.findContours(
        mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    if not contours:
        return 0.0
    cnt       = max(contours, key=cv2.contourArea)
    area      = cv2.contourArea(cnt)
    perimeter = cv2.arcLength(cnt, True)
    if area == 0:
        return 0.0
    score = (perimeter ** 2) / (4 * np.pi * area)
    return float(np.clip(score / 10, 0, 1))


def compute_color(image, mask):
    lesion_pixels = image[mask > 0]
    if len(lesion_pixels) < 10:
        return 0.0
    hsv    = cv2.cvtColor(lesion_pixels.reshape(-1, 1, 3), cv2.COLOR_BGR2HSV)
    hsv    = hsv.reshape(-1, 3)
    kmeans = KMeans(n_clusters=3, n_init=10, random_state=42)
    kmeans.fit(hsv)
    variance = np.var(hsv)
    return float(np.clip(variance / 1000, 0, 1))


def compute_diameter(mask):
    points = np.column_stack(np.where(mask > 0))
    if len(points) < 2:
        return 0.0
    dist = np.max([
        np.linalg.norm(p1 - p2)
        for p1 in points[::20]
        for p2 in points[::20]
    ])
    h, w = mask.shape
    diag = np.sqrt(h**2 + w**2)
    return float(np.clip(dist / diag, 0, 1))


def extract_abcd(image):
    mask = segment_lesion(image)
    A    = compute_asymmetry(mask)
    B    = compute_border(mask)
    C    = compute_color(image, mask)
    D    = compute_diameter(mask)
    return {"A": A, "B": B, "C": C, "D": D}, mask


# ==============================
# 4. FEATURE EXTRACTION
# ==============================
def extract_features(backbone, image):
    tensor = transform(image).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        features = backbone(tensor)
    return features.cpu().numpy().flatten()


# ==============================
# 5. FEATURE DRIFT
# ==============================
def compute_drift(f1, f2):
    drift = float(cosine(f1, f2))
    if drift < 0.15:
        label = "Stable"
    elif drift < 0.30:
        label = "Moderate"
    else:
        label = "Significant"
    return drift, label


# ==============================
# 6. CNN PREDICTION
# ─────────────────────────────
# Returns:
#   - pred_class      : predicted class name
#   - conf            : confidence of predicted class
#   - malignancy_prob : sum of probabilities of malignant classes only
#                       used for risk score instead of raw confidence
#
# Fix: previously used max(confidence) which inflates risk even for
# benign predictions. Now uses malignant class probabilities only.
# ==============================
def predict(model, image, class_names):
    tensor = transform(image).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        logits = model(tensor)
        probs  = torch.softmax(logits, dim=1)
        conf, pred_idx = torch.max(probs, dim=1)

    pred_class = class_names[pred_idx.item()] if class_names else str(pred_idx.item())

    # ── Malignancy probability (the correct risk signal) ──────
    # Sum probabilities of all malignant classes only
    # If model predicts Benign with 95% conf → malignancy_prob stays low
    # If model predicts Melanoma with 84% conf → malignancy_prob is high
    malignant_indices = [
        class_names.index(c)
        for c in MALIGNANT_CLASSES
        if c in class_names
    ]

    if malignant_indices:
        malignancy_prob = float(probs[0, malignant_indices].sum().item())
    else:
        # Fallback if class names don't match — use raw confidence
        malignancy_prob = float(conf.item())
        print("⚠️  No malignant class found in checkpoint class_names — using raw confidence")

    return pred_class, float(conf.item()), malignancy_prob


# ==============================
# 7. RISK FUSION
# ─────────────────────────────
# Weights:
#   ABCD features : 40% total (10% each)
#   Feature drift : 30%
#   CNN malignancy probability : 30%  ← fixed: uses malignancy_prob not raw conf
#
# Example:
#   Benign prediction (conf=0.95) → malignancy_prob ~0.05 → low CNN contribution
#   Melanoma prediction (conf=0.84) → malignancy_prob ~0.84 → high CNN contribution
# ==============================
def compute_risk(abcd, drift, malignancy_prob):
    risk = (
        0.10 * abcd["A"]      +   # Asymmetry
        0.10 * abcd["B"]      +   # Border irregularity
        0.10 * abcd["C"]      +   # Color variance
        0.10 * abcd["D"]      +   # Diameter
        0.30 * drift          +   # Feature drift between visits
        0.30 * malignancy_prob    # Probability of malignant class (fixed)
    )
    return float(np.clip(risk, 0, 1))


# ==============================
# 8. VISUALIZATION
# ==============================
def visualize(img1, img2, abcd, drift, drift_label, risk,
              pred1, pred2, conf1, conf2, malignancy_prob):

    if risk < 0.3:
        color      = "green"
        risk_label = "Low Risk"
    elif risk < 0.6:
        color      = "orange"
        risk_label = "Moderate Risk"
    else:
        color      = "red"
        risk_label = "High Risk — Clinical Review Recommended"

    fig, axes = plt.subplots(1, 2, figsize=(12, 5))

    axes[0].imshow(cv2.cvtColor(img1, cv2.COLOR_BGR2RGB))
    axes[0].set_title(f"Visit 1\n{pred1} ({conf1:.1%})", fontsize=12)
    axes[0].axis('off')

    axes[1].imshow(cv2.cvtColor(img2, cv2.COLOR_BGR2RGB))
    axes[1].set_title(f"Visit 2\n{pred2} ({conf2:.1%})", fontsize=12)
    axes[1].axis('off')

    plt.suptitle(
        f"ABCD:  A={abcd['A']:.2f}  B={abcd['B']:.2f}  "
        f"C={abcd['C']:.2f}  D={abcd['D']:.2f}\n"
        f"Malignancy Prob: {malignancy_prob:.2f}  |  "
        f"Feature Drift (E): {drift:.3f} → {drift_label}\n"
        f"Risk Score: {risk:.2f} → {risk_label}",
        color=color,
        fontsize=11,
        fontweight='bold'
    )

    plt.tight_layout()
    plt.show()

    print(f"\n{'='*55}")
    print(f"  ABCD Scores:")
    print(f"    A (Asymmetry) : {abcd['A']:.3f}")
    print(f"    B (Border)    : {abcd['B']:.3f}")
    print(f"    C (Color)     : {abcd['C']:.3f}")
    print(f"    D (Diameter)  : {abcd['D']:.3f}")
    print(f"  Malignancy Prob : {malignancy_prob:.3f}")
    print(f"  Feature Drift   : {drift:.3f} → {drift_label}")
    print(f"  Risk Score      : {risk:.3f} → {risk_label}")
    print(f"{'='*55}")


# ==============================
# 9. FULL PIPELINE
# ==============================
def run_pipeline(image_path_1, image_path_2=None):
    """
    Full longitudinal lesion tracking pipeline.

    Args:
        image_path_1 : path to visit 1 image (required)
        image_path_2 : path to visit 2 image (optional)
                       if None, simulates visit 2 with mild augmentation

    Returns:
        dict with all scores
    """
    model, backbone, class_names = load_model()

    # Load visit 1
    img1 = cv2.imread(image_path_1)
    if img1 is None:
        raise FileNotFoundError(f"Image not found: {image_path_1}")

    # Load or simulate visit 2
    if image_path_2 and os.path.exists(image_path_2):
        img2 = cv2.imread(image_path_2)
        print("✅ Using real visit 2 image")
    else:
        img2 = cv2.GaussianBlur(img1, (7, 7), 0)
        img2 = cv2.addWeighted(img2, 1.1, np.zeros_like(img2), 0, 10)
        print("⚠️  No visit 2 provided — simulating with augmentation")

    # ABCD from visit 1
    abcd, _ = extract_abcd(img1)

    # Feature vectors
    f1 = extract_features(backbone, img1)
    f2 = extract_features(backbone, img2)

    # Drift
    drift, drift_label = compute_drift(f1, f2)

    # CNN predictions — now returns malignancy_prob separately
    pred1, conf1, malignancy_prob = predict(model, img1, class_names)
    pred2, conf2, _               = predict(model, img2, class_names)

    # Risk score — uses malignancy_prob instead of raw confidence
    risk = compute_risk(abcd, drift, malignancy_prob)

    # Visualize
    visualize(img1, img2, abcd, drift, drift_label, risk,
              pred1, pred2, conf1, conf2, malignancy_prob)

    return {
        "prediction"      : pred1,
        "confidence"      : conf1,
        "malignancy_prob" : malignancy_prob,
        "abcd"            : abcd,
        "features"        : f1.tolist(),
        "drift"           : drift,
        "drift_label"     : drift_label,
        "risk_score"      : risk
    }


# ==============================
# RUN
# ==============================
if __name__ == "__main__":
    # Single image demo — simulates visit 2
    result = run_pipeline("test.jpg")

    # Two real visits:
    # result = run_pipeline("visit1.jpg", "visit2.jpg")
