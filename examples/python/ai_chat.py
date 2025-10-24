"""
AI Chat Example - Python SDK

Demonstrates AI chat functionality:
- Sending chat messages
- Using context and RAG
- Managing conversations
- Working with different AI models
"""

import asyncio
import os
from datetime import datetime

from vibecode_client import VibeCodeClient


async def main():
    """Main function demonstrating AI chat features."""

    async with VibeCodeClient(
        base_url=os.getenv("VIBECODE_API_URL", "http://localhost:3000/api"),
        token=os.getenv("VIBECODE_TOKEN"),
    ) as client:
        try:
            # Create a workspace for context
            print("Creating workspace for AI context...")
            workspace = await client.create_workspace(
                project_id=f"ai-demo-{int(datetime.now().timestamp())}",
                project_name="AI Demo",
                framework="react",
                files={
                    "src/components/Button.jsx": """
export default function Button({ children, onClick }) {
  return (
    <button onClick={onClick} className="btn">
      {children}
    </button>
  );
}""",
                    "src/components/Counter.jsx": """
import { useState } from 'react';
import Button from './Button';

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <h2>Count: {count}</h2>
      <Button onClick={() => setCount(count + 1)}>
        Increment
      </Button>
    </div>
  );
}""",
                },
            )

            print(f"Workspace created: {workspace.id}\n")

            # Example 1: Simple chat without context
            print("Example 1: Simple chat question")
            response1 = await client.chat(
                message="What are React hooks and why are they useful?",
                model="anthropic/claude-3.5-sonnet",
                temperature=0.7,
            )

            print("AI Response:")
            print(response1["response"])
            print(f"\nTokens used: {response1['usage']['total_tokens']}\n")

            # Example 2: Chat with workspace context and RAG
            print("Example 2: Chat with workspace context")
            response2 = await client.chat(
                message="How can I improve the Counter component in this codebase?",
                workspace_id=workspace.id,
                enable_rag=True,
                model="anthropic/claude-3.5-sonnet",
                context={
                    "files": ["src/components/Counter.jsx", "src/components/Button.jsx"],
                },
            )

            print("AI Response:")
            print(response2["response"])
            print(f"\nTokens used: {response2['usage']['total_tokens']}\n")

            # Example 3: Multi-turn conversation
            print("Example 3: Multi-turn conversation")
            from vibecode_client.types import ChatMessage, ChatRole

            messages = [
                ChatMessage(
                    role=ChatRole.USER,
                    content="I want to add a reset button to the counter",
                ),
            ]

            response3 = await client.chat(
                message="Show me the code for adding a reset button",
                messages=messages,
                workspace_id=workspace.id,
                enable_rag=True,
                temperature=0.5,  # Lower temperature for more focused code generation
            )

            print("AI Response:")
            print(response3["response"])

            # Example 4: Code generation with specific requirements
            print("\n\nExample 4: Specific code generation")
            response4 = await client.chat(
                message=(
                    "Create a new component called TodoList that manages a list of tasks "
                    "with add, delete, and toggle complete functionality. Use TypeScript."
                ),
                model="anthropic/claude-3.5-sonnet",
                temperature=0.3,
                max_tokens=2000,
                enable_tools=True,
            )

            print("AI Generated Code:")
            print(response4["response"])

            # Example 5: Using streaming (if supported)
            print("\n\nExample 5: Streaming response")
            stream_response = await client.stream_chat(
                conversation_id=f"conv-{int(datetime.now().timestamp())}",
                message="Explain the useState hook with an example",
                workspace_id=workspace.id,
            )

            print("Stream initiated:", stream_response)

            # Clean up
            print("\n\nCleaning up...")
            await client.delete_workspace(workspace.id)
            print("Workspace deleted")

        except Exception as e:
            print(f"Error: {e}")
            return 1

    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)
