# Secrets Scan Report - 2026-01-19

## Summary

Quick security scan for hardcoded secrets in the codebase.

| Category | Count | Action Needed |
|----------|-------|---------------|
| Critical (real secrets) | 2 | Immediate rotation |
| Medium (dev defaults) | 7 | Replace with env vars |
| Low (test fixtures) | 180+ | Acceptable |

---

## Critical Findings

### 1. Hardcoded OpenRouter API Key (HIGH SEVERITY)

**File:** `services/ai-gateway/src/__tests__/openrouter-e2e.int.test.ts:133`

```typescript
const TEST_API_KEY = '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';
```

- Format matches real OpenRouter API keys (`sk-or-v1-...`)
- **Recommendation:** Rotate this key immediately and replace with environment variable

### 2. Hardcoded Legacy Credentials in Production Code (HIGH SEVERITY)

**File:** `src/lib/auth.ts:102-113`

Contains 11 hardcoded user/password pairs in the NextAuth credentials provider:
- `admin@vibecode.dev` / `admin123`
- `developer@vibecode.dev` / `dev123`
- `lead@vibecode.dev` / `lead123`
- And 8 more...

- **Recommendation:** Move to environment-based config or proper user database

---

## Medium Severity Findings

| File | Issue |
|------|-------|
| `docker-compose.litellm.yml:80` | `UI_PASSWORD: "vibecode2024"` |
| `helm/vibecode-platform/values.yaml:9` | `rootPassword: "vibecode-root"` |
| `config/vfkit/postgresql-pgvector-vm.yaml:423` | `POSTGRES_PASSWORD: "postgres_admin_2024"` |
| `docker/mongodb/init-chatui-db.js:10` | `pwd: 'chatui_password_2025'` |
| `docker/authelia/configuration.yml:16` | `jwt_secret: "insecure_jwt_secret_change_in_production"` |
| `litellm/config.yaml:344` | `ui_password` with default fallback |
| `k8s/authelia/authelia-config.yaml:122` | `password: "vibecode_password"` |

---

## Acceptable Patterns

The following were found but are acceptable:

1. **Test fixtures** (~180+ occurrences): Mock API keys and passwords in `tests/**` directories
2. **Placeholder values**: `REPLACE_WITH_*` patterns in K8s secrets templates
3. **Environment variable references**: `${DD_API_KEY:-}` patterns
4. **Example files**: `.env.example` files with placeholder values

---

## Private Key Files

Found private key patterns in:
- `docs/sessions/archive-worklogs/zfs-apool-repair-complete-session.md`
- `.specstory/history/2025-11-03_17-42Z-repair-database-for-chat-history.md`

These appear to be documentation/history files - verify they don't contain actual production keys.

---

## Recommendations

1. **Immediate:** Rotate the OpenRouter API key and update `TEST_API_KEY` to use environment variable
2. **Short-term:** Refactor `src/lib/auth.ts` to use environment variables or database for credentials
3. **Medium-term:** Audit docker-compose and helm values files to use secrets injection
