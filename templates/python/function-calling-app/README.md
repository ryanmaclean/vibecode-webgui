# Function Calling App Template

This template provides a simple, command-line AI agent that uses the modern, native **tool-calling** (formerly function-calling) feature of the OpenAI API. This is the current best practice for building applications that need to interact with external tools or APIs.

## How It Works: Native Tool Calling

This approach is more efficient and reliable than manually prompting a model to generate JSON. The conversation with the model happens in a structured, multi-step process:

1.  **Define Tools:** The application defines a list of available tools, including their names, descriptions, and parameter schemas, and sends this list to the model along with the user's query.

2.  **Model Responds with Tool Call:** If the model determines that it needs to use one of the tools to answer the user's query, its response will contain a `tool_calls` object. This is a structured request from the model to the application, asking it to run a specific function with specific arguments.

3.  **Application Executes Tool:** The application receives this `tool_calls` object, parses it, and executes the corresponding Python function (e.g., `get_current_weather(city="London")`).

4.  **Send Result Back to Model:** The application then sends the result of the function call back to the model in a new message, referencing the original `tool_call_id`.

5.  **Model Generates Final Answer:** The model receives the tool's output and uses that information to generate a final, natural-language response for the user.

This structured loop is the recommended way to build reliable AI agents.

## Prerequisites

- Python 3.8+
- An Azure account with an active Azure OpenAI Service resource. You will need:
  - Your API Key
  - Your resource endpoint URL
  - The deployment name for a chat model that supports native tool-calling (e.g., `gpt-4`, `gpt-35-turbo`).

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
    -   Open the `.env` file and add your Azure OpenAI API key, endpoint, and chat model deployment name.

5.  **Run the application:**
    ```bash
    python app.py
    ```

6.  **Give the agent a task!** Try asking it about the weather in a city. To exit, type `exit` and press Enter.
