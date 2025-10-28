---
title: dev credentials
description: dev credentials documentation
---

# Development Test Credentials

This file contains test user credentials for development authentication until OAuth is properly deployed.

## 🔐 Test User Accounts

### Admin Users (Full Access)
| Email | Password | Name | Role |
|-------|----------|------|------|
| admin@vibecode.dev | admin123 | VibeCode Admin | admin |
| lead@vibecode.dev | lead123 | Lisa Thompson | admin |

### Developer Users (Standard Access)
| Email | Password | Name | Role |
|-------|----------|------|------|
| developer@vibecode.dev | dev123 | Sarah Johnson | user |
| frontend@vibecode.dev | frontend123 | Michael Chen | user |
| backend@vibecode.dev | backend123 | Emily Rodriguez | user |
| fullstack@vibecode.dev | fullstack123 | David Kim | user |

### Team Member Users (Standard Access)
| Email | Password | Name | Role |
|-------|----------|------|------|
| designer@vibecode.dev | design123 | Jessica Taylor | user |
| tester@vibecode.dev | test123 | Robert Wilson | user |
| devops@vibecode.dev | devops123 | Amanda Garcia | user |
| intern@vibecode.dev | intern123 | James Martinez | user |

## 🚀 Quick Access

You can use any of these credentials to sign in at:
- **Sign In Page**: http://localhost:3000/auth/signin
- **Test Page**: http://localhost:3000/auth/test

## 🔒 Security Notes

- **Development Only**: These credentials are only active in development mode (`NODE_ENV=development`)
- **Production Disabled**: All test credentials are automatically disabled in production
- **No Persistence**: User data is not persisted between sessions
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
# Example sign-in with admin user
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@vibecode.dev",
    "password": "admin123"
  }'

# Example sign-in with developer user
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "developer@vibecode.dev",
    "password": "dev123"
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
    "userId": "developer@vibecode.dev"
  }'
```

---

**Last Updated**: July 18, 2025
**Environment**: Development Only
**Status**: Active for local development
**Next Step**: Deploy platform and configure OAuth providers
