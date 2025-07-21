from typing import Tuple

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
from typing_extensions import Annotated

from zenml import pipeline, step

@step
def create_dataset() -> Tuple[
    Annotated[np.ndarray, "X_train"],
    Annotated[np.ndarray, "X_test"],
    Annotated[np.ndarray, "y_train"],
    Annotated[np.ndarray, "y_test"],
]:
    """Generate a simple classification dataset."""
    print("Creating dataset...")
    X, y = make_classification(
        n_samples=1000, n_features=10, n_classes=2, random_state=42
    )
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    return X_train, X_test, y_train, y_test

@step
def train_model(
    X_train: np.ndarray, y_train: np.ndarray
) -> RandomForestClassifier:
    """Train a simple sklearn model."""
    print("Training model...")
    model = RandomForestClassifier(n_estimators=10, random_state=42)
    model.fit(X_train, y_train)
    return model

@step
def evaluate_model(
    model: RandomForestClassifier, X_test: np.ndarray, y_test: np.ndarray
) -> Annotated[float, "accuracy"]:
    """Evaluate the model accuracy."""
    print("Evaluating model...")
    predictions = model.predict(X_test)
    accuracy = accuracy_score(y_test, predictions)
    print(f"Model Accuracy: {accuracy:.2%}")
    return accuracy

@pipeline
def simple_ml_pipeline():
    """A simple pipeline that trains and evaluates a classifier."""
    print("Starting ML pipeline...")
    X_train, X_test, y_train, y_test = create_dataset()
    model = train_model(X_train, y_train)
    evaluate_model(model, X_test, y_test)
    print("ML pipeline finished.")

if __name__ == "__main__":
    print("Executing ZenML pipeline...")
    simple_ml_pipeline()
