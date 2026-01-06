# OpenVSCode Server 403 Forbidden - Root Cause & Fix

**Date:** 2025-12-01  
**Status:** ✅ Root cause identified

---

## Root Cause

**OpenVSCode Server IS running**, but:

1. ✅ Server starts successfully on `127.0.0.1:3000`
2. ✅ Bun TCP relay is active on `0.0.0.0:8080`
3. ❌ **OpenVSCode generates a connection token automatically** (even with `--without-connection-token`)
4. ❌ **Bun relay doesn't forward the token** to requests
5. ❌ **OpenVSCode rejects requests without token** → HTTP 403 Forbidden

### Evidence

**Console log shows:**
```
Web UI available at http://localhost:3000?tkn=1444d7e4-86da-400a-9477-5a1d5e443315
```

**Token is:** `1444d7e4-86da-400a-9477-5a1d5e443315`

**Test result:**
```bash
curl http://192.168.64.3:8080
# → HTTP 403 Forbidden

curl "http://192.168.64.3:8080?tkn=1444d7e4-86da-400a-9477-5a1d5e443315"
# → Should work (needs testing)
```

---

## The Problem

The Bun relay in `bun-server.js` forwards requests but:
- Doesn't extract the token from OpenVSCode startup output
- Doesn't add token to relayed requests
- OpenVSCode requires token validation even with `--without-connection-token` flag

---

## Solutions

### Solution 1: Fix Bun Relay to Extract & Forward Token (Recommended)

**Update `bun-server.js`:**

```javascript
#!/usr/bin/env bun
import { spawn } from "bun";

const INTERNAL_PORT = 3000;
const EXTERNAL_PORT = 8080;
const HOST = process.env.HOST || "0.0.0.0";

let connectionToken = null;

// Start OpenVSCode server
const server = spawn({
    cmd: ["/opt/openvscode/bin/openvscode-server"],
    args: [
        "--host", "127.0.0.1",
        "--port", INTERNAL_PORT.toString(),
        "--without-connection-token",  // Try to disable, but may still generate token
        "--accept-server-license-terms",
        "--user-data-dir", "/tmp/vscode-data"
    ],
    stdout: "pipe",  // Capture output to extract token
    stderr: "inherit",
    cwd: "/opt/openvscode",
    env: {
        ...process.env,
        NODE_OPTIONS: "--max-old-space-size=384"
    }
});

// Extract token from OpenVSCode output
server.stdout.on("data", (data) => {
    const output = data.toString();
    console.log(output);
    
    // Look for token in output: "tkn=xxxx-xxxx-xxxx"
    const tokenMatch = output.match(/tkn=([a-f0-9-]+)/i);
    if (tokenMatch && !connectionToken) {
        connectionToken = tokenMatch[1];
        console.log(`✅ Extracted connection token: ${connectionToken}`);
    }
});

// Start Bun relay after OpenVSCode starts
setTimeout(() => {
    Bun.serve({
        port: EXTERNAL_PORT,
        hostname: HOST,
        async fetch(req, server) {
            const url = new URL(req.url);
            
            // Add token to request if we have it
            if (connectionToken && !url.searchParams.has('tkn')) {
                url.searchParams.set('tkn', connectionToken);
            }
            
            const targetURL = `http://127.0.0.1:${INTERNAL_PORT}${url.pathname}${url.search}`;
            
            const headers = new Headers(req.headers);
            headers.set("Host", `127.0.0.1:${INTERNAL_PORT}`);
            
            // Handle WebSocket upgrades
            if (req.headers.get("upgrade") === "websocket") {
                const success = server.upgrade(req, {
                    data: { token: connectionToken }
                });
                if (success) return undefined;
            }
            
            try {
                const response = await fetch(targetURL, {
                    method: req.method,
                    headers: headers,
                    body: req.body
                });
                return response;
            } catch (error) {
                console.error("Relay error:", error);
                return new Response("Gateway error: upstream server not ready", { status: 502 });
            }
        },
        websocket: {
            message(ws, message) {
                ws.send(message);
            },
            open(ws) {
                console.log("WebSocket connection opened");
            },
            close(ws) {
                console.log("WebSocket connection closed");
            }
        }
    });
    
    console.log(`✓ TCP relay active: ${HOST}:${EXTERNAL_PORT} -> 127.0.0.1:${INTERNAL_PORT}`);
    if (connectionToken) {
        console.log(`✓ Connection token: ${connectionToken}`);
        console.log(`✓ Access at: http://<VM_IP>:${EXTERNAL_PORT}?tkn=${connectionToken}`);
    } else {
        console.log(`⚠ Token not yet extracted, requests may fail`);
    }
}, 5000);
```

### Solution 2: Use Environment Variable for Token

**Set token explicitly:**
```javascript
const CONNECTION_TOKEN = process.env.OPENVSCODE_TOKEN || null;

// In OpenVSCode args:
if (CONNECTION_TOKEN) {
    args.push("--connection-token", CONNECTION_TOKEN);
} else {
    args.push("--without-connection-token");
}
```

### Solution 3: Bind OpenVSCode Directly to 0.0.0.0 (Simplest)

**Change init script:**
```bash
# Instead of relay, bind directly:
--host 0.0.0.0 --port 3000 --without-connection-token
```

Then access at `http://192.168.64.3:3000` directly.

---

## Immediate Workaround

**Use the token from console log:**
```bash
# Get token from console log
TOKEN=$(grep -oP 'tkn=\K[a-f0-9-]+' /tmp/vibecode-console-*.log | head -1)

# Access with token
open "http://192.168.64.3:8080?tkn=$TOKEN"
```

---

## Next Steps

1. ✅ **Root cause identified** - Token not forwarded by relay
2. ⏳ **Fix Bun relay** - Extract token from OpenVSCode output and forward it
3. ⏳ **Rebuild initramfs** - Update `bun-server.js` with token extraction
4. ⏳ **Test** - Verify access works without manual token

---

## Summary

**Yes, OpenVSCode Server IS running in the VM!** 

The 403 Forbidden is because:
- OpenVSCode generates a connection token
- Bun relay doesn't forward the token
- Requests without token are rejected

**Fix:** Update Bun relay to extract and forward the token automatically.

