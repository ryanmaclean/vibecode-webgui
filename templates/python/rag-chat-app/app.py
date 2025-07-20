import os
import numpy as np
from openai import AzureOpenAI
from dotenv import load_dotenv
from sklearn.metrics.pairwise import cosine_similarity

# --- Configuration and Constants ---
KNOWLEDGE_BASE_FILE = "data.md"
TOP_K_RESULTS = 3

def main():
    """
    A Retrieval Augmented Generation (RAG) application that answers questions
    based on a local knowledge base.
    """
    # --- 1. Initialization and Setup ---
    load_dotenv()
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    embeddings_deployment = os.getenv("AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT")
    chat_deployment = os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT")

    if not all([api_key, azure_endpoint, embeddings_deployment, chat_deployment]):
        print("Error: Please create a .env file and set all required environment variables.")
        return

    try:
        client = AzureOpenAI(
            api_key=api_key,
            api_version="2024-02-01",
            azure_endpoint=azure_endpoint
        )
        print("✅ Azure OpenAI client initialized.")
    except Exception as e:
        print(f"Error initializing Azure OpenAI client: {e}")
        return

    # --- 2. Knowledge Base Processing ---
    try:
        text_chunks = load_and_chunk_knowledge_base(KNOWLEDGE_BASE_FILE)
        print(f"✅ Knowledge base '{KNOWLEDGE_BASE_FILE}' loaded and chunked.")
        
        print("Creating embeddings for knowledge base... This may take a moment.")
        embeddings = get_embeddings(client, embeddings_deployment, text_chunks)
        print("✅ Embeddings created successfully.")

    except FileNotFoundError:
        print(f"Error: The knowledge base file '{KNOWLEDGE_BASE_FILE}' was not found.")
        return
    except Exception as e:
        print(f"Error processing knowledge base: {e}")
        return

    # --- 3. Main Application Loop ---
    print("\n🚀 Ask questions about the VibeCode platform.")
    print("   Type 'exit' to end the application.")
    print("-----------------------------------------")

    while True:
        query = input("\nYour question: ")
        if query.lower() == 'exit':
            print("\nExiting application. Goodbye!")
            break

        try:
            # 1. Retrieve relevant context
            context = retrieve_context(client, embeddings_deployment, query, embeddings, text_chunks)
            
            # 2. Generate a response
            response = generate_response(client, chat_deployment, query, context)
            
            print(f"\n🤖 Answer: {response}")

        except Exception as e:
            print(f"An error occurred: {e}")

# --- Core RAG Functions ---

def load_and_chunk_knowledge_base(file_path: str, chunk_size: int = 500) -> list[str]:
    """Loads text from a file and splits it into smaller chunks."""
    with open(file_path, 'r', encoding='utf-8') as f:
        text = f.read()
    
    chunks = [text[i:i+chunk_size] for i in range(0, len(text), chunk_size)]
    return chunks

def get_embeddings(client, model, texts: list[str]) -> np.ndarray:
    """Generates embeddings for a list of texts."""
    response = client.embeddings.create(input=texts, model=model)
    return np.array([item.embedding for item in response.data])

def retrieve_context(client, model, query: str, embeddings: np.ndarray, chunks: list[str]) -> str:
    """Retrieves the most relevant text chunks from the knowledge base."""
    query_embedding = get_embeddings(client, model, [query])
    
    # Calculate cosine similarity
    sims = cosine_similarity(query_embedding, embeddings)[0]
    
    # Get top_k results
    top_indices = sims.argsort()[-TOP_K_RESULTS:][::-1]
    
    # Concatenate the relevant chunks into a single context string
    context = "\n\n---\n\n".join([chunks[i] for i in top_indices])
    return context

def generate_response(client, model, query: str, context: str) -> str:
    """Generates a response using the chat model based on the query and context."""
    system_prompt = (
        "You are a helpful AI assistant for the VibeCode platform. "
        "Answer the user's question based *only* on the provided context. "
        "If the context does not contain the answer, say that you don't know."
    )

    user_prompt = (
        f"Context:\n{context}\n\n---\n\nQuestion: {query}\n\nAnswer:"
    )

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.2,
        max_tokens=250
    )
    return response.choices[0].message.content

if __name__ == "__main__":
    main()
