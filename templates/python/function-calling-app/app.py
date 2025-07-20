import os
import json
from openai import AzureOpenAI
from dotenv import load_dotenv

# --- 1. Tool Definition ---
def get_current_weather(city: str) -> str:
    """Gets the current weather for a given city."""
    # This is a mock tool. In a real application, this would call a weather API.
    print(f"Calling get_current_weather for {city}")
    if "san francisco" in city.lower():
        return json.dumps({"city": "San Francisco", "temperature": "75°F", "condition": "Sunny"})
    elif "new york" in city.lower():
        return json.dumps({"city": "New York", "temperature": "68°F", "condition": "Cloudy"})
    elif "london" in city.lower():
        return json.dumps({"city": "London", "temperature": "59°F", "condition": "Rainy"})
    else:
        return json.dumps({"city": city, "error": "City not found"})

# --- 2. Main Application ---
def main():
    """An AI agent that uses the native OpenAI tool-calling feature."""
    # --- Initialization ---
    load_dotenv()
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    chat_deployment = os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT")

    if not all([api_key, azure_endpoint, chat_deployment]):
        print("Error: Please create a .env file and set all required environment variables.")
        return

    client = AzureOpenAI(
        api_key=api_key,
        api_version="2024-02-15-preview", # Use a preview version that supports tool calling
        azure_endpoint=azure_endpoint
    )
    print("✅ Azure OpenAI client initialized.")

    # --- Define Tools for the API ---
    tools = [
        {
            "type": "function",
            "function": {
                "name": "get_current_weather",
                "description": "Get the current weather in a given city",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "city": {
                            "type": "string",
                            "description": "The city, e.g., San Francisco",
                        }
                    },
                    "required": ["city"],
                },
            },
        }
    ]

    messages = [{"role": "system", "content": "You are a helpful assistant that can access tools to get weather information."}]

    # --- Main Loop ---
    print("\n🚀 I am an AI agent with native tool-calling ability.")
    print("   For example: 'What is the weather like in London?'")
    print("   Type 'exit' to end the application.")
    print("----------------------------------------------------------------")

    while True:
        user_query = input("\nYour request: ")
        if user_query.lower() == 'exit':
            print("\nExiting application. Goodbye!")
            break
        
        messages.append({"role": "user", "content": user_query})

        try:
            # --- Step 1: Send the conversation and available tools to the model ---
            print("\n🤔 Checking if a tool is needed...")
            response = client.chat.completions.create(
                model=chat_deployment,
                messages=messages,
                tools=tools,
                tool_choice="auto",
            )
            response_message = response.choices[0].message

            # --- Step 2: Check if the model wants to call a tool ---
            if response_message.tool_calls:
                print("🛠️ Tool call requested by the model.")
                # Append the assistant's response to the message history
                messages.append(response_message)

                # --- Step 3: Execute the tool call ---
                for tool_call in response_message.tool_calls:
                    function_name = tool_call.function.name
                    function_to_call = globals().get(function_name)
                    function_args = json.loads(tool_call.function.arguments)
                    
                    print(f"📞 Calling function: {function_name} with args: {function_args}")
                    function_response = function_to_call(**function_args)
                    print(f"💡 Tool output: {function_response}")

                    # --- Step 4: Send the tool output back to the model ---
                    messages.append(
                        {
                            "tool_call_id": tool_call.id,
                            "role": "tool",
                            "name": function_name,
                            "content": function_response,
                        }
                    )
                
                # Get a new response from the model with the tool's output
                print("💬 Getting final response from model...")
                final_response = client.chat.completions.create(
                    model=chat_deployment,
                    messages=messages,
                )
                final_answer = final_response.choices[0].message.content
            else:
                # No tool needed, the model's response is the final answer
                final_answer = response_message.content

            print(f"\n🤖 Answer: {final_answer}")
            messages.append({"role": "assistant", "content": final_answer})

        except Exception as e:
            print(f"An error occurred: {e}")

if __name__ == "__main__":
    main()
