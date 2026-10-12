import joblib
import pandas as pd

# Load the trained model
model = joblib.load("land_fraud_model.pkl")

# Create land data using the same feature names
land_data = pd.DataFrame([{
    "area": 1200,
    "owner_id_valid": 1,
    "survey_number_valid": 1,
    "location_valid": 1,
    "previous_records": 0,
    "document_complete": 1
}])

# Make prediction
prediction = model.predict(land_data)[0]

# Get fraud probability
probability = model.predict_proba(land_data)[0]

if prediction == 0:
    print("Result: GENUINE LAND")
    print("Fraud Probability:", round(probability[1] * 100, 2), "%")
else:
    print("Result: FRAUDULENT LAND")
    print("Fraud Probability:", round(probability[1] * 100, 2), "%")