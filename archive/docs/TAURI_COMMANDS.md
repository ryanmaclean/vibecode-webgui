# Tauri App Commands Reference

All available commands in the VibeCode Tauri app.

## Basic Commands

- `greet(name)` - Hello message
- `ping()` - Health check, returns "pong"

## Browser Commands

- `open_browser_window()` - Open browser window
- `navigate_to(url)` - Navigate to URL
- `launch_browser(url)` - Launch system browser

## Docker Commands

- `check_docker()` - Check if Docker is available
- `get_docker_version()` - Get Docker version
- `get_docker_status()` - Get Docker status (available, version)
- `get_docker_info()` - Get detailed Docker info
- `start_containers()` - Start Docker containers
- `stop_containers()` - Stop Docker containers
- `restart_containers()` - Restart Docker containers

## mDNS/Bonjour Commands

- `start_mdns_service(user_name, port)` - Start mDNS advertising
- `discover_vibecode_sessions()` - Discover VibeCode sessions
- `stop_mdns_service(user_name)` - Stop mDNS service

## VM Commands

### Lima VM
- `start_lima_vm()` - Start Lima VM
- `stop_lima_vm()` - Stop Lima VM
- `status_lima_vm()` - Get Lima VM status

### vfkit VM
- `start_vfkit_vm()` - Start vfkit VM with Datadog tracing

## code-server Commands

- `start_code_server()` - Start code-server on port 8080
  - Auto-detects bundled or system code-server
  - Creates workspace at `~/vibecode/workspaces/default`
  - Configures extensions and user data
  - Sets up Datadog tracing

## AI Commands

### Chat & Completion
- `ai_chat(request)` - AI chat with multiple providers
- `ai_complete(code, cursor, language)` - Code completion
- `ai_explain(code, language)` - Code explanation
- `ai_optimize(code, language)` - Code optimization
- `ai_fix(code, language)` - Bug fixing
- `ai_chat_stream(request, stream_id)` - Streaming chat (TODO)

### Model Management
- `ai_list_models()` - List available AI models
- `ai_get_model_info(model_id)` - Get model info

### MCP (Model Context Protocol)
- `mcp_connect(server_config)` - Connect to MCP server
- `mcp_list_tools(server_id)` - List MCP tools
- `mcp_call_tool(server_id, tool_name, args)` - Call MCP tool

### Agents
- `agent_create_task(task_description, agents)` - Create agent task (TODO)
- `agent_get_status(task_id)` - Get agent task status (TODO)

## What the App Does

1. **Wraps code-server** - Launches VS Code in browser
2. **VM Management** - Start/stop VMs (Lima, vfkit)
3. **Docker Integration** - Manage Docker containers
4. **AI Features** - Chat, completion, explanation via Tauri backend
5. **Service Discovery** - mDNS/Bonjour for session discovery

## No Snapshots or VM Management

**Note**: The app does NOT include:
- ❌ VM snapshot management
- ❌ VM cloning (handled by scripts)
- ❌ VM suspend/resume (use system features)
- ❌ File browser in Tauri window

The app just starts code-server and provides commands.

## Simple Summary

```
User opens Tauri app
 → Launches code-server
 → Opens browser to localhost:8080
 → VS Code loads with VibeCode extension
 → Can use AI features via extension
```

That's it. Simple wrapper around code-server.
