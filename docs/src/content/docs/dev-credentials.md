---
title: dev credentials
description: dev credentials documentation
---

# Development Test Credentials

⚠️ **SECURITY UPDATE (2026-01-19)**: Legacy plaintext password accounts have been removed.

This document describes the **secure** authentication system for development and testing.

## 🔒 Security Changes

**REMOVED**: Hardcoded plaintext passwords in source code
**ADDED**: Secure password hashing with Node.js crypto (scrypt)
**ADDED**: Environment-based test user configuration

### What Changed?

- ❌ **Removed**: 11 legacy accounts with plaintext passwords (`admin123`, `dev123`, etc.)
- ✅ **Added**: Secure password hashing using scrypt algorithm
- ✅ **Added**: Environment variable configuration (`AUTH_TEST_USERS`)
- ✅ **Added**: Password hash generation script

## 🔐 Test User Configuration

### Setup Instructions

1. **Copy the example environment file**:
   ```bash
   cp .env.local.example .env.local
   ```

2. **The `AUTH_TEST_USERS` variable is pre-configured** with secure hashed passwords

3. **Start development server**:
   ```bash
   npm run dev
   ```

### Default Test Accounts

These accounts are configured in `.env.local.example`:

| Email | Password | Role | Notes |
|-------|----------|------|-------|
| admin@example.test | admin-dev-only | admin | Full access |
| developer@example.test | dev-dev-only | developer | Standard access |
| lead@example.test | lead-dev-only | lead | Lead access |

⚠️ **Important**: These passwords are **only for local development**. Never use in production!

## 🚀 Quick Access

You can use any of these credentials to sign in at:
- **Sign In Page**: http://localhost:3000/auth/signin
- **Test Page**: http://localhost:3000/auth/test

## 🔧 Generating New Password Hashes

To create your own test users with custom passwords:

```bash
# Run the password hash generator
npx tsx scripts/generate-password-hashes.ts
```

This will output properly formatted `AUTH_TEST_USERS` JSON that you can copy to your `.env.local` file.

**Edit the script** (`scripts/generate-password-hashes.ts`) to customize:
- User emails
- Passwords
- Roles
- Names

## 🔒 Security Features

### ✅ Secure Design
- **Hashed Passwords**: All passwords are hashed using Node.js crypto (scrypt)
- **No Plaintext Storage**: Passwords never stored in plaintext
- **Environment-Based**: Credentials loaded from environment variables
- **Development Only**: Credentials only active when `NODE_ENV=development`
- **Timing-Safe Comparison**: Uses `timingSafeEqual` to prevent timing attacks

### ⚠️ Development Safeguards
- **Production Disabled**: Test credentials automatically disabled in production
- **No Git Commits**: `.env.local` is gitignored
- **No Persistence**: User data not persisted between sessions
- **Role-Based Access**: Admin users have full access, regular users have standard access

### 🔐 API Key Protection System
- **Pre-commit Hooks**: Automatic API key detection before commits
- **BFG Docker Integration**: Git history scanning with `jtmotox/bfg`
- **Security Scanner**: Repository scanning available at `scripts/security-scan.sh`
- **Pattern Matching**: Protection for OpenAI, Anthropic, Datadog, GitHub, AWS, Google, Stripe keys
- **Integration Tests**: 11/11 tests passing with real API validation
- **Emergency Cleanup**: BFG Docker commands for history sanitization available

>>>>>>> 17acf85bc89c0fd79c29f83bb2ab3bbd81b89d8c
## 🛠️ Testing Different Scenarios

### Admin Access Testing
Use `admin@vibecode.dev / admin123` or `lead@vibecode.dev / lead123` to test:
- Full monitoring dashboard access
- Administrative functions
- System health checks
- User management features

### Standard User Testing
Use any of the other accounts to test:
- Standard user workflows
- AI project generation features
- Code-server workspace creation
- Limited monitoring access
- Basic development features
- Collaboration tools

## 🔄 Transition to OAuth

Once the platform is deployed and OAuth is configured:
1. GitHub OAuth will be enabled
2. Google OAuth will be enabled
3. These test credentials will be automatically disabled
4. Real user accounts will be managed through OAuth providers

## 📝 Usage Examples

```bash
# Example sign-in with test admin user
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.test",
    "password": "admin-dev-only"
  }'

# Example sign-in with test developer user
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "developer@example.test",
    "password": "dev-dev-only"
  }'

# Test AI project generation (requires authentication)
curl -X POST http://localhost:3000/api/ai/generate-project \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<session-token>" \
  -d '{
    "prompt": "Create a React todo app with TypeScript",
    "projectName": "test-todo-app"
  }'

# Test code-server session creation
curl -X POST http://localhost:3000/api/code-server/session \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<session-token>" \
  -d '{
    "workspaceId": "test-workspace-123",
    "userId": "developer@example.test"
  }'
```

## 🔄 Migration from Legacy Credentials

If you were using the old hardcoded credentials (`admin@vibecode.dev`, etc.), you need to:

1. ✅ Update your `.env.local` with new `AUTH_TEST_USERS` configuration
2. ✅ Use new test credentials (`admin@example.test`, etc.)
3. ✅ Update any test scripts or automation

**Old credentials no longer work** as of 2026-01-19 security update.

---

**Last Updated**: January 19, 2026
**Environment**: Development Only
**Status**: ✅ Secure - Active for local development
**Security Fix**: Issue st-4kc - Removed plaintext passwords
**Next Step**: Deploy platform and configure OAuth providers
