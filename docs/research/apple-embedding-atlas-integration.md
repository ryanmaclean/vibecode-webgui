# Apple Embedding Atlas Integration Research

> Research document for GitHub Issue #1136: Evaluate apple/embedding-atlas for embedding visualization

**Author**: AI Research Assistant
**Date**: 2026-02-04
**Status**: Research Complete

---

## 1. Overview of Embedding Atlas

### What It Is

[Embedding Atlas](https://github.com/apple/embedding-atlas) is an open-source interactive visualization tool developed by Apple for exploring large-scale embedding datasets. Released under the MIT License in November 2025, it enables users to visualize, cross-filter, and search embeddings along with their associated metadata.

### Key Features

| Feature | Description |
|---------|-------------|
| **Automatic Clustering & Labeling** | Interactively visualize and navigate overall data structure with density-based clustering |
| **Kernel Density Estimation** | Density contours to distinguish between dense regions and outliers |
| **Transparent Rendering** | Order-independent transparency for accurate overlapping point visualization |
| **Real-time Search** | Find similar data to a given query or existing data point with nearest neighbor search |
| **High-Performance Graphics** | WebGPU implementation (with WebGL 2 fallback) supporting up to millions of points |
| **Multi-View Coordination** | Interactively link and filter data across metadata columns |
| **Privacy-First Design** | All computation happens in the browser; data never leaves the machine |

### How It Works

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Data (Parquet/CSV)                      │
└────────────────────────────────────┬────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Embedding Generation                              │
│  • SentenceTransformers (all-MiniLM-L6-v2) for text                 │
│  • ViT (google/vit-base-patch16-384) for images                     │
│  • Or pre-computed vectors via --vector flag                        │
└────────────────────────────────────┬────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    UMAP Projection (WebAssembly)                     │
│  • Dimensionality reduction to 2D                                   │
│  • Configurable: n_neighbors, min_dist, metric                      │
└────────────────────────────────────┬────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Density Clustering (Rust/WASM)                    │
│  • Automatic cluster detection                                      │
│  • Label generation                                                 │
└────────────────────────────────────┬────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Interactive Visualization                         │
│  • WebGPU/WebGL 2 rendering                                         │
│  • Cross-filtering with metadata                                    │
│  • Real-time search and nearest neighbors                           │
└─────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **Frontend**: TypeScript (46.7%), Svelte (30.3%)
- **Backend**: Python (command-line tool and Jupyter widget)
- **Algorithms**: Rust (density clustering), C++ (UMAP via umappp)
- **Rendering**: WebGPU with WebGL 2 fallback
- **Data Format**: Parquet files (primary), CSV supported

### Research Publications

Two academic papers accompany this tool:
- Main tool paper: arXiv:2505.06386 (IEEE Visualization 2025)
- Clustering algorithm paper: arXiv:2504.07285

---

## 2. Integration Opportunities

### 2.1 Visualize RAG Embeddings

**Use Case**: Debug and understand the vector space created by our RAG system.

Our current architecture (see `ARCHITECTURE_RAG_SYSTEM.md`) uses:
- PostgreSQL + pgvector for vector storage
- 1536-dimensional embeddings (text-embedding-3-small)
- HNSW index for approximate nearest neighbor search

**Integration Approach**:

```python
# Export embeddings from PostgreSQL to Parquet for visualization
import pandas as pd
import psycopg2

conn = psycopg2.connect("postgresql://...")
df = pd.read_sql("""
    SELECT
        chunk_text,
        embedding::text as embedding_str,
        metadata->>'source' as source,
        metadata->>'timestamp' as timestamp,
        created_at
    FROM document_embeddings
    LIMIT 100000
""", conn)

# Convert embedding strings to lists
import json
df['embedding'] = df['embedding_str'].apply(lambda x: json.loads(x.replace('{', '[').replace('}', ']')))

# Save as Parquet
df.to_parquet('rag_embeddings.parquet')

# Launch embedding-atlas
# embedding-atlas rag_embeddings.parquet --vector embedding --text chunk_text
```

**Benefits**:
- Visualize document clusters in your knowledge base
- Identify semantic regions (e.g., all Python docs cluster together)
- Find outliers that may indicate data quality issues
- Understand embedding distribution before deploying updates

### 2.2 Debug Vector Search Quality

**Use Case**: Evaluate and improve retrieval accuracy.

**Current Challenge**:
Our RAG system uses a similarity threshold of 0.7 (cosine similarity). But how do we know this is optimal?

**Integration Approach**:

```python
from embedding_atlas.widget import EmbeddingAtlasWidget
import pandas as pd

# Load query and results data
queries_df = pd.read_parquet('query_logs.parquet')
results_df = pd.read_parquet('retrieved_documents.parquet')

# Visualize query embeddings alongside document embeddings
combined_df = pd.concat([
    queries_df.assign(type='query'),
    results_df.assign(type='document')
])

# In Jupyter notebook
widget = EmbeddingAtlasWidget(combined_df)
widget
```

**Debug Workflows**:

1. **False Negatives**: Find relevant documents that weren't retrieved
   - Search for a query in the visualization
   - Identify nearby documents that weren't in the top-K results
   - Adjust `ef_search` or similarity threshold

2. **False Positives**: Identify irrelevant retrievals
   - Visualize retrieved documents for a specific query
   - If they're spread across multiple clusters, retrieval may be too broad
   - Consider adding metadata filters

3. **Embedding Drift**: Monitor changes over time
   - Export embeddings periodically
   - Compare projections to detect semantic shifts

### 2.3 Understand Embedding Clusters

**Use Case**: Gain insights into your document corpus structure.

**Example Analysis**:

```bash
# Export all documents with rich metadata
embedding-atlas docs_with_metadata.parquet \
  --vector embedding \
  --text content \
  --labels topic_labels.txt \
  --point-size 3
```

**Cluster Analysis Benefits**:

| Analysis | Insight |
|----------|---------|
| **Topic Discovery** | Automatic labeling reveals emergent topics |
| **Coverage Gaps** | Sparse regions indicate missing documentation |
| **Redundancy Detection** | Dense clusters may have duplicate content |
| **Quality Assessment** | Outliers often indicate noise or errors |

---

## 3. Implementation Considerations

### 3.1 Installation and Dependencies

**Python Package (Recommended)**:

```bash
# Standard installation
pip install embedding-atlas

# Or with uv (faster)
uv pip install embedding-atlas
```

**Requirements**:
- Python 3.9+
- Modern browser with WebGL 2 support (WebGPU optional)
- ~500MB disk space (includes embedding models)

**NPM Package (For UI Integration)**:

```bash
npm install embedding-atlas
```

**Exports available**:
- Vanilla JS: `import { EmbeddingAtlas } from "embedding-atlas"`
- React: `import { EmbeddingAtlas } from "embedding-atlas/react"`
- Svelte: `import { EmbeddingAtlas } from "embedding-atlas/svelte"`

### 3.2 Data Format Requirements

**Primary Format: Parquet**

```python
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

# Required columns
schema = pa.schema([
    ('text', pa.string()),           # Text content for display
    ('embedding', pa.list_(pa.float32())),  # Vector embedding
    # Optional metadata columns
    ('source', pa.string()),
    ('category', pa.string()),
    ('timestamp', pa.timestamp('ms')),
])

# Create table
table = pa.Table.from_pandas(df, schema=schema)
pq.write_table(table, 'embeddings.parquet')
```

**Export from pgvector**:

```sql
-- Export as CSV (then convert to Parquet)
COPY (
    SELECT
        chunk_text as text,
        embedding::text as embedding,
        metadata->>'source' as source,
        created_at as timestamp
    FROM document_embeddings
) TO '/tmp/embeddings.csv' WITH CSV HEADER;
```

**Pre-computed Projections**:

If you already have 2D coordinates (e.g., from a previous UMAP run):

```bash
embedding-atlas data.parquet --x x_coord --y y_coord
```

### 3.3 UI Integration Options

**Option A: Standalone Web Application**

```bash
# Export as static web app
embedding-atlas data.parquet --export-application ./embedding-viewer

# Deploy to any static hosting
# Files are self-contained HTML/JS/CSS
```

**Option B: Jupyter Widget Integration**

```python
from embedding_atlas.widget import EmbeddingAtlasWidget

# In a Jupyter notebook
widget = EmbeddingAtlasWidget(df)
display(widget)
```

**Option C: Streamlit Component**

```python
import streamlit as st
from embedding_atlas.streamlit import embedding_atlas

# In a Streamlit app
st.title("RAG Embedding Visualization")
embedding_atlas(df)
```

**Option D: React/Svelte Integration**

```tsx
// React component
import { EmbeddingAtlas } from "embedding-atlas/react";

function EmbeddingViewer({ data }) {
  return (
    <EmbeddingAtlas
      data={data}
      textColumn="text"
      vectorColumn="embedding"
      pointSize={3}
    />
  );
}
```

### 3.4 Performance Considerations

| Dataset Size | Load Time | Memory (Browser) | Recommendation |
|--------------|-----------|------------------|----------------|
| 10K points | <5s | ~100MB | Full interactivity |
| 100K points | ~30s | ~500MB | Good performance |
| 1M points | ~3min | ~2GB | Use sampling or pagination |
| 10M+ points | N/A | N/A | Pre-cluster, show summaries |

**Optimization Strategies**:

```bash
# Sample large datasets
embedding-atlas large_data.parquet --sample 100000

# Filter with SQL
embedding-atlas data.parquet --query "SELECT * WHERE category = 'python'"
```

---

## 4. Recommendation

### 4.1 Should We Integrate?

**Recommendation: YES - Integrate as a development/debugging tool**

**Rationale**:

| Factor | Assessment |
|--------|------------|
| **Value** | High - Provides unique insight into RAG embedding quality |
| **Effort** | Low - Well-documented Python package, easy installation |
| **Risk** | Minimal - MIT license, browser-based (no server dependency) |
| **Maintenance** | Low - Apple-backed, active development (14 contributors) |

### 4.2 Recommended Use Cases

#### Primary Use Cases (Immediate Value)

1. **RAG Quality Debugging**
   - Visualize retrieval results to understand why certain queries fail
   - Identify embedding clusters that need better coverage
   - Tune similarity thresholds based on visual inspection

2. **Document Corpus Analysis**
   - Understand the semantic structure of indexed documents
   - Discover duplicate or near-duplicate content
   - Identify gaps in documentation coverage

3. **Embedding Model Evaluation**
   - Compare different embedding models visually
   - Evaluate fine-tuned vs. base models
   - Assess embedding quality before production deployment

#### Secondary Use Cases (Future Consideration)

4. **User Query Analysis**
   - Visualize query patterns over time
   - Identify common query clusters for optimization
   - Detect anomalous queries that may indicate issues

5. **A/B Testing Embeddings**
   - Compare embedding distributions across model versions
   - Validate that model updates maintain semantic coherence

### 4.3 Suggested Implementation Plan

**Phase 1: Development Tool (Week 1)**
- Install `embedding-atlas` in development environment
- Create export script for pgvector embeddings
- Document usage in `docs/guides/embedding-visualization.md`

**Phase 2: Jupyter Integration (Week 2)**
- Set up Jupyter notebook for embedding analysis
- Create pre-built analysis notebooks for common tasks
- Integrate with existing Datadog metrics for correlation

**Phase 3: Dashboard Integration (Optional, Week 3-4)**
- Evaluate Streamlit component for internal dashboards
- Consider static export for documentation site
- Assess React component for future UI integration

### 4.4 Code Example: Quick Start

```python
#!/usr/bin/env python3
"""
Quick start script for visualizing VibeCode RAG embeddings.

Usage:
    python visualize_embeddings.py
"""

import os
import pandas as pd
import psycopg2
import subprocess
from pathlib import Path

# Configuration
POSTGRES_URL = os.environ.get('DATABASE_URL', 'postgresql://vibecode:vibecode@localhost:5432/vibecode')
OUTPUT_PATH = Path('/tmp/rag_embeddings.parquet')
SAMPLE_SIZE = 50000

def export_embeddings():
    """Export embeddings from PostgreSQL to Parquet."""
    conn = psycopg2.connect(POSTGRES_URL)

    query = f"""
        SELECT
            id,
            chunk_text as text,
            embedding::text as embedding_str,
            metadata->>'source' as source,
            metadata->>'file_type' as file_type,
            created_at
        FROM document_embeddings
        ORDER BY created_at DESC
        LIMIT {SAMPLE_SIZE}
    """

    df = pd.read_sql(query, conn)
    conn.close()

    # Parse embedding strings to lists
    import json
    df['embedding'] = df['embedding_str'].apply(
        lambda x: json.loads(x.replace('{', '[').replace('}', ']'))
    )
    df = df.drop(columns=['embedding_str'])

    # Save as Parquet
    df.to_parquet(OUTPUT_PATH, index=False)
    print(f"Exported {len(df)} embeddings to {OUTPUT_PATH}")
    return OUTPUT_PATH

def launch_visualization(parquet_path: Path):
    """Launch embedding-atlas visualization."""
    cmd = [
        'embedding-atlas',
        str(parquet_path),
        '--vector', 'embedding',
        '--text', 'text',
        '--point-size', '3',
    ]
    subprocess.run(cmd)

if __name__ == '__main__':
    parquet_path = export_embeddings()
    launch_visualization(parquet_path)
```

---

## 5. References

- **GitHub Repository**: https://github.com/apple/embedding-atlas
- **Documentation**: https://apple.github.io/embedding-atlas/
- **Research Paper**: https://machinelearning.apple.com/research/embedding-atlas
- **Demo**: https://apple.github.io/embedding-atlas/ (interactive online demo)
- **Related Internal Docs**:
  - `/docs/ARCHITECTURE_RAG_SYSTEM.md` - RAG system architecture
  - `/docs/POSTGRESQL_PGVECTOR_SETUP.md` - Vector database setup
  - `/extensions/workspace-rag/README.md` - RAG extension documentation

---

**Conclusion**: Apple's Embedding Atlas is a high-quality, well-documented tool that addresses a real gap in our RAG development workflow. The browser-based architecture ensures data privacy while providing powerful visualization capabilities. Integration effort is minimal, and the potential for improving embedding quality and debugging retrieval issues makes this a worthwhile addition to our development toolkit.
