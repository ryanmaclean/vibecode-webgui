# ML/AI Stack Quick Start Guide

Get up and running with the ML/AI infrastructure in minutes.

---

## Prerequisites

- Unified Services VM running (PostgreSQL, Valkey, OpenVSCode, SSH)
- 4GB RAM minimum (8GB recommended for ML workloads)
- 10GB free disk space

---

## Installation

### Option 1: Build from Source

```bash
cd /path/to/vibecode-webgui/azure
./ml-stack-setup.sh
```

This will create `ml-ai-stack.cpio.gz` with all ML components.

### Option 2: Use Pre-built Package

```bash
# Download pre-built ML stack
wget https://github.com/your-repo/releases/ml-ai-stack.cpio.gz

# Or use existing build
cp azure/ml-ai-stack.cpio.gz /tmp/
```

### Option 3: Integrated Build

For a complete VM with ML stack:

```bash
cd azure

# Build unified services first (if not already done)
./build-unified-services-with-datadog.sh

# Then merge with ML stack
./integrate-ml-stack.sh
```

---

## Starting the Services

### Automatic Startup

If integrated into the VM, services start automatically:

```bash
# Boot the VM with ML stack
vfkit \
  --cpus 4 \
  --memory 4096 \
  --kernel kernel/vmlinux \
  --initrd unified-services-ml-complete.cpio.gz \
  --device virtio-net,nat \
  --device virtio-rng
```

### Manual Startup

If running services separately:

```bash
# SSH into the VM
ssh root@<VM_IP>

# Start ML services
/usr/local/bin/start-ml-services.sh
```

This starts:
- JupyterLab on port 8888
- Model Server on port 8000
- MLflow on port 5000

---

## Verify Installation

### 1. Check Service Status

```bash
# Check if services are running
netstat -tulpn | grep -E '8888|8000|5000'

# Expected output:
# tcp 0.0.0.0:8888 (JupyterLab)
# tcp 0.0.0.0:8000 (Model Server)
# tcp 0.0.0.0:5000 (MLflow)
```

### 2. Test JupyterLab

Open in browser: `http://<VM_IP>:8888`

You should see the JupyterLab interface with sample notebooks.

### 3. Test Model Server

```bash
curl http://<VM_IP>:8000/
# Expected: {"status": "healthy", "service": "ML Model Server"}
```

### 4. Test MLflow

Open in browser: `http://<VM_IP>:5000`

You should see the MLflow tracking UI.

### 5. Test pgvector

```bash
# SSH into VM
ssh root@<VM_IP>

# Connect to PostgreSQL
psql -U postgres -d postgres

# Check pgvector
\dx vector

# Expected: vector extension installed
```

---

## Quick Examples

### Example 1: Vector Similarity Search (5 minutes)

1. Open JupyterLab: `http://<VM_IP>:8888`
2. Open notebook: `02-pgvector-semantic-search.ipynb`
3. Run all cells (Cell → Run All)
4. You should see:
   - pgvector extension installed
   - Documents table created
   - Similarity search results
   - Query performance metrics

### Example 2: Train a Model (10 minutes)

1. Open notebook: `03-pytorch-training.ipynb`
2. Run all cells
3. You should see:
   - PyTorch model training
   - MLflow tracking logs
   - Model saved to disk
   - Test accuracy results

4. View in MLflow:
   - Open `http://<VM_IP>:5000`
   - Click on "pytorch-classification" experiment
   - See your training run with metrics

### Example 3: Model Serving (5 minutes)

1. Test the model server:

```bash
# Health check
curl http://<VM_IP>:8000/

# List models
curl http://<VM_IP>:8000/models

# Make a prediction (example)
curl -X POST http://<VM_IP>:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "model_name": "test",
    "inputs": [[1.0, 2.0, 3.0, 4.0, 5.0]]
  }'
```

Expected response:
```json
{
  "predictions": [0.75],
  "model_name": "test",
  "latency_ms": 5.2
}
```

---

## Common Tasks

### Install a Python Package

```bash
# SSH into VM
ssh root@<VM_IP>

# Activate ML environment
source /opt/ml-env/bin/activate

# Install package
pip install transformers

# Verify
python -c "import transformers; print(transformers.__version__)"
```

### Create a New Notebook

1. Open JupyterLab: `http://<VM_IP>:8888`
2. Click "+" button (New Launcher)
3. Click "Python 3" under "Notebook"
4. Start coding!

### Load a Pre-trained Model

```python
import torch
from transformers import AutoModel, AutoTokenizer

# Load model (will download first time)
model_name = "sentence-transformers/all-MiniLM-L6-v2"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModel.from_pretrained(model_name)

# Generate embeddings
text = "Hello, world!"
inputs = tokenizer(text, return_tensors="pt")
outputs = model(**inputs)
embeddings = outputs.last_hidden_state.mean(dim=1)

print(f"Embedding shape: {embeddings.shape}")
```

### Store Embeddings in pgvector

```python
import psycopg2
import numpy as np

# Connect to PostgreSQL
conn = psycopg2.connect(
    host="localhost",
    port=5432,
    user="postgres",
    dbname="postgres"
)
cursor = conn.cursor()

# Create table
cursor.execute("""
CREATE TABLE IF NOT EXISTS embeddings (
    id SERIAL PRIMARY KEY,
    text TEXT,
    embedding vector(384)
);
""")

# Insert embedding
text = "Sample text"
embedding = embeddings[0].detach().numpy().tolist()
cursor.execute(
    "INSERT INTO embeddings (text, embedding) VALUES (%s, %s)",
    (text, embedding)
)
conn.commit()

print("✓ Embedding stored")
```

### Track Experiments with MLflow

```python
import mlflow
import mlflow.pytorch

# Configure
mlflow.set_tracking_uri("http://localhost:5000")
mlflow.set_experiment("my-experiment")

# Start run
with mlflow.start_run():
    # Your training code
    model = train_model()

    # Log parameters
    mlflow.log_param("learning_rate", 0.001)
    mlflow.log_param("batch_size", 32)

    # Log metrics
    mlflow.log_metric("accuracy", 0.95)
    mlflow.log_metric("loss", 0.05)

    # Log model
    mlflow.pytorch.log_model(model, "model")

print("✓ Experiment tracked")
```

---

## Access Credentials

All services are accessible with default credentials:

| Service | URL | Username | Password |
|---------|-----|----------|----------|
| SSH | ssh root@<VM_IP> | root | vibecode |
| PostgreSQL | postgresql://<VM_IP>:5432 | postgres | (trust auth) |
| Valkey | redis://<VM_IP>:6379 | - | (no password) |
| JupyterLab | http://<VM_IP>:8888 | - | (no token) |
| Model Server | http://<VM_IP>:8000 | - | (no auth) |
| MLflow | http://<VM_IP>:5000 | - | (no auth) |

**Note**: These are development defaults. Enable authentication for production.

---

## Troubleshooting

### JupyterLab Not Starting

```bash
# Check logs
ssh root@<VM_IP>
cat /tmp/jupyter.log

# Restart manually
cd /opt/jupyter/notebooks
/opt/ml-env/bin/jupyter lab \
  --config=/opt/jupyter/config/jupyter_lab_config.py
```

### Model Server Not Responding

```bash
# Check logs
cat /tmp/model-server.log

# Restart manually
/opt/ml-env/bin/python /opt/ml-serving/model_server.py
```

### pgvector Extension Not Found

```bash
# Install extension
psql -U postgres -d postgres
CREATE EXTENSION vector;

# If error, may need to build pgvector
# See AGENT-AC-ML-AI-INFRASTRUCTURE.md for build instructions
```

### Python Package Import Error

```bash
# Verify ML environment
source /opt/ml-env/bin/activate
python -c "import torch; import sklearn; print('OK')"

# If error, reinstall packages
pip install --upgrade torch scikit-learn
```

### Out of Memory

```bash
# Check memory usage
free -h

# Reduce JupyterLab memory if needed
# Edit /opt/jupyter/config/jupyter_lab_config.py
# Add: c.ServerApp.ResourceUseDisplay.mem_limit = 2147483648  # 2GB

# Restart JupyterLab
pkill -f jupyter
cd /opt/jupyter/notebooks
/opt/ml-env/bin/jupyter lab --config=/opt/jupyter/config/jupyter_lab_config.py &
```

---

## Performance Tips

### Optimize Vector Search

```sql
-- Increase index lists for better recall
DROP INDEX documents_embedding_idx;
CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 1000);  -- Increase from 100

-- Analyze table for better query plans
ANALYZE documents;
```

### Enable Model Caching

```python
import redis

r = redis.Redis(host='localhost', port=6379)

def cached_predict(model_name, inputs):
    cache_key = f"{model_name}:{hash(str(inputs))}"

    # Check cache
    cached = r.get(cache_key)
    if cached:
        return cached

    # Compute prediction
    prediction = model.predict(inputs)

    # Cache for 1 hour
    r.setex(cache_key, 3600, prediction)

    return prediction
```

### Batch Processing

```python
# Instead of this (slow):
for input in inputs:
    prediction = model.predict([input])

# Do this (fast):
predictions = model.predict(inputs)  # Batch all at once
```

---

## Next Steps

1. **Read Full Documentation**: See AGENT-AC-ML-AI-INFRASTRUCTURE.md
2. **Learn MLOps Best Practices**: See AGENT-AC-MLOPS-GUIDE.md
3. **Explore Sample Notebooks**: Run all notebooks in /opt/jupyter/notebooks/
4. **Deploy Your Model**: Use FastAPI server template
5. **Monitor Performance**: Set up metrics and logging

---

## Common Use Cases

### Use Case 1: Semantic Search

**Goal**: Find similar documents by meaning, not keywords

**Steps**:
1. Generate embeddings for your documents
2. Store in PostgreSQL with pgvector
3. Query with cosine similarity
4. Results in <100ms

**Example**: See `02-pgvector-semantic-search.ipynb`

### Use Case 2: Model Training

**Goal**: Train a machine learning model with experiment tracking

**Steps**:
1. Prepare data in PostgreSQL or Pandas
2. Train model with PyTorch or Scikit-learn
3. Track with MLflow
4. Save model for deployment

**Example**: See `03-pytorch-training.ipynb`

### Use Case 3: RAG (Retrieval Augmented Generation)

**Goal**: Enhance LLM responses with relevant context

**Steps**:
1. Store knowledge base in pgvector
2. For each query, retrieve top-k similar documents
3. Pass context to LLM
4. Generate enhanced response

**Example**:
```python
def rag_pipeline(query: str) -> str:
    # 1. Generate query embedding
    query_emb = embedder.encode(query)

    # 2. Retrieve similar documents
    context = retrieve_from_pgvector(query_emb, top_k=3)

    # 3. Generate response with LLM
    prompt = f"Context: {context}\n\nQuery: {query}\n\nAnswer:"
    response = llm.generate(prompt)

    return response
```

### Use Case 4: Model Serving API

**Goal**: Deploy model as REST API for production

**Steps**:
1. Train and save model
2. Load in FastAPI server
3. Expose /predict endpoint
4. Monitor latency and throughput

**Example**: See `/opt/ml-serving/model_server.py`

---

## Resources

### Documentation
- Main Infrastructure Report: AGENT-AC-ML-AI-INFRASTRUCTURE.md
- MLOps Best Practices: AGENT-AC-MLOPS-GUIDE.md
- Sample Notebooks: /opt/jupyter/notebooks/

### External Links
- [PyTorch Tutorials](https://pytorch.org/tutorials/)
- [pgvector Examples](https://github.com/pgvector/pgvector#examples)
- [MLflow Tracking](https://mlflow.org/docs/latest/tracking.html)
- [FastAPI Tutorial](https://fastapi.tiangolo.com/tutorial/)

### Community
- [PyTorch Forums](https://discuss.pytorch.org/)
- [PostgreSQL Mailing Lists](https://www.postgresql.org/list/)
- [r/MachineLearning](https://reddit.com/r/MachineLearning)

---

## Support

For issues or questions:

1. Check logs: `/tmp/jupyter.log`, `/tmp/model-server.log`, `/tmp/mlflow.log`
2. Review documentation: AGENT-AC-ML-AI-INFRASTRUCTURE.md
3. Search community forums
4. Create GitHub issue with full error details

---

**Last Updated**: 2026-01-05
**Version**: 1.0.0

---

*Get started with ML/AI in minutes, not hours.*
