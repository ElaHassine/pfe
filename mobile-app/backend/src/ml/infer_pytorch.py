import argparse
import json
import os
import sys


def parse_class_names(value: str):
    if not value:
        return ["low", "medium", "high"]
    names = [item.strip() for item in value.split(",") if item.strip()]
    return names if names else ["low", "medium", "high"]


# ==============================
# FIX 3 — infer_risk_from_label
# Added full class name tokens to match your checkpoint class names:
#   "Actinic keratosis"      → added "actinic"
#   "Squamous cell carcinoma"→ added "squamous"
#   "Basal cell carcinoma"   → already had "basal", "bcc"
#   "Benign"                 → already had "benign"
#   "Melanoma"               → already had "melanoma"
# ==============================
def infer_risk_from_label(label: str):
    normalized = label.lower()
    if any(token in normalized for token in [
        "high", "melanoma", "malignant", "severe",
        "mel", "akiec", "scc",
        "actinic",      # Actinic keratosis
        "squamous",     # Squamous cell carcinoma
    ]):
        return "high"
    if any(token in normalized for token in [
        "medium", "atypical", "moderate", "dysplastic",
        "bcc", "basal", "bkl",   # Basal cell carcinoma
    ]):
        return "medium"
    if any(token in normalized for token in [
        "low", "benign",          # Benign
        "normal", "common",
        "nv", "nevus", "df", "vasc",
    ]):
        return "low"
    return "medium"


def infer_recommendation(risk_level: str):
    if risk_level == "high":
        return "urgent"
    if risk_level == "medium":
        return "consult"
    return "monitor"


def clean_state_dict(state_dict):
    cleaned = {}
    for key, value in state_dict.items():
        normalized_key = key[7:] if key.startswith("module.") else key
        cleaned[normalized_key] = value
    return cleaned


def infer_num_classes(state_dict, fallback_classes):
    # ==============================
    # FIX 2 — priority_keys updated
    # Your classifier head structure:
    #   classifier.0 → BatchNorm1d
    #   classifier.1 → Dropout
    #   classifier.2 → Linear(1792, 512)
    #   classifier.3 → SiLU
    #   classifier.4 → Dropout
    #   classifier.5 → Linear(512, num_classes)  ← output layer
    # So output key is "classifier.5.weight", not "classifier.1.weight"
    # ==============================
    priority_keys = [
        "classifier.5.weight",   # your model's output layer
        "classifier.1.weight",
        "classifier.weight",
        "fc.weight",
        "head.weight",
    ]

    for key in priority_keys:
        tensor = state_dict.get(key)
        if tensor is not None and hasattr(tensor, "shape") and len(tensor.shape) >= 1:
            return int(tensor.shape[0])

    # Fallback: pick the last 2D weight-like tensor
    for key, tensor in reversed(list(state_dict.items())):
        if not key.endswith("weight"):
            continue
        if not hasattr(tensor, "shape"):
            continue
        if len(tensor.shape) != 2:
            continue
        rows = int(tensor.shape[0])
        if 2 <= rows <= 1000:
            return rows

    return len(fallback_classes)


def build_model(arch, num_classes):
    import torch.nn as nn
    import torchvision.models as models

    arch_normalized = (arch or "efficientnet_b4").strip().lower()
    if not hasattr(models, arch_normalized):
        raise RuntimeError(f"Unsupported MODEL_ARCH '{arch}'.")

    constructor = getattr(models, arch_normalized)
    model = constructor(weights=None)

    if hasattr(model, "fc") and isinstance(model.fc, nn.Linear):
        in_features = model.fc.in_features
        model.fc = nn.Linear(in_features, num_classes)
        return model

    if hasattr(model, "classifier"):
        classifier = model.classifier
        if isinstance(classifier, nn.Linear):
            model.classifier = nn.Linear(classifier.in_features, num_classes)
            return model
        if isinstance(classifier, nn.Sequential):
            for i in range(len(classifier) - 1, -1, -1):
                layer = classifier[i]
                if isinstance(layer, nn.Linear):
                    classifier[i] = nn.Linear(layer.in_features, num_classes)
                    model.classifier = classifier
                    return model

    if hasattr(model, "head") and isinstance(model.head, nn.Linear):
        model.head = nn.Linear(model.head.in_features, num_classes)
        return model

    raise RuntimeError(
        f"Could not replace classifier head for architecture '{arch_normalized}'."
    )


# ==============================
# FIX 1 — build_timm_b4_checkpoint_model
# Dropout values corrected to match your training:
#   drop_rate     : 0.2 → 0.4
#   drop_path_rate: 0.1 → 0.2
#   Dropout(p=0.2)→ Dropout(p=0.4)  (first dropout)
#   Dropout(p=0.2)→ Dropout(p=0.3)  (second dropout)
# These must match exactly to reproduce training behavior at inference.
# ==============================
def build_timm_b4_checkpoint_model(num_classes):
    import torch.nn as nn
    import timm

    model = timm.create_model(
        'efficientnet_b4',
        pretrained=False,
        num_classes=0,
        drop_rate=0.4,        # fixed: was 0.2
        drop_path_rate=0.2,   # fixed: was 0.1
    )

    in_features = model.num_features  # 1792 for B4
    model.classifier = nn.Sequential(
        nn.BatchNorm1d(in_features),
        nn.Dropout(p=0.4),             # fixed: was 0.2
        nn.Linear(in_features, 512),
        nn.SiLU(),
        nn.Dropout(p=0.3),             # fixed: was 0.2
        nn.Linear(512, num_classes),
    )

    return model


def load_model(model_path):
    import torch

    # Prefer TorchScript for backend portability
    try:
        model = torch.jit.load(model_path, map_location="cpu")
        model.eval()
        return model, "torchscript"
    except Exception:
        pass

    # Fallback: full serialized nn.Module
    model_obj = torch.load(model_path, map_location="cpu")
    if hasattr(model_obj, "eval"):
        model_obj.eval()
        return model_obj, "module"

    # Fallback: checkpoint / state_dict dictionary
    if isinstance(model_obj, dict):
        if "model_state_dict" in model_obj and "class_names" in model_obj:
            state_dict  = clean_state_dict(model_obj["model_state_dict"])
            class_names = [
                str(name) for name in model_obj.get("class_names", [])
                if str(name).strip()
            ]
            num_classes = (
                len(class_names) if class_names
                else infer_num_classes(
                    state_dict,
                    parse_class_names(os.getenv("MODEL_CLASS_NAMES", ""))
                )
            )

            try:
                model = build_timm_b4_checkpoint_model(num_classes)
                model.load_state_dict(state_dict, strict=True)
                model.eval()
                return model, "checkpoint:timm_efficientnet_b4", class_names
            except Exception as checkpoint_error:
                raise RuntimeError(
                    f"Checkpoint format detected but model rebuild failed: {checkpoint_error}"
                )

        state_dict = None
        if "model_state_dict" in model_obj and isinstance(model_obj["model_state_dict"], dict):
            state_dict = model_obj["model_state_dict"]
        elif "state_dict" in model_obj and isinstance(model_obj["state_dict"], dict):
            state_dict = model_obj["state_dict"]
        elif any(str(k).endswith("weight") for k in model_obj.keys()):
            state_dict = model_obj

        if state_dict is not None:
            classes_hint = parse_class_names(os.getenv("MODEL_CLASS_NAMES", ""))
            cleaned      = clean_state_dict(state_dict)
            num_classes  = infer_num_classes(cleaned, classes_hint)
            arch         = os.getenv("MODEL_ARCH", "efficientnet_b4")

            model = build_model(arch, num_classes)
            missing, unexpected = model.load_state_dict(cleaned, strict=False)
            model.eval()

            if unexpected:
                print(
                    f"Warning: unexpected checkpoint keys: {unexpected[:5]}",
                    file=sys.stderr
                )
            if missing:
                print(
                    f"Warning: missing checkpoint keys: {missing[:5]}",
                    file=sys.stderr
                )

            return model, f"state_dict:{arch}", classes_hint

    raise RuntimeError(
        "Unsupported PyTorch model format. "
        "Provide TorchScript, nn.Module, or checkpoint/state_dict with MODEL_ARCH set."
    )


def preprocess_image(image_path):
    from PIL import Image
    import torchvision.transforms as transforms
    import torchvision.transforms.functional as F
    import torch

    image      = Image.open(image_path).convert("RGB")
    image_size = int(os.getenv("MODEL_IMAGE_SIZE", "380"))
    tta_enabled = os.getenv("MODEL_ENABLE_TTA", "true").strip().lower() != "false"

    normalize = transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std =[0.229, 0.224, 0.225]
    )
    to_tensor = transforms.ToTensor()

    base     = image.resize((image_size, image_size))
    variants = [base]

    if tta_enabled:
        # Horizontal flip — improves dermoscopy image stability
        variants.append(F.hflip(base))

        # Deterministic crop variants — reduces sensitivity to framing
        padded = image.resize((image_size + 40, image_size + 40))
        variants.extend([
            F.center_crop(padded, [image_size, image_size]),
            F.crop(padded, 0,  0,  image_size, image_size),
            F.crop(padded, 40, 40, image_size, image_size),
        ])

    tensors = []
    for variant in variants:
        tensor = to_tensor(variant)
        tensor = normalize(tensor)
        tensors.append(tensor)

    return torch.stack(tensors, dim=0)   # shape: [N, C, H, W]


def run_inference(model, image_tensor, class_names):
    import torch

    with torch.no_grad():
        output = model(image_tensor)

        if isinstance(output, (tuple, list)):
            output = output[0]
        if output.dim() == 1:
            output = output.unsqueeze(0)

        probabilities      = torch.softmax(output, dim=1)
        mean_probabilities = probabilities.mean(dim=0)   # average TTA views

        sorted_probabilities, sorted_indices = torch.sort(
            mean_probabilities, descending=True
        )

        idx = int(sorted_indices[0].item())
        prob = float(sorted_probabilities[0].item())

        label = class_names[idx] if idx < len(class_names) else f"class_{idx}"
        risk_level = infer_risk_from_label(label)

        # Only return the highest (top) diagnosis to avoid surfacing uncertain secondary labels.
        return {
            "predictedClass": label,
            "predictedIndex": idx,
            "confidence": max(0.0, min(1.0, prob)),
            "riskLevel": risk_level,
            "recommendation": infer_recommendation(risk_level),
        }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image",   required=True)
    parser.add_argument("--model",   required=True)
    parser.add_argument("--classes", default="")
    args = parser.parse_args()

    try:
        import torch        # noqa: F401
        import torchvision  # noqa: F401
        import PIL          # noqa: F401
    except Exception as import_error:
        print(json.dumps({
            "ok"   : False,
            "error": f"Missing Python dependencies: {import_error}",
        }))
        sys.exit(2)

    if not os.path.exists(args.model):
        print(json.dumps({
            "ok"   : False,
            "error": f"Model not found: {args.model}"
        }))
        sys.exit(2)

    class_names = parse_class_names(args.classes)

    try:
        loaded = load_model(args.model)
        if len(loaded) == 3:
            model, model_type, checkpoint_class_names = loaded
            if checkpoint_class_names:
                class_names = checkpoint_class_names
        else:
            model, model_type = loaded

        image_tensor = preprocess_image(args.image)
        prediction   = run_inference(model, image_tensor, class_names)

        print(json.dumps({
            "ok"       : True,
            "modelType": model_type,
            **prediction,
        }))

    except Exception as error:
        print(json.dumps({
            "ok"   : False,
            "error": str(error),
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
