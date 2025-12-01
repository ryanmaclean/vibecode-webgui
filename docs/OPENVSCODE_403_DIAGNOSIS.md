# OpenVSCode Server 403 Forbidden Diagnosis

**Date:** 2025-12-01  
**Issue:** HTTP 403 Forbidden when accessing OpenVSCode Server via port 8080

---

## Current Status

### What's Working ✅
- OpenVSCode Server **IS running** in the VM
- Server bound to `127.0.0.1:3000` (internal)
- Bun TCP relay active on `0.0.0.0:8080` → `127.0.0.1:3000`
- Network connectivity: Port 8080 responds (HTTP 403, not connection refused)

### What's Not Working ❌
- HTTP 403 Forbidden when accessing `http://192.168.64.3:8080`
- Port 3000 not accessible externally (connection refused - expected, it's localhost only)

---

## Root Cause Analysis

### The 403 Response

The HTTP 403 is coming from **OpenVSCode Server itself**, not the Bun relay. This happens because:

1. **OpenVSCode Server requires connection token validation**
   - Even with `--without-connection-token`, OpenVSCode may still validate tokens
   - The Bun relay forwards requests but doesn't handle token validation

2. **Missing connection token in requests**
   - Browser requests to `http://192.168.64.3:8080` don't include a token
   - OpenVSCode rejects them with 403 Forbidden

3. **Relay doesn't handle WebSocket upgrades properly**
   - OpenVSCode uses WebSockets for many operations
   - The Bun relay WebSocket handling may be incomplete

---

## Solutions

### Solution 1: Fix Bun Relay to Handle Tokens (Recommended)

**Update `bun-server.js` to:**
1. Generate a connection token
2. Include token in relayed requests
3. Handle WebSocket upgrades properly

**Modified `bun-server.js`:**
```javascript
#!/usr/bin/env bun
import { spawn } from "bun";
import crypto from "crypto";

const INTERNAL_PORT = 3000;
const EXTERNAL_PORT = 8080;
const HOST = process.env.HOST || "0.0.0.0";

// Generate connection token
const CONNECTION_TOKEN = crypto.randomBytes(16).toString('hex');
console.log(`Connection token: ${CONNECTION_TOKEN}`);

// Start OpenVSCode with token
const server = spawn({
    cmd: ["/opt/openvscode/bin/openvscode-server"],
    args: [
        "--host", "127.0.0.1",
        "--port", INTERNAL_PORT.toString(),
        "--connection-token", CONNECTION_TOKEN,  // Use token instead of --without-connection-token
        "--accept-server-license-terms",
        "--user-data-dir", "/tmp/vscode-data"
    ],
    // ... rest of config
});

// Bun relay that adds token to requests
Bun.serve({
    port: EXTERNAL_PORT,
    hostname: HOST,
    async fetch(req, server) {
        const url = new URL(req.url);
        
        // Add connection token to query string
        url.searchParams.set('tkn', CONNECTION_TOKEN);
        
        const targetURL = `http://127.0.0.1:${INTERNAL_PORT}${url.pathname}${url.search}`;
        
        const headers = new Headers(req.headers);
        headers.set("Host", `127.0.0.1:${INTERNAL_PORT}`);
        
        // Handle WebSocket upgrades
        if (req.headers.get("upgrade") === "websocket") {
            const success = server.upgrade(req, {
                data: { token: CONNECTION_TOKEN }
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
            return new Response("Gateway error", { status: 502 });
        }
    },
    websocket: {
        message(ws, message) {
            // Forward WebSocket messages
            ws.send(message);
        }
    }
});
```

### Solution 2: Use `--without-connection-token` Correctly

**Verify OpenVSCode is actually started without token:**
```bash
# In VM, check process
ps aux | grep openvscode-server
# Should show: --without-connection-token

# Test internal access
curl http://127.0.0.1:3000
# Should work if token is truly disabled
```

### Solution 3: Bind OpenVSCode Directly to 0.0.0.0 (Simplest)

**Change init script to bind OpenVSCode to all interfaces:**
```bash
# Instead of:
--host 127.0.0.1 --port 3000

# Use:
--host 0.0.0.0 --port 3000
```

Then access directly at `http://192.168.64.3:3000` without relay.

---

## Quick Test

### Test 1: Check if OpenVSCode responds internally
```bash
# SSH into VM (if possible)
ssh root@192.168.64.3
curl http://127.0.0.1:3000
```

### Test 2: Check relay is forwarding correctly
```bash
# From host
curl -v http://192.168.64.3:8080 2>&1 | grep -E "HTTP|403|Forbidden"
```

### Test 3: Try with token parameter
```bash
# If token is required, try:
curl "http://192.168.64.3:8080?tkn=<token-from-console-log>"
```

---

## Recommended Fix

**Immediate fix:** Update the Bun relay to:
1. Generate and log connection token
2. Add token to all relayed requests
3. Handle WebSocket upgrades with token

**Long-term fix:** Bind OpenVSCode directly to `0.0.0.0:3000` and remove relay complexity.

---

## Next Steps

1. Extract current `bun-server.js` from initramfs
2. Update it to handle tokens properly
3. Rebuild initramfs
4. Test access

