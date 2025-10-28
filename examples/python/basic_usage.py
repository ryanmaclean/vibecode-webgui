"""
Basic Usage Example - Python SDK

Demonstrates basic operations with the VibeCode API:
- Creating and initializing the client
- Managing authentication
- Creating and managing workspaces
- Basic error handling
"""

import asyncio
import os
from datetime import datetime

from vibecode_client import VibeCodeClient, VibeCodeError


async def main():
    """Main function demonstrating basic SDK usage."""

    # Create client instance using context manager
    async with VibeCodeClient(
        base_url=os.getenv("VIBECODE_API_URL", "http://localhost:3000/api"),
        token=os.getenv("VIBECODE_TOKEN"),
        auto_manage_csrf=True,
    ) as client:
        try:
            print("Initializing client...")
            # Client is automatically initialized in context manager

            # List existing workspaces
            print("\nListing workspaces...")
            workspaces = await client.list_workspaces(page=1, limit=10)
            print(f"Found {workspaces.total} workspaces")

            for ws in workspaces.workspaces:
                print(f"  - {ws.project_name} ({ws.status})")

            # Create a new workspace
            print("\nCreating new workspace...")
            new_workspace = await client.create_workspace(
                project_id=f"demo-{int(datetime.now().timestamp())}",
                project_name="Demo Project",
                framework="react",
                files={
                    "package.json": """{
  "name": "demo-project",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}""",
                    "src/App.jsx": """export default function App() {
  return <h1>Hello from VibeCode!</h1>;
}""",
                    "README.md": "# Demo Project\n\nCreated with VibeCode API",
                },
                dependencies=["react", "react-dom"],
            )

            print(f"Workspace created: {new_workspace.id}")
            print(f"Status: {new_workspace.status}")

            # Get workspace details
            print("\nFetching workspace details...")
            workspace = await client.get_workspace(new_workspace.id)
            print(f"Files in workspace: {len(workspace.files or {})}")

            # Update workspace
            print("\nUpdating workspace...")
            await client.update_workspace(
                new_workspace.id,
                project_name="Demo Project - Updated",
                environment={
                    "NODE_ENV": "development",
                },
            )
            print("Workspace updated successfully")

            # Check rate limit
            rate_limit_info = client.get_rate_limit_info()
            if rate_limit_info:
                print("\nRate limit info:")
                print(f"  Limit: {rate_limit_info.limit}")
                print(f"  Remaining: {rate_limit_info.remaining}")
                print(f"  Resets at: {rate_limit_info.reset}")

            # Clean up (optional - delete the workspace)
            print("\nCleaning up...")
            await client.delete_workspace(new_workspace.id)
            print("Workspace deleted successfully")

        except VibeCodeError as e:
            print("\nError occurred:")
            print(f"  Type: {e.error}")
            print(f"  Message: {e.message}")
            print(f"  Status: {e.status_code}")
            print(f"  Request ID: {e.request_id}")
            return 1

    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)
