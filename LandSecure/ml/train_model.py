import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import joblib

# 1. Load expanded dataset
data = pd.read_csv("dataset.csv")

print("Dataset loaded successfully!")
print(f"Total samples: {len(data)}")
print(f"Genuine: {len(data[data['fraud'] == 0])}, Fraud: {len(data[data['fraud'] == 1])}")
print()
print(data.head(10))

# 2. Separate input features and target
X = data.drop("fraud", axis=1)
y = data["fraud"]

# 3. Split data into training and testing
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

print(f"\nTraining samples: {len(X_train)}")
print(f"Testing samples: {len(X_test)}")

# 4. Create Random Forest model (better than Logistic Regression for this task)
model = RandomForestClassifier(
    n_estimators=100,
    max_depth=10,
    random_state=42,
    class_weight="balanced"
)

# 5. Train the model
model.fit(X_train, y_train)

# 6. Cross-validation
cv_scores = cross_val_score(model, X, y, cv=5, scoring="accuracy")
print(f"\nCross-Validation Accuracy: {cv_scores.mean():.4f} (+/- {cv_scores.std():.4f})")

# 7. Test set evaluation
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)

print(f"\nTest Accuracy: {accuracy:.4f}")

print("\nClassification Report:")
print(classification_report(y_test, y_pred, target_names=["Genuine", "Fraud"]))

print("Confusion Matrix:")
print(confusion_matrix(y_test, y_pred))

# 8. Feature importance
print("\nFeature Importance:")
for feature, importance in sorted(
    zip(X.columns, model.feature_importances_),
    key=lambda x: x[1],
    reverse=True
):
    print(f"  {feature}: {importance:.4f}")

# 9. Save the trained model
joblib.dump(model, "land_fraud_model.pkl")

print("\nModel saved as land_fraud_model.pkl")