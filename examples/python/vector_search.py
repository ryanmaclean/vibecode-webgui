
# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
Vector Search Example - Python SDK

Demonstrates semantic search and RAG:
- Performing vector searches
- Using search results with AI chat
- Finding similar code patterns
- Content-based retrieval
"""

import asyncio
import os
from datetime import datetime

from vibecode_client import VibeCodeClient


async def main():
    """Main function demonstrating vector search features."""

    async with VibeCodeClient(
        base_url=os.getenv("VIBECODE_API_URL", "http://localhost:3000/api"),
        token=os.getenv("VIBECODE_TOKEN"),
    ) as client:
        try:
            # Create a workspace with various files
            print("Creating workspace with sample code...")
            workspace = await client.create_workspace(
                project_id=f"search-demo-{int(datetime.now().timestamp())}",
                project_name="Vector Search Demo",
                framework="react",
                files={
                    "src/auth/login.js": """
export async function login(username, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new Error('Login failed');
  }

  const { token } = await response.json();
  localStorage.setItem('authToken', token);
  return token;
}""",
                    "src/auth/logout.js": """
export function logout() {
  localStorage.removeItem('authToken');
  window.location.href = '/login';
}""",
                    "src/auth/protected.js": """
export function isAuthenticated() {
  return !!localStorage.getItem('authToken');
}

export function requireAuth(Component) {
  return function AuthenticatedComponent(props) {
    if (!isAuthenticated()) {
      window.location.href = '/login';
      return null;
    }
    return <Component {...props} />;
  };
}""",
                    "src/api/fetch.js": """
export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('authToken');

  const response = await fetch(endpoint, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
}""",
                    "src/components/LoginForm.jsx": """
import { useState } from 'react';
import { login } from '../auth/login';

export default function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(username, password);
      window.location.href = '/dashboard';
    } catch (err) {
      setError('Invalid credentials');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      {error && <p className="error">{error}</p>}
      <button type="submit">Login</button>
    </form>
  );
}""",
                },
            )

            print(f"Workspace created: {workspace.id}\n")

            # Example 1: Search for authentication-related code
            print("Example 1: Searching for authentication code...")
            auth_search = await client.vector_search(
                workspace_id=workspace.id,
                query="user authentication and login",
                max_results=5,
                threshold=0.6,
            )

            print(f"Found {len(auth_search['results'])} relevant files:")
            for index, result in enumerate(auth_search["results"], 1):
                print(f"\n{index}. {result['file']} (score: {result['score']:.2f})")
                print(f"   Preview: {result['content'][:100]}...")

            # Example 2: Search for token management
            print("\n\nExample 2: Searching for token management...")
            token_search = await client.vector_search(
                workspace_id=workspace.id,
                query="JWT token storage and retrieval",
                max_results=3,
                threshold=0.7,
            )

            print(f"Found {len(token_search['results'])} relevant files:")
            for index, result in enumerate(token_search["results"], 1):
                print(f"\n{index}. {result['file']} (score: {result['score']:.2f})")

            # Example 3: Use search results with AI chat
            print("\n\nExample 3: Using search results with AI chat...")
            relevant_files = [r["file"] for r in auth_search["results"][:3]]

            ai_response = await client.chat(
                message=(
                    "How is authentication implemented in this codebase? "
                    "Are there any security concerns?"
                ),
                workspace_id=workspace.id,
                enable_rag=True,
                context={
                    "files": relevant_files,
                },
            )

            print("\nAI Analysis:")
            print(ai_response["response"])

            # Example 4: Search for specific patterns
            print("\n\nExample 4: Searching for API request patterns...")
            api_search = await client.vector_search(
                workspace_id=workspace.id,
                query="making HTTP requests with fetch",
                max_results=5,
                threshold=0.5,
            )

            print(f"Found {len(api_search['results'])} relevant code snippets:")
            for index, result in enumerate(api_search["results"], 1):
                print(f"\n{index}. {result['file']}")
                print(f"   Similarity: {result['score'] * 100:.1f}%")
                if result.get("metadata"):
                    print(f"   Metadata: {result['metadata']}")

            # Example 5: Combine multiple searches for comprehensive analysis
            print("\n\nExample 5: Comprehensive code analysis...")

            searches = await asyncio.gather(
                client.vector_search(
                    workspace_id=workspace.id, query="authentication", max_results=3
                ),
                client.vector_search(
                    workspace_id=workspace.id, query="error handling", max_results=3
                ),
                client.vector_search(
                    workspace_id=workspace.id, query="React components", max_results=3
                ),
            )

            all_relevant_files = set()
            for search in searches:
                for result in search["results"]:
                    all_relevant_files.add(result["file"])

            print(f"Total unique files found: {len(all_relevant_files)}")

            analysis_response = await client.chat(
                message=(
                    "Analyze the overall code quality, architecture, and potential "
                    "improvements for this codebase."
                ),
                workspace_id=workspace.id,
                enable_rag=True,
                context={
                    "files": list(all_relevant_files),
                },
                temperature=0.5,
            )

            print("\nComprehensive Analysis:")
            print(analysis_response["response"])

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