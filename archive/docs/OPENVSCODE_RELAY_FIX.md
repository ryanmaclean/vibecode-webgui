# Fix Bun Relay for OpenVSCode Server

**Issue:** HTTP 403 Forbidden even with token - Bun relay not forwarding query parameters correctly

---

## Problem

The Bun relay in `bun-server.js` has a bug - it's not preserving query parameters when forwarding requests:

```javascript
// Current (BROKEN):
const targetURL = `http://127.0.0.1:${INTERNAL_PORT}${url.pathname}${url.search}`;
```

The `url.search` should include query parameters, but the relay might be stripping them or not forwarding correctly.

---

## Fixed Bun Relay Code

**Updated `bun-server.js`:**

```javascript
#!/usr/bin/env bun
// Bun-optimized OpenVSCode Server with TCP relay for external access
import { spawn } from "bun";

const INTERNAL_PORT = 3000;
const EXTERNAL_PORT = 8080;
const HOST = process.env.HOST || "0.0.0.0";

let connectionToken = null;

console.log("Starting OpenVSCode Server with TCP relay...");
console.log(`Internal server: 127.0.0.1:${INTERNAL_PORT}`);
console.log(`External access: ${HOST}:${EXTERNAL_PORT} (via relay)`);

// Start OpenVSCode server
const server = spawn({
    cmd: ["/opt/openvscode/bin/openvscode-server"],
    args: [
        "--host", "127.0.0.1",
        "--port", INTERNAL_PORT.toString(),
        "--without-connection-token",
        "--accept-server-license-terms",
        "--user-data-dir", "/tmp/vscode-data"
    ],
    stdout: "pipe",  // Capture to extract token
    stderr: "inherit",
    cwd: "/opt/openvscode",
    env: {
        ...process.env,
        NODE_OPTIONS: "--max-old-space-size=384"
    }
});

// Extract token from OpenVSCode output
const outputBuffer = [];
server.stdout.on("data", (data) => {
    const output = data.toString();
    outputBuffer.push(output);
    console.log(output);
    
    // Look for token: "tkn=xxxx-xxxx-xxxx" or "Web UI available at ...?tkn=..."
    const fullOutput = outputBuffer.join('');
    const tokenMatch = fullOutput.match(/tkn=([a-f0-9-]+)/i);
    if (tokenMatch && !connectionToken) {
        connectionToken = tokenMatch[1];
        console.log(`✅ Extracted connection token: ${connectionToken}`);
    }
});

// Start relay after OpenVSCode initializes
setTimeout(() => {
    console.log("Starting TCP relay...");
    
    Bun.serve({
        port: EXTERNAL_PORT,
        hostname: HOST,
        async fetch(req, server) {
            const url = new URL(req.url);
            
            // Build target URL with ALL query parameters preserved
            let targetPath = url.pathname;
            let targetSearch = url.search;  // Includes '?' and all params
            
            // If we have a token and request doesn't have one, add it
            if (connectionToken && !url.searchParams.has('tkn')) {
                targetSearch = targetSearch 
                    ? `${targetSearch}&tkn=${connectionToken}`
                    : `?tkn=${connectionToken}`;
            }
            
            const targetURL = `http://127.0.0.1:${INTERNAL_PORT}${targetPath}${targetSearch}`;
            
            // Copy headers, but update Host
            const headers = new Headers(req.headers);
            headers.set("Host", `127.0.0.1:${INTERNAL_PORT}`);
            headers.set("X-Forwarded-For", req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "");
            headers.set("X-Forwarded-Proto", "http");
            
            // Handle WebSocket upgrades
            if (req.headers.get("upgrade") === "websocket") {
                const success = server.upgrade(req, {
                    data: { 
                        token: connectionToken,
                        targetURL: `ws://127.0.0.1:${INTERNAL_PORT}${targetPath}${targetSearch}`
                    }
                });
                if (success) {
                    return undefined;
                }
            }
            
            try {
                // Forward request with all headers and body
                const response = await fetch(targetURL, {
                    method: req.method,
                    headers: headers,
                    body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : null,
                    redirect: 'manual'  // Handle redirects manually
                });
                
                // Copy response headers
                const responseHeaders = new Headers(response.headers);
                responseHeaders.delete('connection');
                responseHeaders.delete('transfer-encoding');
                
                return new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: responseHeaders
                });
            } catch (error) {
                console.error("Relay error:", error);
                return new Response(`Gateway error: ${error.message}`, { 
                    status: 502,
                    headers: { 'Content-Type': 'text/plain' }
                });
            }
        },
        websocket: {
            async message(ws, message) {
                // Forward WebSocket messages to OpenVSCode
                // Note: This is simplified - full WebSocket proxying is more complex
                try {
                    const wsClient = new WebSocket(ws.data.targetURL);
                    wsClient.on('message', (data) => ws.send(data));
                    wsClient.send(message);
                } catch (error) {
                    console.error("WebSocket relay error:", error);
                }
            },
            open(ws) {
                console.log("WebSocket connection opened");
            },
            close(ws) {
                console.log("WebSocket connection closed");
            },
            error(ws, error) {
                console.error("WebSocket error:", error);
            }
        }
    });
    
    console.log(`✓ TCP relay active: ${HOST}:${EXTERNAL_PORT} -> 127.0.0.1:${INTERNAL_PORT}`);
    if (connectionToken) {
        console.log(`✓ Connection token: ${connectionToken}`);
        console.log(`✓ Access at: http://<VM_IP>:${EXTERNAL_PORT}?tkn=${connectionToken}`);
    } else {
        console.log(`⚠ Token extraction pending - check console output`);
    }
}, 8000);  // Wait 8s for OpenVSCode to fully start

// Handle signals
process.on("SIGTERM", () => {
    console.log("Received SIGTERM, shutting down...");
    server.kill();
    process.exit(0);
});

process.on("SIGINT", () => {
    console.log("Received SIGINT, shutting down...");
    server.kill();
    process.exit(0);
});

await server.exited;
```

---

## Alternative: Simpler Fix - Bind Directly

**Even simpler:** Just bind OpenVSCode to `0.0.0.0` and skip the relay:

```javascript
// Start OpenVSCode directly on all interfaces
const server = spawn({
    cmd: ["/opt/openvscode/bin/openvscode-server"],
    args: [
        "--host", "0.0.0.0",  // Bind to all interfaces
        "--port", "3000",
        "--without-connection-token",
        "--accept-server-license-terms",
        "--user-data-dir", "/tmp/vscode-data"
    ],
    // ... rest
});
```

Then access at `http://192.168.64.3:3000` directly - no relay needed!

---

## Testing

After fixing, test:
```bash
# Should work without token (if --without-connection-token works)
curl http://192.168.64.3:8080

# Or with token (if relay extracts it)
curl "http://192.168.64.3:8080?tkn=<token>"
```

---

## Recommendation

**Use the simpler approach:** Bind OpenVSCode directly to `0.0.0.0:3000` and remove the relay complexity. The relay was only needed if OpenVSCode had to bind to localhost, but if `--without-connection-token` truly disables token checking, direct binding is simpler.

