from flask import Flask, request, jsonify
import joblib
import pandas as pd
import numpy as np
import os

app = Flask(__name__)

# Try to enable CORS if flask_cors is installed
try:
    from flask_cors import CORS
    CORS(app)
except Exception:
    pass

# Load the trained ML model safely
MODEL_PATH = os.path.join(os.path.dirname(__file__), "land_fraud_model.pkl")
try:
    model = joblib.load(MODEL_PATH)
    print("[OK] ML Model loaded successfully from", MODEL_PATH)
except Exception as e:
    model = None
    print("[WARN] Could not load land_fraud_model.pkl:", e)


@app.route("/", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "service": "LandSecure ML Fraud Detection API",
        "model_loaded": model is not None
    })


@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.json or {}

        area = float(data.get("area", 1200))
        owner_id_valid = int(data.get("owner_id_valid", 1))
        survey_number_valid = int(data.get("survey_number_valid", 1))
        location_valid = int(data.get("location_valid", 1))
        previous_records = int(data.get("previous_records", 0))
        document_complete = int(data.get("document_complete", 1))
        ocr_mismatch = bool(data.get("ocr_mismatch", False))

        # Base prediction from model if available
        fraud_probability = 5.0
        prediction = 0

        if model is not None:
            land_data = pd.DataFrame([{
                "area": area,
                "owner_id_valid": owner_id_valid,
                "survey_number_valid": survey_number_valid,
                "location_valid": location_valid,
                "previous_records": previous_records,
                "document_complete": document_complete
            }])

            prediction = int(model.predict(land_data)[0])
            probability = model.predict_proba(land_data)[0]
            fraud_probability = round(float(probability[1]) * 100, 2)
        else:
            # Heuristic calculation if model file is not yet loaded
            score = 0
            if not owner_id_valid: score += 40
            if not survey_number_valid: score += 35
            if not location_valid: score += 20
            if not document_complete: score += 25
            if area > 100000 or area < 100: score += 15
            fraud_probability = min(99.0, max(2.0, float(score)))
            prediction = 1 if fraud_probability > 50 else 0

        # Factor in OCR document mismatch
        if ocr_mismatch:
            fraud_probability = min(99.0, fraud_probability + 45.0)
            if fraud_probability >= 50.0:
                prediction = 1

        # Determine risk tier & verdict
        if fraud_probability < 30:
            result = "GENUINE"
            risk_level = "LOW"
        elif fraud_probability < 65:
            result = "SUSPICIOUS"
            risk_level = "MEDIUM"
        else:
            result = "FRAUD"
            risk_level = "HIGH"

        # Explainable factors
        factors = {
            "area_anomaly": bool(area > 50000 or area < 100),
            "owner_id_valid": bool(owner_id_valid),
            "survey_number_valid": bool(survey_number_valid),
            "location_valid": bool(location_valid),
            "document_complete": bool(document_complete),
            "ocr_mismatch": ocr_mismatch
        }

        reasons = []
        if ocr_mismatch:
            reasons.append("Document OCR content does not match registration form values")
        if not owner_id_valid:
            reasons.append("Unverified or missing government owner identification")
        if not survey_number_valid:
            reasons.append("Survey number format is invalid or unrecorded in cadastral registry")
        if not location_valid:
            reasons.append("Boundary coordinates or location do not match official revenue records")
        if not document_complete:
            reasons.append("Incomplete mandatory supporting documents for this transaction type")
        if factors["area_anomaly"]:
            reasons.append("Unusual land area measurement requires field verification")

        confidence = round(abs(fraud_probability - 50.0) * 1.8 + 10, 1)
        confidence = min(99.4, max(75.0, confidence))

        return jsonify({
            "success": True,
            "result": result,
            "fraud_probability": round(fraud_probability, 2),
            "risk_level": risk_level,
            "confidence": confidence,
            "factors": factors,
            "flag_reasons": reasons
        })

    except Exception as error:
        return jsonify({
            "success": False,
            "message": str(error)
        }), 400


if __name__ == "__main__":
    app.run(port=5001, debug=False)