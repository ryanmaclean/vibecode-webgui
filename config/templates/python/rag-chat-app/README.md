# Retrieval Augmented Generation (RAG) - "Chat with your Data" Template

This template provides a simple, command-line RAG application that allows you to chat with a local knowledge base (`data.md`). It demonstrates the core principles of RAG by grounding a chat model's responses in your own data.

This is a foundational example of how to build powerful "Chat with your Data" applications.

## How It Works

The application follows these steps:

1.  **Load Data:** Reads the content from the `data.md` file.
2.  **Chunking:** Splits the text into smaller, manageable chunks.
3.  **Embedding:** Uses an embeddings model (like `text-embedding-ada-002`) to convert each text chunk into a numerical vector representation.
4.  **Indexing:** Stores these embeddings in a simple, in-memory vector store (a NumPy array).
5.  **User Query:** When you ask a question, the app creates an embedding for your query.
6.  **Retrieval:** It performs a similarity search (using cosine similarity) to find the most relevant text chunks from the knowledge base.
7.  **Augmentation:** It combines your original question with the retrieved text chunks into a new, augmented prompt.
8.  **Generation:** It sends this augmented prompt to a powerful chat model (like GPT-4) to generate a final answer that is grounded in the provided context.

## Prerequisites

- Python 3.8+
- An Azure account with an active Azure OpenAI Service resource. You will need:
  - Your API Key
  - Your resource endpoint URL
  - The deployment name for your `text-embedding-ada-002` model
  - The deployment name for your chat model (e.g., `gpt-4`)

## How to Use

1.  **Clone the repository and navigate to this directory.**

2.  **Add your data:** Open the `data.md` file and replace the sample content with your own text-based knowledge.

3.  **Create a virtual environment (recommended):**
    ```bash
    python -m venv venv
    source venv/bin/activate
    # On Windows, use: venv\Scripts\activate
    ```

4.  **Install the required packages:**
    ```bash
    pip install -r requirements.txt
    ```

5.  **Configure your credentials:**
    -   Rename the `.env.example` file to `.env`.
    -   Open the `.env` file and add your Azure OpenAI API key, endpoint, and the deployment names for your embeddings and chat models.

6.  **Run the application:**
    ```bash
    python app.py
    ```

7.  **Start asking questions!** The app will first process and embed your data, which may take a moment. Once it's ready, you can ask questions about the content in `data.md`. To exit, type `exit` and press Enter.
