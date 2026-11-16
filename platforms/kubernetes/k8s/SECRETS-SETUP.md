# Kubernetes Secrets Setup Guide

This guide explains how to properly configure the Kubernetes secrets for external deployment of VibeCode.

## ⚠️ SECURITY WARNING

Real secret manifests are never committed. The repository only ships placeholder
templates; copy one, fill it locally and apply it. The copies are git-ignored
(`**/*-secret.yaml`, `**/*-secrets.yaml`), and CI runs gitleaks on every PR
(`.github/workflows/gitleaks.yml`).

| Template (committed) | Local copy (ignored) |
|---|---|
| `datadog-secret.example.yaml` | `datadog-secret.yaml` |
| `vector-secrets.example.yaml` | `vector-secrets.yaml` |
| `postgres-secret.example.yaml` | `postgres-secret.yaml` |
| `oauth-secrets.example.yaml` | `oauth-secrets.yaml` |

```bash
cd platforms/kubernetes/k8s
cp oauth-secrets.example.yaml oauth-secrets.yaml
$EDITOR oauth-secrets.yaml        # replace every "<set-me>"
kubectl apply -f oauth-secrets.yaml
```

The templates use `stringData:`, so values are plain text (Kubernetes base64-encodes them).
Manifests that embed a Secret (`datadog-agent-with-postgres.yaml`,
`postgres-with-monitoring.yaml`, `postgresql-aks-statefulset.yaml`) carry `<set-me>`
placeholders too; fill them in a local copy or create the Secret separately.

If you create the Secret separately, delete the embedded `kind: Secret` document from your local
copy before `kubectl apply`: applying the full manifest overwrites the live Secret with `<set-me>`.

## Required Secret Replacements

### 1. OAuth Secrets (`oauth-secrets.yaml`, from `oauth-secrets.example.yaml`)

Set `GITHUB_ID`, `GITHUB_SECRET`, `GOOGLE_ID`, `GOOGLE_SECRET`, `NEXTAUTH_SECRET` and `NEXTAUTH_URL`.

1. Get OAuth credentials from the GitHub and Google developer consoles
2. Generate a NextAuth secret: `openssl rand -base64 32`
3. Put the plain values in your local copy (no base64 needed with `stringData:`)

### 2. VibeCode Application Secrets (`k8s/vibecode-secrets.yaml`)

Replace these values:

```yaml
# Placeholder/development values that need replacement:
ADMIN_EMAIL: admin@vibecode.dev           # Use real admin email
ADMIN_PASSWORD: admin123                  # Use secure password
NEXTAUTH_SECRET: [encoded placeholder]    # Must match oauth-secrets
DD_API_KEY: [encoded placeholder]         # Real Datadog API key
OPENROUTER_API_KEY: [encoded placeholder] # Real OpenRouter API key
NEXT_PUBLIC_DD_APPLICATION_ID: dmlibQ==   # Real Datadog app ID (currently "vibm")
NEXT_PUBLIC_DD_CLIENT_TOKEN: [encoded]    # Real Datadog client token
```

## Security Best Practices

1. **Never commit real secrets to version control**
2. **Use environment-specific secret management** (e.g., Kubernetes secrets, HashiCorp Vault)
3. **Rotate secrets regularly**
4. **Use minimal required permissions** for service accounts
5. **Audit secret access** in production environments

## Template Files

Template versions with clear placeholders are available:
- `k8s/templates/vibecode-secrets.template.yaml`
- `k8s/templates/oauth-secrets.template.yaml`

## Validation

After replacing secrets, validate the deployment:

```bash
# Check secret creation
kubectl get secrets -n vibecode-platform

# Validate service health
kubectl port-forward svc/vibecode-service 3000:3000 -n vibecode-platform
curl -H "User-Agent: Mozilla/5.0" http://localhost:3000/api/health/simple
```

## For Development/Testing

For local development or testing environments, you can use the placeholder values, but they should **NEVER** be used in production or shared externally.
