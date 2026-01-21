# Semantic Kernel RAG App Template

This template provides a complete, end-to-end example of a Retrieval-Augmented Generation (RAG) application built with Microsoft's Semantic Kernel. It demonstrates how to ingest a real-world knowledge base, generate embeddings, and use them to answer questions with an AI model.

## How It Works

This application performs the following steps:

1.  **Data Ingestion:** It automatically clones the [`microsoft/Web-Dev-For-Beginners`](https://github.com/microsoft/Web-Dev-For-Beginners) GitHub repository, which contains a full curriculum on web development.
2.  **Processing & Chunking:** It finds all the Markdown (`.md`) lesson files, cleans them by converting them to plain text, and splits them into smaller, manageable chunks suitable for embedding.
3.  **Embedding & Storage:** It uses an AI embedding model (from OpenAI or Azure OpenAI) to convert the text chunks into vector embeddings. These embeddings are then stored in a local **ChromaDB** vector database.
4.  **Retrieval & Generation:** When you ask a question:
    -   The app searches the ChromaDB database for the most relevant chunks of text based on your query.
    -   It then feeds this retrieved context, along with your original question, into a chat model (like GPT-3.5 Turbo).
    -   The AI generates a final answer based on the provided information.

This entire process is orchestrated using the powerful and flexible **Microsoft Semantic Kernel** framework.

## Prerequisites

-   Python 3.8+
-   Git installed on your system.
-   An API key from either OpenAI or Azure OpenAI.

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
    -   Open the `.env` file and fill in your API key and other details for either OpenAI or Azure OpenAI, depending on which service you want to use.
    -   Set `USE_AZURE_OPENAI` to `true` or `false` accordingly.

5.  **Run the application:**
    ```bash
    python app.py
    ```

6.  **First-Time Setup:** The first time you run the app, it will:
    -   Clone the `Web-Dev-For-Beginners` repository (this may take a moment).
    -   Process all the lesson files and generate embeddings, storing them in a local `chroma_db` directory. This is a one-time process.

7.  **Ask Questions:** Once the setup is complete, you can ask questions about web development (e.g., "What is a JavaScript variable?" or "How do I create a loop?"). To exit, type `exit` and press Enter.
