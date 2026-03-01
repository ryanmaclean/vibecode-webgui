# Auto-Claude Configuration

> **🔒 Security-First Configuration Management**

This directory contains configuration files for the Auto-Claude system. All secrets and tokens must be managed securely following the practices outlined below.

## 🚨 Security Warning

**NEVER commit `.env` files to version control.** This directory is gitignored, but you must still follow secure credential management practices to prevent accidental exposure through backups, screenshots, or file sharing.

## 🚀 Quick Setup

### 1. Create Your Environment File

Copy the example template to create your local `.env` file:

```bash
cp .auto-claude/.env.example .auto-claude/.env
```

### 2. Configure GitHub Token

Edit `.auto-claude/.env` and add your GitHub Personal Access Token:

```bash
# Open in your preferred editor
nano .auto-claude/.env
# or
code .auto-claude/.env
```

Replace the placeholder value:
```bash
GITHUB_TOKEN=ghp_your_actual_token_here
```

### 3. Generate a GitHub Personal Access Token

1. Go to [GitHub Settings → Tokens](https://github.com/settings/tokens)
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Configure the token:
   - **Name**: `auto-claude-development` (or similar)
   - **Expiration**: 90 days (recommended) or custom
   - **Scopes**: Select the following:
     - ✅ `repo` (Full control of private repositories)
     - ✅ `workflow` (Update GitHub Action workflows)
4. Click **"Generate token"**
5. **IMMEDIATELY** copy the token and paste it into `.auto-claude/.env`
6. **DO NOT** close the page until you've saved the token (GitHub only shows it once)

## 🔐 Security Best Practices

### What NOT to Do ❌

- **DO NOT** commit `.env` files to Git
- **DO NOT** share your `.env` file via Slack, email, or screenshots
- **DO NOT** use production tokens in development environments
- **DO NOT** use long-lived tokens (>90 days) if shorter expiration is acceptable
- **DO NOT** hardcode tokens in scripts or configuration files
- **DO NOT** back up `.env` files to cloud storage without encryption

### What TO Do ✅

- **DO** use `.env.example` as a template (with placeholder values)
- **DO** use GitHub Personal Access Tokens with minimal required scopes
- **DO** rotate tokens regularly (every 90 days recommended)
- **DO** revoke tokens immediately if compromised
- **DO** use environment-specific tokens (dev/staging/prod)
- **DO** store tokens in secure password managers
- **DO** verify `.auto-claude/.env` is gitignored before adding tokens

### Verify Gitignore Protection

Before adding any secrets, confirm the file is gitignored:

```bash
git check-ignore .auto-claude/.env
# Should output: .auto-claude/.env

# Also verify it won't be committed
git add .auto-claude/.env
git status
# Should show no changes (file is ignored)
```

## 📋 Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | `ghp_xxxxxxxxxxxxxxxxxxxx` |

### Token Scopes Required

- **`repo`**: Access to repository code, issues, and pull requests
- **`workflow`**: Permission to update GitHub Actions workflows

## 🔄 Token Rotation

GitHub tokens should be rotated regularly to minimize security risks:

1. **Generate a new token** following the steps above
2. **Update `.auto-claude/.env`** with the new token
3. **Test the new token** by running a simple auto-claude command
4. **Revoke the old token** at [GitHub Tokens Settings](https://github.com/settings/tokens)

## 🆘 If Your Token is Compromised

1. **Immediately revoke** the token at https://github.com/settings/tokens
2. **Verify access logs** in GitHub Settings → Security Log
3. **Generate a new token** with minimal required scopes
4. **Update `.auto-claude/.env`** with the new token
5. **Review recent commits** for any unauthorized changes
6. **Enable 2FA** on your GitHub account if not already enabled

## 📚 Additional Resources

- [GitHub Personal Access Tokens Documentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [GitHub Security Best Practices](https://docs.github.com/en/code-security/getting-started/securing-your-organization)

## 🛠️ Troubleshooting

### "Authentication failed" errors

- Verify your token is correctly set in `.auto-claude/.env`
- Check that your token hasn't expired
- Confirm the token has the required scopes (`repo`, `workflow`)
- Try generating a fresh token and updating `.env`

### Token not being recognized

- Ensure there are no extra spaces or quotes around the token value
- Verify the file is named exactly `.env` (not `.env.txt` or similar)
- Restart any running auto-claude processes to reload environment variables

---

**Remember**: Treat GitHub tokens like passwords. Never share them, commit them, or store them insecurely. When in doubt, regenerate the token.
