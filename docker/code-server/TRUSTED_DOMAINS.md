# Trusted Domains Configuration

The VibeCode code-server comes pre-configured with trusted domains to prevent annoying prompts when extensions try to open external URLs.

## Pre-configured Trusted Domains

The following domains are pre-configured as trusted in the VibeCode code-server image:

### AI Services
- **Anthropic Claude**: `anthropic.com`, `*.anthropic.com`, `api.anthropic.com`, `console.anthropic.com`
- **OpenAI**: `openai.com`, `*.openai.com`, `api.openai.com`
- **OpenRouter**: `openrouter.ai`, `*.openrouter.ai`
- **Codeium**: `codeium.com`, `*.codeium.com`
- **Windsurf**: `windsurf.com`, `*.windsurf.com`, `codeium.windsurf.com`
- **Continue**: `continue.dev`, `*.continue.dev`

### Monitoring & Observability
- **Datadog**: `datadog.com`, `*.datadog.com`, `datadoghq.com`, `*.datadoghq.com`
  - `app.datadoghq.com` (US1)
  - `app.datadoghq.eu` (EU)
  - `us5.datadoghq.com` (US5)

### Development Tools
- **GitHub**: `github.com`, `*.github.com`, `*.githubusercontent.com`
- **NPM**: `npmjs.com`, `*.npmjs.com`
- **VS Code Marketplace**: `marketplace.visualstudio.com`, `*.visualstudio.com`, `code.visualstudio.com`

### Documentation & Resources
- **Stack Overflow**: `stackoverflow.com`, `*.stackoverflow.com`
- **MDN**: `developer.mozilla.org`
- **Microsoft Docs**: `docs.microsoft.com`

### Cloud Platforms
- **Azure**: `azure.microsoft.com`, `*.azure.com`
- **Vercel**: `vercel.com`, `*.vercel.com`

### Framework & Library Sites
- **Tailwind CSS**: `tailwindcss.com`, `*.tailwindcss.com`
- **Next.js**: `nextjs.org`, `*.nextjs.org`

### Local Development
- **Localhost**: `localhost`, `127.0.0.1` (both HTTP and HTTPS)

## Settings Applied

```json
{
  "workbench.trustedDomains.promptInTrustedWorkspace": false,
  "http.proxyStrictSSL": false,
  "http.linkProtectionTrustedDomains": [
    // All domains listed above
  ]
}
```

## Adding Custom Domains

To add your own trusted domains, you can:

### Option 1: Update settings.json

Edit `/home/coder/.local/share/code-server/User/settings.json` inside the container:

```json
{
  "http.linkProtectionTrustedDomains": [
    "https://your-custom-domain.com",
    "https://*.your-wildcard-domain.com"
  ]
}
```

### Option 2: Rebuild with Custom Domains

1. Edit `docker/code-server/settings.json` in the repository
2. Add your domains to the `http.linkProtectionTrustedDomains` array
3. Rebuild the image:
   ```bash
   docker build -f docker/code-server/Dockerfile -t vibecode-codeserver:latest .
   ```

### Option 3: Mount Custom Settings

Mount your own settings file when running the container:

```bash
docker run -p 8765:8765 \
  -v /path/to/your/settings.json:/home/coder/.local/share/code-server/User/settings.json \
  vibecode-codeserver:latest
```

## Wildcard Support

The configuration supports wildcard domains using `*`:

- `*.github.com` - Matches `api.github.com`, `raw.github.com`, etc.
- `*.openai.com` - Matches `api.openai.com`, `platform.openai.com`, etc.

## Security Considerations

### Why These Domains?

All pre-configured domains are:
- ✅ Required by installed extensions
- ✅ Official documentation sites
- ✅ Trusted development platforms
- ✅ Well-known AI service providers

### What This Prevents

Without trusted domains configuration, users would see prompts like:
- "Do you want to open the external website?"
- "This extension wants to open a URL"
- "Allow this site to open?"

### Security Trade-offs

**Pros:**
- Better user experience
- Fewer interruptions during development
- Extensions work seamlessly

**Cons:**
- Extensions can open URLs without prompting
- Users should still verify links before clicking

**Recommendation:** The pre-configured list includes only well-known, trusted domains. For production environments, review and customize based on your security requirements.

## Troubleshooting

### Extension Still Prompting

If an extension still prompts for domain trust:

1. **Check the domain**: Look at the URL being requested
2. **Add to list**: If it's a legitimate domain, add it to the trusted list
3. **Restart code-server**: Reload the window or restart the container

### Domain Not Working

If a trusted domain isn't being recognized:

1. **Check format**: Ensure proper format (e.g., `https://domain.com`)
2. **Check wildcards**: Use `*` for subdomains (e.g., `https://*.domain.com`)
3. **Check settings**: Verify settings.json was properly loaded

### View Current Settings

```bash
# Inside the container
cat /home/coder/.local/share/code-server/User/settings.json

# From host
docker exec vibecode-codeserver-test cat /home/coder/.local/share/code-server/User/settings.json
```

## Related Settings

### Disable All Prompts (Not Recommended)

```json
{
  "security.workspace.trust.enabled": false,
  "workbench.trustedDomains.promptInTrustedWorkspace": false
}
```

### Re-enable Prompts

Remove or set to `true`:
```json
{
  "workbench.trustedDomains.promptInTrustedWorkspace": true
}
```

## References

- [VS Code Trusted Domains Documentation](https://code.visualstudio.com/docs/editor/workspace-trust)
- [code-server Configuration](https://coder.com/docs/code-server/latest)
