# 🔐 Authentication Testing Guide

> **SOLUTION**: This guide provides comprehensive instructions for testing all authentication-protected features including AI project generation, workspace management, and file upload capabilities.

## 🚀 Quick Start - Test All Features Now

### 1. Setup Development Environment

```bash
# Copy environment template
cp .env.local.example .env.local

# Install dependencies (if not already done)
npm install

# Start the development server
npm run dev
```

### 2. Test Authentication System

```bash
# Test all 10 development credentials
node tests/root-tests/credentials/test-credentials.cjs
```

**Expected Output**: ✅ All 10 test users should authenticate successfully.

## 👥 Available Test Users

### Admin Users (Full Access)
- **admin@vibecode.dev** / admin123 (VibeCode Admin)
- **lead@vibecode.dev** / lead123 (Lisa Thompson)

### Developer Users (AI + Workspace Access)
- **developer@vibecode.dev** / dev123 (Sarah Johnson)
- **frontend@vibecode.dev** / frontend123 (Michael Chen) 
- **backend@vibecode.dev** / backend123 (Emily Rodriguez)

### Team Members (Standard Access)
- **fullstack@vibecode.dev** / fullstack123 (David Kim)
- **designer@vibecode.dev** / design123 (Jessica Taylor)
- **tester@vibecode.dev** / test123 (Robert Wilson)
- **devops@vibecode.dev** / devops123 (Amanda Garcia)
- **intern@vibecode.dev** / intern123 (James Martinez)

## 🧪 Testing Protected Features

### A. AI Project Generation Testing

1. **Sign in** to http://localhost:3000/auth/signin with any test user
2. **Navigate** to the AI project generation page
3. **Test the API endpoint** directly:

```bash
# Get session token after signing in through browser
# Check browser dev tools > Application > Cookies > next-auth.session-token

curl -X POST http://localhost:3000/api/ai/generate-project \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN_HERE" \
  -d '{
    "prompt": "Create a React TypeScript app with Tailwind CSS",
    "projectName": "test-project",
    "framework": "react"
  }'
```

### B. Workspace Management Testing

1. **Sign in** with a developer or admin account
2. **Test workspace creation**:

```bash
curl -X POST http://localhost:3000/api/workspaces \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN_HERE" \
  -d '{
    "name": "test-workspace",
    "description": "Test workspace for feature validation"
  }'
```

3. **Test code-server session**:

```bash
curl -X POST http://localhost:3000/api/code-server/session \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN_HERE" \
  -d '{
    "workspaceId": "test-workspace",
    "userId": "test-user"
  }'
```

### C. File Upload and RAG System Testing

1. **Test file upload endpoint**:

```bash
curl -X POST http://localhost:3000/api/files/upload \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN_HERE" \
  -F "file=@test-document.pdf" \
  -F "workspaceId=test-workspace"
```

2. **Test file sync**:

```bash
curl -X POST http://localhost:3000/api/files/sync \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN_HERE" \
  -d '{
    "workspaceId": "test-workspace",
    "files": ["test-file.txt"]
  }'
```

### D. Real-time Collaboration Testing

1. **Open multiple browser tabs** with different test users
2. **Join the same workspace** from each tab
3. **Test real-time features**:
   - Live code editing
   - Chat messaging
   - Cursor tracking
   - File sharing

## 🔧 Development Testing Utilities

### Environment Bypass for Testing

For end-to-end testing without browser authentication, use test headers:

```bash
# Test with mock authentication (development only)
curl -X POST http://localhost:3000/api/ai/generate-project \
  -H "Content-Type: application/json" \
  -H "x-test-user-id: test-dev-1" \
  -H "x-test-user-role: developer" \
  -d '{
    "prompt": "Create a Next.js app",
    "projectName": "bypass-test"
  }'
```

**Note**: This bypass only works in `NODE_ENV=development` and when security middleware detects testing mode.

### Automated Testing Scripts

```bash
# Test all authentication flows
npm run test:auth

# Test protected endpoints
npm run test:integration

# Test with authentication bypas for CI/CD
NODE_ENV=test npm run test:e2e
```

## 🛡️ Security Considerations

### Development Safety
- ✅ Test users only work in `NODE_ENV=development`
- ✅ Automatically disabled in production
- ✅ No database persistence (JWT only)
- ✅ CSRF protection enabled
- ✅ Secure cookie settings

### Production Readiness
- OAuth providers configured (GitHub/Google)
- Database adapter ready (Prisma)
- Session management configured
- Role-based access control implemented

## 🐛 Troubleshooting

### Issue: "Authentication Required" Error
**Solution**: 
1. Verify you're using the correct test credentials
2. Check that `NODE_ENV=development` in your `.env.local`
3. Clear browser cookies and sign in again

### Issue: "CSRF Token Missing" Error
**Solution**:
1. Always get CSRF token first: `GET /api/auth/csrf`
2. Include token in form submissions
3. Use proper Content-Type headers

### Issue: API Returns 401 Unauthorized
**Solution**:
1. Verify session token in browser cookies
2. Include cookie header in API requests
3. Check token hasn't expired (30-day lifetime)

### Issue: Role-Based Access Denied
**Solution**:
1. Use admin accounts for admin endpoints
2. Use developer accounts for AI/workspace features
3. Check user role in session data

## 📊 Validation Checklist

Before considering authentication testing complete, verify:

- [ ] All 10 test users authenticate successfully
- [ ] AI project generation works with authenticated users
- [ ] Workspace creation and management functional
- [ ] File upload endpoints accept authenticated requests
- [ ] Real-time collaboration features work across user sessions
- [ ] Role-based access control properly restricts features
- [ ] End-to-end workflows complete without authentication blocks
- [ ] Security middleware allows development testing
- [ ] Production mode properly disables test users
- [ ] OAuth migration path ready for deployment

## 🚀 Next Steps

1. **Validate Core Features**: Use this guide to test all blocked features
2. **Run Automated Tests**: Execute test suites with authentication
3. **Document Findings**: Report any remaining authentication issues
4. **Prepare for OAuth**: Plan migration to production authentication

---

**Status**: ✅ Authentication system ready for comprehensive feature testing
**Last Updated**: Current
**Test Users**: 10 active accounts across 3 role levels
**Security**: Development-safe with production migration path