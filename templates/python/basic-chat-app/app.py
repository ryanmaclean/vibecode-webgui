import os
from openai import AzureOpenAI
from dotenv import load_dotenv

def main():
    """
    A simple chat application that demonstrates how to use the Azure OpenAI API.

    This script loads credentials from a .env file, initializes the AzureOpenAI client,
    and enters a loop to chat with the model.
    """
    # Load environment variables from a .env file
    load_dotenv()

    # Retrieve environment variables
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    deployment_name = os.getenv("AZURE_OPENAI_DEPLOYMENT")

    # Check if the required environment variables are set
    if not all([api_key, azure_endpoint, deployment_name]):
        print("Error: Please create a .env file and set the following environment variables:")
        print(" - AZURE_OPENAI_API_KEY")
        print(" - AZURE_OPENAI_ENDPOINT")
        print(" - AZURE_OPENAI_DEPLOYMENT")
        return

    # Initialize the Azure OpenAI client
    try:
        client = AzureOpenAI(
            api_key=api_key,
            api_version="2024-02-01",
            azure_endpoint=azure_endpoint
        )
    except Exception as e:
        print(f"Error initializing Azure OpenAI client: {e}")
        return

    print("✅ Azure OpenAI client initialized successfully.")
    print("🚀 You can now start chatting with the AI.")
    print("   Type 'exit' to end the conversation.")
    print("-----------------------------------------")

    # Start the chat loop
    while True:
        try:
            user_prompt = input("\nYou: ")
            if user_prompt.lower() == 'exit':
                print("\nExiting chat. Goodbye!")
                break

            # Send the prompt to the model
            response = client.chat.completions.create(
                model=deployment_name,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": user_prompt},
                ]
            )

            # Print the model's response
            if response.choices:
                print(f"AI: {response.choices[0].message.content}")
            else:
                print("AI: I don't have a response for that.")

        except Exception as e:
            print(f"An error occurred: {e}")
            break

if __name__ == "__main__":
    main()
