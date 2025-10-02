# MCP Server Authentication

## Overview

The VibeCode MCP server requires **JWT authentication** for all operations. This addresses the CRITICAL-01 vulnerability identified in the security audit (CVSS 10.0).

## Authentication Architecture

### Token Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. User logs in to VibeCode Web UI                          │
│     └─> NextAuth generates JWT token                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  2. User extracts JWT token from session                     │
│     └─> Token contains: id, email, name, role               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  3. User sets VIBECODE_TOKEN environment variable            │
│     └─> export VIBECODE_TOKEN=<jwt-token>                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  4. MCP client calls VibeCode MCP server                     │
│     └─> Server extracts token from environment               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  5. Server verifies JWT token using NEXTAUTH_SECRET          │
│     └─> Validates signature, expiration, payload             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  6. Server extracts user context from token                  │
│     └─> userId, userEmail, userRole available to tools      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  7. Tool executes with authenticated user context            │
│     └─> Workspace access control enforced                    │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

**Required:**

- `NEXTAUTH_SECRET` - Secret used to sign/verify JWT tokens (must match web UI)
- `VIBECODE_TOKEN` - JWT token for authentication (obtained from web UI)

**Example:**

```bash
# Server-side (set on MCP server host)
export NEXTAUTH_SECRET="your-nextauth-secret-from-env"

# Client-side (set before running MCP client)
export VIBECODE_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## Token Sources

The MCP server accepts tokens from multiple sources (in priority order):

1. **Environment Variable** (Recommended for stdio transport)
   ```bash
   export VIBECODE_TOKEN=<your-jwt-token>
   ```

2. **Request Parameter** (Alternative for HTTP transport)
   ```json
   {
     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "workspaceId": "ws-123"
   }
   ```

3. **Alternative Parameter Name**
   ```json
   {
     "authToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "workspaceId": "ws-123"
   }
   ```

## Obtaining a Token

### Method 1: Browser Developer Tools

1. Log in to VibeCode web UI
2. Open browser developer tools (F12)
3. Go to Application → Cookies
4. Find cookie named `next-auth.session-token` or `__Secure-next-auth.session-token`
5. Copy the cookie value (this is your JWT token)

### Method 2: NextAuth API (Future)

```bash
curl -X POST https://vibecode.dev/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2025-10-02T12:00:00Z"
}
```

## Usage Examples

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "vibecode": {
      "command": "node",
      "args": ["/path/to/vibecode-webgui/src/mcp/server.ts"],
      "env": {
        "NEXTAUTH_SECRET": "your-nextauth-secret",
        "VIBECODE_TOKEN": "your-jwt-token"
      }
    }
  }
}
```

### Windsurf

Edit Windsurf MCP configuration:

```json
{
  "mcpServers": {
    "vibecode": {
      "command": "tsx",
      "args": ["/path/to/vibecode-webgui/src/mcp/server.ts"],
      "env": {
        "NEXTAUTH_SECRET": "your-nextauth-secret",
        "VIBECODE_TOKEN": "your-jwt-token"
      }
    }
  }
}
```

### Direct Testing

```bash
# Set environment variables
export NEXTAUTH_SECRET="your-nextauth-secret"
export VIBECODE_TOKEN="your-jwt-token"

# Run MCP server
npm run mcp:start
```

## Security Features

### 1. Mandatory Authentication

- **All tool calls require authentication**
- No bypass or fallback mechanisms
- Authentication checked before tool execution

### 2. JWT Verification

- Token signature verified using NEXTAUTH_SECRET
- Token expiration checked
- Payload structure validated

### 3. User Context Extraction

- User ID, email, name, and role extracted from token
- User context passed to all tool implementations
- Workspace access control enabled

### 4. Detailed Error Messages

Authentication failures provide clear, actionable error messages:

```
🔒 Authentication Error: Authentication token has expired

Code: TOKEN_EXPIRED

To authenticate:
1. Obtain a JWT token from VibeCode web UI
2. Set environment variable: export VIBECODE_TOKEN=<your-token>
3. Retry your request
```

## Error Handling

### Common Authentication Errors

| Error Code | Cause | Solution |
|------------|-------|----------|
| `JWT_SECRET_MISSING` | NEXTAUTH_SECRET not set | Set NEXTAUTH_SECRET environment variable |
| `TOKEN_MISSING` | No token provided | Set VIBECODE_TOKEN or include token in request |
| `AUTH_REQUIRED` | Token not found in any source | Check environment variables and request parameters |
| `TOKEN_EXPIRED` | JWT token has expired | Obtain a new token from web UI |
| `TOKEN_INVALID` | Token signature invalid | Verify token and NEXTAUTH_SECRET match web UI |
| `TOKEN_INVALID_PAYLOAD` | Token missing required fields | Token must contain id, email, name, role |

## Testing Authentication

### Test 1: Verify Server Starts

```bash
export NEXTAUTH_SECRET="test-secret-at-least-32-characters-long"
npm run mcp:start
```

Expected output:
```
🚀 VibeCode MCP Server running on stdio
🔒 Authentication: ENABLED (JWT required)
💡 Set VIBECODE_TOKEN environment variable to authenticate
```

### Test 2: Test Without Token

```bash
# Try to call a tool without setting VIBECODE_TOKEN
# Should fail with AUTH_REQUIRED error
```

### Test 3: Test With Valid Token

```bash
export VIBECODE_TOKEN="<valid-jwt-token>"
# Try to call a tool
# Should succeed and show: ✅ Authenticated: user@example.com (role)
```

### Test 4: Test With Expired Token

```bash
export VIBECODE_TOKEN="<expired-jwt-token>"
# Try to call a tool
# Should fail with TOKEN_EXPIRED error
```

## Implementation Details

### JWT Structure

The JWT token contains:

```json
{
  "id": "user-123",
  "email": "user@example.com",
  "name": "User Name",
  "role": "admin",
  "githubId": "github-123",
  "googleId": "google-123",
  "iat": 1696176000,
  "exp": 1696262400
}
```

### User Context Interface

```typescript
interface UserContext {
  id: string;
  email: string;
  name: string;
  role: string;
  githubId?: string;
  googleId?: string;
}
```

### Authenticated Tool Arguments

All tool implementations receive user context:

```typescript
{
  ...originalArgs,
  _auth: {
    userId: "user-123",
    userEmail: "user@example.com",
    userRole: "admin"
  }
}
```

## Future Enhancements

### Phase 2: HTTP Transport Support

When HTTP transport is added:

- Use HTTP Authorization header: `Authorization: Bearer <token>`
- Support both environment variable and header
- Add rate limiting per user
- Implement API key authentication for service accounts

### Phase 3: Enhanced Security

- Add token refresh mechanism
- Implement role-based access control (RBAC)
- Add workspace-level permissions
- Audit logging for all authenticated operations
- Add IP allowlisting for production

### Phase 4: Token Management API

- Dedicated API endpoint for token generation
- Token revocation support
- Multiple tokens per user (with names/scopes)
- Token expiration customization

## Migration Guide

If you were using the MCP server before authentication was added:

1. **Update Configuration**: Add NEXTAUTH_SECRET to server environment
2. **Obtain Token**: Log in to web UI and extract JWT token
3. **Update Client Config**: Add VIBECODE_TOKEN to MCP client configuration
4. **Test**: Verify authentication works before deploying

## Support

For authentication issues:

1. Check server logs for authentication error details
2. Verify NEXTAUTH_SECRET matches web UI configuration
3. Verify token is valid and not expired
4. Verify token contains required fields (id, email)
5. Check GitHub issue #484 for updates

## References

- Security Audit: GitHub Issue #484
- JWT Standard: RFC 7519
- NextAuth Documentation: https://next-auth.js.org
- MCP Protocol: https://modelcontextprotocol.io
