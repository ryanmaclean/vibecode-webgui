---
title: AUTHENTICATION TESTING GUIDE
description: AUTHENTICATION TESTING GUIDE documentation
---

# Authentication Testing Guide

## ✅ **Authentication Status: FULLY WORKING**

The authentication system has been properly configured and tested. All 10 development user accounts are active and ready for use.

## 🔐 **Test Credentials (All Working)**

### **Admin Users (2 accounts)**
- **admin@vibecode.dev** / **admin123** (VibeCode Admin)
- **lead@vibecode.dev** / **lead123** (Lisa Thompson)

### **Developer Users (3 accounts)**
- **developer@vibecode.dev** / **dev123** (Sarah Johnson)
- **frontend@vibecode.dev** / **frontend123** (Michael Chen)
- **backend@vibecode.dev** / **backend123** (Emily Rodriguez)

### **Team Members (5 accounts)**
- **fullstack@vibecode.dev** / **fullstack123** (David Kim)
- **designer@vibecode.dev** / **design123** (Jessica Taylor)
- **tester@vibecode.dev** / **test123** (Robert Wilson)
- **devops@vibecode.dev** / **devops123** (Amanda Garcia)
- **intern@vibecode.dev** / **intern123** (James Martinez)

## 🧪 **How to Test Authentication**

### **Method 1: Main Sign-In Page (Recommended)**
1. **Open**: http://localhost:3000/auth/signin
2. **Choose any credentials**: All 10 accounts are displayed on the page
3. **Sign In**: Enter email and password, click "Sign in"
4. **Success**: You'll be redirected to the dashboard

### **Method 2: Simple Test Page**
1. **Open**: http://localhost:3000/auth/test-simple
2. **View Session**: See current authentication status
3. **Test Login**: Click "Test Login" button to test developer@vibecode.dev
4. **Check Result**: Session information will be displayed

### **Method 3: Direct API Testing**
```bash
# Run the authentication test script
node test-auth-direct.js

# Test AI project generation authentication
curl -X POST http://localhost:3000/api/ai/generate-project \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<your-session-token>" \
  -d '{"prompt": "Create a simple React app", "projectName": "test-ai-project"}'

# Test code-server session creation
curl -X POST http://localhost:3000/api/code-server/session \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<your-session-token>" \
  -d '{"workspaceId": "test-workspace", "userId": "test-user"}'
>>>>>>> 17acf85bc89c0fd79c29f83bb2ab3bbd81b89d8c
```

## 🛠️ **Technical Verification**

### **Infrastructure Check**
- ✅ **NextAuth Providers**: http://localhost:3000/api/auth/providers
- ✅ **CSRF Token**: http://localhost:3000/api/auth/csrf
- ✅ **Session Endpoint**: http://localhost:3000/api/auth/session
- ✅ **Health Check**: http://localhost:3000/api/health/simple
<<<<<<< HEAD
=======
- ✅ **AI Project Generation**: http://localhost:3000/api/ai/generate-project (POST, authenticated)
- ✅ **Code-Server Sessions**: http://localhost:3000/api/code-server/session (POST, authenticated)
- ✅ **File Sync**: http://localhost:3000/api/files/sync (POST, authenticated)
>>>>>>> 17acf85bc89c0fd79c29f83bb2ab3bbd81b89d8c

### **Authentication Flow**
1. **CSRF Token**: Generated successfully
2. **Credentials Provider**: Registered and working
3. **Session Creation**: JWT sessions created on successful login
4. **Role-Based Access**: Admin vs user roles properly assigned
<<<<<<< HEAD
=======
5. **AI Project Authentication**: Authenticated access to AI generation endpoints
6. **Workspace Isolation**: User-specific workspace access control verified
>>>>>>> 17acf85bc89c0fd79c29f83bb2ab3bbd81b89d8c

## 🔧 **Files Created/Updated**

### **Core Authentication**
- **`src/lib/auth.ts`**: NextAuth configuration with 10 test users
- **`src/app/api/auth/[...nextauth]/route.ts`**: NextAuth API routes
- **`src/app/providers.tsx`**: Session provider configuration

### **UI Components**
- **`src/components/auth/SimpleSignInForm.tsx`**: Working sign-in form
- **`src/app/auth/signin/page.tsx`**: Main sign-in page
- **`src/app/auth/test-simple/page.tsx`**: Simple authentication test page

### **Testing Tools**
- **`test-auth-direct.js`**: Automated authentication testing
- **`public/simple-auth-test.html`**: HTML-based testing
- **`DEVELOPMENT_CREDENTIALS.md`**: Complete credentials reference

## 🚀 **Ready for Development**

The authentication system is now fully operational:

### **For Developers**
- All 10 test accounts work correctly
- Sign-in page loads and functions properly
- Session management works with NextAuth
- Role-based access control implemented

### **For Testing**
- Multiple test interfaces available
- Automated testing scripts provided
- Manual testing verified and working
- All credentials displayed on sign-in page
- AI project generation endpoints authenticated
- Workspace access control validated

## ⚠️ **Important Notes**

### **Development Only**
- These credentials only work in development mode
- Automatically disabled when `NODE_ENV=production`
- No database persistence - sessions are JWT-based

### **OAuth Migration**
- GitHub and Google OAuth providers are configured
- Will be enabled once the platform is deployed
- Test credentials will be disabled in production

### 🔒 **Security Enhancements**
- **API Key Protection**: Comprehensive protection system implemented
- **Pre-commit Hooks**: Automatic API key detection before commits
- **BFG Docker Integration**: Git history scanning with `jtmotox/bfg`
- **Security Scanner**: Repository scanning available at `scripts/security-scan.sh`
- **Pattern Matching**: Protection for OpenAI, Anthropic, Datadog, GitHub, AWS, Google, Stripe keys
- **Emergency Cleanup**: BFG Docker commands for history sanitization if needed


## 🎯 **Next Steps**

1. **Use the credentials**: All 10 accounts are ready for development
2. **Test different roles**: Admin vs user access levels
3. **Deploy for OAuth**: Configure real OAuth providers in production
4. **Add features**: Build on the working authentication foundation

---

**Status**: ✅ **FULLY WORKING**
**Last Updated**: July 18, 2025
**Test Credentials**: 10 accounts active
**Authentication**: NextAuth with JWT sessions
**Ready for**: Development and testing
