# Tauri as MCP Helper

Turn the VibeCode Tauri app into an MCP server that AI assistants can control.

## Concept

```
┌─────────────────────────────────────┐
│   Claude Desktop (MCP Client)       │
│   - Sends natural language requests │
│   - Receives structured responses   │
└─────────────┬───────────────────────┘
              │ MCP Protocol (stdio/HTTP)
              ▼
┌─────────────────────────────────────┐
│   VibeCode Tauri App (MCP Server)   │
│   - Runs locally on user's machine  │
│   - Has native system access        │
│   - Exposes Tauri commands as tools │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│   Local System Resources            │
│   - Docker containers               │
│   - Virtual machines (vfkit/Lima)   │
│   - Serial ports (Arduino/ESP32)    │
│   - File system                     │
│   - Network (mDNS discovery)        │
└─────────────────────────────────────┘
```

## Existing Tauri Commands (Already Built!)

We already have **17 commands** that can become MCP tools:

### Docker Management
```rust
✅ check_docker() -> bool
✅ get_docker_version() -> String
✅ get_docker_status() -> JSON
✅ get_docker_info() -> JSON
✅ start_containers() -> String
✅ stop_containers() -> String
✅ restart_containers() -> String
```

### VM Management
```rust
✅ start_vfkit_vm() -> String
✅ start_lima_vm() -> String
✅ stop_lima_vm() -> String
✅ status_lima_vm() -> String
```

### Service Discovery
```rust
✅ start_mdns_service(user_name, port) -> String
✅ discover_vibecode_sessions() -> Vec<Service>
✅ stop_mdns_service(user_name) -> String
```

### Browser Control
```rust
✅ launch_browser(url) -> ()
✅ open_browser_window(url) -> ()  // New from browser.rs
```

### Utility
```rust
✅ greet(name) -> String
✅ ping() -> String
```

## Implementation: Tauri MCP Bridge

### 1. Add MCP Server to Tauri

```rust
// src-tauri/src/mcp_server.rs
use tauri::{AppHandle, Manager};
use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Write};
use std::sync::{Arc, Mutex};

pub struct McpServer {
    app: AppHandle,
}

impl McpServer {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }

    pub async fn start(&self) {
        let stdin = std::io::stdin();
        let mut stdout = std::io::stdout();
        let reader = BufReader::new(stdin);

        for line in reader.lines() {
            let line = line.expect("Failed to read line");
            let request: Value = serde_json::from_str(&line).expect("Invalid JSON");

            let response = self.handle_request(request).await;

            let response_str = serde_json::to_string(&response).expect("Failed to serialize");
            writeln!(stdout, "{}", response_str).expect("Failed to write response");
            stdout.flush().expect("Failed to flush");
        }
    }

    async fn handle_request(&self, request: Value) -> Value {
        match request["method"].as_str() {
            Some("tools/list") => self.list_tools(),
            Some("tools/call") => self.call_tool(request["params"].clone()).await,
            _ => json!({
                "error": {
                    "code": -32601,
                    "message": "Method not found"
                }
            })
        }
    }

    fn list_tools(&self) -> Value {
        json!({
            "tools": [
                {
                    "name": "docker_check",
                    "description": "Check if Docker is available",
                    "inputSchema": {
                        "type": "object",
                        "properties": {},
                        "required": []
                    }
                },
                {
                    "name": "docker_start_containers",
                    "description": "Start all Docker containers",
                    "inputSchema": {
                        "type": "object",
                        "properties": {},
                        "required": []
                    }
                },
                {
                    "name": "vm_start_vfkit",
                    "description": "Start vfkit virtual machine",
                    "inputSchema": {
                        "type": "object",
                        "properties": {},
                        "required": []
                    }
                },
                {
                    "name": "vm_start_lima",
                    "description": "Start Lima virtual machine",
                    "inputSchema": {
                        "type": "object",
                        "properties": {},
                        "required": []
                    }
                },
                {
                    "name": "mdns_discover",
                    "description": "Discover VibeCode sessions on local network",
                    "inputSchema": {
                        "type": "object",
                        "properties": {},
                        "required": []
                    }
                },
                {
                    "name": "browser_open",
                    "description": "Open URL in system browser",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "url": {
                                "type": "string",
                                "description": "URL to open"
                            }
                        },
                        "required": ["url"]
                    }
                }
            ]
        })
    }

    async fn call_tool(&self, params: Value) -> Value {
        let tool_name = params["name"].as_str().unwrap_or("");
        let arguments = &params["arguments"];

        match tool_name {
            "docker_check" => self.docker_check().await,
            "docker_start_containers" => self.docker_start_containers().await,
            "vm_start_vfkit" => self.vm_start_vfkit().await,
            "vm_start_lima" => self.vm_start_lima().await,
            "mdns_discover" => self.mdns_discover().await,
            "browser_open" => self.browser_open(arguments["url"].as_str().unwrap_or("")).await,
            _ => json!({
                "error": {
                    "code": -32602,
                    "message": format!("Unknown tool: {}", tool_name)
                }
            })
        }
    }

    // Tool implementations that call Tauri commands
    async fn docker_check(&self) -> Value {
        match self.app.tauri_invoke("check_docker", json!({})).await {
            Ok(available) => json!({
                "content": [{
                    "type": "text",
                    "text": format!("Docker available: {}", available)
                }]
            }),
            Err(e) => json!({
                "error": {
                    "code": -32603,
                    "message": format!("Failed to check Docker: {}", e)
                }
            })
        }
    }

    async fn docker_start_containers(&self) -> Value {
        match self.app.tauri_invoke("start_containers", json!({})).await {
            Ok(result) => json!({
                "content": [{
                    "type": "text",
                    "text": format!("Containers started: {}", result)
                }]
            }),
            Err(e) => json!({
                "error": {
                    "code": -32603,
                    "message": format!("Failed to start containers: {}", e)
                }
            })
        }
    }

    async fn vm_start_vfkit(&self) -> Value {
        match self.app.tauri_invoke("start_vfkit_vm", json!({})).await {
            Ok(result) => json!({
                "content": [{
                    "type": "text",
                    "text": format!("vfkit VM started: {}", result)
                }]
            }),
            Err(e) => json!({
                "error": {
                    "code": -32603,
                    "message": format!("Failed to start vfkit VM: {}", e)
                }
            })
        }
    }

    async fn vm_start_lima(&self) -> Value {
        match self.app.tauri_invoke("start_lima_vm", json!({})).await {
            Ok(result) => json!({
                "content": [{
                    "type": "text",
                    "text": format!("Lima VM started: {}", result)
                }]
            }),
            Err(e) => json!({
                "error": {
                    "code": -32603,
                    "message": format!("Failed to start Lima VM: {}", e)
                }
            })
        }
    }

    async fn mdns_discover(&self) -> Value {
        match self.app.tauri_invoke("discover_vibecode_sessions", json!({})).await {
            Ok(sessions) => json!({
                "content": [{
                    "type": "text",
                    "text": format!("Discovered sessions: {}", sessions)
                }]
            }),
            Err(e) => json!({
                "error": {
                    "code": -32603,
                    "message": format!("Failed to discover sessions: {}", e)
                }
            })
        }
    }

    async fn browser_open(&self, url: &str) -> Value {
        match self.app.tauri_invoke("launch_browser", json!({"url": url})).await {
            Ok(_) => json!({
                "content": [{
                    "type": "text",
                    "text": format!("Opened browser: {}", url)
                }]
            }),
            Err(e) => json!({
                "error": {
                    "code": -32603,
                    "message": format!("Failed to open browser: {}", e)
                }
            })
        }
    }
}

// Helper trait for invoking Tauri commands
trait TauriInvoke {
    async fn tauri_invoke(&self, cmd: &str, args: Value) -> Result<Value, String>;
}

impl TauriInvoke for AppHandle {
    async fn tauri_invoke(&self, cmd: &str, args: Value) -> Result<Value, String> {
        // This would use Tauri's internal command system
        // For now, simplified version
        Err("Not implemented".to_string())
    }
}
```

### 2. Register MCP Server in main.rs

```rust
// src-tauri/src/main.rs
mod mcp_server;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // ... existing commands
        ])
        .setup(|app| {
            // Check if running in MCP mode
            let args: Vec<String> = std::env::args().collect();
            if args.contains(&"--mcp".to_string()) {
                let app_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    let server = mcp_server::McpServer::new(app_handle);
                    server.start().await;
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 3. Claude Desktop Configuration

```json
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "vibecode": {
      "command": "/Applications/VibeCode.app/Contents/MacOS/vibecode",
      "args": ["--mcp"]
    }
  }
}
```

## Usage from AI Assistants

### Claude Desktop Example

```
User: "Check if Docker is running and start my containers"

Claude:
1. Calls docker_check → "Docker available: true"
2. Calls docker_start_containers → "Containers started: postgres, redis, datadog-agent"
→ "Docker is running. Started 3 containers: postgres, redis, and datadog-agent"
```

### Multi-Step Workflow

```
User: "Setup my development environment"

Claude:
1. docker_check → Verify Docker
2. docker_start_containers → Start services
3. vm_start_vfkit → Launch Alpine VM
4. mdns_discover → Find other dev sessions
5. browser_open → http://localhost:8080
→ "Environment ready! Postgres, Redis, and Alpine VM running. Code-server at localhost:8080"
```

## Simpler Alternative: HTTP Bridge

If stdio MCP is complex, create an HTTP bridge:

```rust
// src-tauri/src/mcp_http.rs
use axum::{Router, Json};
use serde_json::{json, Value};
use tokio::net::TcpListener;

pub async fn start_mcp_http_server(app: AppHandle) {
    let app_state = Arc::new(app);

    let app = Router::new()
        .route("/mcp/tools/list", get(list_tools))
        .route("/mcp/tools/call", post(call_tool))
        .with_state(app_state);

    let listener = TcpListener::bind("127.0.0.1:8765").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn list_tools() -> Json<Value> {
    Json(json!({
        "tools": [/* ... */]
    }))
}

async fn call_tool(Json(payload): Json<Value>) -> Json<Value> {
    // Handle tool calls
    Json(json!({"result": "success"}))
}
```

Then Claude Desktop config becomes:

```json
{
  "mcpServers": {
    "vibecode": {
      "command": "curl",
      "args": [
        "-X", "POST",
        "http://localhost:8765/mcp/tools/call",
        "-H", "Content-Type: application/json",
        "-d", "@-"
      ]
    }
  }
}
```

## Advantages of Tauri MCP Helper

### vs Node.js MCP Server
- ✅ **Native system access**: Direct Docker, serial ports, file system
- ✅ **Single binary**: No Node.js runtime needed
- ✅ **Lower overhead**: Rust is more efficient than Node.js
- ✅ **Better security**: Sandboxed Tauri environment

### vs Web API
- ✅ **Standard protocol**: Any MCP client works
- ✅ **Self-documenting**: Tools schema is built-in
- ✅ **Bi-directional**: Server can push updates
- ✅ **Type-safe**: JSON Schema validation

### vs Manual CLI
- ✅ **AI-native**: Designed for LLM consumption
- ✅ **Composable**: Combine with other MCP servers
- ✅ **Discoverable**: AI can explore available tools
- ✅ **Stateful**: Maintain context across calls

## Adding Serial Communication

```rust
// src-tauri/src/serial.rs (new module)
use serialport::{SerialPort, available_ports};
use tauri::command;

#[command]
pub fn serial_list_ports() -> Result<Vec<String>, String> {
    available_ports()
        .map_err(|e| e.to_string())?
        .iter()
        .map(|p| Ok(p.port_name.clone()))
        .collect()
}

#[command]
pub async fn serial_monitor(
    port: String,
    baud_rate: u32,
    duration_secs: u64,
) -> Result<String, String> {
    let mut port = serialport::new(&port, baud_rate)
        .timeout(Duration::from_millis(100))
        .open()
        .map_err(|e| e.to_string())?;

    let mut output = String::new();
    let mut buffer = vec![0; 1024];
    let end_time = Instant::now() + Duration::from_secs(duration_secs);

    while Instant::now() < end_time {
        match port.read(&mut buffer) {
            Ok(n) if n > 0 => {
                output.push_str(&String::from_utf8_lossy(&buffer[0..n]));
            }
            _ => continue
        }
    }

    Ok(output)
}
```

Then expose via MCP:

```json
{
  "name": "serial_monitor",
  "description": "Monitor serial port for specified duration",
  "inputSchema": {
    "type": "object",
    "properties": {
      "port": { "type": "string", "description": "/dev/ttyUSB0" },
      "baudRate": { "type": "number", "default": 115200 },
      "durationSecs": { "type": "number", "default": 30 }
    },
    "required": ["port"]
  }
}
```

## AI Use Cases

### Hardware Development

```
User: "Monitor my Arduino serial output and save it"

Claude:
1. serial_list_ports → ["/dev/ttyUSB0", "/dev/ttyUSB1"]
2. serial_monitor("/dev/ttyUSB0", 115200, 30) → "Boot logs..."
3. Save to file
→ "Monitored Arduino on /dev/ttyUSB0 for 30 seconds. Saved output to arduino_log.txt"
```

### Infrastructure Management

```
User: "Start all my dev services and open the dashboard"

Claude:
1. docker_check → true
2. docker_start_containers → "Started 5 containers"
3. vm_start_vfkit → "Alpine VM running"
4. browser_open("http://localhost:3000") → Opened
→ "All services running. Dashboard open at localhost:3000"
```

### Multi-Environment Testing

```
User: "Discover other VibeCode instances and connect to the one on port 8081"

Claude:
1. mdns_discover → [{name: "Alice's VibeCode", port: 8081}, ...]
2. browser_open("http://alice-mbp.local:8081") → Opened
→ "Found 3 VibeCode instances. Opened Alice's session"
```

## Next Steps

1. **Implement MCP bridge**: Either stdio or HTTP
2. **Test with Claude Desktop**: Verify end-to-end
3. **Add serial support**: Include `serialport` crate
4. **Expand tool catalog**: Expose all 17+ commands
5. **Publish configuration**: MCP Registry listing

## Security Considerations

### Sandboxing
- Tauri's native sandboxing protects system
- MCP commands must be explicitly allowed
- No arbitrary code execution

### Authentication
```rust
// Validate MCP client token
if request.headers().get("X-MCP-Token") != Some(&SECRET_TOKEN) {
    return Err("Unauthorized");
}
```

### Rate Limiting
```rust
// Prevent abuse
let limiter = RateLimiter::new(10, Duration::from_secs(60));
if !limiter.check() {
    return Err("Rate limit exceeded");
}
```

## References

- **MCP Specification**: https://modelcontextprotocol.io/
- **Tauri Commands**: https://v2.tauri.app/develop/calling-rust/
- **Claude Desktop MCP**: https://docs.anthropic.com/claude/docs/mcp
- **serialport-rs**: https://docs.rs/serialport/
