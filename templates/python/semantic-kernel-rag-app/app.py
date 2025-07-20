import os
import asyncio
import semantic_kernel as sk
from semantic_kernel.connectors.ai.open_ai import AzureChatCompletion, AzureTextEmbedding, OpenAIChatCompletion, OpenAITextEmbedding
from semantic_kernel.connectors.memory.chroma import ChromaMemoryStore
from semantic_kernel.text import split_markdown_lines
from semantic_kernel.memory import SemanticTextMemory
from dotenv import load_dotenv
import git
import markdown
from bs4 import BeautifulSoup

# --- Configuration & Constants ---
REPO_URL = "https://github.com/microsoft/Web-Dev-For-Beginners.git"
REPO_PATH = "./web-dev-for-beginners"
COLLECTION_NAME = "web_dev_for_beginners"

# --- Main Application Logic ---
async def main():
    """Main function to run the Semantic Kernel RAG application."""
    # 1. Initialize Semantic Kernel
    kernel, memory = await initialize_kernel_and_memory()

    # 2. Ingest and Process Data
    await ingest_data(memory)

    # 3. Start Interactive Q&A Loop
    await interactive_qa_loop(kernel, memory)

async def initialize_kernel_and_memory():
    """Initializes the Semantic Kernel and the memory store."""
    print("🚀 Initializing Semantic Kernel and ChromaDB...")
    load_dotenv()

    use_azure_openai = os.getenv("USE_AZURE_OPENAI", "False").lower() == 'true'
    
    kernel = sk.Kernel()
    
    if use_azure_openai:
        deployment, api_key, endpoint = sk.azure_openai_settings_from_dot_env()
        embedding_deployment, _, _ = sk.azure_openai_settings_from_dot_env(embedding=True)
        kernel.add_chat_service("chat_completion", AzureChatCompletion(deployment, endpoint, api_key))
        embedding_generator = AzureTextEmbedding(embedding_deployment, endpoint, api_key)
    else:
        api_key, org_id = sk.openai_settings_from_dot_env()
        kernel.add_chat_service("chat_completion", OpenAIChatCompletion("gpt-3.5-turbo", api_key, org_id))
        embedding_generator = OpenAITextEmbedding("text-embedding-ada-002", api_key, org_id)

    kernel.add_text_embedding_generation_service("ada", embedding_generator)

    memory_store = ChromaMemoryStore(persist_directory="./chroma_db")
    memory = SemanticTextMemory(storage=memory_store, embeddings_generator=embedding_generator)
    
    print("✅ Kernel and memory initialized.")
    return kernel, memory

async def ingest_data(memory):
    """Clones the repo, processes the markdown files, and stores them in memory."""
    # Check if data is already ingested
    try:
        collections = await memory.get_collections_async()
        if COLLECTION_NAME in collections:
            print("📚 Data already ingested. Skipping ingestion.")
            return
    except Exception as e:
        print(f"Could not check collections, proceeding with ingestion. Error: {e}")

    print(f"\n📥 Cloning repository: {REPO_URL}")
    if not os.path.exists(REPO_PATH):
        git.Repo.clone_from(REPO_URL, REPO_PATH)
    print("✅ Repository cloned.")

    print("\n📄 Processing and embedding Markdown files...")
    # Walk through the lesson directories
    lessons_path = os.path.join(REPO_PATH, '2-js-basics', 'lessons')
    file_count = 0
    for root, _, files in os.walk(lessons_path):
        for file in files:
            if file.endswith(".md"):
                file_path = os.path.join(root, file)
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    # Convert markdown to plain text for cleaner chunks
                    html = markdown.markdown(content)
                    soup = BeautifulSoup(html, 'html.parser')
                    text_content = soup.get_text()

                    # Chunk the text
                    chunks = split_markdown_lines(text_content, max_tokens=200, chunk_overlap=20)
                    for i, chunk in enumerate(chunks):
                        await memory.save_information_async(
                            collection=COLLECTION_NAME,
                            id=f"{file}_{i}",
                            text=chunk
                        )
                file_count += 1
                print(f"  - Processed {file}")
    print(f"\n✅ Processed and embedded {file_count} files into ChromaDB.")

async def interactive_qa_loop(kernel: sk.Kernel, memory: SemanticTextMemory):
    """Runs the main interactive question-and-answering loop."""
    prompt_template = """
    You are a helpful AI assistant for web developers. Your task is to answer questions based on the provided context from a beginner's web development course.

    Context from the course:
    --- BEGIN CONTEXT ---
    {{$context}}
    --- END CONTEXT ---

    Question:
    {{$user_question}}

    Based on the context above, please provide a clear and concise answer. If the context does not contain the answer, say 'I could not find an answer in the provided materials.'
    Answer:
    """

    rag_function = kernel.create_semantic_function(prompt_template, max_tokens=200, temperature=0.2)

    print("\n----------------------------------------------------------------")
    print("   I am an AI assistant with knowledge of the Web Dev for Beginners course.")
    print("   Ask me a question, or type 'exit' to end.")
    print("----------------------------------------------------------------")

    while True:
        try:
            user_question = input("\nYour question: ")
            if user_question.lower() == 'exit':
                print("\nExiting application. Goodbye!")
                break

            print("\n🔍 Searching for relevant information...")
            # Search for relevant context
            results = await memory.search_async(COLLECTION_NAME, user_question, limit=3, min_relevance_score=0.75)
            context = "\n".join([r.text for r in results])

            if not context:
                print("\n🤖 Assistant: I could not find any relevant information in the course materials to answer your question.")
                continue

            print("\n💬 Generating answer...")
            # Generate the answer
            answer = await kernel.run_async(
                rag_function,
                input_vars=sk.ContextVariables(variables={
                    "context": context,
                    "user_question": user_question
                })
            )
            print(f"\n🤖 Assistant: {str(answer).strip()}")

        except Exception as e:
            print(f"An error occurred: {e}")

if __name__ == "__main__":
    asyncio.run(main())
