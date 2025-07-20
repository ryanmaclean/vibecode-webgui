# AgentLite App Template

This template provides a lightweight, command-line AI agent built with [AgentLite](https://github.com/SalesforceAIResearch/AgentLite), a research-oriented framework for creating task-focused agents. This example demonstrates how to build a simple agent that can use a search tool to answer questions.

## How It Works: AgentLite Concepts

AgentLite is designed around a few core concepts:

1.  **Actions:** These are the tools or functions that an agent can use. In this template, the agent has one action: `DuckDuckGoSearch`, which allows it to search the web.

2.  **Agents:** An agent is given a name, a role (a system prompt), and a set of actions. It uses a Large Language Model (LLM) to reason about which action to use to accomplish a given task.

3.  **Few-Shot Examples:** You can guide the agent's behavior by providing it with examples of successful task completion. In `app.py`, the `__build_examples__` method shows the agent how to think, use the search tool, and provide a final answer.

4.  **Task Execution:** When the agent receives a task, it enters a reasoning loop:
    -   **Think:** It decides what to do next.
    -   **Act:** It executes an action (e.g., performs a search).
    -   **Observe:** It receives the result from the action.
    -   It repeats this process until it can provide a final answer.

## Prerequisites

-   Python 3.8+
-   An [OpenAI API Key](https://platform.openai.com/api-keys).

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
    -   Open the `.env` file and add your OpenAI API key.

5.  **Run the application:**
    ```bash
    python app.py
    ```

6.  **Give the agent a task!** Ask it a question that requires a web search. To exit, type `exit` and press Enter.

## Customization

-   **Add New Actions:** Create a new class that inherits from `BaseAction` and add it to the `actions` list when initializing the `SearchAgent`.
-   **Improve Reasoning:** Add more examples to the `__build_examples__` method to teach the agent how to handle more complex tasks or use new tools.
