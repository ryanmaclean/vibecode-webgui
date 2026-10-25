# Security Fix: Remove Plaintext Password Accounts (st-4kc)

**Status**: CRITICAL
**Priority**: P0
**Created**: 2026-01-19
**Assignee**: vibecode/polecats/flint

## Executive Summary

Found **11 legacy user accounts** with plaintext passwords in production authentication code. These must be removed immediately and replaced with proper hashed password authentication.

## Security Impact

- **Severity**: CRITICAL
- **Exposure**: Plaintext passwords hardcoded in Git repository
- **Affected Users**: 11 development/test accounts
- **Attack Vector**: Anyone with code access can see credentials
- **Production Risk**: HIGH - Code is in production-ready state

## Affected Accounts

All accounts use `@vibecode.dev` email domain with weak plaintext passwords:

1. `admin@vibecode.dev` → `admin123` (admin role)
2. `developer@vibecode.dev` → `dev123` (developer role)
3. `lead@vibecode.dev` → `lead123` (lead role)
4. `frontend@vibecode.dev` → `frontend123` (developer role)
5. `backend@vibecode.dev` → `backend123` (developer role)
6. `fullstack@vibecode.dev` → `fullstack123` (developer role)
7. `designer@vibecode.dev` → `design123` (designer role)
8. `tester@vibecode.dev` → `test123` (tester role)
9. `devops@vibecode.dev` → `devops123` (devops role)
10. `intern@vibecode.dev` → `intern123` (intern role)
11. `security@vibecode.dev` → `security123` (security role)

## Affected Files

### Core Authentication (HIGH PRIORITY)
- `src/lib/auth.ts` - **PRODUCTION CODE** with plaintext passwords (lines 102-114)
  - Uses simple string comparison: `user.password === credentials.password`
  - No password hashing
  - Hardcoded user array

### Test Mocks (HIGH PRIORITY)
- `tests/__mocks__/@/lib/auth.ts` - Duplicates plaintext passwords (lines 41-52)
- `tests/e2e/auth/legacy-credentials.test.ts` - E2E tests using credentials (lines 3-14)

### Documentation (MEDIUM PRIORITY)
- `docs/src/content/docs/dev-credentials.md` - Documents all accounts with passwords
- Multiple archive/wiki copies documenting these credentials

### Additional Files (80+ files reference these accounts)
- Test files: `tests/unit/`, `tests/e2e/`, `tests/integration/`
- UI components: `src/components/auth/`
- Config files: `k8s/`, `docker/`, `scripts/`
- Documentation: `docs/`, `content/wiki/`

## Migration Plan

### Phase 1: Implement Secure Authentication (IMMEDIATE)

#### 1.1 Add Password Hashing Library
```bash
npm install bcrypt
npm install --save-dev @types/bcrypt
```

#### 1.2 Create Environment-Based User Management
- Move to environment variables or secure database
- Implement bcrypt password hashing
- Add password validation utilities

#### 1.3 Update Authentication Code
**File**: `src/lib/auth.ts`

Replace hardcoded users array (lines 102-114) with:
- Environment-variable based test user configuration
- Bcrypt password comparison
- Optional database lookup for production

### Phase 2: Update Tests (IMMEDIATE)

#### 2.1 Update Test Mocks
**File**: `tests/__mocks__/@/lib/auth.ts`
- Use secure test fixtures
- Mock password hashing for tests
- Remove plaintext passwords

#### 2.2 Update E2E Tests
**File**: `tests/e2e/auth/legacy-credentials.test.ts`
- Use environment variables for test credentials
- Add proper test setup/teardown
- Document test-only nature

### Phase 3: Update Documentation (HIGH)

#### 3.1 Security Documentation
- Update `docs/src/content/docs/dev-credentials.md`
- Remove plaintext password examples
- Add instructions for environment-based auth
- Document security best practices

#### 3.2 Migration Guide
- Create guide for developers
- Explain new authentication flow
- Provide environment variable examples

### Phase 4: Clean Git History (RECOMMENDED)

#### 4.1 Security Scan
- Run `git log -p | grep -i "password.*123"` to find commits
- Document all commits containing plaintext passwords

#### 4.2 History Rewrite (Optional but Recommended)
- Use BFG Repo-Cleaner to remove passwords from history
- Force push to remote (requires team coordination)
- Update all clones

### Phase 5: Verification (CRITICAL)

#### 5.1 Security Audit
- Verify no plaintext passwords remain
- Check all authentication endpoints
- Test password hashing works correctly

#### 5.2 Test Suite
- Run full test suite
- Verify all auth tests pass
- Check E2E authentication flows

## Implementation Timeline

1. **Hour 0-1**: Implement secure authentication (Phase 1)
2. **Hour 1-2**: Update tests (Phase 2)
3. **Hour 2-3**: Update documentation (Phase 3)
4. **Hour 3-4**: Testing and verification (Phase 5)
5. **Optional**: Git history cleanup (Phase 4)

## Technical Solution

### Recommended Approach: Environment-Based Test Users

```typescript
// src/lib/auth.ts
import bcrypt from 'bcrypt';

async authorize(credentials) {
  if (!credentials) return null;

  // Option 1: For development - use env vars
  const TEST_USERS = process.env.NODE_ENV === 'development'
    ? JSON.parse(process.env.AUTH_TEST_USERS || '[]')
    : [];

  // Option 2: For production - database lookup
  const user = await lookupUserFromDatabase(credentials.email);

  if (!user) {
    // Check test users in development only
    const testUser = TEST_USERS.find(u => u.email === credentials.email);
    if (testUser && process.env.NODE_ENV === 'development') {
      const passwordMatch = await bcrypt.compare(
        credentials.password,
        testUser.passwordHash
      );
      if (passwordMatch) return testUser;
    }
    return null;
  }

  // Verify password with bcrypt
  const passwordMatch = await bcrypt.compare(
    credentials.password,
    user.passwordHash
  );

  return passwordMatch ? user : null;
}
```

### Environment Variable Example

```bash
# .env.local (NOT committed to git)
AUTH_TEST_USERS='[
  {
    "id": "test-admin",
    "email": "admin@example.test",
    "passwordHash": "$2b$10$...",
    "name": "Test Admin",
    "role": "admin"
  }
]'
```

## Risk Mitigation

### Before Changes
- **Risk**: Anyone with code access sees passwords
- **Impact**: Potential unauthorized access
- **Likelihood**: HIGH (public repo or team access)

### After Changes
- **Risk**: Minimal - hashed passwords in env vars
- **Impact**: Requires environment access + hash cracking
- **Likelihood**: LOW

## Success Criteria

- [ ] No plaintext passwords in source code
- [ ] All passwords properly hashed with bcrypt
- [ ] Test suite passes completely
- [ ] Documentation updated
- [ ] Security scan shows no secrets
- [ ] Git history cleaned (optional)

## References

- **Issue**: st-4kc
- **Found by**: Amber (security scan)
- **Related Issues**: st-1b5 (OpenRouter API keys), st-6av (database passwords)
- **Security Scan Report**: `docs/security/secrets-scan-2026-01-19.md`

---

**Next Steps**: Begin Phase 1 implementation immediately.
