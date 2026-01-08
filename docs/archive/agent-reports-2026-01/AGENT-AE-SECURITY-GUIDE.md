# Agent AE: API Gateway & Service Mesh - Security Best Practices Guide

**Document**: Security Best Practices
**Agent**: AE - API Gateway and Service Mesh Specialist
**Version**: 1.0
**Classification**: Internal
**Date**: January 5, 2026

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Authentication & Authorization](#authentication--authorization)
3. [Network Security](#network-security)
4. [Data Protection](#data-protection)
5. [API Security](#api-security)
6. [Infrastructure Security](#infrastructure-security)
7. [Monitoring & Detection](#monitoring--detection)
8. [Incident Response](#incident-response)
9. [Compliance & Audit](#compliance--audit)
10. [Security Checklist](#security-checklist)

---

## Executive Summary

The VibeCode API Gateway and Service Mesh implement a comprehensive security framework protecting the microservices architecture from:

- **Unauthorized Access**: JWT/OAuth, mTLS, RBAC
- **Data Breach**: Encryption at rest and in transit
- **API Abuse**: Rate limiting, WAF, DDoS protection
- **Service Compromise**: Network policies, isolation, monitoring
- **Compliance Violations**: Audit logging, data governance

---

## Authentication & Authorization

### 1. JWT (JSON Web Tokens)

#### Configuration

```yaml
# File: traefik/config/dynamic/middlewares.yaml

auth-jwt:
  basicAuth:
    users:
      - "admin:$2y$10$8lGH1/TgmYLSxrxVdYyqzO0UZKOWwt/c5J6MF7v7K.6T7zGl.ZMze"
    realm: "VibeCode API"
    removeHeader: true
```

#### JWT Token Structure

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user@vibecode.local",
    "iss": "https://auth.vibecode.local",
    "aud": ["vibecode-api"],
    "exp": 1609459200,
    "iat": 1609459200,
    "scope": "read write admin",
    "roles": ["user", "developer"],
    "org": "vibecode"
  },
  "signature": "HMACSHA256(...)"
}
```

#### Best Practices

```yaml
JWT Security Measures:
  Token Generation:
    - Use strong secret (at least 32 bytes)
    - Short expiration time (1 hour for access tokens)
    - Include audience claim
    - Sign with HS256 or RS256

  Token Validation:
    - Always verify signature
    - Check expiration (exp claim)
    - Validate issuer (iss claim)
    - Verify audience (aud claim)
    - Check token not blacklisted

  Token Storage (Client):
    - Store in memory only
    - NOT in localStorage (XSS vulnerability)
    - Use httpOnly cookies if needed
    - Clear on logout

  Token Rotation:
    - Refresh tokens every 1 hour
    - Use refresh token rotation
    - Revoke old tokens on refresh
    - Implement token blacklist

  Example Refresh Flow:
    GET /auth/refresh
    Header: Authorization: Bearer <refresh_token>
    Returns: New access token + new refresh token
```

### 2. OAuth 2.0 / OpenID Connect

#### Provider Configuration

```yaml
# traefik/config/dynamic/middlewares.yaml

auth-oauth:
  forwardAuth:
    address: "http://oauth-provider:4180"
    trustForwardHeader: true
    authResponseHeaders:
      - "X-Auth-User"
      - "X-Auth-Groups"
      - "X-Auth-Token"
```

#### Supported Providers

```yaml
OAuth Providers:
  Google OAuth 2.0:
    scope: "openid email profile"
    endpoint: https://accounts.google.com/o/oauth2/v2/auth

  GitHub OAuth 2.0:
    scope: "user:email read:org"
    endpoint: https://github.com/login/oauth/authorize

  Azure AD / Entra ID:
    scope: "openid email profile"
    endpoint: https://login.microsoftonline.com/common/oauth2/v2.0/authorize

  Keycloak (Self-hosted):
    scope: "openid email profile roles"
    endpoint: https://keycloak.vibecode.local/auth/realms/vibecode/protocol/openid-connect/auth
```

#### OAuth Setup Example

```bash
# 1. Create OAuth application with provider (e.g., GitHub)
# Register at: https://github.com/settings/developers

# 2. Configure environment variables
cat >> .env.api-gateway << 'EOF'
OAUTH_CLIENT_ID=your_client_id
OAUTH_CLIENT_SECRET=your_client_secret
OAUTH_REDIRECT_URL=https://api.vibecode.local/oauth/callback
OAUTH_PROVIDER=github
EOF

# 3. Restart Traefik
docker-compose restart traefik
```

### 3. Role-Based Access Control (RBAC)

#### Authorization Policy

```yaml
# istio/config/mtls-policy.yaml

apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: api-gateway-rbac
  namespace: default
spec:
  selector:
    matchLabels:
      app: api-gateway
  rules:
    # Allow admin users
    - from:
        - source:
            principals:
              - "cluster.local/ns/default/sa/admin"
            requestPrincipals:
              - "https://auth.vibecode.local/user/*"
      to:
        - operation:
            methods: ["GET", "POST", "PUT", "DELETE"]
            ports: ["443"]
      when:
        - key: request.auth.claims[roles]
          values: ["admin"]

    # Allow regular users (read-only)
    - from:
        - source:
            requestPrincipals:
              - "https://auth.vibecode.local/user/*"
      to:
        - operation:
            methods: ["GET"]
            ports: ["443"]
      when:
        - key: request.auth.claims[scope]
          values: ["read"]

    # Allow service-to-service with mTLS
    - from:
        - source:
            principals:
              - "cluster.local/ns/default/sa/*"
      to:
        - operation:
            ports: ["8080"]  # Internal service ports
```

#### Role Definitions

```yaml
Roles:
  admin:
    Permissions:
      - create:workspace
      - read:workspace
      - update:workspace
      - delete:workspace
      - manage:users
      - view:audit_logs
    Scope: "*"

  developer:
    Permissions:
      - create:workspace
      - read:workspace
      - update:workspace
      - read:database
      - write:cache
      - read:terminal
    Scope: "own_resources"

  viewer:
    Permissions:
      - read:workspace
      - read:database (limited)
    Scope: "shared_resources"

  api_client:
    Permissions:
      - call:api
    Scope: "assigned_endpoints"
    Rate Limit: "1000 req/min"
```

---

## Network Security

### 1. Mutual TLS (mTLS)

#### Enable mTLS Cluster-wide

```yaml
# istio/config/mtls-policy.yaml

apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default-mtls
  namespace: default
spec:
  mtls:
    mode: STRICT  # STRICT = mTLS required for all traffic
  portLevelMtls:
    "8080":       # OpenVSCode
      mode: STRICT
    "5432":       # PostgreSQL
      mode: STRICT
    "6379":       # Valkey
      mode: STRICT
    "22":         # SSH
      mode: STRICT
```

#### Certificate Management

```bash
# Istio automatically manages mTLS certificates
# Certificates located at: /etc/istio/certs/

# Verify mTLS is enabled
kubectl get peerAuthentication -A
kubectl get destinationrules -A

# Check certificate details
kubectl exec -it pod/openvscode-server-xyz -- \
  openssl s_client -showcerts < /etc/istio/certs/tls.crt

# Certificate Rotation Schedule:
# - Default: 90 days
# - Rotation: 1 day before expiry
# - No downtime required
```

### 2. Network Policies

#### Namespace Isolation

```yaml
# kubernetes/network-policies.yaml

apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: default
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  # Deny all by default, then allow specific rules

---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api-gateway-to-services
  namespace: default
spec:
  podSelector:
    matchLabels:
      tier: service
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: api-gateway
      ports:
        - protocol: TCP
          port: 8080
        - protocol: TCP
          port: 5432
        - protocol: TCP
          port: 6379

---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-egress-dns
  namespace: default
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
    - to:
        - namespaceSelector: {}
      ports:
        - protocol: UDP
          port: 53
```

### 3. IP Whitelisting

#### Configure IP Allowlist

```yaml
# traefik/config/dynamic/middlewares.yaml

ip-whitelist:
  ipWhiteList:
    sourceRange:
      - "127.0.0.1/8"              # Localhost
      - "::1/128"                   # IPv6 localhost
      - "10.0.0.0/8"                # Private network
      - "172.16.0.0/12"             # Private network
      - "192.168.0.0/16"            # Private network
      - "203.0.113.0/24"            # Office IP range
      - "198.51.100.0/24"           # Partner IP range
    invertSourceIP: false

# Apply to specific routes
routers:
  admin-panel:
    rule: "Path(`/admin`)"
    middlewares:
      - ip-whitelist
      - auth-jwt
```

#### Geo-blocking

```yaml
# Block access from specific countries
geoBlocking:
  allowed_countries:
    - US
    - CA
    - GB
    - DE
    - FR
    - AU
    - JP
    - SG

  blocked_countries:
    - KP   # North Korea
    - IR   # Iran
    - SY   # Syria
    - CU   # Cuba

# Implementation via ModSecurity WAF
modsecurity_rules: |
  SecRule REMOTE_ADDR "@geoLookup" \
    "id:1000,chain,phase:1,deny,status:403,\
    msg:'Access from blocked country'"
    SecRule GEO:COUNTRY_CODE "@rx ^(KP|IR|SY|CU)$"
```

---

## Data Protection

### 1. Encryption in Transit

#### TLS/SSL Configuration

```yaml
# traefik/config/traefik.yaml

tls:
  options:
    default:
      minVersion: VersionTLS12
      cipherSuites:
        - TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256
        - TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
        - TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384
        - TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
        - TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305
        - TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305

    modern:
      minVersion: VersionTLS13
      cipherSuites:
        - TLS_AES_128_GCM_SHA256
        - TLS_CHACHA20_POLY1305_SHA256
        - TLS_AES_256_GCM_SHA384

  certificatesResolvers:
    letsencrypt:
      acme:
        email: admin@vibecode.local
        storage: /etc/traefik/acme.json
        caServer: https://acme-v02.api.letsencrypt.org/directory
        httpChallenge:
          entryPoint: web
```

#### HSTS (HTTP Strict Transport Security)

```yaml
security-headers:
  headers:
    forceSTSHeader: true
    stsSeconds: 31536000         # 1 year
    stsIncludeSubdomains: true   # Include subdomains
    stsPreload: true             # Include in preload list
    # Enables Strict-Transport-Security header
```

### 2. Encryption at Rest

#### Database Encryption

```sql
-- PostgreSQL TDE (Transparent Data Encryption)
-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create encrypted column
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    api_key BYTEA NOT NULL
    ENCRYPTED_WITH (ALGORITHM = 'aes-256-cbc')
);

-- Encrypt sensitive data
INSERT INTO users (email, password_hash, api_key)
VALUES (
    'user@vibecode.local',
    crypt('password', gen_salt('bf')),
    pgp_sym_encrypt('secret-key', 'encryption-password')
);
```

#### Valkey Encryption

```bash
# Redis/Valkey encryption configuration
# In redis.conf or docker-compose environment

# TLS/SSL for Valkey
port 0                          # Disable unencrypted port
tls-port 6379                   # Enable TLS port
tls-cert-file /etc/valkey/certs/cert.pem
tls-key-file /etc/valkey/certs/key.pem
tls-ca-cert-file /etc/valkey/certs/ca.pem
tls-replication yes             # Encrypt replication
tls-cluster yes                 # Encrypt cluster communication

# Client connections must use TLS
tls-client-default-no-auth no
```

### 3. Secrets Management

#### Environment Variable Management

```bash
# Use secrets manager, NOT environment files
# Option 1: HashiCorp Vault
vault kv put secret/vibecode/api-gateway \
  jwt_secret="$(openssl rand -base64 32)" \
  oauth_client_secret="your-secret" \
  database_password="strong-password"

# Retrieve in application
VAULT_TOKEN=s.xxx vault kv get secret/vibecode/api-gateway

# Option 2: Kubernetes Secrets
kubectl create secret generic api-gateway-secrets \
  --from-literal=jwt_secret=$(openssl rand -base64 32) \
  --from-literal=oauth_client_secret=your-secret

# Use in deployments
apiVersion: v1
kind: Pod
metadata:
  name: api-gateway
spec:
  containers:
    - name: traefik
      env:
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: api-gateway-secrets
              key: jwt_secret

# Option 3: AWS Secrets Manager
aws secretsmanager create-secret \
  --name vibecode/api-gateway \
  --secret-string '{"jwt_secret":"...","oauth_client_secret":"..."}'

# Retrieve: aws secretsmanager get-secret-value --secret-id vibecode/api-gateway
```

#### Sensitive Data in Logs

```yaml
# DO NOT log sensitive data
# traefik/config/dynamic/middlewares.yaml

request-logger:
  plugin:
    requestLogger:
      # Redact sensitive headers
      redactHeaders:
        - Authorization
        - X-API-Key
        - X-JWT-Token
        - Cookie
        - X-Forwarded-Authorization

      # Redact request body patterns
      redactPatterns:
        - password
        - secret
        - token
        - api_key
        - credit_card
```

---

## API Security

### 1. Web Application Firewall (WAF)

#### ModSecurity Rules

```yaml
# traefik/config/dynamic/middlewares.yaml

waf-modsecurity:
  plugin:
    modsecurity:
      enabled: true
      rules: |
        # OWASP Core Rule Set (CRS)
        Include /etc/modsecurity/crs/crs-setup.conf
        Include /etc/modsecurity/crs/rules/*.conf

        # Custom rules for VibeCode

        # Rule 1: Block SQL injection
        SecRule ARGS|HEADERS|BODY "@rx (?i)(union|select|insert|update|delete|drop)" \
          "id:1001,phase:2,deny,status:403,msg:'SQL injection attempt'"

        # Rule 2: Block XSS attempts
        SecRule ARGS|HEADERS|BODY "@rx (?i)<script[^>]*>.*?</script>" \
          "id:1002,phase:2,deny,status:403,msg:'XSS attempt'"

        # Rule 3: Block command injection
        SecRule ARGS|HEADERS|BODY "@rx [;|&]\s*(cat|ls|rm|chmod|sudo)" \
          "id:1003,phase:2,deny,status:403,msg:'Command injection attempt'"

        # Rule 4: Require valid Content-Type
        SecRule REQUEST_METHOD "@rx ^(POST|PUT)$" \
          "chain,id:1004,phase:1,deny,status:415,msg:'Missing Content-Type'"
          SecRule HEADERS:Content-Type "!@rx ^application/json"

        # Rule 5: Rate limit per IP
        SecRule IP:RATELIMIT "@gt 100" \
          "id:1005,phase:1,deny,status:429,msg:'Rate limit exceeded'"
```

### 2. Rate Limiting

#### DDoS Protection

```yaml
# traefik/config/dynamic/middlewares.yaml

ddos-protection:
  rateLimit:
    average: 1000           # 1000 req/sec global
    burst: 5000             # Allow burst to 5000
    period: "1m"
    sourceIp: true
    # Sliding window algorithm prevents burst attacks

# Per-tier rate limiting
rate-limit-standard:
  rateLimit:
    average: 100
    burst: 200

rate-limit-premium:
  rateLimit:
    average: 1000
    burst: 2000

rate-limit-enterprise:
  rateLimit:
    average: 10000
    burst: 50000
```

#### Slow Rate Limiting Attack

```yaml
# Detect clients making very slow requests (Slowloris)
slowrateLimit:
  policy:
    - name: "slowloris-protection"
      maxConnectTime: 10s      # Max time to complete headers
      maxBodyTime: 30s          # Max time to send body
      readTimeout: 5s           # Timeout between data packets
```

### 3. Input Validation

#### Request Validation

```yaml
# traefik/config/dynamic/middlewares.yaml

request-validation:
  plugin:
    schemaValidator:
      enabled: true
      validateContentType: true
      validatePayload: true

      # Define schema for POST endpoints
      schemas:
        "/api/v1/editor/workspace":
          method: "POST"
          schema: |
            {
              "type": "object",
              "required": ["name", "path"],
              "properties": {
                "name": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 255
                },
                "path": {
                  "type": "string",
                  "pattern": "^/[a-zA-Z0-9/_-]+$"
                }
              }
            }

        "/api/v1/database/query":
          method: "POST"
          schema: |
            {
              "type": "object",
              "required": ["sql"],
              "properties": {
                "sql": {
                  "type": "string",
                  "maxLength": 10000
                },
                "params": {
                  "type": "array"
                },
                "timeout": {
                  "type": "integer",
                  "minimum": 1,
                  "maximum": 60000
                }
              }
            }
```

---

## Infrastructure Security

### 1. Container Security

#### Docker Best Practices

```dockerfile
# Dockerfile security practices

FROM ubuntu:22.04 AS base

# Run as non-root user
RUN useradd -m -u 1000 appuser

# Install minimal dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy application
COPY --chown=appuser:appuser . /app

WORKDIR /app

# Use non-root user
USER appuser:appuser

# Health check
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Security labels
LABEL security.scan="vulnerability-scanning"
LABEL security.policy="strict"
```

#### Container Scanning

```bash
# Scan images for vulnerabilities
trivy image vibecode/openvscode-server:latest

# Use signed images
docker pull vibecode/openvscode-server@sha256:abc123...

# Scan registries
trivy image-registry --severity HIGH,CRITICAL
```

### 2. Kubernetes Security

#### Pod Security Policy

```yaml
# kubernetes/pod-security-policy.yaml

apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: restricted
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  hostNetwork: false
  hostIPC: false
  hostPID: false
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'MustRunAs'
    seLinuxOptions:
      level: 's0:c123,c456'
  readOnlyRootFilesystem: true
```

#### Network Policies

```yaml
# kubernetes/network-policies.yaml

# Deny all ingress by default
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
spec:
  podSelector: {}
  policyTypes:
    - Ingress

# Allow only from Traefik
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-traefik
spec:
  podSelector:
    matchLabels:
      tier: service
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: traefik
      ports:
        - protocol: TCP
          port: 8080
```

### 3. RBAC (Kubernetes)

#### Role-Based Access Control

```yaml
# kubernetes/rbac.yaml

# ServiceAccount for API Gateway
apiVersion: v1
kind: ServiceAccount
metadata:
  name: api-gateway

---
# Role with minimal permissions
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: api-gateway
rules:
  # Can read configmaps for configuration
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get", "watch"]

  # Can get services for discovery
  - apiGroups: [""]
    resources: ["services"]
    verbs: ["get", "list"]

  # Can get endpoints for routing
  - apiGroups: [""]
    resources: ["endpoints"]
    verbs: ["get", "list", "watch"]

---
# Bind role to service account
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: api-gateway
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: api-gateway
subjects:
  - kind: ServiceAccount
    name: api-gateway
```

---

## Monitoring & Detection

### 1. Security Monitoring

#### Audit Logging

```yaml
# traefik/config/dynamic/middlewares.yaml

request-logger:
  plugin:
    requestLogger:
      level: "info"
      format: "json"
      fields:
        - timestamp
        - client_ip
        - user_id
        - http_method
        - http_path
        - http_status
        - response_time_ms
        - error_message
        - tls_version
        - tls_cipher
        - auth_method
        - auth_result

      # Log to ELK stack
      outputs:
        - elasticsearch:
            url: "http://elasticsearch:9200"
            index: "vibecode-api-logs"

# Audit trail configuration
auditLog:
  enabled: true
  location: "/var/log/audit/traefik-audit.log"
  format: "json"
  includeRequestBody: true
  redactSensitiveData:
    - Authorization
    - X-API-Key
    - password
    - secret
```

### 2. Threat Detection

#### Suspicious Activity Alerts

```yaml
# prometheus/alerts.yaml

groups:
  - name: security-alerts
    rules:
      # High error rate (potential attack)
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m])) /
          sum(rate(http_requests_total[5m])) > 0.05
        for: 5m
        annotations:
          severity: critical
          description: "Error rate > 5%"

      # Too many failed auth attempts
      - alert: HighAuthFailureRate
        expr: |
          sum(rate(auth_failures_total[5m])) > 100
        for: 1m
        annotations:
          severity: high
          description: "Auth failures > 100/min"

      # Rate limit exceeded frequently
      - alert: RateLimitExceeded
        expr: |
          sum(rate(rate_limit_exceeded_total[1m])) > 1000
        for: 1m
        annotations:
          severity: warning
          description: "Rate limit exceeded > 1000/min"

      # Unusual IP accessing API
      - alert: UnusualSourceIP
        expr: |
          increase(requests_from_new_ip[5m]) > 5
        annotations:
          severity: info
          description: "Requests from new IP address"
```

### 3. Intrusion Detection

#### WAF Event Logging

```bash
# View ModSecurity events
tail -f /var/log/modsecurity/audit.log

# Parse and analyze WAF events
docker exec traefik-api-gateway \
  grep -i "denied" /var/log/modsecurity/audit.log | \
  jq '.message, .client_ip, .rule_id'

# Send to SIEM
# Configure rsyslog or filebeat to forward logs to:
# - Splunk
# - ELK Stack
# - Datadog
# - Cloud SIEM
```

---

## Incident Response

### 1. Security Incident Procedures

#### Response Plan

```yaml
Incident Response Timeline:

  T+0 (Detection):
    - Alert triggered by monitoring
    - Incident created in ticketing system
    - On-call security engineer notified

  T+15 min (Assessment):
    - Gather logs and metrics
    - Identify affected services
    - Check if data was accessed
    - Determine scope of compromise

  T+30 min (Containment):
    - Isolate affected services
    - Block malicious IP addresses
    - Revoke compromised credentials
    - Enable extra logging

  T+1 hour (Investigation):
    - Root cause analysis
    - Forensic data collection
    - Impact assessment
    - Notification preparation

  T+2-4 hours (Remediation):
    - Patch vulnerabilities
    - Rotate credentials
    - Clear cache/sessions
    - Restore from backup if needed

  T+4+ hours (Recovery):
    - Service restoration
    - Validation and testing
    - Customer notifications
    - Post-incident analysis

Response Contacts:
  - Security Team: security@vibecode.local
  - On-Call: ops@vibecode.local
  - Legal: legal@vibecode.local
  - PR: pr@vibecode.local
```

### 2. Breach Notification

#### Data Breach Protocol

```bash
#!/bin/bash
# Breach notification checklist

echo "Data Breach Detected - Executing Response Protocol"

# Step 1: Contain the breach
echo "1. Isolating affected services..."
kubectl scale deployment compromised-service --replicas=0

# Step 2: Disable compromised credentials
echo "2. Revoking credentials..."
vault write auth/token/revoke-prefix path="token-path"

# Step 3: Enable detailed logging
echo "3. Enabling enhanced logging..."
kubectl set env deployment/api-gateway LOG_LEVEL=DEBUG

# Step 4: Collect forensic data
echo "4. Collecting forensic data..."
kubectl logs deployment/api-gateway > /tmp/forensics.log
kubectl exec pod/postgresql -- \
  pg_dump vibecode > /tmp/db-backup.sql

# Step 5: Notify stakeholders
echo "5. Sending notifications..."
# Send to: legal@vibecode.local, security@vibecode.local

# Step 6: Initiate investigation
echo "6. Starting investigation..."
# Contact: Incident Response Team, Legal, Insurance

exit 0
```

---

## Compliance & Audit

### 1. Compliance Frameworks

#### GDPR Compliance

```yaml
GDPR Requirements Implementation:

Data Protection:
  - Encryption at rest (TDE, AES-256)
  - Encryption in transit (TLS 1.2+)
  - Secure key management (Vault)

Data Minimization:
  - Only collect required data
  - Retention: Delete after 90 days
  - Pseudonymization: Hash sensitive data

User Rights:
  - Right to access: /api/user/data-export
  - Right to deletion: /api/user/delete
  - Right to portability: /api/user/data-export
  - Right to object: /api/preferences/tracking

Breach Notification:
  - Notify within 72 hours
  - Affected users notification
  - Regulatory authority notification

DPA Agreements:
  - Data Processing Agreement with vendors
  - Subprocessor list: https://vibecode.local/dpa
  - SCCs for international transfers
```

#### HIPAA Compliance (if handling health data)

```yaml
HIPAA Requirements:

Access Control:
  - Unique user IDs
  - Emergency access procedures
  - Automatic logoff (15 min)
  - Encryption and decryption

Audit Controls:
  - Audit logging enabled
  - Tamper-proof logs
  - Immediate alerting
  - 6-year retention

Transmission Security:
  - TLS for all data in transit
  - Integrity controls (HMAC)
  - Authentication required
  - Encrypted backups
```

### 2. Audit Logging

#### Compliance Logs

```yaml
# Log requirements for compliance

ApiGatewayLogs:
  Fields:
    - timestamp: "2026-01-05T10:00:00Z"
    - request_id: "req-123456"
    - user_id: "user@vibecode.local"
    - source_ip: "203.0.113.1"
    - http_method: "POST"
    - endpoint: "/api/v1/database/query"
    - request_body_hash: "sha256:abc123"
    - response_status: 200
    - response_time_ms: 245
    - tls_version: "TLSv1.3"
    - tls_cipher: "TLS_AES_128_GCM_SHA256"
    - auth_method: "JWT"
    - auth_result: "success"
    - user_roles: ["developer", "user"]
    - action: "database_query"
    - resource: "users_table"
    - outcome: "success"
    - error_message: null

  Retention:
    development: 30 days
    staging: 90 days
    production: 7 years (for compliance)

  Storage:
    - Immutable append-only
    - Encrypted at rest
    - Tamper detection
    - Replicated backups
```

---

## Security Checklist

### Pre-Deployment

- [ ] All default passwords changed
- [ ] JWT secret generated (32+ bytes)
- [ ] OAuth provider configured
- [ ] TLS certificates obtained (Let's Encrypt or commercial)
- [ ] Rate limiting policies defined
- [ ] WAF rules enabled
- [ ] IP whitelist configured
- [ ] Network policies created
- [ ] RBAC roles defined
- [ ] Audit logging enabled
- [ ] Secrets in Vault/KMS (not env files)
- [ ] Security headers configured
- [ ] mTLS enabled between services
- [ ] HTTPS enforced (HTTP redirects)
- [ ] CORS properly restricted
- [ ] Input validation rules created
- [ ] Output encoding configured
- [ ] SQL injection prevention tested
- [ ] XSS protection tested
- [ ] CSRF tokens enabled

### Post-Deployment

- [ ] Penetration testing performed
- [ ] Vulnerability scanning passed
- [ ] Load testing completed (under attack)
- [ ] Failover tested
- [ ] Disaster recovery plan created
- [ ] Incident response plan documented
- [ ] Security team trained
- [ ] Monitoring dashboards active
- [ ] Alerting rules validated
- [ ] Backup/restore tested
- [ ] Documentation reviewed
- [ ] Legal review completed
- [ ] Compliance audit passed
- [ ] Insurance coverage verified

### Ongoing Operations

- [ ] Daily security monitoring
- [ ] Weekly log review
- [ ] Monthly vulnerability scanning
- [ ] Quarterly penetration testing
- [ ] Annual compliance audit
- [ ] Certificate expiry checks
- [ ] Dependency updates
- [ ] Security patch application
- [ ] Access review (quarterly)
- [ ] Incident drills (quarterly)

---

## References

- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **NIST Cybersecurity Framework**: https://www.nist.gov/cyberframework
- **CIS Controls**: https://www.cisecurity.org/controls/
- **GDPR**: https://gdpr-info.eu/
- **Traefik Security**: https://doc.traefik.io/traefik/https/overview/
- **Istio Security**: https://istio.io/latest/docs/concepts/security/
- **Kubernetes Security**: https://kubernetes.io/docs/concepts/security/

---

**Security Guide - Complete**

For questions or security issues: security@vibecode.local
