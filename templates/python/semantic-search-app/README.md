# Semantic Search Application Template

This template provides a simple, command-line semantic search application that finds relevant videos from a pre-indexed dataset based on a user's natural language query.

It is adapted from the "Building Search Applications" lesson in Microsoft's `generative-ai-for-beginners` course.

## Features

- **Semantic Search:** Uses OpenAI's `text-embedding-ada-002` model to understand the meaning behind a user's query and find the most relevant content.
- **Pre-indexed Data:** Comes with a pre-computed embeddings index (`embedding_index_3m.json`) of YouTube video transcripts.
- **Secure Configuration:** Loads API keys and endpoints from a `.env` file.
- **Easy to Understand:** The core logic is contained in a single, well-commented Python script (`app.py`).

## Prerequisites

- Python 3.8+
- An Azure account with an active Azure OpenAI Service resource. You will need:
  - Your API Key
  - Your resource endpoint URL
  - The name of your `text-embedding-ada-002` model deployment

## How to Use

1.  **Clone the repository and navigate to this directory.**

2.  **Create a virtual environment (recommended):**
    ```bash
    python -m venv venv
    source venv/bin/activate
    # On Windows, use: venv\Scripts\activate
    ```

3.  **Install the required packages:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configure your credentials:**
    -   Rename the `.env.example` file to `.env`.
    -   Open the `.env` file and add your Azure OpenAI API key, endpoint, and embeddings deployment name.

5.  **Run the application:**
    ```bash
    python app.py
    ```

6.  **Start searching!** Type your query and press Enter. To exit, type `exit` and press Enter.

### Sample Queries

- What is Azure Machine Learning?
- How do convolutional neural networks work?
- What is a neural network?
- Can I use Jupyter Notebooks with Azure Machine Learning?
- What is ONNX?
