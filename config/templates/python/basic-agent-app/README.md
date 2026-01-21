# Basic AI Agent Template (ReAct Pattern)

This template provides a simple, command-line AI agent that can use tools to accomplish tasks. It demonstrates the foundational **ReAct (Reason + Act)** pattern, which is the core logic behind most modern AI agents.

## How It Works: The ReAct Pattern

An AI agent goes beyond simple Q&A. It can reason about a problem, decide what tools it needs, use them, and then formulate an answer based on the results. This template implements a simplified version of that loop:

1.  **User Request:** The user gives the agent a task (e.g., "What's the weather like in San Francisco?").

2.  **Reason:** The application sends a carefully crafted prompt to a powerful chat model (like GPT-4). This prompt includes the user's request and a description of the available tools (in this case, a `get_current_weather` function). The model's job is to determine if a tool is needed and, if so, to output a JSON object specifying which tool to call and with what arguments.

3.  **Act:** The Python application parses the model's JSON response. If a tool call is requested, the application executes the corresponding Python function (e.g., it calls `get_current_weather(city="San Francisco")`).

4.  **Observe & Final Answer:** The output from the tool is then fed back into the chat model with a new prompt, asking it to formulate a final, natural-language answer for the user based on the tool's results.

This simple loop is the essence of how AI agents can interact with external systems and take actions in the world.

## Prerequisites

- Python 3.8+
- An Azure account with an active Azure OpenAI Service resource. You will need:
  - Your API Key
  - Your resource endpoint URL
  - The deployment name for a powerful chat model capable of reasoning and following JSON format instructions (e.g., a `gpt-4` deployment).

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
