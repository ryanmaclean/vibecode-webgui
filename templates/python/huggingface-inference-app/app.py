import os
import torch
from dotenv import load_dotenv
from transformers import pipeline
from huggingface_hub import login, HfApi

# --- Main Application Logic ---
def main():
    """An application to demonstrate authenticated inference with a gated Hugging Face model."""
    # 1. Load Environment Variables and Authenticate
    load_dotenv()
    hf_api_key = os.getenv("HUGGINGFACE_API_KEY")

    if not hf_api_key:
        print("Error: HUGGINGFACE_API_KEY not found.")
        print("Please create a .env file and add your Hugging Face API key.")
        return

    print("🔑 Authenticating with Hugging Face Hub...")
    try:
        login(token=hf_api_key)
        print("✅ Authentication successful.")
    except Exception as e:
        print(f"❌ Authentication failed: {e}")
        return

    # 2. Setup Model and Pipeline
    # We use a gated model to demonstrate the need for authentication.
    # IMPORTANT: You must visit the model's page on Hugging Face and accept the
    # license terms before you can use it.
    model_id = "meta-llama/Llama-2-7b-chat-hf"
    print(f"\n🚀 Loading gated model: {model_id}")
    print("   This may take a significant amount of time and disk space on first run.")

    try:
        text_generator = pipeline(
            "text-generation",
            model=model_id,
            torch_dtype=torch.float16,
            device_map="auto"
        )
        print("✅ Model loaded successfully.")
    except Exception as e:
        print(f"\n❌ Error loading model: {e}")
        print("\n   Please ensure you have accepted the license for this model on the Hugging Face Hub:")
        print(f"   https://huggingface.co/{model_id}")
        return

    # 3. Interactive Inference Loop
    print("----------------------------------------------------------------")
    print("   I am an AI assistant powered by Llama-2.")
    print("   Type 'exit' to end the application.")
    print("----------------------------------------------------------------")

    while True:
        user_prompt = input("\nYour prompt: ")
        if user_prompt.lower() == 'exit':
            print("\nExiting application. Goodbye!")
            break

        print("\n💬 Generating response...")
        sequences = text_generator(
            user_prompt,
            do_sample=True,
            top_k=10,
            num_return_sequences=1,
            eos_token_id=text_generator.tokenizer.eos_token_id,
            max_length=200,
        )
        print(f"\n🤖 Assistant: {sequences[0]['generated_text']}")

if __name__ == "__main__":
    main()
