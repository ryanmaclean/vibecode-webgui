# VibeCode Authentication Strategy
**Phase 5: OpenVSCode Server Authentication Architecture**

**Version:** 1.0
**Date:** October 28, 2025
**Status:** Architecture Design
**Security Classification:** Internal Use

---

## Executive Summary

VibeCode is a native macOS development environment built on OpenVSCode Server with Swift 5 + Rust CLI integration. Unlike code-server, OpenVSCode Server has **NO built-in authentication**, requiring us to design and implement a comprehensive authentication layer from scratch.

**Key Challenge:** Secure a browser-based IDE running locally or remotely, wrapped in a native macOS desktop app (Tauri/Swift), with multiple deployment models (local VM, remote fleet, desktop wrapper).

**Recommended Approach:** Hybrid authentication using Swift-native auth layer + reverse proxy with OAuth/OIDC support and JWT-based session management.

---

## Table of Contents

1. [Threat Model](#threat-model)
2. [Deployment Context](#deployment-context)
3. [Authentication Options Analysis](#authentication-options-analysis)
4. [Recommended Architecture](#recommended-architecture)
5. [Implementation Roadmap](#implementation-roadmap)
6. [TLS/HTTPS Strategy](#tlshttps-strategy)
7. [Session Management](#session-management)
8. [Security Considerations](#security-considerations)
9. [Fallback & Recovery](#fallback--recovery)
10. [Swift 5 Auth Module Design](#swift-5-auth-module-design)

---

## Threat Model

### What Are We Protecting Against?

#### 1. **Unauthorized Access to IDE**
- **Risk:** HIGH
- **Attack Vectors:**
  - Direct network access to OpenVSCode Server (default: no auth)
  - Port scanning discovering exposed :8080 endpoint
  - Man-in-the-middle attacks on unencrypted connections
  - Session hijacking via stolen tokens
- **Impact:** Full access to user code, credentials, environment variables

#### 2. **Code Exfiltration**
- **Risk:** HIGH
- **Attack Vectors:**
  - Unauthorized file download via VS Code API
  - Terminal access for remote command execution
  - Extension marketplace attacks (malicious extensions)
  - Git credential theft from workspace
- **Impact:** Intellectual property loss, supply chain compromise

#### 3. **Remote Code Execution (RCE)**
- **Risk:** CRITICAL
- **Attack Vectors:**
  - Terminal access without authentication
  - Extension installation with arbitrary code
  - Debugging API exploitation
  - Workspace settings manipulation
- **Impact:** Full system compromise, lateral movement in fleet

#### 4. **Credential Theft**
- **Risk:** HIGH
- **Attack Vectors:**
  - Environment variable exposure (.env files)
  - macOS Keychain access via compromised IDE
  - SSH keys stored in workspace
  - Git credentials in config files
- **Impact:** Cloud account takeover, API key abuse

#### 5. **Fleet-Wide Compromise**
- **Risk:** MEDIUM (Remote Fleet Mode)
- **Attack Vectors:**
  - Single compromised node leading to fleet-wide access
  - Service discovery exploitation
  - Shared authentication tokens
  - Network segmentation bypass
- **Impact:** Mass data breach, coordinated RCE

#### 6. **Desktop App-Specific Threats**
- **Risk:** MEDIUM (Tauri Desktop Mode)
- **Attack Vectors:**
  - Tauri command injection
  - IPC (Inter-Process Communication) exploitation
  - WebView JavaScript injection
  - Local file access via webkit
- **Impact:** Local privilege escalation, sandbox escape

### Trust Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                     UNTRUSTED NETWORK                        │
│  (Internet, local network, potentially hostile actors)      │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    ┌─────────────────┐
                    │   TLS Layer     │ ← Trust Boundary #1
                    │  (HTTPS/WSS)    │
                    └─────────────────┘
                              ↓
                    ┌─────────────────┐
                    │ Auth Proxy      │ ← Trust Boundary #2
                    │ (JWT Validation)│
                    └─────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    SEMI-TRUSTED ZONE                         │
│  ┌──────────────────┐        ┌──────────────────┐          │
│  │ OpenVSCode Server│◄──────►│  Swift Wrapper   │          │
│  │  (localhost:8080)│        │  (Native macOS)  │          │
│  └──────────────────┘        └──────────────────┘          │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    ┌─────────────────┐
                    │   VM Boundary   │ ← Trust Boundary #3
                    │ (Virtualization)│
                    └─────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      TRUSTED ZONE                            │
│  ┌──────────────────┐        ┌──────────────────┐          │
│  │   User Files     │        │  macOS Keychain  │          │
│  │  (Workspace)     │        │  (Secrets)       │          │
│  └──────────────────┘        └──────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

### Security Objectives

1. **Authentication:** Verify identity before granting IDE access
2. **Authorization:** Enforce role-based access control (RBAC)
3. **Confidentiality:** Encrypt all data in transit (TLS)
4. **Integrity:** Prevent tampering with code and configuration
5. **Audit:** Log all authentication events for forensic analysis
6. **Isolation:** Prevent cross-user data access in fleet mode

---

## Deployment Context

### Three Deployment Models

VibeCode supports three distinct deployment patterns, each with unique authentication requirements:

#### 1. **Desktop App (Tauri + webkit)**
```
┌─────────────────────────────────────────┐
│        VibeCode.app (macOS)            │
│  ┌───────────────────────────────────┐ │
│  │  Tauri (Rust + Swift Bridge)     │ │
│  │  ┌─────────────────────────────┐ │ │
│  │  │  WKWebView (webkit)         │ │ │
│  │  │  ┌───────────────────────┐  │ │ │
│  │  │  │ OpenVSCode Server     │  │ │ │
│  │  │  │ (http://localhost:8080)│ │ │ │
│  │  │  └───────────────────────┘  │ │ │
│  │  └─────────────────────────────┘ │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Auth Requirements:**
- Single-user local access (no shared resources)
- macOS user = IDE user (implicit trust)
- Optional: Local password/biometric for app unlock
- Keychain integration for storing tokens
- **Threat:** Malicious local processes accessing webkit

#### 2. **Local VM (Virtualization Framework)**
```
┌─────────────────────────────────────────┐
│         macOS Host                      │
│  ┌───────────────────────────────────┐ │
│  │  Swift VM Manager                 │ │
│  │  ┌─────────────────────────────┐ │ │
│  │  │  Linux VM (vfkit/QEMU)      │ │ │
│  │  │  ┌───────────────────────┐  │ │ │
│  │  │  │ OpenVSCode Server     │  │ │ │
│  │  │  │ (0.0.0.0:8080)        │  │ │ │
│  │  │  └───────────────────────┘  │ │ │
│  │  └─────────────────────────────┘ │ │
│  └───────────────────────────────────┘ │
│           ↓ Port Forward               │
│    http://localhost:8080               │
└─────────────────────────────────────────┘
```

**Auth Requirements:**
- Still single-user but VM isolation needed
- Network boundary between host and VM
- Token-based auth even for localhost
- **Threat:** VM escape, port hijacking

#### 3. **Remote Fleet (Multi-Mac Orchestration)**
```
┌──────────────────────────────────────────────────────────┐
│                  Fleet Control Plane                     │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Swift FleetManager (Service Discovery + RBAC)    │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
         ↓                    ↓                    ↓
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Mac Node 1  │    │  Mac Node 2  │    │  Mac Node N  │
│ OpenVSCode   │    │ OpenVSCode   │    │ OpenVSCode   │
│ :8080        │    │ :8080        │    │ :8080        │
└──────────────┘    └──────────────┘    └──────────────┘
```

**Auth Requirements:**
- Multi-user, multi-tenant isolation
- OAuth/OIDC for centralized identity
- Fleet-wide RBAC policies
- Service mesh with mTLS
- **Threat:** Lateral movement, privilege escalation

---

## Authentication Options Analysis

### Option 1: Reverse Proxy (Caddy/nginx/Traefik)

#### Architecture
```
User → TLS → Reverse Proxy (Auth Layer) → OpenVSCode Server
```

#### Pros
- ✅ Industry standard approach
- ✅ Mature security features (OAuth, JWT, rate limiting)
- ✅ Zero code changes to OpenVSCode Server
- ✅ Easy to swap proxy implementations
- ✅ Automatic TLS termination (Let's Encrypt)
- ✅ WebSocket support for VS Code protocol

#### Cons
- ❌ Extra process to manage (memory/CPU overhead)
- ❌ Not deeply integrated with Swift/macOS
- ❌ Config file complexity (nginx especially)
- ❌ Harder to debug multi-layer issues

#### Implementation Matrix

| Proxy    | OAuth | JWT | mTLS | Swift Integration | Recommendation |
|----------|-------|-----|------|-------------------|----------------|
| **Caddy** | ✅ (plugins) | ✅ | ✅ | ⚠️ (HTTP API) | **BEST** for simplicity |
| **nginx** | ⚠️ (complex) | ✅ | ✅ | ❌ (config files) | Good for scale |
| **Traefik** | ✅ (native) | ✅ | ✅ | ⚠️ (HTTP API) | Good for k8s |

#### Recommended: **Caddy**

**Why Caddy?**
- Automatic HTTPS with Let's Encrypt (zero-config)
- Simple JSON API for Swift integration
- Native OAuth2 support via plugins
- Minimal configuration (Caddyfile is human-readable)
- Active development, good macOS support

**Example Caddyfile:**
```caddy
# VibeCode Caddy Configuration
{
    admin localhost:2019
    auto_https disable_redirects
}

localhost:8443 {
    # JWT validation
    jwt {
        sign_key {env.JWT_SECRET}
    }

    # OAuth2 (GitHub/Google)
    oauth {
        provider github
        client_id {env.GITHUB_CLIENT_ID}
        client_secret {env.GITHUB_CLIENT_SECRET}
        redirect_uri https://localhost:8443/auth/callback
    }

    # Proxy to OpenVSCode Server
    reverse_proxy localhost:8080 {
        # WebSocket support (critical for VS Code)
        header_up Upgrade {http.request.header.Upgrade}
        header_up Connection {http.request.header.Connection}
    }

    # Security headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
    }
}
```

**Swift Integration:**
```swift
// Control Caddy via admin API
class CaddyAuthProxy {
    let adminURL = URL(string: "http://localhost:2019")!

    func start() async throws {
        // Load config from Swift
        let config = CaddyConfig(...)
        try await postJSON(to: "\(adminURL)/load", body: config)
    }

    func validateSession(token: String) async -> Bool {
        // Query Caddy for token validation
        return await get("\(adminURL)/validate?token=\(token)")
    }
}
```

---

### Option 2: Custom Swift Auth Layer

#### Architecture
```
User → Swift Auth Middleware → OpenVSCode Server
```

#### Pros
- ✅ **Native macOS integration** (Keychain, Touch ID, Face ID)
- ✅ Full control over auth flow
- ✅ No external dependencies
- ✅ Direct Swift ↔ Rust CLI communication
- ✅ Tightest integration with desktop app

#### Cons
- ❌ **High development effort** (build OAuth from scratch)
- ❌ Security critical code (high risk if done wrong)
- ❌ Need to maintain JWT library, OAuth clients
- ❌ Reinventing the wheel (proxies already solve this)

#### Implementation Complexity
- **OAuth2 Client:** ~2000 lines of Swift
- **JWT Library:** ~500 lines (or use third-party)
- **Session Management:** ~1000 lines
- **TLS Configuration:** ~300 lines
- **Testing:** ~1500 lines
- **Total:** ~5300 lines + ongoing maintenance

#### Verdict
**Not Recommended** for initial release. Consider for v2.0 after proxy proves limiting.

---

### Option 3: OAuth/OIDC (GitHub, Google, Enterprise SSO)

#### Architecture
```
User → OAuth Provider → Token → Reverse Proxy/Swift → OpenVSCode Server
```

#### Pros
- ✅ Leverage existing identity providers
- ✅ No password management (provider handles it)
- ✅ Enterprise-ready (SAML, OIDC)
- ✅ Multi-factor authentication (MFA) via provider
- ✅ Centralized user management

#### Cons
- ❌ **Requires internet connection** (deal-breaker for local mode)
- ❌ OAuth flow complexity in desktop app
- ❌ Redirect URIs tricky with localhost
- ❌ Offline mode needs fallback

#### Provider Comparison

| Provider | Use Case | Desktop Support | Enterprise |
|----------|----------|-----------------|------------|
| **GitHub** | Developer-focused | ✅ (OAuth App) | ✅ (GitHub Enterprise) |
| **Google** | General users | ✅ (Desktop App flow) | ✅ (Google Workspace) |
| **Okta/Auth0** | Enterprise SSO | ✅ | ✅ (SAML/OIDC) |
| **Apple Sign In** | macOS native | ✅ (**Best**) | ❌ |

#### Recommended for Remote Fleet
OAuth/OIDC is **mandatory** for remote fleet deployment but **optional** for local desktop use.

---

### Option 4: JWT-Based Authentication

#### Architecture
```
User → Login → JWT Token → All Requests Include Token → Validation
```

#### Pros
- ✅ Stateless (no server-side sessions)
- ✅ Portable across nodes (perfect for fleet)
- ✅ Can embed user roles/permissions in token
- ✅ Works with reverse proxy or custom Swift

#### Cons
- ❌ Token revocation is hard (need blacklist)
- ❌ Stolen tokens valid until expiry
- ❌ Need secure storage (macOS Keychain)

#### Token Structure
```json
{
  "sub": "user@vibecode.dev",
  "iss": "vibecode-auth",
  "exp": 1730000000,
  "iat": 1729990000,
  "roles": ["developer", "admin"],
  "workspace_id": "ws-abc123",
  "fleet_node": "mac-node-1"
}
```

#### Swift Implementation
```swift
import CryptoKit

struct JWTValidator {
    let secretKey: SymmetricKey

    func validate(token: String) throws -> Claims {
        let parts = token.split(separator: ".")
        guard parts.count == 3 else {
            throw AuthError.invalidToken
        }

        let header = try decode(String(parts[0]))
        let payload = try decode(String(parts[1]))
        let signature = String(parts[2])

        // Verify signature using HMAC-SHA256
        let data = "\(parts[0]).\(parts[1])".data(using: .utf8)!
        let expectedSig = HMAC<SHA256>.authenticationCode(
            for: data,
            using: secretKey
        )

        guard signature == expectedSig.hexString else {
            throw AuthError.invalidSignature
        }

        return try JSONDecoder().decode(Claims.self, from: payload)
    }
}
```

#### Verdict
**Recommended** as transport mechanism for auth state, but not as sole authentication method.

---

### Option 5: Hybrid Approach (RECOMMENDED)

#### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT (Browser/Desktop)                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    ┌─────────────────┐
                    │   TLS (HTTPS)   │
                    └─────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              SWIFT AUTH LAYER (macOS Native)                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  • Keychain integration (store tokens)               │ │
│  │  • Touch ID / Face ID (optional unlock)              │ │
│  │  • Local password fallback                            │ │
│  │  • JWT token generation & validation                  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    ┌─────────────────┐
                    │  CADDY PROXY    │
                    │  (OAuth + JWT)  │
                    └─────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│            OPENVSCODE SERVER (No Auth)                       │
│                   localhost:8080                             │
└─────────────────────────────────────────────────────────────┘
```

#### Flow Diagram
```
┌──────┐     1. Launch      ┌──────────────┐
│ User │ ─────────────────► │ VibeCode.app │
└──────┘                     │  (Tauri)     │
                             └──────────────┘
                                    │
                          2. Check Keychain
                                    ↓
                       ┌─────────────────────┐
                       │ Token exists?       │
                       └─────────────────────┘
                          │               │
                    ✅ Yes              ❌ No
                          │               │
                          ↓               ↓
              ┌──────────────────┐   ┌──────────────┐
              │ Validate JWT     │   │ Show Login   │
              │ (Swift + Caddy)  │   │ (OAuth/Local)│
              └──────────────────┘   └──────────────┘
                          │               │
                          └───────┬───────┘
                                  ↓
                      ┌──────────────────────┐
                      │ Start Caddy Proxy    │
                      │ (JWT validation on)  │
                      └──────────────────────┘
                                  ↓
                      ┌──────────────────────┐
                      │ Start OpenVSCode     │
                      │ (localhost:8080)     │
                      └──────────────────────┘
                                  ↓
                      ┌──────────────────────┐
                      │ Inject JWT in Headers│
                      │ (Swift → WKWebView)  │
                      └──────────────────────┘
                                  ↓
                      ┌──────────────────────┐
                      │ User sees IDE        │
                      │ (Authenticated)      │
                      └──────────────────────┘
```

#### Why Hybrid Wins

1. **Best of Both Worlds:**
   - Swift handles native macOS features (Keychain, biometrics)
   - Caddy handles complex OAuth/TLS
   - JWT bridges the two layers

2. **Deployment Flexibility:**
   - Desktop: Swift-only auth (no Caddy needed for single-user)
   - Local VM: Swift + lightweight Caddy
   - Remote Fleet: Full Caddy with OAuth + Swift for fleet management

3. **Security Layering:**
   - Layer 1: TLS (Caddy automatic HTTPS)
   - Layer 2: OAuth (Caddy handles provider redirects)
   - Layer 3: JWT (Swift validates and injects)
   - Layer 4: macOS Keychain (secure token storage)

4. **Graceful Degradation:**
   - Internet down? Use local password (Swift)
   - Caddy crashes? Swift can proxy directly (emergency mode)
   - OpenVSCode Server restart? Session persists (JWT in Keychain)

---

## Recommended Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        VibeCode.app (macOS)                         │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │                     Swift Auth Module                           ││
│  │                                                                  ││
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐ ││
│  │  │ Keychain Manager│  │ Biometric Auth  │  │ Token Manager  │ ││
│  │  │  - Store tokens │  │  - Touch ID     │  │  - JWT gen/val │ ││
│  │  │  - Rotate keys  │  │  - Face ID      │  │  - Refresh     │ ││
│  │  └─────────────────┘  └─────────────────┘  └────────────────┘ ││
│  │                                                                  ││
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐ ││
│  │  │ OAuth Client    │  │ RBAC Engine     │  │ Audit Logger   │ ││
│  │  │  - GitHub       │  │  - Roles        │  │  - Auth events │ ││
│  │  │  - Google       │  │  - Permissions  │  │  - Failures    │ ││
│  │  │  - Apple ID     │  │  - Workspaces   │  │  - Success     │ ││
│  │  └─────────────────┘  └─────────────────┘  └────────────────┘ ││
│  └────────────────────────────────────────────────────────────────┘│
│                                   ↓                                  │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │                     Tauri/Rust Bridge                           ││
│  │  - IPC commands for auth actions                               ││
│  │  - WebView injection (JWT in headers)                          ││
│  └────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
                                   ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         Caddy Reverse Proxy                         │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │  Port: 8443 (HTTPS)                                            ││
│  │  - JWT validation (verify signature from Swift)                ││
│  │  - OAuth2 provider integration                                 ││
│  │  - Rate limiting (100 req/min per IP)                          ││
│  │  - WebSocket upgrade handling                                  ││
│  │  - Security headers injection                                  ││
│  └────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
                                   ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    OpenVSCode Server (No Auth)                      │
│  Port: 8080 (HTTP, localhost only)                                 │
│  - Bound to 127.0.0.1 (not 0.0.0.0)                                │
│  - Assumes all requests pre-authenticated                           │
└─────────────────────────────────────────────────────────────────────┘
```

### Authentication Flows

#### Flow 1: Desktop App First Launch
```
1. User opens VibeCode.app
2. Swift checks Keychain for existing token
3. No token found → Show onboarding
4. User chooses auth method:
   a) Local password (macOS user password + Touch ID)
   b) GitHub OAuth (opens browser)
   c) Google OAuth (opens browser)
5. Swift generates JWT, stores in Keychain
6. Swift starts OpenVSCode Server (localhost:8080)
7. Swift starts Caddy (8443 → 8080 proxy)
8. WKWebView loads https://localhost:8443 with JWT injected
9. Caddy validates JWT, proxies to OpenVSCode Server
10. User sees authenticated IDE
```

#### Flow 2: Subsequent Launches
```
1. User opens VibeCode.app
2. Swift checks Keychain for token
3. Token found → Validate expiry
4. If expired:
   a) Desktop mode: Silently refresh (local password/biometric)
   b) Remote mode: Refresh via OAuth provider
5. Start OpenVSCode Server + Caddy
6. Load IDE with valid JWT
```

#### Flow 3: Remote Fleet Access
```
1. User navigates to https://vibecode.company.com
2. Caddy redirects to OAuth provider (e.g., Okta)
3. User authenticates via SSO
4. OAuth callback to Caddy with auth code
5. Caddy exchanges code for access token
6. Caddy generates JWT, sets secure cookie
7. User redirected to IDE
8. All requests include JWT cookie
9. Caddy validates JWT on each request
10. FleetManager assigns user to available Mac node
11. OpenVSCode Server session starts on assigned node
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
**Objective:** Basic auth working in desktop mode

#### Tasks
1. **Swift Auth Module Setup**
   - [ ] Create `VibeCodeAuth` Swift package
   - [ ] Implement Keychain wrapper (`KeychainManager.swift`)
   - [ ] Add JWT generation/validation (`JWTEngine.swift`)
   - [ ] Implement local password auth (`LocalAuthProvider.swift`)

2. **Caddy Integration**
   - [ ] Install Caddy via Homebrew
   - [ ] Create base `Caddyfile` configuration
   - [ ] Test TLS with self-signed cert (localhost)
   - [ ] Verify WebSocket proxying works

3. **OpenVSCode Server Hardening**
   - [ ] Configure to bind 127.0.0.1 only (not 0.0.0.0)
   - [ ] Disable any built-in auth attempts
   - [ ] Test with Caddy proxy in front

#### Success Criteria
- ✅ User can set local password in VibeCode.app
- ✅ JWT stored securely in Keychain
- ✅ OpenVSCode Server accessible via https://localhost:8443
- ✅ VS Code UI loads without authentication errors

---

### Phase 2: Biometric Auth (Week 3)
**Objective:** macOS native Touch ID/Face ID integration

#### Tasks
1. **LocalAuthentication Framework**
   ```swift
   import LocalAuthentication

   class BiometricAuth {
       func authenticate(reason: String) async throws -> Bool {
           let context = LAContext()
           var error: NSError?

           guard context.canEvaluatePolicy(
               .deviceOwnerAuthenticationWithBiometrics,
               error: &error
           ) else {
               throw AuthError.biometricsUnavailable
           }

           return try await context.evaluatePolicy(
               .deviceOwnerAuthenticationWithBiometrics,
               localizedReason: reason
           )
       }
   }
   ```

2. **Integration Points**
   - [ ] Lock screen when app goes to background
   - [ ] Require biometric on wake from sleep
   - [ ] Optional: Require biometric for sensitive actions (terminal commands)

3. **Fallback Handling**
   - [ ] Detect when biometrics fail (5 attempts)
   - [ ] Fall back to local password
   - [ ] Notify user of security event

#### Success Criteria
- ✅ Touch ID prompt when launching app
- ✅ Face ID prompt on MacBooks with Face ID
- ✅ Graceful fallback to password

---

### Phase 3: OAuth Integration (Week 4-5)
**Objective:** Support GitHub, Google, Apple Sign In

#### Tasks
1. **Caddy OAuth Plugin Configuration**
   ```caddy
   oauth {
       provider github
       client_id {env.GITHUB_CLIENT_ID}
       client_secret {env.GITHUB_CLIENT_SECRET}
       redirect_uri https://localhost:8443/auth/callback

       # Scopes for accessing user info
       scopes user:email read:org
   }
   ```

2. **Swift OAuth Client**
   ```swift
   class OAuthCoordinator {
       func startFlow(provider: OAuthProvider) async throws -> JWT {
           // 1. Open browser with authorization URL
           let authURL = provider.authorizationURL
           NSWorkspace.shared.open(authURL)

           // 2. Listen for callback on local HTTP server
           let callback = try await listenForCallback()

           // 3. Exchange code for token
           let token = try await provider.exchangeCode(callback.code)

           // 4. Generate internal JWT
           return generateJWT(from: token)
       }
   }
   ```

3. **Provider Setup**
   - [ ] Register GitHub OAuth App
   - [ ] Register Google OAuth Client
   - [ ] Register Apple Sign In (macOS)
   - [ ] Document OAuth app creation process

4. **Token Refresh Logic**
   - [ ] Implement refresh token flow
   - [ ] Background token refresh (15 min before expiry)
   - [ ] Handle revoked tokens gracefully

#### Success Criteria
- ✅ User can sign in with GitHub
- ✅ User can sign in with Google
- ✅ User can sign in with Apple ID
- ✅ Tokens auto-refresh in background
- ✅ Offline mode falls back to cached credentials

---

### Phase 4: Remote Fleet (Week 6-7)
**Objective:** Multi-user, multi-Mac authentication

#### Tasks
1. **Fleet Control Plane**
   ```swift
   class FleetAuthService {
       let database: PostgreSQL
       let jwtValidator: JWTValidator

       func authenticateRequest(
           _ request: Request
       ) async throws -> AuthenticatedUser {
           // 1. Extract JWT from Authorization header
           guard let token = request.headers["Authorization"] else {
               throw AuthError.missingToken
           }

           // 2. Validate JWT signature
           let claims = try jwtValidator.validate(token)

           // 3. Check user exists in fleet database
           let user = try await database.fetchUser(id: claims.sub)

           // 4. Verify user has access to requested workspace
           try await checkWorkspaceAccess(
               user: user,
               workspace: request.workspaceID
           )

           return user
       }
   }
   ```

2. **Workspace Isolation**
   - [ ] Implement RBAC policies (admin, developer, viewer)
   - [ ] Enforce workspace-level permissions
   - [ ] Audit all cross-workspace access attempts

3. **Service Discovery Integration**
   - [ ] Register authenticated nodes with mDNS/Consul
   - [ ] Implement node health checks with auth
   - [ ] Auto-deregister nodes on auth failure

4. **Monitoring & Alerting**
   - [ ] Log all auth events to Datadog
   - [ ] Alert on repeated auth failures (5 in 1 min)
   - [ ] Dashboard for active sessions per node

#### Success Criteria
- ✅ Multiple users can access different workspaces
- ✅ Users cannot access others' workspaces
- ✅ Fleet manager tracks authenticated sessions
- ✅ Admins can revoke user access remotely

---

### Phase 5: Production Hardening (Week 8)
**Objective:** Security audit and deployment readiness

#### Tasks
1. **Security Audit**
   - [ ] Run OWASP ZAP against local instance
   - [ ] Pen test OAuth flow (CSRF, token theft)
   - [ ] Review Caddy config with security expert
   - [ ] Test JWT expiry/revocation edge cases

2. **Monitoring Setup**
   - [ ] Integrate with Datadog APM
   - [ ] Custom metrics: auth latency, failure rate
   - [ ] Alerts: brute force detection, mass token theft

3. **Documentation**
   - [ ] Administrator guide (OAuth app setup)
   - [ ] User guide (first-time login)
   - [ ] Troubleshooting guide (common auth errors)
   - [ ] API reference (Swift auth module)

4. **Deployment Tooling**
   - [ ] Helm chart with Caddy + OpenVSCode Server
   - [ ] Kubernetes secrets management
   - [ ] Certificate rotation automation (cert-manager)

#### Success Criteria
- ✅ Zero critical vulnerabilities (OWASP scan)
- ✅ All auth metrics visible in Datadog
- ✅ Documentation complete and reviewed
- ✅ Can deploy to Kubernetes in < 10 minutes

---

## TLS/HTTPS Strategy

### Certificate Management

#### Development (localhost)
```swift
// Auto-generate self-signed cert on first launch
class CertificateManager {
    func ensureDevelopmentCert() async throws {
        let certPath = "~/.vibecode/certs/localhost.crt"
        let keyPath = "~/.vibecode/certs/localhost.key"

        if !FileManager.default.fileExists(atPath: certPath) {
            // Generate 2048-bit RSA key pair
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/usr/bin/openssl")
            process.arguments = [
                "req", "-x509", "-newkey", "rsa:2048",
                "-keyout", keyPath,
                "-out", certPath,
                "-days", "365",
                "-nodes",
                "-subj", "/CN=localhost"
            ]
            try process.run()
            process.waitUntilExit()
        }

        // Trust cert in macOS Keychain
        try await trustCertificate(at: certPath)
    }
}
```

**Why Self-Signed is OK Locally:**
- Desktop app controls entire stack (no external CA needed)
- Certificate pinning in WKWebView (MITM resistant)
- User never sees browser warnings (hidden in app)

#### Production (Remote Fleet)
```caddy
# Caddy auto-HTTPS with Let's Encrypt
vibecode.company.com {
    tls {
        # Automatic certificate via ACME
        # Caddy handles renewal (60 days before expiry)
        email admin@company.com
    }

    # Proxy config...
}
```

**Certificate Rotation:**
- Caddy auto-renews 30 days before expiry
- Zero-downtime rotation (keeps old cert until clients migrate)
- Alert on renewal failure (Datadog integration)

### TLS Configuration

#### Minimum TLS Version: 1.3
```caddy
tls {
    protocols tls1.3
    ciphers TLS_AES_128_GCM_SHA256 TLS_AES_256_GCM_SHA384
}
```

**Rationale:**
- TLS 1.3 is 40% faster than TLS 1.2 (fewer round trips)
- Modern browsers support it (Safari 12.1+, Chrome 70+)
- Eliminates legacy cipher vulnerabilities

#### HSTS (HTTP Strict Transport Security)
```caddy
header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
```

**Effect:**
- Browsers will ONLY connect via HTTPS for 1 year
- Prevents SSL stripping attacks
- Preload list submission for VibeCode.com (optional)

---

## Session Management

### JWT Token Structure

#### Access Token (Short-lived)
```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user-uuid-here",
    "email": "developer@vibecode.dev",
    "iss": "vibecode-auth-service",
    "aud": "vibecode-ide",
    "exp": 1730001900,  // 30 minutes from now
    "iat": 1730000000,
    "jti": "unique-token-id",
    "roles": ["developer", "workspace-admin"],
    "workspace_id": "ws-abc123",
    "fleet_node": "mac-node-1",
    "session_id": "sess-xyz789"
  }
}
```

#### Refresh Token (Long-lived)
```json
{
  "sub": "user-uuid-here",
  "type": "refresh",
  "exp": 1732592000,  // 30 days from now
  "jti": "unique-refresh-id"
}
```

### Token Lifecycle

```
┌────────────────────────────────────────────────────────────┐
│  User Authenticates (OAuth or Local Password)             │
└────────────────────────────────────────────────────────────┘
                           ↓
        ┌─────────────────────────────────────────┐
        │  Swift generates TWO tokens:            │
        │  1. Access Token (30 min)              │
        │  2. Refresh Token (30 days)            │
        └─────────────────────────────────────────┘
                           ↓
        ┌─────────────────────────────────────────┐
        │  Store both in macOS Keychain           │
        │  (encrypted, user-scoped)               │
        └─────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│  Every API Request:                                        │
│  - Include Access Token in Authorization header            │
│  - Caddy validates signature + expiry                      │
└────────────────────────────────────────────────────────────┘
                           ↓
        ┌─────────────────────────────────────────┐
        │  Access Token Expires (after 30 min)   │
        └─────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│  Swift automatically:                                      │
│  1. Sends Refresh Token to /auth/refresh endpoint         │
│  2. Receives new Access Token (30 min)                    │
│  3. Updates Keychain                                       │
│  4. Retries failed request with new token                 │
└────────────────────────────────────────────────────────────┘
                           ↓
        ┌─────────────────────────────────────────┐
        │  Refresh Token Expires (after 30 days)  │
        └─────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│  User must re-authenticate:                                │
│  - Desktop: Touch ID or password                           │
│  - Remote: OAuth flow                                      │
└────────────────────────────────────────────────────────────┘
```

### Token Storage Security

#### macOS Keychain (Desktop Mode)
```swift
class SecureTokenStore {
    func save(token: String, type: TokenType) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.vibecode.auth",
            kSecAttrAccount as String: type.rawValue,
            kSecValueData as String: token.data(using: .utf8)!,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]

        // Delete old token if exists
        SecItemDelete(query as CFDictionary)

        // Add new token
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw KeychainError.saveFailed(status)
        }
    }

    func retrieve(type: TokenType) throws -> String {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.vibecode.auth",
            kSecAttrAccount as String: type.rawValue,
            kSecReturnData as String: true
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data,
              let token = String(data: data, encoding: .utf8) else {
            throw KeychainError.notFound
        }

        return token
    }
}
```

**Security Properties:**
- `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`:
  - Token only accessible after first device unlock
  - NOT synced to iCloud (device-local only)
  - Protected by device passcode

#### PostgreSQL (Fleet Mode)
```sql
-- Store session metadata (NOT tokens themselves)
CREATE TABLE auth_sessions (
    session_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    last_activity TIMESTAMP NOT NULL DEFAULT NOW(),
    ip_address INET NOT NULL,
    user_agent TEXT NOT NULL,
    fleet_node TEXT,
    revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP,
    revoked_reason TEXT,
    INDEX idx_user_active (user_id, expires_at) WHERE NOT revoked
);
```

**Why NOT store tokens in DB:**
- JWT is self-contained (no lookup needed)
- DB breach doesn't expose valid tokens
- Stateless validation = better scalability

### Session Revocation

#### Immediate Revocation (Emergency)
```swift
class SessionRevoker {
    func revokeAllSessions(for user: User) async throws {
        // 1. Add user to revocation list (Redis)
        await redis.setex(
            key: "revoked:user:\(user.id)",
            value: "true",
            expiry: 86400  // 24 hours
        )

        // 2. Mark sessions as revoked in DB
        try await database.execute("""
            UPDATE auth_sessions
            SET revoked = TRUE, revoked_at = NOW(), revoked_reason = 'admin_revoke'
            WHERE user_id = $1
        """, [user.id])

        // 3. Notify all fleet nodes via message bus
        await messageBus.publish(
            topic: "auth.revoke",
            payload: ["user_id": user.id]
        )
    }
}
```

#### Graceful Expiry (Normal)
```caddy
# Caddy JWT validation
jwt {
    sign_key {env.JWT_SECRET}

    # Check Redis revocation list before accepting token
    verify_claims {
        sub {
            check_redis "revoked:user:{{.sub}}"
        }
    }
}
```

**Revocation Latency:**
- Emergency revoke: ~2 seconds (Redis propagation)
- Normal expiry: 0 seconds (JWT exp claim checked locally)

---

## Security Considerations

### CSRF Protection

#### Desktop App (Not Applicable)
- Desktop app doesn't use cookies (JWT in Authorization header)
- No cross-origin requests possible (app-controlled WebView)

#### Remote Fleet (Critical)
```caddy
# SameSite cookie for JWT
cookie {
    name vibecode_token
    samesite strict
    httponly true
    secure true
}
```

**Plus State Token:**
```swift
// Generate random state token for OAuth flow
let state = UUID().uuidString
UserDefaults.standard.set(state, forKey: "oauth_state")

// Verify on callback
guard receivedState == UserDefaults.standard.string(forKey: "oauth_state") else {
    throw OAuthError.invalidState
}
```

### XSS Protection

#### Content Security Policy
```caddy
header Content-Security-Policy "
    default-src 'self';
    script-src 'self' 'unsafe-eval';  # VS Code requires eval
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    connect-src 'self' wss://localhost:8443;
    font-src 'self' data:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
"
```

**Why `unsafe-eval`?**
- Monaco editor (VS Code's editor) requires `eval()` for syntax highlighting
- Acceptable risk: Content is user's own code (trusted)
- Alternative: Switch to non-eval-based editor (major effort)

#### Input Sanitization
```swift
// Sanitize user input before logging
func sanitizeForLog(_ input: String) -> String {
    input
        .replacingOccurrences(of: "<", with: "&lt;")
        .replacingOccurrences(of: ">", with: "&gt;")
        .replacingOccurrences(of: "\"", with: "&quot;")
        .prefix(1000)  // Truncate long inputs
}
```

### SQL Injection

**Already Protected:**
- Using Prisma ORM (parameterized queries)
- PostgreSQL prepared statements
- No raw SQL in application code

**Example Safe Query:**
```typescript
// Prisma automatically parameterizes this
const user = await prisma.user.findUnique({
  where: { email: userInput }  // Safe even if userInput = "'; DROP TABLE users; --"
});
```

### Rate Limiting

#### Caddy Configuration
```caddy
rate_limit {
    zone auth {
        key {remote_host}
        events 5
        window 1m
    }

    zone api {
        key {remote_host}
        events 100
        window 1m
    }
}

# Apply to sensitive endpoints
route /auth/* {
    rate_limit auth
}

route /api/* {
    rate_limit api
}
```

#### Swift-Level Rate Limiting (Desktop)
```swift
actor RateLimiter {
    private var attempts: [Date] = []
    private let maxAttempts = 5
    private let window: TimeInterval = 60  // 1 minute

    func checkLimit() async throws {
        let now = Date()

        // Remove attempts outside window
        attempts = attempts.filter { now.timeIntervalSince($0) < window }

        guard attempts.count < maxAttempts else {
            throw AuthError.rateLimitExceeded(
                retryAfter: attempts.first!.addingTimeInterval(window)
            )
        }

        attempts.append(now)
    }
}
```

### Audit Logging

#### What to Log
```swift
struct AuthAuditLog: Codable {
    let timestamp: Date
    let event: AuthEvent
    let userId: String?
    let email: String?
    let ipAddress: String
    let userAgent: String
    let success: Bool
    let errorMessage: String?
    let metadata: [String: String]
}

enum AuthEvent: String, Codable {
    case loginAttempt = "auth.login.attempt"
    case loginSuccess = "auth.login.success"
    case loginFailure = "auth.login.failure"
    case logoutSuccess = "auth.logout.success"
    case tokenRefresh = "auth.token.refresh"
    case tokenRevoke = "auth.token.revoke"
    case biometricSuccess = "auth.biometric.success"
    case biometricFailure = "auth.biometric.failure"
    case oauthCallback = "auth.oauth.callback"
    case sessionExpired = "auth.session.expired"
    case suspiciousActivity = "auth.suspicious.activity"
}
```

#### Datadog Integration
```swift
import DatadogCore
import DatadogLogs

class AuthLogger {
    let logger = Logger.create(
        with: Logger.Configuration(
            name: "vibecode-auth",
            networkInfoEnabled: true,
            bundleWithRumEnabled: true
        )
    )

    func log(event: AuthAuditLog) {
        logger.info(
            event.event.rawValue,
            attributes: [
                "user_id": event.userId ?? "anonymous",
                "email": event.email ?? "unknown",
                "ip_address": event.ipAddress,
                "user_agent": event.userAgent,
                "success": event.success,
                "error": event.errorMessage ?? "none"
            ]
        )

        // Send metric for monitoring
        if !event.success {
            Datadog.metric(
                name: "auth.failure.count",
                value: 1,
                tags: ["event": event.event.rawValue]
            )
        }
    }
}
```

#### Retention Policy
- **Production:** 90 days (compliance requirement)
- **Development:** 7 days (storage cost)
- **PII Handling:** Hash email addresses in logs (GDPR)

---

## Fallback & Recovery

### Scenario 1: Caddy Crashes

**Detection:**
```swift
class CaddyHealthCheck {
    func isHealthy() async -> Bool {
        do {
            let response = try await URLSession.shared.data(
                from: URL(string: "https://localhost:8443/health")!
            )
            return true
        } catch {
            return false
        }
    }
}
```

**Recovery:**
```swift
if !await caddyHealthCheck.isHealthy() {
    logger.error("Caddy proxy is down, entering emergency mode")

    // Option 1: Restart Caddy
    try await restartCaddy()

    // Option 2: Direct connection (ONLY for single-user desktop mode)
    if config.deploymentMode == .desktop {
        logger.warning("Connecting directly to OpenVSCode Server (no auth)")
        webView.load(URLRequest(url: URL(string: "http://localhost:8080")!))
    } else {
        // Fleet mode: Cannot bypass auth
        throw AuthError.proxyUnavailable
    }
}
```

### Scenario 2: macOS Keychain Locked

**Detection:**
```swift
do {
    let token = try secureTokenStore.retrieve(type: .accessToken)
} catch KeychainError.interactionNotAllowed {
    // Device locked, Keychain inaccessible
    logger.warning("Keychain locked, prompting user")
    showUnlockPrompt()
}
```

**Recovery:**
```swift
func showUnlockPrompt() {
    let alert = NSAlert()
    alert.messageText = "Unlock Required"
    alert.informativeText = "Please unlock your Mac to continue using VibeCode."
    alert.alertStyle = .warning
    alert.addButton(withTitle: "Unlock Now")
    alert.addButton(withTitle: "Work Offline")

    if alert.runModal() == .alertFirstButtonReturn {
        // Trigger biometric prompt
        Task {
            _ = try await BiometricAuth().authenticate(
                reason: "Unlock VibeCode"
            )
        }
    } else {
        // Enter offline mode (read-only)
        enterOfflineMode()
    }
}
```

### Scenario 3: OAuth Provider Down

**Detection:**
```swift
do {
    let token = try await oAuthClient.refreshToken(refreshToken)
} catch OAuthError.providerUnreachable {
    logger.error("OAuth provider unreachable, using fallback")

    if let cachedToken = try? await loadCachedToken() {
        logger.info("Using cached credentials (emergency mode)")
        return cachedToken
    } else {
        throw AuthError.authenticationUnavailable
    }
}
```

**Recovery Strategy:**
1. **Cache Last-Known-Good Token** (24 hours)
2. **Show Warning Banner:** "Using offline authentication. Some features may be limited."
3. **Retry OAuth Every 5 Minutes** (background task)
4. **Alert User After 1 Hour** (may need to re-authenticate)

### Scenario 4: JWT Secret Rotation

**Planned Rotation:**
```swift
class JWTSecretRotation {
    func rotateSecret() async throws {
        // 1. Generate new secret
        let newSecret = SymmetricKey(size: .bits256)

        // 2. Store in Keychain with version number
        try secureStore.save(key: "jwt_secret_v2", value: newSecret)

        // 3. Update Caddy config to accept BOTH old and new secrets (30-day overlap)
        try await updateCaddyConfig(secrets: [oldSecret, newSecret])

        // 4. Notify all clients to refresh tokens (within 30 days)
        await notifyClientsToRefresh()

        // 5. After 30 days, remove old secret
        Timer.scheduledTimer(withTimeInterval: 30 * 86400, repeats: false) { _ in
            Task {
                try await self.removeOldSecret()
            }
        }
    }
}
```

**Emergency Rotation (Secret Leaked):**
```swift
func emergencyRotation() async throws {
    logger.critical("JWT secret leaked! Rotating immediately")

    // 1. Generate new secret
    let newSecret = SymmetricKey(size: .bits256)

    // 2. Update Caddy immediately (old secret disabled)
    try await updateCaddyConfig(secrets: [newSecret])

    // 3. Revoke ALL existing tokens
    await revokeAllTokens()

    // 4. Force all users to re-authenticate
    await forceReauth()

    // 5. Send security incident notification
    await sendSecurityAlert(
        severity: .critical,
        message: "All sessions revoked due to security incident. Please log in again."
    )
}
```

---

## Swift 5 Auth Module Design

### Module Structure

```
VibeCodeAuth/
├── Package.swift
├── Sources/
│   ├── VibeCodeAuth/
│   │   ├── VibeCodeAuth.swift          # Public API
│   │   ├── Models/
│   │   │   ├── User.swift
│   │   │   ├── JWT.swift
│   │   │   ├── Session.swift
│   │   │   └── AuthError.swift
│   │   ├── Providers/
│   │   │   ├── AuthProvider.swift       # Protocol
│   │   │   ├── LocalAuthProvider.swift
│   │   │   ├── OAuthProvider.swift
│   │   │   ├── BiometricProvider.swift
│   │   │   └── AppleSignInProvider.swift
│   │   ├── Storage/
│   │   │   ├── KeychainManager.swift
│   │   │   ├── SecureTokenStore.swift
│   │   │   └── SessionCache.swift
│   │   ├── JWT/
│   │   │   ├── JWTEngine.swift
│   │   │   ├── JWTValidator.swift
│   │   │   └── ClaimsBuilder.swift
│   │   ├── Network/
│   │   │   ├── CaddyClient.swift
│   │   │   └── OAuthClient.swift
│   │   ├── Security/
│   │   │   ├── RateLimiter.swift
│   │   │   ├── AuditLogger.swift
│   │   │   └── CertificateManager.swift
│   │   └── Extensions/
│   │       ├── Date+JWT.swift
│   │       └── String+Base64.swift
└── Tests/
    └── VibeCodeAuthTests/
        ├── JWTEngineTests.swift
        ├── OAuthProviderTests.swift
        └── KeychainManagerTests.swift
```

### Core API (Public Interface)

```swift
import Foundation
import LocalAuthentication

/// Main authentication service for VibeCode
public class VibeCodeAuth: ObservableObject {

    // MARK: - Published Properties

    @Published public private(set) var currentUser: User?
    @Published public private(set) var isAuthenticated: Bool = false
    @Published public private(set) var authState: AuthState = .notAuthenticated

    // MARK: - Configuration

    public struct Configuration {
        let deploymentMode: DeploymentMode
        let jwtSecret: SymmetricKey
        let oauthProviders: [OAuthProviderConfig]
        let biometricsEnabled: Bool
        let sessionTimeout: TimeInterval
        let refreshTokenLifetime: TimeInterval

        public init(
            deploymentMode: DeploymentMode = .desktop,
            jwtSecret: SymmetricKey,
            oauthProviders: [OAuthProviderConfig] = [],
            biometricsEnabled: Bool = true,
            sessionTimeout: TimeInterval = 1800,  // 30 minutes
            refreshTokenLifetime: TimeInterval = 2592000  // 30 days
        ) {
            self.deploymentMode = deploymentMode
            self.jwtSecret = jwtSecret
            self.oauthProviders = oauthProviders
            self.biometricsEnabled = biometricsEnabled
            self.sessionTimeout = sessionTimeout
            self.refreshTokenLifetime = refreshTokenLifetime
        }
    }

    // MARK: - Dependencies

    private let config: Configuration
    private let keychainManager: KeychainManager
    private let jwtEngine: JWTEngine
    private let auditLogger: AuditLogger
    private let rateLimiter: RateLimiter

    // MARK: - Initialization

    public init(config: Configuration) {
        self.config = config
        self.keychainManager = KeychainManager()
        self.jwtEngine = JWTEngine(secret: config.jwtSecret)
        self.auditLogger = AuditLogger()
        self.rateLimiter = RateLimiter()

        // Attempt to restore session from Keychain
        Task {
            await restoreSession()
        }
    }

    // MARK: - Public API

    /// Authenticate with local password
    public func authenticateLocal(
        username: String,
        password: String
    ) async throws -> User {
        try await rateLimiter.checkLimit()

        auditLogger.log(
            event: .loginAttempt,
            metadata: ["username": username, "method": "local"]
        )

        // Validate credentials (would check against user database)
        let isValid = try await LocalAuthProvider().validate(
            username: username,
            password: password
        )

        guard isValid else {
            auditLogger.log(event: .loginFailure, metadata: ["username": username])
            throw AuthError.invalidCredentials
        }

        // Generate JWT tokens
        let user = User(id: UUID(), email: username, roles: ["developer"])
        let accessToken = try jwtEngine.generateAccessToken(for: user)
        let refreshToken = try jwtEngine.generateRefreshToken(for: user)

        // Store in Keychain
        try keychainManager.save(token: accessToken, type: .access)
        try keychainManager.save(token: refreshToken, type: .refresh)

        // Update state
        await MainActor.run {
            self.currentUser = user
            self.isAuthenticated = true
            self.authState = .authenticated
        }

        auditLogger.log(event: .loginSuccess, metadata: ["user_id": user.id.uuidString])

        return user
    }

    /// Authenticate with biometrics (Touch ID / Face ID)
    public func authenticateBiometric(
        reason: String = "Unlock VibeCode"
    ) async throws -> User {
        guard config.biometricsEnabled else {
            throw AuthError.biometricsDisabled
        }

        auditLogger.log(event: .biometricAttempt)

        let biometricProvider = BiometricProvider()
        let success = try await biometricProvider.authenticate(reason: reason)

        guard success else {
            auditLogger.log(event: .biometricFailure)
            throw AuthError.biometricsFailed
        }

        // Retrieve stored refresh token
        let refreshToken = try keychainManager.retrieve(type: .refresh)

        // Generate new access token
        let claims = try jwtEngine.validate(token: refreshToken)
        let user = User(id: UUID(uuidString: claims.sub)!, email: claims.email, roles: claims.roles)
        let accessToken = try jwtEngine.generateAccessToken(for: user)

        // Update Keychain
        try keychainManager.save(token: accessToken, type: .access)

        // Update state
        await MainActor.run {
            self.currentUser = user
            self.isAuthenticated = true
            self.authState = .authenticated
        }

        auditLogger.log(event: .biometricSuccess, metadata: ["user_id": user.id.uuidString])

        return user
    }

    /// Authenticate with OAuth provider (GitHub, Google, Apple)
    public func authenticateOAuth(
        provider: OAuthProviderType
    ) async throws -> User {
        auditLogger.log(
            event: .oauthAttempt,
            metadata: ["provider": provider.rawValue]
        )

        guard let providerConfig = config.oauthProviders.first(where: { $0.type == provider }) else {
            throw AuthError.providerNotConfigured(provider)
        }

        let oauthClient = OAuthClient(config: providerConfig)

        // Start OAuth flow (opens browser)
        let authCode = try await oauthClient.authorize()

        // Exchange code for access token
        let oauthToken = try await oauthClient.exchangeCode(authCode)

        // Fetch user info from provider
        let userInfo = try await oauthClient.fetchUserInfo(token: oauthToken)

        // Create local user and JWT
        let user = User(
            id: UUID(),
            email: userInfo.email,
            name: userInfo.name,
            roles: ["developer"]  // Would fetch from user DB
        )

        let accessToken = try jwtEngine.generateAccessToken(for: user)
        let refreshToken = try jwtEngine.generateRefreshToken(for: user)

        // Store in Keychain
        try keychainManager.save(token: accessToken, type: .access)
        try keychainManager.save(token: refreshToken, type: .refresh)

        // Update state
        await MainActor.run {
            self.currentUser = user
            self.isAuthenticated = true
            self.authState = .authenticated
        }

        auditLogger.log(
            event: .oauthSuccess,
            metadata: ["provider": provider.rawValue, "user_id": user.id.uuidString]
        )

        return user
    }

    /// Refresh expired access token
    public func refreshSession() async throws {
        let refreshToken = try keychainManager.retrieve(type: .refresh)

        // Validate refresh token
        let claims = try jwtEngine.validate(token: refreshToken)
        guard claims.type == .refresh else {
            throw AuthError.invalidTokenType
        }

        // Generate new access token
        let user = User(id: UUID(uuidString: claims.sub)!, email: claims.email, roles: claims.roles)
        let accessToken = try jwtEngine.generateAccessToken(for: user)

        // Update Keychain
        try keychainManager.save(token: accessToken, type: .access)

        auditLogger.log(event: .tokenRefresh, metadata: ["user_id": user.id.uuidString])
    }

    /// Sign out and clear session
    public func signOut() async throws {
        guard let user = currentUser else { return }

        auditLogger.log(event: .logoutAttempt, metadata: ["user_id": user.id.uuidString])

        // Remove tokens from Keychain
        try? keychainManager.delete(type: .access)
        try? keychainManager.delete(type: .refresh)

        // Update state
        await MainActor.run {
            self.currentUser = nil
            self.isAuthenticated = false
            self.authState = .notAuthenticated
        }

        auditLogger.log(event: .logoutSuccess, metadata: ["user_id": user.id.uuidString])
    }

    /// Check if current session is valid
    public func validateSession() async -> Bool {
        do {
            let accessToken = try keychainManager.retrieve(type: .access)
            let claims = try jwtEngine.validate(token: accessToken)

            // Check expiry
            guard claims.exp > Date() else {
                // Token expired, try refresh
                try await refreshSession()
                return true
            }

            return true
        } catch {
            return false
        }
    }

    // MARK: - Private Methods

    private func restoreSession() async {
        do {
            let isValid = await validateSession()
            if isValid {
                let accessToken = try keychainManager.retrieve(type: .access)
                let claims = try jwtEngine.validate(token: accessToken)
                let user = User(id: UUID(uuidString: claims.sub)!, email: claims.email, roles: claims.roles)

                await MainActor.run {
                    self.currentUser = user
                    self.isAuthenticated = true
                    self.authState = .authenticated
                }

                auditLogger.log(event: .sessionRestored, metadata: ["user_id": user.id.uuidString])
            }
        } catch {
            // Session restore failed, require re-auth
            authState = .notAuthenticated
        }
    }
}

// MARK: - Supporting Types

public enum AuthState {
    case notAuthenticated
    case authenticating
    case authenticated
    case refreshing
    case error(AuthError)
}

public enum DeploymentMode {
    case desktop       // Single-user, localhost
    case localVM       // Single-user, VM isolated
    case remoteFleet   // Multi-user, cloud/on-prem
}

public enum OAuthProviderType: String {
    case github
    case google
    case appleSignIn
    case okta
    case auth0
}

public struct User: Codable, Identifiable {
    public let id: UUID
    public let email: String
    public let name: String?
    public let roles: [String]

    public var isAdmin: Bool {
        roles.contains("admin")
    }
}

public enum AuthError: Error, LocalizedError {
    case invalidCredentials
    case biometricsDisabled
    case biometricsFailed
    case providerNotConfigured(OAuthProviderType)
    case invalidTokenType
    case tokenExpired
    case rateLimitExceeded(retryAfter: Date)
    case keychainError(OSStatus)

    public var errorDescription: String? {
        switch self {
        case .invalidCredentials:
            return "Invalid username or password"
        case .biometricsDisabled:
            return "Biometric authentication is disabled"
        case .biometricsFailed:
            return "Biometric authentication failed"
        case .providerNotConfigured(let provider):
            return "OAuth provider \(provider.rawValue) is not configured"
        case .invalidTokenType:
            return "Invalid token type"
        case .tokenExpired:
            return "Authentication token has expired"
        case .rateLimitExceeded(let retryAfter):
            return "Too many attempts. Try again after \(retryAfter)"
        case .keychainError(let status):
            return "Keychain error: \(status)"
        }
    }
}
```

### Example Usage in Tauri App

```swift
import SwiftUI
import VibeCodeAuth

@main
struct VibeCodeApp: App {
    @StateObject private var auth: VibeCodeAuth

    init() {
        // Configure auth module
        let jwtSecret = SymmetricKey(size: .bits256)
        let config = VibeCodeAuth.Configuration(
            deploymentMode: .desktop,
            jwtSecret: jwtSecret,
            oauthProviders: [
                .init(type: .github, clientID: "...", clientSecret: "..."),
                .init(type: .google, clientID: "...", clientSecret: "...")
            ],
            biometricsEnabled: true
        )

        _auth = StateObject(wrappedValue: VibeCodeAuth(config: config))
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(auth)
        }
    }
}

struct ContentView: View {
    @EnvironmentObject var auth: VibeCodeAuth
    @State private var showingLogin = false

    var body: some View {
        Group {
            if auth.isAuthenticated {
                IDEView()  // Load OpenVSCode Server in WKWebView
            } else {
                LoginView()
            }
        }
        .onAppear {
            // Check if session can be restored
            Task {
                let isValid = await auth.validateSession()
                if !isValid {
                    showingLogin = true
                }
            }
        }
    }
}

struct LoginView: View {
    @EnvironmentObject var auth: VibeCodeAuth
    @State private var username = ""
    @State private var password = ""
    @State private var showError = false
    @State private var errorMessage = ""

    var body: some View {
        VStack(spacing: 20) {
            Text("Welcome to VibeCode")
                .font(.largeTitle)

            TextField("Email", text: $username)
                .textFieldStyle(.roundedBorder)

            SecureField("Password", text: $password)
                .textFieldStyle(.roundedBorder)

            Button("Sign In") {
                Task {
                    do {
                        _ = try await auth.authenticateLocal(
                            username: username,
                            password: password
                        )
                    } catch {
                        errorMessage = error.localizedDescription
                        showError = true
                    }
                }
            }
            .buttonStyle(.borderedProminent)

            Divider()

            Button("Sign in with Touch ID") {
                Task {
                    do {
                        _ = try await auth.authenticateBiometric()
                    } catch {
                        errorMessage = error.localizedDescription
                        showError = true
                    }
                }
            }

            Button("Sign in with GitHub") {
                Task {
                    do {
                        _ = try await auth.authenticateOAuth(provider: .github)
                    } catch {
                        errorMessage = error.localizedDescription
                        showError = true
                    }
                }
            }
        }
        .padding()
        .alert("Authentication Error", isPresented: $showError) {
            Button("OK") { }
        } message: {
            Text(errorMessage)
        }
    }
}
```

---

## Conclusion

### Summary of Recommendations

1. **Hybrid Architecture:** Swift auth layer + Caddy reverse proxy
2. **Desktop Mode:** Swift-native with biometrics, optional Caddy
3. **Fleet Mode:** Caddy with OAuth/OIDC, JWT-based sessions
4. **TLS:** Automatic HTTPS via Caddy (Let's Encrypt)
5. **Storage:** macOS Keychain for tokens, PostgreSQL for session metadata
6. **Monitoring:** Datadog integration for all auth events
7. **Fallback:** Graceful degradation, offline mode support

### Security Checklist

- ✅ All traffic encrypted (TLS 1.3)
- ✅ JWT tokens with short expiry (30 min)
- ✅ Refresh tokens with rotation support
- ✅ Rate limiting on all auth endpoints
- ✅ Biometric authentication for desktop
- ✅ OAuth/OIDC for enterprise SSO
- ✅ Comprehensive audit logging
- ✅ Session revocation mechanism
- ✅ CSRF protection (state tokens)
- ✅ XSS protection (CSP headers)
- ✅ SQL injection prevention (ORM)

### Next Steps

1. **Review this document** with security team
2. **Prototype Swift auth module** (Week 1)
3. **Integrate Caddy** for TLS termination (Week 2)
4. **Implement OAuth flows** (Week 3-4)
5. **Security audit** before production (Week 8)
6. **Deploy to fleet** with phased rollout

---

**Document Owner:** Security Architect
**Last Updated:** October 28, 2025
**Next Review:** November 28, 2025
**Approval Required:** CTO, Security Lead, DevOps Lead

---

## Appendix: Alternative Approaches (Not Recommended)

### A. No Authentication (Status Quo)
**Why Not:** OpenVSCode Server with no auth is a critical security vulnerability. Any process on the machine can access the IDE.

### B. Basic HTTP Auth
**Why Not:** Weak security (passwords transmitted in Base64), no session management, no biometric support.

### C. Custom Electron-Based Auth
**Why Not:** Electron adds 100MB+ to app size, webkit-based Tauri is lighter and more native on macOS.

### D. VPN-Only Access
**Why Not:** Doesn't solve authentication problem, adds complexity for users, not suitable for desktop mode.

---

**End of Document**
