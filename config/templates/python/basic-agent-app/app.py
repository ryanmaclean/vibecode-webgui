import os
import json
from openai import AzureOpenAI
from dotenv import load_dotenv

# --- 1. Tool Definition ---
def get_current_weather(city: str) -> str:
    """Gets the current weather for a given city."""
    # This is a mock tool. In a real application, this would call a weather API.
    if "san francisco" in city.lower():
        return json.dumps({"city": "San Francisco", "temperature": "75°F", "condition": "Sunny"})
    elif "new york" in city.lower():
        return json.dumps({"city": "New York", "temperature": "68°F", "condition": "Cloudy"})
    elif "london" in city.lower():
        return json.dumps({"city": "London", "temperature": "59°F", "condition": "Rainy"})
    else:
        return json.dumps({"city": city, "error": "City not found"})

AVAILABLE_TOOLS = {
    "get_current_weather": get_current_weather
}

# --- 2. Main Application ---
def main():
    """A basic AI agent that uses the ReAct pattern to accomplish tasks."""
    # --- Initialization ---
    load_dotenv()
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    chat_deployment = os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT")

    if not all([api_key, azure_endpoint, chat_deployment]):
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

    # --- Main Loop ---
    print("\n🚀 I am a basic AI agent. Ask me something that requires a tool.")
    print("   For example: 'What is the weather like in San Francisco?'")
    print("   Type 'exit' to end the application.")
    print("----------------------------------------------------------------")

    while True:
        user_query = input("\nYour request: ")
        if user_query.lower() == 'exit':
            print("\nExiting application. Goodbye!")
            break
        
        try:
            # --- ReAct (Reason + Act) Loop ---
            
            # 1. Reason: The model decides if a tool is needed.
            print("\n🤔 Thinking...")
            tool_call_request = reason_and_get_tool_call(client, chat_deployment, user_query)

            # 2. Act: If a tool is needed, execute it.
            if tool_call_request:
                tool_name = tool_call_request['name']
                tool_args = tool_call_request['arguments']
                print(f"🛠️ Using tool: {tool_name} with arguments {tool_args}")
                
                tool_function = AVAILABLE_TOOLS.get(tool_name)
                if tool_function:
                    tool_output = tool_function(**tool_args)
                    print(f"💡 Tool output: {tool_output}")
                else:
                    tool_output = f"Error: Tool '{tool_name}' not found."

                # 3. Final Response: The model uses the tool's output to generate a final answer.
                final_answer = generate_final_answer(client, chat_deployment, user_query, tool_output)
            else:
                # If no tool is needed, just generate a direct response.
                print("No tool needed. Generating a direct response.")
                final_answer = generate_final_answer(client, chat_deployment, user_query, tool_output=None)

            print(f"\n🤖 Answer: {final_answer}")

        except Exception as e:
            print(f"An error occurred: {e}")

def reason_and_get_tool_call(client, model, query: str) -> dict | None:
    """The 'Reason' part of ReAct. Decides which tool to use and with what arguments."""
    system_prompt = f"""
You are an AI agent that can use tools to answer questions. Your goal is to determine if a tool is needed to answer the user's query and to provide the necessary JSON to call that tool.

Available tools:
- `get_current_weather(city: str)`: Gets the current weather for a given city.

If the user's query requires a tool, respond with a JSON object like this:
{{"tool_call": {{"name": "<tool_name>", "arguments": {{"<arg_name>": "<arg_value>"}}}}}}

If no tool is needed, respond with:
{{"tool_call": null}}

Do not add any other text to your response.
"""

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": query}
        ],
        temperature=0.0,
        max_tokens=150
    )
    
    response_text = response.choices[0].message.content
    response_json = json.loads(response_text)
    return response_json.get("tool_call")

def generate_final_answer(client, model, query: str, tool_output: str | None) -> str:
    """Generates the final natural language response for the user."""
    system_prompt = "You are a helpful AI assistant. Answer the user's question based on the information provided."
    
    if tool_output:
        user_prompt = f"The user asked: '{query}'. A tool was run and returned this information: {tool_output}. Based on this, please provide a final, natural language answer."
    else:
        user_prompt = query # No tool was needed, just answer the query directly.

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.7,
        max_tokens=250
    )
    return response.choices[0].message.content

if __name__ == "__main__":
    main()
