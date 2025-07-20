import os
from typing import List
from dotenv import load_dotenv

# --- AgentLite Core Imports ---
from agentlite.actions import BaseAction, FinishAct, ThinkAct
from agentlite.actions.InnerActions import INNER_ACT_KEY
from agentlite.agents import BaseAgent
from agentlite.commons import AgentAct, TaskPackage
from agentlite.llm.agent_llms import get_llm_backend
from agentlite.llm.LLMConfig import LLMConfig
from agentlite.logging.terminal_logger import AgentLogger

# --- Action/Tool Definition ---
# Actions are the tools that an agent can use.
import duckduckgo_search

class DuckDuckGoSearch(BaseAction):
    """A tool to search the web using DuckDuckGo."""
    def __init__(self) -> None:
        action_name = "DuckDuckGo_Search"
        action_desc = "Use this action to search for information on the web."
        params_doc = {"query": "A simple, direct search query."}
        self.ddgs = duckduckgo_search.DDGS()
        super().__init__(action_name, action_desc, params_doc)

    def __call__(self, query: str) -> str:
        print(f"\n🔎 Searching for: {query}")
        results = self.ddgs.chat(query)
        print(f"💡 Got search result: {results[:150]}...")
        return results

# --- Agent Definition ---
# Agents have a role and a set of actions they can perform.
class SearchAgent(BaseAgent):
    """An agent that can search the web to answer questions."""
    def __init__(self, llm: str = "gpt-3.5-turbo"):
        # 1. Configure the LLM for the agent
        llm_config = LLMConfig({"llm_name": llm, "temperature": 0.1})
        agent_llm = get_llm_backend(llm_config)

        # 2. Define the agent's role and available actions
        name = "Web_Searcher"
        role = "You are an AI assistant that can search the web to answer user questions."
        actions = [DuckDuckGoSearch()]
        logger = AgentLogger(PROMPT_DEBUG_FLAG=False)

        super().__init__(name=name, role=role, llm=agent_llm, actions=actions, logger=logger)
        self.__build_examples__()

    def __build_examples__(self):
        """Adds few-shot examples to guide the agent's behavior."""
        task = "Who is the CEO of OpenAI?"
        task_package = TaskPackage(instruction=task)

        # Example of the agent's thought process and actions
        act_1 = AgentAct(name=ThinkAct.action_name, params={INNER_ACT_KEY: "I need to find out who the current CEO of OpenAI is."})
        obs_1 = "OK."
        act_2 = AgentAct(name=DuckDuckGoSearch.action_name, params={"query": "CEO of OpenAI"})
        obs_2 = "Sam Altman is the CEO of OpenAI."
        act_3 = AgentAct(name=FinishAct.action_name, params={INNER_ACT_KEY: "The CEO of OpenAI is Sam Altman."})
        obs_3 = "Task Completed."

        self.add_example(task=task_package, action_chain=[(act_1, obs_1), (act_2, obs_2), (act_3, obs_3)])

# --- Main Application Loop ---
def main():
    """An interactive CLI to run the AgentLite Search Agent."""
    load_dotenv()
    if not os.getenv("OPENAI_API_KEY"):
        print("Error: OPENAI_API_KEY not found. Please create a .env file.")
        return

    print("\n🚀 Initializing AgentLite Search Agent...")
    agent = SearchAgent()
    print("✅ Agent initialized.")
    print("----------------------------------------------------------------")
    print("   Ask a question, and the agent will use DuckDuckGo to find the answer.")
    print("   Type 'exit' to end the application.")
    print("----------------------------------------------------------------")

    while True:
        try:
            user_query = input("\nYour question: ")
            if user_query.lower() == 'exit':
                print("\nExiting application. Goodbye!")
                break
            
            task = TaskPackage(instruction=user_query)
            response = agent(task)
            print(f"\n🤖 Agent's Answer: {response}")

        except Exception as e:
            print(f"An error occurred: {e}")

if __name__ == "__main__":
    main()
