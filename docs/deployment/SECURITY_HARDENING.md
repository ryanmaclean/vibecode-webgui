# Security Hardening Guide

Production security hardening best practices for VibeCode deployment.

## Security Layers

```
┌───────────────────────────────────────────────────────────┐
│                    Security Architecture                   │
├───────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 1: Network Security                                 │
│  ├─ Firewall Rules                                         │
│  ├─ Network Policies                                       │
│  ├─ TLS/SSL Encryption                                     │
│  └─ DDoS Protection                                        │
│                                                             │
│  Layer 2: Application Security                             │
│  ├─ Input Validation                                       │
│  ├─ Authentication & Authorization                         │
│  ├─ Session Management                                     │
│  └─ Security Headers                                       │
│                                                             │
│  Layer 3: Infrastructure Security                          │
│  ├─ Container Security                                     │
│  ├─ Image Scanning                                         │
│  ├─ Runtime Protection                                     │
│  └─ Pod Security Policies                                  │
│                                                             │
│  Layer 4: Data Security                                    │
│  ├─ Encryption at Rest                                     │
│  ├─ Encryption in Transit                                  │
│  ├─ Secret Management                                      │
│  └─ Data Classification                                    │
│                                                             │
│  Layer 5: Access Control                                   │
│  ├─ RBAC                                                   │
│  ├─ Service Accounts                                       │
│  ├─ API Authentication                                     │
│  └─ Audit Logging                                          │
│                                                             │
└───────────────────────────────────────────────────────────┘
```

## Network Security

### Kubernetes Network Policies

```yaml
# network-policies-strict.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: vibecode-production
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress

---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-vibecode-ingress
  namespace: vibecode-production
spec:
  podSelector:
    matchLabels:
      app: vibecode
  policyTypes:
  - Ingress
  ingress:
  # Only allow from ingress controller
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
      podSelector:
        matchLabels:
          app.kubernetes.io/name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3000

---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-vibecode-egress
  namespace: vibecode-production
spec:
  podSelector:
    matchLabels:
      app: vibecode
  policyTypes:
  - Egress
  egress:
  # Allow to database only
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432

  # Allow to external HTTPS only (AI providers)
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 443

  # Allow DNS
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53

---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: postgres-isolation
  namespace: vibecode-production
spec:
  podSelector:
    matchLabels:
      app: postgres
  policyTypes:
  - Ingress
  - Egress
  ingress:
  # Only allow from application pods
  - from:
    - podSelector:
        matchLabels:
          app: vibecode
    ports:
    - protocol: TCP
      port: 5432

  # Allow from monitoring
  - from:
    - namespaceSelector:
        matchLabels:
          name: monitoring
    ports:
    - protocol: TCP
      port: 5432

  egress:
  # Allow DNS only
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53
```

### TLS/SSL Configuration

```yaml
# tls-certificate.yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: vibecode-tls
  namespace: vibecode-production
spec:
  secretName: vibecode-tls-secret
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
  - vibecode.example.com
  - www.vibecode.example.com
  - api.vibecode.example.com

---
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: security@example.com
    privateKeySecretRef:
      name: letsencrypt-prod-account-key
    solvers:
    - http01:
        ingress:
          class: nginx
```

## Container Security

### Secure Dockerfile

```dockerfile
# Dockerfile.secure
# Use specific version, not latest
FROM node:20.10.0-alpine3.18 AS base

# Install security updates
RUN apk upgrade --no-cache

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY --chown=nodejs:nodejs . .

# Build application
RUN npm run build

# Remove development files
RUN rm -rf src tests docs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "server.js"]
```

### Pod Security Context

```yaml
# secure-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vibecode-secure
  namespace: vibecode-production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: vibecode
  template:
    metadata:
      labels:
        app: vibecode
      annotations:
        # Security scanning
        container.apparmor.security.beta.kubernetes.io/vibecode: runtime/default
        seccomp.security.alpha.kubernetes.io/pod: runtime/default
    spec:
      # Security context for pod
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        runAsGroup: 1001
        fsGroup: 1001
        fsGroupChangePolicy: "OnRootMismatch"
        seccompProfile:
          type: RuntimeDefault

      # Service account with minimal permissions
      serviceAccountName: vibecode-app
      automountServiceAccountToken: false

      containers:
      - name: vibecode
        image: vibecode/webgui:1.0.0
        imagePullPolicy: IfNotPresent

        # Security context for container
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: false  # Next.js needs write
          runAsNonRoot: true
          runAsUser: 1001
          runAsGroup: 1001
          capabilities:
            drop:
            - ALL
          seccompProfile:
            type: RuntimeDefault

        # Resource limits to prevent DoS
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"

        # Environment from secrets only
        envFrom:
        - secretRef:
            name: vibecode-secrets
        - configMapRef:
            name: vibecode-config

        # Mount only necessary volumes
        volumeMounts:
        - name: tmp
          mountPath: /tmp
          readOnly: false
        - name: cache
          mountPath: /app/.next/cache
          readOnly: false

      volumes:
      - name: tmp
        emptyDir:
          medium: Memory
          sizeLimit: 1Gi
      - name: cache
        emptyDir:
          sizeLimit: 2Gi

      # DNS policy for security
      dnsPolicy: ClusterFirst

      # Image pull secrets
      imagePullSecrets:
      - name: registry-credentials
```

## Secret Management

### HashiCorp Vault Integration

```yaml
# vault-integration.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: vibecode-vault
  namespace: vibecode-production

---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: vibecode-vault-role
  namespace: vibecode-production
rules:
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get", "list"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: vibecode-vault-binding
  namespace: vibecode-production
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: vibecode-vault-role
subjects:
- kind: ServiceAccount
  name: vibecode-vault
  namespace: vibecode-production

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: vault-agent-config
  namespace: vibecode-production
data:
  vault-agent-config.hcl: |
    exit_after_auth = false
    pid_file = "/tmp/pidfile"

    auto_auth {
      method "kubernetes" {
        mount_path = "auth/kubernetes"
        config = {
          role = "vibecode-app"
        }
      }

      sink "file" {
        config = {
          path = "/vault/secrets/.vault-token"
        }
      }
    }

    template {
      source      = "/vault/configs/database-config.tmpl"
      destination = "/vault/secrets/database-config"
    }

    template {
      source      = "/vault/configs/api-keys.tmpl"
      destination = "/vault/secrets/api-keys"
    }
```

### External Secrets Operator

```yaml
# external-secrets.yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: vault-backend
  namespace: vibecode-production
spec:
  provider:
    vault:
      server: "https://vault.example.com"
      path: "secret"
      version: "v2"
      auth:
        kubernetes:
          mountPath: "kubernetes"
          role: "vibecode-app"
          serviceAccountRef:
            name: vibecode-vault

---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: vibecode-secrets
  namespace: vibecode-production
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault-backend
    kind: SecretStore

  target:
    name: vibecode-secrets
    creationPolicy: Owner

  data:
  - secretKey: database-url
    remoteRef:
      key: vibecode/production
      property: database_url

  - secretKey: nextauth-secret
    remoteRef:
      key: vibecode/production
      property: nextauth_secret

  - secretKey: openai-api-key
    remoteRef:
      key: vibecode/production
      property: openai_api_key

  - secretKey: anthropic-api-key
    remoteRef:
      key: vibecode/production
      property: anthropic_api_key
```

## Database Security

### PostgreSQL Hardening

```sql
-- Create secure database configuration
-- postgresql.conf additions

# Connection security
ssl = on
ssl_cert_file = '/etc/ssl/certs/server.crt'
ssl_key_file = '/etc/ssl/private/server.key'
ssl_ca_file = '/etc/ssl/certs/ca.crt'
ssl_min_protocol_version = 'TLSv1.2'
ssl_ciphers = 'HIGH:MEDIUM:+3DES:!aNULL'
ssl_prefer_server_ciphers = on

# Authentication
password_encryption = scram-sha-256

# Logging for security audit
log_connections = on
log_disconnections = on
log_duration = off
log_error_verbosity = default
log_hostname = off
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_statement = 'ddl'
log_timezone = 'UTC'

# Row Level Security
row_security = on
```

```sql
-- Create security policies
-- setup-security.sql

-- Enable row level security on sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY user_isolation_policy ON users
  USING (id = current_setting('app.current_user_id')::uuid);

-- Create secure roles
CREATE ROLE vibecode_app_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO vibecode_app_readonly;

CREATE ROLE vibecode_app_readwrite;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO vibecode_app_readwrite;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO vibecode_app_readwrite;

-- Revoke public schema access
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO vibecode_app_readonly;
GRANT USAGE ON SCHEMA public TO vibecode_app_readwrite;

-- Create application user
CREATE USER vibecode_app WITH PASSWORD 'secure-password';
GRANT vibecode_app_readwrite TO vibecode_app;

-- Enable audit logging
CREATE EXTENSION IF NOT EXISTS pgaudit;
ALTER SYSTEM SET pgaudit.log = 'ddl, role, read, write';
ALTER SYSTEM SET pgaudit.log_catalog = off;
ALTER SYSTEM SET pgaudit.log_parameter = on;
```

### Database Connection Security

```typescript
// lib/db-secure.ts
import { Pool } from 'pg';
import fs from 'fs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // SSL/TLS configuration
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('/certs/ca.crt').toString(),
    cert: fs.readFileSync('/certs/client.crt').toString(),
    key: fs.readFileSync('/certs/client.key').toString(),
  },

  // Connection pool limits
  max: 20,
  min: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,

  // Security settings
  statement_timeout: 30000,  // 30 seconds
  query_timeout: 30000,

  // Application name for audit
  application_name: 'vibecode-webgui',
});

// Set session variables for RLS
export const setSecurityContext = async (userId: string) => {
  const client = await pool.connect();
  try {
    await client.query('SET app.current_user_id = $1', [userId]);
    return client;
  } catch (error) {
    client.release();
    throw error;
  }
};

export default pool;
```

## Application Security

### Input Validation & Sanitization

```typescript
// lib/validation.ts
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

// Schema validation
export const userInputSchema = z.object({
  message: z.string().min(1).max(10000).trim(),
  userId: z.string().uuid(),
  metadata: z.object({
    source: z.enum(['web', 'api', 'mobile']),
    timestamp: z.number().positive(),
  }).optional(),
});

// Sanitize HTML
export const sanitizeHtml = (input: string): string => {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
    ALLOWED_ATTR: [],
  });
};

// SQL injection prevention (use parameterized queries)
export const safeQuery = async (query: string, params: any[]) => {
  // Always use parameterized queries
  // NEVER concatenate user input into SQL
  return pool.query(query, params);
};

// XSS prevention
export const escapeHtml = (text: string): string => {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
};

// Path traversal prevention
export const sanitizePath = (path: string): string => {
  // Remove any .. or absolute paths
  return path.replace(/\.\./g, '').replace(/^\//, '');
};
```

### Rate Limiting

```typescript
// lib/rate-limit.ts
import { Redis } from 'ioredis';
import { NextRequest } from 'next/server';

const redis = new Redis(process.env.REDIS_URL);

export const rateLimit = async (
  req: NextRequest,
  limit: number = 100,
  window: number = 60 // seconds
): Promise<{ success: boolean; remaining: number }> => {
  const identifier = req.headers.get('x-real-ip') ||
                     req.headers.get('x-forwarded-for') ||
                     'unknown';

  const key = `ratelimit:${identifier}:${Date.now() / (window * 1000) | 0}`;

  const current = await redis.incr(key);

  if (current === 1) {
    await redis.expire(key, window);
  }

  const remaining = Math.max(0, limit - current);

  return {
    success: current <= limit,
    remaining,
  };
};

// Strict rate limiting for sensitive endpoints
export const strictRateLimit = async (
  req: NextRequest,
  limit: number = 5,
  window: number = 300 // 5 minutes
): Promise<boolean> => {
  const result = await rateLimit(req, limit, window);
  return result.success;
};
```

### Security Headers

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // HSTS (only in production)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // Adjust for Next.js
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.openai.com https://api.anthropic.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

## Authentication & Authorization

### NextAuth.js Hardening

```typescript
// pages/api/auth/[...nextauth].ts
import NextAuth from 'next-auth';
import type { NextAuthOptions } from 'next-auth';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import prisma from '@/lib/prisma';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 24,  // 24 hours
    updateAge: 60 * 60,    // Update every hour
  },

  jwt: {
    maxAge: 60 * 60 * 24,  // 24 hours
  },

  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },

  callbacks: {
    async jwt({ token, user, account }) {
      // Add security context to JWT
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.permissions = user.permissions;
      }

      // Rotate token periodically
      const shouldRotate = Date.now() - (token.iat || 0) * 1000 > 3600000; // 1 hour
      if (shouldRotate) {
        token.iat = Math.floor(Date.now() / 1000);
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId;
        session.user.role = token.role;
        session.user.permissions = token.permissions;
      }
      return session;
    },
  },

  events: {
    async signIn({ user, account, isNewUser }) {
      // Audit log
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'SIGN_IN',
          provider: account?.provider,
          timestamp: new Date(),
        },
      });
    },

    async signOut({ token }) {
      // Audit log
      await prisma.auditLog.create({
        data: {
          userId: token.userId,
          action: 'SIGN_OUT',
          timestamp: new Date(),
        },
      });
    },
  },

  providers: [
    // Configure providers securely
  ],
};

export default NextAuth(authOptions);
```

## Security Scanning

### Container Image Scanning

```yaml
# .github/workflows/security-scan.yml
name: Security Scan

on:
  push:
    branches: [main, production]
  pull_request:
    branches: [main, production]
  schedule:
    - cron: '0 0 * * *'  # Daily

jobs:
  trivy-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build image
        run: docker build -t vibecode/webgui:${{ github.sha }} .

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: vibecode/webgui:${{ github.sha }}
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'

      - name: Upload Trivy results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'

  snyk-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run Snyk to check for vulnerabilities
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

  dependency-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: OWASP Dependency Check
        uses: dependency-check/Dependency-Check_Action@main
        with:
          project: 'vibecode'
          path: '.'
          format: 'HTML'

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: dependency-check-report
          path: dependency-check-report.html
```

## Incident Response

### Security Incident Playbook

```markdown
# Security Incident Response Playbook

## Phase 1: Detection & Analysis (0-15 minutes)
- [ ] Confirm security incident
- [ ] Assess severity (Critical/High/Medium/Low)
- [ ] Activate incident response team
- [ ] Create incident ticket

## Phase 2: Containment (15-60 minutes)
- [ ] Isolate affected systems
- [ ] Revoke compromised credentials
- [ ] Block malicious IPs/domains
- [ ] Preserve evidence

## Phase 3: Eradication (1-4 hours)
- [ ] Identify root cause
- [ ] Remove malicious artifacts
- [ ] Patch vulnerabilities
- [ ] Reset all credentials

## Phase 4: Recovery (4-24 hours)
- [ ] Restore from clean backups
- [ ] Verify system integrity
- [ ] Monitor for reinfection
- [ ] Gradual service restoration

## Phase 5: Post-Incident (24-72 hours)
- [ ] Document incident timeline
- [ ] Conduct post-mortem
- [ ] Update security policies
- [ ] Implement preventive measures

## Contact Information
- Security Lead: security@example.com
- On-call Engineer: +1-555-0100
- Legal: legal@example.com
```

## Next Steps

- [Disaster Recovery](./DISASTER_RECOVERY.md)
- [Monitoring Configuration](./MONITORING.md)
- [Production Checklist](./PRODUCTION_CHECKLIST.md)
- [Kubernetes Production](./KUBERNETES_PRODUCTION.md)
