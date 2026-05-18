"""
Flask backend for longitudinal lesion tracking with feature drift detection.
Endpoints:
  - POST /analyze          : analyze single lesion image
  - POST /analyze_drift    : analyze with drift computation from previous features
"""

import os
import io
import json
import base64
import numpy as np
import cv2
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS
import torch
import sys

# Add the repository root to path to import feature_drift from the top-level workspace
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from feature_drift_1 import (
    load_model,
    extract_features,
    compute_drift,
    extract_abcd,
    predict,
    compute_risk,
)

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configuration
MODEL_PATH = r"C:\Users\pc\Documents\ela format pc\LSI3\PFE\models\best_model_b4_benign_0.81.pth"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
MAX_IMAGE_SIZE = 50 * 1024 * 1024  # 50MB
# Lesion detection thresholds
MIN_LESION_PIXELS = 50
MIN_LESION_AREA_RATIO = 0.001

print(f"🔧 Device: {DEVICE}")
print(f"🔧 Model path: {MODEL_PATH}")

# Global model state
MODEL_STATE = {
    "model": None,
    "backbone": None,
    "class_names": None,
}


def load_models():
    """Load EfficientNet model on first request."""
    if MODEL_STATE["model"] is None:
        print("📦 Loading EfficientNet-B4 model...")
        try:
            model, backbone, class_names = load_model()
            MODEL_STATE["model"] = model
            MODEL_STATE["backbone"] = backbone
            MODEL_STATE["class_names"] = class_names
            print(f"✅ Model loaded. Classes: {class_names}")
        except Exception as e:
            print(f"❌ Failed to load model: {e}")
            raise


def allowed_file(filename):
    """Check if file extension is allowed."""
    allowed_extensions = {"png", "jpg", "jpeg", "bmp", "gif"}
    return "." in filename and filename.rsplit(".", 1)[1].lower() in allowed_extensions


def decode_image_input(data):
    """
    Decode image from either:
    1. File upload (multipart/form-data)
    2. Base64 string in JSON
    Returns: cv2 image (BGR)
    """
    image = None

    # Try to get file from multipart form
    if "image" in request.files:
        file = request.files["image"]
        if file.filename == "":
            return None
        if not allowed_file(file.filename):
            return None
        image_data = file.read()
        image = cv2.imdecode(np.frombuffer(image_data, np.uint8), cv2.IMREAD_COLOR)

    # Try to get base64 from JSON
    elif "image_base64" in request.json or (request.is_json and request.json):
        json_data = request.get_json() or {}
        image_base64 = json_data.get("image_base64")
        if image_base64:
            try:
                image_data = base64.b64decode(image_base64)
                image = cv2.imdecode(
                    np.frombuffer(image_data, np.uint8), cv2.IMREAD_COLOR
                )
            except Exception as e:
                print(f"❌ Failed to decode base64: {e}")
                return None

    return image


def build_response(prediction, confidence, abcd, features, risk_score, drift=None, drift_label=None):
    """Build standardized response JSON."""
    return {
        "prediction": prediction,
        "confidence": float(confidence),
        "abcd": {
            "A": float(abcd["A"]),
            "B": float(abcd["B"]),
            "C": float(abcd["C"]),
            "D": float(abcd["D"]),
        },
        "features": [float(f) for f in features],
        "risk_score": float(risk_score),
        "drift": float(drift) if drift is not None else None,
        "drift_label": drift_label,
    }


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok", "device": DEVICE})


@app.route("/analyze", methods=["POST"])
def analyze():
    """
    Analyze a single lesion image.

    Input:
      - image: file upload or
      - image_base64: base64-encoded image string

    Output:
      {
        "prediction": "Melanoma",
        "confidence": 0.84,
        "abcd": {"A": 0.6, "B": 0.4, "C": 0.3, "D": 0.5},
        "features": [1792 float values],
        "risk_score": 0.72,
        "drift": null,
        "drift_label": null
      }
    """
    try:
        # Load models if not already loaded
        load_models()

        # Decode image
        image = decode_image_input(request)
        if image is None:
            return jsonify({"error": "Invalid or missing image"}), 400

        print(f"📸 Image shape: {image.shape}")

        # Extract ABCD features
        abcd, mask = extract_abcd(image)
        # Validate lesion presence: require a minimum number of segmented pixels
        lesion_pixels = int((mask > 0).sum()) if mask is not None else 0
        if lesion_pixels < MIN_LESION_PIXELS or (lesion_pixels / mask.size if mask is not None else 0) < MIN_LESION_AREA_RATIO:
            return jsonify({"error": "No lesion detected", "quality": {"valid": False}}), 400
        print(f"✅ ABCD extracted: A={abcd['A']:.3f}, B={abcd['B']:.3f}, C={abcd['C']:.3f}, D={abcd['D']:.3f}")

        # Extract feature vector (1792-dim)
        features = extract_features(MODEL_STATE["backbone"], image)
        print(f"✅ Features extracted: shape={features.shape}")

        # Predict class and confidence
        prediction, confidence, malignancy_prob = predict(
            MODEL_STATE["model"], image, MODEL_STATE["class_names"]
        )
        print(f"✅ Prediction: {prediction} ({confidence:.1%})")

        # Compute risk score (no drift on first scan)
        risk_score = compute_risk(abcd, drift=0.0, malignancy_prob=malignancy_prob)
        print(f"✅ Risk score: {risk_score:.3f}")

        response = build_response(
            prediction=prediction,
            confidence=confidence,
            abcd=abcd,
            features=features,
            risk_score=risk_score,
            drift=None,
            drift_label=None,
        )

        return jsonify(response), 200

    except Exception as e:
        print(f"❌ Error in /analyze: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/analyze_drift", methods=["POST"])
def analyze_drift():
    """
    Analyze a lesion image with drift computation from previous features.

    Input:
      - image: file upload or image_base64
      - previous_features: JSON array of 1792 floats from previous scan

    Output:
      {
        "prediction": "Melanoma",
        "confidence": 0.84,
        "abcd": {"A": 0.6, "B": 0.4, "C": 0.3, "D": 0.5},
        "features": [1792 float values],
        "risk_score": 0.75,
        "drift": 0.18,
        "drift_label": "Moderate"
      }
    """
    try:
        # Load models if not already loaded
        load_models()

        # Decode image
        image = decode_image_input(request)
        if image is None:
            return jsonify({"error": "Invalid or missing image"}), 400

        # Get previous features from request
        json_data = request.get_json() or {}
        previous_features_list = json_data.get("previous_features")

        if not previous_features_list:
            return (
                jsonify({"error": "Missing previous_features in request"}),
                400,
            )

        # Convert to numpy array
        try:
            previous_features = np.array(previous_features_list, dtype=np.float32)
            if previous_features.shape[0] != 1792:
                return (
                    jsonify(
                        {"error": f"Expected 1792 features, got {previous_features.shape[0]}"}
                    ),
                    400,
                )
        except Exception as e:
            return jsonify({"error": f"Invalid previous_features format: {e}"}), 400

        print(f"📸 Image shape: {image.shape}")
        print(f"📊 Previous features shape: {previous_features.shape}")

        # Extract ABCD features
        abcd, mask = extract_abcd(image)
        lesion_pixels = int((mask > 0).sum()) if mask is not None else 0
        if lesion_pixels < MIN_LESION_PIXELS or (lesion_pixels / mask.size if mask is not None else 0) < MIN_LESION_AREA_RATIO:
            return jsonify({"error": "No lesion detected", "quality": {"valid": False}}), 400
        print(f"✅ ABCD extracted: A={abcd['A']:.3f}, B={abcd['B']:.3f}, C={abcd['C']:.3f}, D={abcd['D']:.3f}")

        # Extract feature vector
        features = extract_features(MODEL_STATE["backbone"], image)
        print(f"✅ Features extracted: shape={features.shape}")

        # Compute drift
        drift, drift_label = compute_drift(previous_features, features)
        print(f"✅ Drift computed: {drift:.3f} ({drift_label})")

        # Predict class and confidence
        prediction, confidence, malignancy_prob = predict(
            MODEL_STATE["model"], image, MODEL_STATE["class_names"]
        )
        print(f"✅ Prediction: {prediction} ({confidence:.1%})")

        # Compute risk score WITH drift
        risk_score = compute_risk(abcd, drift=drift, malignancy_prob=malignancy_prob)
        print(f"✅ Risk score (with drift): {risk_score:.3f}")

        response = build_response(
            prediction=prediction,
            confidence=confidence,
            abcd=abcd,
            features=features,
            risk_score=risk_score,
            drift=drift,
            drift_label=drift_label,
        )

        return jsonify(response), 200

    except Exception as e:
        print(f"❌ Error in /analyze_drift: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/info", methods=["GET"])
def info():
    """Get model and endpoint information."""
    load_models()
    return jsonify({
        "device": DEVICE,
        "class_names": MODEL_STATE["class_names"],
        "feature_dim": 1792,
        "endpoints": [
            "/health",
            "/info",
            "/analyze",
            "/analyze_drift",
        ],
    })


if __name__ == "__main__":
    # Run Flask dev server
    # For production, use gunicorn: gunicorn -w 1 app:app
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=False,
        use_reloader=False,
    )
