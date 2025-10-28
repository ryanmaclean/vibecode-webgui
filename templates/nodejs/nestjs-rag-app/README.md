# Node.js RAG App Template (NestJS + embedJs)

This template provides a production-ready, API-first **Retrieval-Augmented Generation (RAG)** application built with [NestJS](https://nestjs.com/) and [embedJs](https://github.com/llm-tools/embedJs). It allows you to build a "Chat with your Data" service where an LLM can answer questions based on a local knowledge base.

## How It Works

The application follows a simple but powerful RAG pipeline:

1.  **Load Data:** On startup, the `RagService` uses the `TextLoader` from `embedJs` to read and chunk the content of the local `data.md` file.
2.  **Generate & Store Embeddings:** It then generates vector embeddings for each chunk of text and stores them in a local vector database using `LanceDb`.
3.  **Expose API Endpoint:** The `AppController` exposes a `/query` endpoint that accepts a user's question.
4.  **Retrieve & Augment:** When a query is received, `embedJs` searches the vector database for the most relevant text chunks based on the question.
5.  **Generate Answer:** These relevant chunks are passed to the LLM as context, which then generates a final answer grounded in the provided data.

## Prerequisites

-   Node.js (v18+ recommended)
-   An [OpenAI API Key](https://platform.openai.com/api-keys).

## How to Use

1.  **Navigate to this directory.**

2.  **Configure your credentials:**
    -   Rename the `.env.example` file to `.env`.
    -   Open the `.env` file and add your OpenAI API key.

3.  **Install dependencies:**
    ```bash
    npm install
    ```

4.  **Run the application in development mode:**
    ```bash
    npm run start:dev
    ```
    On the first run, the application will need a moment to download the embedding model and build the vector index from `data.md`.

5.  **Query the API:**
    Once the server is running, you can send requests to the API. Open a new terminal or your web browser and use the following URL format:
    ```
    http://localhost:3000/query?q=YOUR_QUESTION_HERE
    ```
    **Example Questions:**
    -   `http://localhost:3000/query?q=What is VibeCode?`
    -   `http://localhost:3000/query?q=What kind of security does VibeCode have?`

## Customization

To use your own data, simply edit the `data.md` file. The application will automatically re-index the data the next time it starts.
