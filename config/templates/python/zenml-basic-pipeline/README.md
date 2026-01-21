# ZenML Basic Pipeline Starter

This template provides a starter project for building reproducible, production-ready machine learning pipelines with [ZenML](https://zenml.io/).

ZenML is an open-source MLOps framework that helps you move from interactive development to a robust, versioned, and automated production workflow.

## What's Included

- **A Basic ML Pipeline:** The `run_pipeline.py` script defines a simple pipeline using `scikit-learn` that:
  1. Creates a sample dataset.
  2. Trains a Random Forest classifier.
  3. Evaluates the model's accuracy.
- **ZenML Configuration:** Ready for you to initialize and run.

## Getting Started

1.  **Initialize ZenML:** Before running the pipeline for the first time, you need to initialize the ZenML repository within your workspace. Open a terminal and run:
    ```bash
    zenml init
    ```

2.  **Run the Pipeline:** Execute the `run_pipeline.py` script to run the ML pipeline:
    ```bash
    python run_pipeline.py
    ```

3.  **Visualize the Results:** After the run completes, you can view your pipeline and its results in the ZenML dashboard. To launch it, run:
    ```bash
    zenml up
    ```
    This will start a local server and provide a URL to the dashboard.
