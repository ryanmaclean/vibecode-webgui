# MLOps Best Practices Guide

Production-ready machine learning operations for the Unified Services VM.

---

## Table of Contents

1. [Introduction](#introduction)
2. [MLOps Principles](#mlops-principles)
3. [Development Workflow](#development-workflow)
4. [Experiment Tracking](#experiment-tracking)
5. [Model Versioning](#model-versioning)
6. [Model Deployment](#model-deployment)
7. [Monitoring and Observability](#monitoring-and-observability)
8. [Model Performance](#model-performance)
9. [Data Management](#data-management)
10. [Testing and Validation](#testing-and-validation)
11. [CI/CD for ML](#cicd-for-ml)
12. [Security and Compliance](#security-and-compliance)

---

## Introduction

MLOps (Machine Learning Operations) combines ML, DevOps, and Data Engineering to deploy and maintain ML systems in production reliably and efficiently.

### Why MLOps Matters

- **Reproducibility**: Track every experiment and model version
- **Reliability**: Ensure models work consistently in production
- **Scalability**: Handle increasing data and traffic
- **Governance**: Meet compliance and audit requirements
- **Collaboration**: Enable teams to work together effectively

### Key Challenges

1. Model drift (data changes over time)
2. Training-serving skew (differences between environments)
3. Resource management (compute and storage)
4. Model debugging (understanding failures)
5. Monitoring (detecting issues early)

---

## MLOps Principles

### 1. Version Everything

**What to Version**:
- Code (git)
- Data (DVC, git-lfs)
- Models (MLflow, model registry)
- Configurations (YAML, JSON)
- Environment (Docker, requirements.txt)

**Example**:
```python
# requirements.txt with pinned versions
torch==2.1.0
scikit-learn==1.3.0
mlflow==2.8.0
psycopg2-binary==2.9.9
```

### 2. Automate Everything

**What to Automate**:
- Data validation and preprocessing
- Model training and evaluation
- Model deployment and rollback
- Monitoring and alerting
- Testing and validation

### 3. Monitor Continuously

**What to Monitor**:
- Model performance (accuracy, latency)
- Data quality (drift, anomalies)
- System health (CPU, memory, disk)
- Business metrics (conversions, revenue)

### 4. Test Rigorously

**What to Test**:
- Unit tests (functions work correctly)
- Integration tests (components work together)
- Model tests (predictions are reasonable)
- Data tests (inputs are valid)
- Performance tests (latency under load)

---

## Development Workflow

### Local Development

```bash
# 1. Create virtual environment
python -m venv ml-env
source ml-env/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Develop in JupyterLab
jupyter lab

# 4. Track experiments with MLflow
mlflow ui --host 0.0.0.0 --port 5000
```

### Experiment Workflow

```
┌─────────────────────────────────────────────┐
│          Experiment Lifecycle               │
├─────────────────────────────────────────────┤
│                                             │
│  1. Data Preparation                        │
│     ↓                                       │
│  2. Feature Engineering                     │
│     ↓                                       │
│  3. Model Training                          │
│     ↓                                       │
│  4. Evaluation & Comparison                 │
│     ↓                                       │
│  5. Model Selection                         │
│     ↓                                       │
│  6. Model Registry                          │
│     ↓                                       │
│  7. Deployment                              │
│     ↓                                       │
│  8. Monitoring                              │
│     ↓                                       │
│  9. Iteration (back to step 1)             │
│                                             │
└─────────────────────────────────────────────┘
```

### Git Workflow

```bash
# 1. Create feature branch
git checkout -b feature/new-model

# 2. Develop and test
jupyter lab  # Experiment
git add .
git commit -m "feat: improve model accuracy"

# 3. Push and create PR
git push origin feature/new-model
# Create pull request for review

# 4. Merge to main after approval
git checkout main
git merge feature/new-model

# 5. Deploy from main
./deploy-model.sh
```

---

## Experiment Tracking

### MLflow Tracking Best Practices

#### 1. Organize Experiments

```python
import mlflow

# Create experiment per use case
mlflow.set_experiment("customer-churn-prediction")

# Use nested runs for hyperparameter tuning
with mlflow.start_run(run_name="xgboost-tuning"):
    for lr in [0.01, 0.05, 0.1]:
        with mlflow.start_run(run_name=f"lr_{lr}", nested=True):
            model = train_model(learning_rate=lr)
            mlflow.log_param("learning_rate", lr)
            mlflow.log_metric("accuracy", evaluate(model))
```

#### 2. Log Comprehensive Metadata

```python
with mlflow.start_run():
    # Log parameters
    mlflow.log_param("model_type", "RandomForest")
    mlflow.log_param("n_estimators", 100)
    mlflow.log_param("max_depth", 10)

    # Log metrics
    mlflow.log_metric("train_accuracy", 0.95)
    mlflow.log_metric("val_accuracy", 0.93)
    mlflow.log_metric("test_accuracy", 0.92)

    # Log additional metrics by step
    for epoch in range(50):
        mlflow.log_metric("loss", loss, step=epoch)

    # Log artifacts
    mlflow.log_artifact("confusion_matrix.png")
    mlflow.log_artifact("feature_importance.csv")

    # Log model
    mlflow.sklearn.log_model(model, "model")

    # Log dataset info
    mlflow.log_param("dataset_size", len(X_train))
    mlflow.log_param("features", list(X_train.columns))

    # Log environment
    mlflow.log_param("python_version", sys.version)
    mlflow.log_param("sklearn_version", sklearn.__version__)
```

#### 3. Compare Experiments

```python
# Query runs
from mlflow.tracking import MlflowClient

client = MlflowClient()
experiment = client.get_experiment_by_name("customer-churn")

# Get all runs sorted by metric
runs = client.search_runs(
    experiment_ids=[experiment.experiment_id],
    order_by=["metrics.accuracy DESC"],
    max_results=10
)

# Print top runs
for run in runs:
    print(f"Run {run.info.run_id}:")
    print(f"  Accuracy: {run.data.metrics['accuracy']:.4f}")
    print(f"  Model: {run.data.params['model_type']}")
```

### Experiment Organization

```
experiments/
├── customer-churn/
│   ├── 01-baseline/
│   │   ├── run-001-logistic-regression/
│   │   ├── run-002-decision-tree/
│   │   └── run-003-random-forest/
│   ├── 02-feature-engineering/
│   │   ├── run-101-pca/
│   │   └── run-102-polynomial/
│   └── 03-hyperparameter-tuning/
│       ├── run-201-grid-search/
│       └── run-202-random-search/
```

---

## Model Versioning

### Semantic Versioning for Models

Use semantic versioning: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes (different input/output format)
- **MINOR**: New features (added capabilities)
- **PATCH**: Bug fixes (improved accuracy)

**Example**: `v1.2.3`

### Model Registry Stages

```python
import mlflow
from mlflow.tracking import MlflowClient

client = MlflowClient()

# Register model
model_uri = f"runs:/{run.info.run_id}/model"
mv = mlflow.register_model(model_uri, "customer-churn-model")

# Transition to staging
client.transition_model_version_stage(
    name="customer-churn-model",
    version=mv.version,
    stage="Staging"
)

# After testing, promote to production
client.transition_model_version_stage(
    name="customer-churn-model",
    version=mv.version,
    stage="Production"
)

# Archive old versions
client.transition_model_version_stage(
    name="customer-churn-model",
    version=old_version,
    stage="Archived"
)
```

### Model Metadata

```python
# Add description
client.update_model_version(
    name="customer-churn-model",
    version=mv.version,
    description="Improved model with feature engineering"
)

# Add tags
client.set_model_version_tag(
    name="customer-churn-model",
    version=mv.version,
    key="dataset",
    value="2024-Q1"
)

client.set_model_version_tag(
    name="customer-churn-model",
    version=mv.version,
    key="approved_by",
    value="data-science-team"
)
```

---

## Model Deployment

### Deployment Strategies

#### 1. Blue-Green Deployment

```python
# Keep two versions running
# Switch traffic all at once

# Deploy new version (green)
deploy_model(version="v2", environment="green")

# Test green
if test_green_environment():
    # Switch traffic
    route_traffic(target="green")
    # Keep blue as backup
else:
    # Rollback
    route_traffic(target="blue")
```

#### 2. Canary Deployment

```python
# Gradually increase traffic to new version

# Deploy new version with 5% traffic
deploy_model(version="v2", traffic_percentage=5)
monitor_metrics(duration="1 hour")

if metrics_look_good():
    # Increase to 20%
    update_traffic(version="v2", percentage=20)
    monitor_metrics(duration="2 hours")

    if still_good():
        # Increase to 100%
        update_traffic(version="v2", percentage=100)
```

#### 3. A/B Testing

```python
# Run two versions simultaneously for comparison

# Deploy both versions
deploy_model(version="v1", traffic=50)
deploy_model(version="v2", traffic=50)

# Collect metrics for both
metrics_v1 = collect_metrics("v1", days=7)
metrics_v2 = collect_metrics("v2", days=7)

# Compare performance
if metrics_v2.accuracy > metrics_v1.accuracy:
    promote_to_production("v2")
```

### Deployment Checklist

- [ ] Model tested on validation set
- [ ] Model tested on held-out test set
- [ ] Model registered in MLflow
- [ ] Model approved by stakeholders
- [ ] Deployment pipeline configured
- [ ] Monitoring and alerts set up
- [ ] Rollback procedure documented
- [ ] Load testing completed
- [ ] Documentation updated
- [ ] Team notified

### FastAPI Model Server Template

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import mlflow.pyfunc
import logging

app = FastAPI()

# Load model at startup
model = None
model_version = None

@app.on_event("startup")
async def load_model():
    global model, model_version
    model_version = "production"
    model_uri = f"models:/customer-churn-model/{model_version}"
    model = mlflow.pyfunc.load_model(model_uri)
    logging.info(f"Loaded model version: {model_version}")

class PredictionRequest(BaseModel):
    features: list

class PredictionResponse(BaseModel):
    prediction: float
    probability: float
    model_version: str
    latency_ms: float

@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    import time
    start = time.time()

    try:
        # Make prediction
        prediction = model.predict([request.features])[0]
        probability = prediction  # For binary classification

        latency = (time.time() - start) * 1000

        return PredictionResponse(
            prediction=float(prediction > 0.5),
            probability=float(probability),
            model_version=model_version,
            latency_ms=latency
        )
    except Exception as e:
        logging.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "model_version": model_version
    }

@app.post("/reload")
async def reload_model():
    """Reload model without restarting server"""
    await load_model()
    return {"status": "reloaded", "version": model_version}
```

---

## Monitoring and Observability

### What to Monitor

#### 1. Model Performance

```python
import psycopg2
from datetime import datetime

def log_prediction(prediction, actual, features):
    """Log predictions for monitoring"""
    conn = psycopg2.connect("postgresql://postgres@localhost:5432/mlops")
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO predictions
        (timestamp, prediction, actual, features, model_version)
        VALUES (%s, %s, %s, %s, %s)
    """, (datetime.now(), prediction, actual, features, "v1.2.3"))

    conn.commit()
    conn.close()

def calculate_rolling_accuracy(window_size=1000):
    """Calculate accuracy over recent predictions"""
    conn = psycopg2.connect("postgresql://postgres@localhost:5432/mlops")
    cursor = conn.cursor()

    cursor.execute(f"""
        SELECT AVG(CASE WHEN prediction = actual THEN 1 ELSE 0 END) as accuracy
        FROM (
            SELECT prediction, actual
            FROM predictions
            ORDER BY timestamp DESC
            LIMIT {window_size}
        ) recent
    """)

    accuracy = cursor.fetchone()[0]
    conn.close()

    return accuracy
```

#### 2. Data Drift Detection

```python
import numpy as np
from scipy.stats import ks_2samp

def detect_drift(training_data, production_data, threshold=0.05):
    """
    Detect data drift using Kolmogorov-Smirnov test
    """
    drifted_features = []

    for col in training_data.columns:
        train_col = training_data[col]
        prod_col = production_data[col]

        # KS test
        statistic, p_value = ks_2samp(train_col, prod_col)

        if p_value < threshold:
            drifted_features.append({
                'feature': col,
                'p_value': p_value,
                'statistic': statistic
            })

    return drifted_features

# Usage
drifted = detect_drift(train_df, prod_df)
if drifted:
    print(f"⚠ Drift detected in {len(drifted)} features:")
    for feature in drifted:
        print(f"  - {feature['feature']} (p={feature['p_value']:.4f})")
```

#### 3. Model Drift Detection

```python
def detect_model_drift(baseline_accuracy, current_accuracy, threshold=0.05):
    """
    Alert if model performance drops significantly
    """
    drop = baseline_accuracy - current_accuracy

    if drop > threshold:
        return {
            'drift_detected': True,
            'baseline': baseline_accuracy,
            'current': current_accuracy,
            'drop': drop
        }

    return {'drift_detected': False}

# Usage
baseline = 0.95
current = calculate_rolling_accuracy()
drift = detect_model_drift(baseline, current)

if drift['drift_detected']:
    print(f"⚠ Model drift detected!")
    print(f"  Baseline: {drift['baseline']:.2%}")
    print(f"  Current: {drift['current']:.2%}")
    print(f"  Drop: {drift['drop']:.2%}")
    # Trigger alert or retraining
```

### Monitoring Dashboard

Create a monitoring dashboard with key metrics:

```sql
-- Create monitoring tables
CREATE TABLE model_metrics (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    model_version VARCHAR(50),
    metric_name VARCHAR(100),
    metric_value FLOAT,
    dataset VARCHAR(50)
);

CREATE TABLE predictions_log (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    model_version VARCHAR(50),
    input_features JSONB,
    prediction FLOAT,
    actual FLOAT,
    latency_ms FLOAT
);

-- Query for dashboard
-- Average accuracy over time
SELECT
    DATE_TRUNC('hour', timestamp) as hour,
    AVG(CASE WHEN prediction = actual THEN 1 ELSE 0 END) as accuracy
FROM predictions_log
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour;

-- Latency percentiles
SELECT
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency_ms) as p50,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) as p99
FROM predictions_log
WHERE timestamp > NOW() - INTERVAL '1 hour';
```

---

## Model Performance

### Performance Optimization

#### 1. Model Optimization

```python
# Quantization (reduce precision)
import torch

# FP32 → FP16
model_fp16 = model.half()

# FP32 → INT8
model_int8 = torch.quantization.quantize_dynamic(
    model, {torch.nn.Linear}, dtype=torch.qint8
)

# Benchmark
import time

def benchmark(model, inputs, iterations=1000):
    start = time.time()
    for _ in range(iterations):
        _ = model(inputs)
    elapsed = time.time() - start
    return elapsed / iterations * 1000  # ms

latency_fp32 = benchmark(model, test_input)
latency_fp16 = benchmark(model_fp16, test_input)
print(f"FP32: {latency_fp32:.2f}ms")
print(f"FP16: {latency_fp16:.2f}ms")
print(f"Speedup: {latency_fp32/latency_fp16:.2f}x")
```

#### 2. Batch Processing

```python
# Instead of processing one at a time
def predict_single(inputs):
    for input in inputs:
        prediction = model.predict([input])
        yield prediction

# Batch process for better throughput
def predict_batch(inputs, batch_size=32):
    for i in range(0, len(inputs), batch_size):
        batch = inputs[i:i+batch_size]
        predictions = model.predict(batch)
        yield from predictions
```

#### 3. Caching

```python
import redis
import hashlib
import pickle

r = redis.Redis(host='localhost', port=6379)

def cached_predict(features, ttl=3600):
    """Cache predictions for repeated inputs"""
    # Generate cache key
    key = hashlib.md5(str(features).encode()).hexdigest()
    cache_key = f"pred:{key}"

    # Check cache
    cached = r.get(cache_key)
    if cached:
        return pickle.loads(cached)

    # Compute prediction
    prediction = model.predict([features])[0]

    # Cache result
    r.setex(cache_key, ttl, pickle.dumps(prediction))

    return prediction
```

#### 4. ONNX Export

```python
import torch.onnx

# Export PyTorch model to ONNX
dummy_input = torch.randn(1, input_dim)
torch.onnx.export(
    model,
    dummy_input,
    "model.onnx",
    export_params=True,
    opset_version=11,
    input_names=['input'],
    output_names=['output']
)

# Use ONNX Runtime for inference
import onnxruntime as ort

session = ort.InferenceSession("model.onnx")
input_name = session.get_inputs()[0].name

def predict_onnx(features):
    result = session.run(None, {input_name: features})
    return result[0]

# Compare performance
latency_pytorch = benchmark(model, test_input)
latency_onnx = benchmark(predict_onnx, test_input)
print(f"PyTorch: {latency_pytorch:.2f}ms")
print(f"ONNX: {latency_onnx:.2f}ms")
print(f"Speedup: {latency_pytorch/latency_onnx:.2f}x")
```

---

## Data Management

### Data Versioning

```bash
# Use DVC (Data Version Control)
pip install dvc

# Initialize
dvc init

# Track data
dvc add data/train.csv
git add data/train.csv.dvc .gitignore
git commit -m "Add training data"

# Push to remote storage
dvc remote add -d storage s3://my-bucket/data
dvc push

# Pull specific version
git checkout v1.0
dvc pull
```

### Data Quality Checks

```python
import pandas as pd

def validate_data(df):
    """Run data quality checks"""
    issues = []

    # Check for missing values
    missing = df.isnull().sum()
    if missing.any():
        issues.append(f"Missing values: {missing[missing > 0].to_dict()}")

    # Check for duplicates
    duplicates = df.duplicated().sum()
    if duplicates > 0:
        issues.append(f"Duplicate rows: {duplicates}")

    # Check data types
    for col in df.columns:
        if df[col].dtype == 'object':
            unique_ratio = df[col].nunique() / len(df)
            if unique_ratio > 0.5:
                issues.append(f"High cardinality: {col} ({unique_ratio:.2%})")

    # Check value ranges
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        if (df[col] < 0).any():
            issues.append(f"Negative values in {col}")

    return issues

# Usage
issues = validate_data(train_df)
if issues:
    print("⚠ Data quality issues found:")
    for issue in issues:
        print(f"  - {issue}")
```

### Feature Store

```python
# Store features in PostgreSQL
def store_features(user_id, features, timestamp=None):
    """Store computed features"""
    import psycopg2
    from datetime import datetime

    conn = psycopg2.connect("postgresql://postgres@localhost:5432/features")
    cursor = conn.cursor()

    timestamp = timestamp or datetime.now()

    cursor.execute("""
        INSERT INTO user_features
        (user_id, features, timestamp)
        VALUES (%s, %s, %s)
        ON CONFLICT (user_id) DO UPDATE
        SET features = EXCLUDED.features,
            timestamp = EXCLUDED.timestamp
    """, (user_id, features, timestamp))

    conn.commit()
    conn.close()

def get_features(user_id):
    """Retrieve features for inference"""
    conn = psycopg2.connect("postgresql://postgres@localhost:5432/features")
    cursor = conn.cursor()

    cursor.execute("""
        SELECT features, timestamp
        FROM user_features
        WHERE user_id = %s
    """, (user_id,))

    result = cursor.fetchone()
    conn.close()

    return result if result else (None, None)
```

---

## Testing and Validation

### Unit Tests

```python
import pytest
import numpy as np

def test_model_predictions():
    """Test model produces valid predictions"""
    # Load model
    model = load_model()

    # Test input
    test_input = np.random.rand(1, 10)

    # Make prediction
    prediction = model.predict(test_input)

    # Assertions
    assert prediction is not None
    assert len(prediction) == 1
    assert 0 <= prediction[0] <= 1  # For binary classification

def test_prediction_latency():
    """Test inference latency"""
    model = load_model()
    test_input = np.random.rand(1, 10)

    import time
    start = time.time()
    prediction = model.predict(test_input)
    latency = (time.time() - start) * 1000

    # Should be < 100ms
    assert latency < 100, f"Latency too high: {latency:.2f}ms"

def test_data_preprocessing():
    """Test preprocessing pipeline"""
    raw_data = {"age": 25, "income": 50000}
    processed = preprocess(raw_data)

    assert "age_normalized" in processed
    assert "income_log" in processed
    assert not np.isnan(processed["age_normalized"])
```

### Integration Tests

```python
import requests

def test_model_api():
    """Test model serving API"""
    # Start server (in separate process)
    # or assume it's already running

    # Test health endpoint
    response = requests.get("http://localhost:8000/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

    # Test prediction endpoint
    payload = {
        "features": [1.0, 2.0, 3.0, 4.0, 5.0]
    }
    response = requests.post(
        "http://localhost:8000/predict",
        json=payload
    )

    assert response.status_code == 200
    result = response.json()
    assert "prediction" in result
    assert "latency_ms" in result
    assert result["latency_ms"] < 100
```

### Model Validation

```python
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from sklearn.metrics import confusion_matrix, classification_report

def validate_model(model, X_test, y_test):
    """Comprehensive model validation"""
    # Make predictions
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    # Calculate metrics
    metrics = {
        'accuracy': accuracy_score(y_test, y_pred),
        'precision': precision_score(y_test, y_pred),
        'recall': recall_score(y_test, y_pred),
        'f1': f1_score(y_test, y_pred)
    }

    # Confusion matrix
    cm = confusion_matrix(y_test, y_pred)

    # Classification report
    report = classification_report(y_test, y_pred)

    # Check thresholds
    assert metrics['accuracy'] >= 0.85, "Accuracy too low"
    assert metrics['precision'] >= 0.80, "Precision too low"
    assert metrics['recall'] >= 0.80, "Recall too low"

    return metrics, cm, report
```

---

## CI/CD for ML

### Pipeline Stages

```yaml
# .gitlab-ci.yml or .github/workflows/ml-pipeline.yml

stages:
  - data
  - train
  - evaluate
  - deploy

data_validation:
  stage: data
  script:
    - python scripts/validate_data.py
    - python scripts/check_drift.py

model_training:
  stage: train
  script:
    - python scripts/train_model.py
    - python scripts/log_to_mlflow.py
  artifacts:
    paths:
      - models/

model_evaluation:
  stage: evaluate
  script:
    - python scripts/evaluate_model.py
    - python scripts/compare_with_baseline.py
  only:
    - main

deploy_staging:
  stage: deploy
  script:
    - python scripts/deploy_to_staging.py
  environment:
    name: staging
  only:
    - main

deploy_production:
  stage: deploy
  script:
    - python scripts/deploy_to_production.py
  environment:
    name: production
  when: manual
  only:
    - main
```

### Automated Retraining

```python
#!/usr/bin/env python3
"""
Automated model retraining pipeline
Runs daily to retrain model with latest data
"""
import mlflow
from datetime import datetime, timedelta

def should_retrain():
    """Check if model needs retraining"""
    # Get current model metrics
    current_accuracy = get_production_accuracy()

    # Get baseline
    baseline = 0.90

    # Check drift
    if current_accuracy < baseline - 0.05:
        return True, "Performance degradation"

    # Check data staleness
    last_train_date = get_last_training_date()
    days_since_train = (datetime.now() - last_train_date).days

    if days_since_train > 7:
        return True, "Data staleness"

    return False, None

def retrain_pipeline():
    """Full retraining pipeline"""
    # 1. Fetch latest data
    data = fetch_latest_data()

    # 2. Validate data
    if not validate_data(data):
        raise ValueError("Data validation failed")

    # 3. Train model
    with mlflow.start_run():
        model = train_model(data)

        # 4. Evaluate
        metrics = evaluate_model(model)

        # 5. Compare with production
        if metrics['accuracy'] > get_production_accuracy():
            # Register new model
            mlflow.register_model("model", "production-model")

            # Deploy
            deploy_model(model, environment="staging")

            # Notify team
            send_notification(
                "New model deployed to staging",
                metrics=metrics
            )

if __name__ == "__main__":
    should_retrain, reason = should_retrain()
    if should_retrain:
        print(f"Retraining triggered: {reason}")
        retrain_pipeline()
    else:
        print("No retraining needed")
```

---

## Security and Compliance

### Security Best Practices

#### 1. Authentication

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify API token"""
    token = credentials.credentials

    # Verify against database or secret manager
    if not is_valid_token(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

    return token

@app.post("/predict")
async def predict(
    request: PredictionRequest,
    token: str = Depends(verify_token)
):
    # Only authenticated requests reach here
    return make_prediction(request)
```

#### 2. Input Validation

```python
from pydantic import BaseModel, validator, conlist, confloat

class PredictionRequest(BaseModel):
    features: conlist(float, min_items=10, max_items=10)

    @validator('features')
    def validate_features(cls, v):
        # Check for NaN/Inf
        if any(np.isnan(v)) or any(np.isinf(v)):
            raise ValueError("Features contain NaN or Inf")

        # Check ranges
        if any(x < 0 or x > 1000 for x in v):
            raise ValueError("Features out of expected range")

        return v
```

#### 3. Model Encryption

```python
from cryptography.fernet import Fernet

def encrypt_model(model_path, key_path):
    """Encrypt model file"""
    # Generate key
    key = Fernet.generate_key()
    with open(key_path, 'wb') as f:
        f.write(key)

    # Encrypt model
    fernet = Fernet(key)
    with open(model_path, 'rb') as f:
        model_data = f.read()

    encrypted = fernet.encrypt(model_data)

    with open(f"{model_path}.encrypted", 'wb') as f:
        f.write(encrypted)

def decrypt_model(encrypted_path, key_path):
    """Decrypt model file"""
    with open(key_path, 'rb') as f:
        key = f.read()

    fernet = Fernet(key)

    with open(encrypted_path, 'rb') as f:
        encrypted_data = f.read()

    decrypted = fernet.decrypt(encrypted_data)

    return decrypted
```

### Compliance

#### GDPR Compliance

```python
def delete_user_data(user_id):
    """Delete all user data (right to be forgotten)"""
    conn = psycopg2.connect("postgresql://postgres@localhost:5432/mlops")
    cursor = conn.cursor()

    # Delete from all tables
    tables = ['predictions_log', 'user_features', 'training_data']

    for table in tables:
        cursor.execute(f"DELETE FROM {table} WHERE user_id = %s", (user_id,))

    conn.commit()
    conn.close()

    # Log deletion
    audit_log(f"Deleted all data for user {user_id}")
```

#### Audit Trail

```python
def audit_log(action, user=None, details=None):
    """Log all model operations for audit"""
    conn = psycopg2.connect("postgresql://postgres@localhost:5432/mlops")
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO audit_log
        (timestamp, action, user, details, ip_address)
        VALUES (NOW(), %s, %s, %s, %s)
    """, (action, user, details, get_client_ip()))

    conn.commit()
    conn.close()

# Usage
audit_log("model_deployed", user="data-scientist", details={"version": "v2.0"})
audit_log("prediction_made", user="api-key-123", details={"latency": 45})
```

---

## Summary

### Key Takeaways

1. **Version Everything**: Code, data, models, configs
2. **Automate**: Training, testing, deployment, monitoring
3. **Monitor Continuously**: Performance, drift, system health
4. **Test Rigorously**: Unit, integration, model validation
5. **Secure**: Authentication, encryption, audit trails

### MLOps Maturity Levels

**Level 0**: Manual everything
- No automation
- No versioning
- No monitoring

**Level 1**: Basic automation
- Automated training
- Version control for code
- Basic monitoring

**Level 2**: Intermediate MLOps
- CI/CD pipelines
- Experiment tracking
- Model registry
- Automated testing

**Level 3**: Advanced MLOps (Goal)
- Automated retraining
- A/B testing
- Drift detection
- Full observability

### Next Steps

1. Implement experiment tracking with MLflow
2. Set up model registry and versioning
3. Create deployment pipeline
4. Add monitoring and alerting
5. Automate retraining

---

**Last Updated**: 2026-01-05
**Version**: 1.0.0

---

*Build reliable and scalable ML systems with MLOps best practices.*
