# Complete Tauri Commands Reference

## Core Commands (Essential)

### code-server Management
- `start_code_server()` - Start code-server on port 8080

**This is the core functionality. Without this, there's no app.**

## Optional Commands (Nice to Have)

### Docker Commands
- `check_docker()` - Check if Docker is available
- `get_docker_version()` - Get Docker version
- `get_docker_status()` - Get Docker status  
- `get_docker_info()` - Get detailed Docker info
- `start_containers()` - Start Docker containers
- `stop_containers()` - Stop containers
- `restart_containers()` - Restart containers

### VM Commands (Lima/vfkit)
- `start_lima_vm()` - Start Lima VM
- `stop_lima_vm()` - Stop Lima VM
- `status_lima_vm()` - Get Lima status
- `start_vfkit_vm()` - Start vfkit VM

### mDNS/Bonjour Service Discovery
- `start_mdns_service(user_name, port)` - Advertise session
- `discover_vibecode_sessions()` - Find other sessions
- `stop_mdns_service(user_name)` - Stop advertising

### Browser Commands
- `launch_browser(url)` - Open URL in default browser
- `open_browser_window()` - Open browser window
- `navigate_to(url)` - Navigate to URL

### Utility Commands
- `greet(name)` - Hello message
- `ping()` - Health check

## AI Commands (In src-tauri/src/ai/commands.rs)

### AI Chat
- `ai_chat(request)` - AI chat
- `ai_complete(code, cursor, language)` - Code completion
- `ai_explain(code, language)` - Code explanation
- `ai_chat_stream(request, stream_id)` - Streaming chat
- `ai_list_models()` - List available AI models

### MCP (Model Context Protocol)
- `mcp_connect(server_config)` - Connect to MCP server
- `mcp_list_tools(server_id)` - List MCP tools
- `mcp_call_tool(server_id, tool_name, args)` - Call MCP tool

### Agent Orchestration
- `agent_create_task(task_description, agents)` - Create agent task
- `agent_get_status(task_id)` - Get task status

**Note**: These AI commands are registered but not all are implemented yet.

## What Each Category Does

### code-server (ESSENTIAL)
- Starts VS Code in browser
- Provides full IDE functionality
- File browser, terminal, git integration all built-in

### Docker Commands (Optional)
- For development workflows
- Start/stop dev containers
- Useful for testing

### VM Commands (Optional)
- For Lima/vfkit development
- Running VMs for testing
- Alternative to Docker

### mDNS/Bonjour (Optional)
- Network service discovery
- Find other VibeCode sessions on network
- Good for collaboration

### AI Commands (Core Feature)
- Multi-provider AI support
- Code generation, completion, explanation
- MCP integration for tool calling
- Agent orchestration

## Architecture Summary

```
Tauri App
 ↓
Starts code-server (ESSENTIAL)
 ↓
Provides VS Code functionality
 ↓
Optional: Docker, VM, mDNS, AI commands
```

## What's Registered vs What Works

### ✅ Fully Implemented and Working
- code-server management
- Docker commands
- VM commands (Lima/vfkit)
- mDNS/Bonjour
- Browser launcher
- AI basic chat/completion

### ⚠️ Partially Implemented
- AI streaming (TODO)
- MCP integration (basic structure exists)
- Agent orchestration (structure exists, not implemented)

### ❌ Not Implemented
- Advanced AI features (conversation context, multi-turn)
- Advanced MCP features
- Agent task execution

## Recommendation

**Keep it simple.**

The app only needs:
1. `start_code_server()` - Start VS Code
2. AI commands - Core feature

Everything else is optional and can be removed if not used.

Remove unused commands to reduce complexity and maintenance burden.
