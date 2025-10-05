# VibeCode Onboarding Flow

## Overview

The VibeCode onboarding flow helps new users configure their development environment in under 2 minutes.

## Features

### 1. **Welcome Screen**
- Brief introduction to VibeCode
- Single "Get Started" button

### 2. **Theme Selection**
- **Light Mode** ☀️ - Traditional light theme
- **Dark Mode** 🌙 - Easy on the eyes
- **Auto** 🔄 - Follows system preferences

### 3. **CLI Editor Preference**
Choose your terminal editor (optional):
- **Vim** - Classic modal editor
- **Neovim** - Modern Vim fork with better defaults
- **Emacs** - Extensible, customizable editor
- **Nano** - Simple and beginner-friendly
- **Skip** - Browser-only workflow

### 4. **Extension Recommendations**
Smart recommendations based on your codebase:

**Always Recommended:**
- Prettier - Code formatter
- ESLint - JavaScript linter
- Git Graph - Visual git history
- Error Lens - Inline error highlighting

**Conditional Recommendations:**
- Jest - If tests detected
- Docker - If Dockerfile present
- Kubernetes - If K8s configs found

### 5. **Service Integrations**

#### Code Hosting
- 🐙 **GitHub** - Repository management, PR reviews
- 🦊 **GitLab** - Alternative Git hosting

#### Project Management
- 📋 **Jira** - Issue tracking, sprint planning
- ⚡ **Linear** - Modern issue tracking

#### AI Services
- 🤖 **OpenAI** - GPT-4, ChatGPT integration
- 🧠 **Anthropic** - Claude AI assistant
- ✨ **Codeium** - Free AI code completion

### 6. **Completion**
- Confirmation screen
- Redirect to dashboard
- Preferences saved

## Implementation

### Routes

```
/onboarding              - Main onboarding flow
/api/user/preferences    - Save/load user preferences
```

### Components

```typescript
// Main onboarding page
src/app/onboarding/page.tsx

// Preference API
src/app/api/user/preferences/route.ts

// Onboarding check wrapper
src/components/OnboardingCheck.tsx
```

### Data Structure

```typescript
interface OnboardingData {
  theme: 'light' | 'dark' | 'auto'
  extensions: string[]
  integrations: {
    github?: boolean
    gitlab?: boolean
    jira?: boolean
    linear?: boolean
    openai?: boolean
    anthropic?: boolean
    codeium?: boolean
  }
}
```

## Usage

### For New Users

1. Sign in to VibeCode
2. Automatically redirected to `/onboarding`
3. Complete 5-step flow
4. Redirected to dashboard with configured environment

### For Existing Users

- Access via Settings → Preferences
- Re-run onboarding anytime
- Update individual preferences

## Customization

### Adding New Integrations

```typescript
// In src/app/onboarding/page.tsx
{
  id: 'newservice',
  name: 'New Service',
  icon: '🔥',
  category: 'ai' // or 'code', 'project'
}
```

### Adding New Extensions

```typescript
{
  id: 'extension-id',
  name: 'Extension Name',
  desc: 'Short description',
  recommended: true, // Auto-check
}
```

### Smart Recommendations

Detect codebase features and recommend extensions:

```typescript
// Example: Detect package.json for Node.js
const hasNodeJs = await fs.exists('package.json')
if (hasNodeJs) {
  recommendations.push('prettier', 'eslint')
}
```

## Integration Setup

### GitHub OAuth

```typescript
// .env.local
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_secret
```

### OpenAI API

```typescript
// .env.local
OPENAI_API_KEY=sk-...
```

### Anthropic API

```typescript
// .env.local
ANTHROPIC_API_KEY=sk-ant-...
```

## Best Practices

1. **Keep it Short** - Under 2 minutes total
2. **Smart Defaults** - Pre-select recommended options
3. **Skip Allowed** - Every step is optional
4. **Visual Feedback** - Progress bar, animations
5. **Mobile Friendly** - Responsive design
6. **Accessible** - Keyboard navigation, screen readers

## Future Enhancements

- [ ] Codebase analysis for smarter recommendations
- [ ] Team templates (inherit team settings)
- [ ] Import settings from VS Code
- [ ] Guided tours for each feature
- [ ] Video tutorials
- [ ] Keyboard shortcuts customization
- [ ] Workspace templates (React, Python, Go, etc.)

## Analytics

Track onboarding completion:
- Step completion rates
- Most popular themes
- Most connected integrations
- Average completion time
- Drop-off points

## Testing

```bash
# Run onboarding in dev mode
npm run dev
# Visit http://localhost:3000/onboarding

# Test API
curl -X POST http://localhost:3000/api/user/preferences \
  -H "Content-Type: application/json" \
  -d '{"theme":"dark","cliEditor":"vim"}'
```

## Support

For issues or questions:
- GitHub Issues: [vibecode-webgui/issues](https://github.com/ryanmaclean/vibecode-webgui/issues)
- Documentation: `/docs`
- Discord: [VibeCode Community](#)
