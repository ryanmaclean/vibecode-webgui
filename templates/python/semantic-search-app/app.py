import os
import pandas as pd
import numpy as np
from openai import AzureOpenAI
from dotenv import load_dotenv

# --- Configuration and Constants ---
SIMILARITIES_RESULTS_THRESHOLD = 0.75
DATASET_NAME = "embedding_index_3m.json"

def main():
    """
    A semantic search application that finds relevant videos based on a user's query.

    This script loads a pre-computed embeddings index, generates an embedding for the
    user's query, and then uses cosine similarity to find the most relevant videos.
    """
    # --- 1. Initialization and Setup ---
    load_dotenv()

    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    embeddings_deployment = os.getenv("AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT")

    if not all([api_key, azure_endpoint, embeddings_deployment]):
        print("Error: Please create a .env file and set the required environment variables.")
        return

    try:
        client = AzureOpenAI(
            api_key=api_key,
            api_version="2024-02-01",
            azure_endpoint=azure_endpoint
        )
        print("✅ Azure OpenAI client initialized successfully.")
    except Exception as e:
        print(f"Error initializing Azure OpenAI client: {e}")
        return

    # --- 2. Data Loading ---
    try:
        pd_vectors = load_dataset(DATASET_NAME)
        print(f"✅ Embeddings index '{DATASET_NAME}' loaded successfully.")
    except FileNotFoundError:
        print(f"Error: The data file '{DATASET_NAME}' was not found.")
        print("Please make sure it is in the same directory as this script.")
        return

    # --- 3. Main Application Loop ---
    print("\n🚀 You can now search for videos.")
    print("   Type 'exit' to end the application.")
    print("-----------------------------------------")

    while True:
        query = input("\nEnter a search query: ")
        if query.lower() == 'exit':
            print("\nExiting application. Goodbye!")
            break
        
        try:
            videos = get_similar_videos(client, embeddings_deployment, query, pd_vectors)
            display_results(videos, query)
        except Exception as e:
            print(f"An error occurred during search: {e}")

# --- Core Functions ---

def load_dataset(source: str) -> pd.DataFrame:
    """Loads the embeddings index from a JSON file into a pandas DataFrame."""
    pd_vectors = pd.read_json(source)
    return pd_vectors.drop(columns=["text"], errors="ignore").fillna("")

def get_similar_videos(client, model, query: str, dataset: pd.DataFrame, rows: int = 5) -> pd.DataFrame:
    """Finds videos in the dataset that are most similar to the user's query."""
    video_vectors = dataset.copy()

    # 1. Get the embedding for the user's query
    query_embeddings = client.embeddings.create(input=query, model=model).data[0].embedding

    # 2. Calculate cosine similarity between the query and all video embeddings
    video_vectors["similarity"] = video_vectors["ada_v2"].apply(
        lambda x: cosine_similarity(np.array(query_embeddings), np.array(x))
    )

    # 3. Filter and sort the results
    mask = video_vectors["similarity"] >= SIMILARITIES_RESULTS_THRESHOLD
    video_vectors = video_vectors[mask].copy()
    video_vectors = video_vectors.sort_values(by="similarity", ascending=False).head(rows)

    return video_vectors

def display_results(videos: pd.DataFrame, query: str):
    """Prints the search results in a user-friendly format."""
    if videos.empty:
        print(f"\nNo videos found similar to '{query}'. Try a different search term.")
        return

    print(f"\nVideos similar to '{query}':")
    for _, row in videos.iterrows():
        youtube_url = f"https://youtu.be/{row['videoId']}?t={row['seconds']}"
        print(f"\n- {row['title']}")
        print(f"  Summary: {' '.join(row['summary'].split()[:20])}...")
        print(f"  YouTube: {youtube_url}")
        print(f"  Similarity: {row['similarity']:.4f}")
        print(f"  Speakers: {row['speaker']}")

def cosine_similarity(a, b):
    """Calculates the cosine similarity between two vectors."""
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

if __name__ == "__main__":
    main()
