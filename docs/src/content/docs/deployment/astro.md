---
title: "Deploying Astro Documentation"
description: "Complete guide to deploying the VibeCode Astro documentation site to various hosting platforms"
sidebar:
  order: 1
---

This guide covers deploying the VibeCode documentation site built with Astro and Starlight to various hosting platforms.

## Overview

The VibeCode documentation is a static site built with:

- **Framework**: Astro 5.14.4 with Starlight 0.35.1
- **Build Time**: ~4.12 seconds
- **Total Pages**: 96 pages
- **Output Size**: ~13 MB (static HTML/CSS/JS)
- **Search**: Pagefind (95 pages indexed)
- **Hosting**: Any static hosting platform

## Prerequisites

- Node.js 18.18.0 or higher
- npm 9.0.0 or higher
- Git (for version control)

## Building for Production

### Local Build

```bash
# Navigate to docs directory
cd docs

# Install dependencies
npm install

# Build for production
npm run build

# Output directory: dist/
# Build includes:
# - Static HTML pages
# - Optimized CSS and JavaScript
# - Pagefind search index
# - Optimized images
```

### Build Configuration

The build is configured in `astro.config.mjs`:

```javascript
export default defineConfig({
  site: 'https://ryanmaclean.github.io',
  base: '/vibecode-webgui',
  trailingSlash: 'always',
  integrations: [
    starlight({
      title: 'VibeCode Platform',
      // ... configuration
    }),
  ],
});
```

**Key Configuration Options**:

- `site`: Your full domain URL
- `base`: Base path for GitHub Pages deployment
- `trailingSlash`: Ensures consistent URLs

### Preview Build Locally

```bash
# Start preview server
npm run preview

# Opens on: http://localhost:4321/vibecode-webgui/
# Test all functionality before deploying
```

## Deployment Platforms

### GitHub Pages (Current Setup)

The documentation is currently configured for GitHub Pages deployment.

#### Automatic Deployment

Already configured! Push to `main` branch and GitHub Actions will deploy automatically.

```bash
# Make changes
git add .
git commit -m "Update documentation"
git push origin main

# GitHub Actions builds and deploys to gh-pages branch
# Live at: https://ryanmaclean.github.io/vibecode-webgui/
```

#### Configuration

**astro.config.mjs**:
```javascript
export default defineConfig({
  site: 'https://ryanmaclean.github.io',
  base: '/vibecode-webgui',  // Repository name
  trailingSlash: 'always',
});
```

**GitHub Settings**:
1. Go to repository Settings > Pages
2. Source: Deploy from a branch
3. Branch: `gh-pages` / `root`
4. Save

#### Custom Domain (Optional)

1. Add `CNAME` file to `public/` directory:
   ```
   docs.vibecode.com
   ```

2. Update `astro.config.mjs`:
   ```javascript
   export default defineConfig({
     site: 'https://docs.vibecode.com',
     base: '/',  // Remove base path for custom domain
   });
   ```

3. Configure DNS:
   ```
   Type: CNAME
   Name: docs
   Value: ryanmaclean.github.io
   ```

### Vercel

Deploy with zero configuration.

#### Quick Deploy

```bash
# Install Vercel CLI
npm install -g vercel

# From docs directory
cd docs
vercel --prod

# Or connect GitHub repository for automatic deployments
```

#### Configuration File

Create `vercel.json` in docs directory:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "astro",
  "installCommand": "npm install",
  "devCommand": "npm run dev"
}
```

#### Environment Variables

In Vercel Dashboard > Settings > Environment Variables:

```bash
# Optional: Datadog RUM monitoring
PUBLIC_DATADOG_CLIENT_TOKEN=your_client_token
PUBLIC_DATADOG_APPLICATION_ID=your_app_id
```

#### Benefits
- **CDN**: Global edge network
- **SSL**: Automatic HTTPS
- **Previews**: Preview deployments for PRs
- **Analytics**: Built-in web analytics
- **Zero config**: Works out of the box

### Netlify

Simple deployment with powerful features.

#### Quick Deploy

```bash
# Install Netlify CLI
npm install -g netlify-cli

# From docs directory
cd docs
netlify deploy --prod

# Or drag-and-drop dist/ folder in Netlify UI
```

#### Configuration File

Create `netlify.toml` in docs directory:

```toml
[build]
  command = "npm run build"
  publish = "dist"
  base = "docs"

[build.environment]
  NODE_VERSION = "18"

# Optimize images
[[plugins]]
  package = "@netlify/plugin-lighthouse"

# Cache dependencies
[[plugins]]
  package = "netlify-plugin-cache"
  [plugins.inputs]
    paths = ["node_modules", ".astro"]

# Redirects and rewrites
[[redirects]]
  from = "/*"
  to = "/404.html"
  status = 404

# Headers for security and performance
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"

[[headers]]
  for = "/_astro/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.css"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.js"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

#### Environment Variables

In Netlify Dashboard > Site settings > Environment variables:

```bash
PUBLIC_DATADOG_CLIENT_TOKEN=your_token
PUBLIC_DATADOG_APPLICATION_ID=your_app_id
```

#### Benefits
- **Forms**: Built-in form handling
- **Functions**: Serverless functions support
- **Deploy previews**: PR previews
- **Split testing**: A/B testing
- **Analytics**: Built-in analytics

### Cloudflare Pages

Fast global deployment with Cloudflare's edge network.

#### Quick Deploy

1. **Via Dashboard**:
   - Go to Cloudflare Pages
   - Connect GitHub repository
   - Configure build settings:
     - **Build command**: `npm run build`
     - **Build output directory**: `dist`
     - **Root directory**: `docs`

2. **Via Wrangler CLI**:
   ```bash
   # Install Wrangler
   npm install -g wrangler

   # Deploy
   cd docs
   npx wrangler pages deploy dist
   ```

#### Configuration

Create `wrangler.toml`:

```toml
name = "vibecode-docs"
compatibility_date = "2025-10-25"

[site]
  bucket = "dist"

[[routes]]
  pattern = "docs.vibecode.com/*"
  zone_name = "vibecode.com"
```

#### Custom Headers

In Cloudflare Pages > Settings > Custom domains > HTTP Headers:

```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()

/_astro/*
  Cache-Control: public, max-age=31536000, immutable
```

#### Benefits
- **Speed**: Cloudflare's global CDN
- **DDoS protection**: Built-in security
- **Analytics**: Cloudflare Web Analytics
- **Workers**: Edge compute capabilities
- **Free tier**: Unlimited bandwidth

### AWS S3 + CloudFront

Enterprise-grade static hosting.

#### Deployment Steps

1. **Create S3 Bucket**:
   ```bash
   aws s3 mb s3://vibecode-docs
   aws s3 website s3://vibecode-docs --index-document index.html --error-document 404.html
   ```

2. **Configure Bucket Policy**:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::vibecode-docs/*"
       }
     ]
   }
   ```

3. **Deploy Files**:
   ```bash
   cd docs
   npm run build
   aws s3 sync dist/ s3://vibecode-docs/ --delete
   ```

4. **Create CloudFront Distribution**:
   ```bash
   aws cloudfront create-distribution \
     --origin-domain-name vibecode-docs.s3.amazonaws.com \
     --default-root-object index.html
   ```

5. **Invalidate Cache After Deploy**:
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id DISTRIBUTION_ID \
     --paths "/*"
   ```

#### Automated Deployment Script

```bash
#!/bin/bash
# deploy-aws.sh

set -euo pipefail

BUCKET="vibecode-docs"
DISTRIBUTION_ID="your-distribution-id"

echo "Building documentation..."
npm run build

echo "Syncing to S3..."
aws s3 sync dist/ s3://${BUCKET}/ \
  --delete \
  --cache-control "public, max-age=31536000" \
  --exclude "*.html" \
  --exclude "_pagefind/*"

aws s3 sync dist/ s3://${BUCKET}/ \
  --delete \
  --cache-control "public, max-age=3600" \
  --exclude "*" \
  --include "*.html" \
  --include "_pagefind/*"

echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id ${DISTRIBUTION_ID} \
  --paths "/*"

echo "Deployment complete!"
```

### Azure Static Web Apps

Deploy to Microsoft Azure.

#### Quick Deploy

```bash
# Install Azure CLI
brew install azure-cli  # macOS
# or download from https://aka.ms/installazurecliwindows

# Login
az login

# Create static web app
az staticwebapp create \
  --name vibecode-docs \
  --resource-group vibecode-rg \
  --location eastus2

# Deploy
cd docs
npm run build
az staticwebapp deploy \
  --app-name vibecode-docs \
  --output-path dist
```

#### GitHub Actions Workflow

Azure provides automatic deployment via GitHub Actions:

```yaml
name: Azure Static Web Apps CI/CD

on:
  push:
    branches:
      - main
    paths:
      - 'docs/**'

jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build
        working-directory: ./docs
        run: |
          npm ci
          npm run build

      - name: Deploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "docs/dist"
```

## CDN Configuration

### Caching Strategy

Configure appropriate cache headers for optimal performance:

**Long-term caching** (1 year):
- `/_astro/*` - Hashed asset files
- `/*.css` - Stylesheet files
- `/*.js` - JavaScript files
- `/fonts/*` - Font files

**Short-term caching** (1 hour):
- `/*.html` - HTML pages
- `/_pagefind/*` - Search index

**No caching**:
- `/404.html` - Error page
- `/api/*` - API endpoints (if any)

### Example Headers

```
# Long-term caching
/_astro/*
  Cache-Control: public, max-age=31536000, immutable

# Short-term caching
/*.html
  Cache-Control: public, max-age=3600

/_pagefind/*
  Cache-Control: public, max-age=3600

# No caching
/404.html
  Cache-Control: no-cache, no-store, must-revalidate
```

## Search Configuration

The documentation uses Pagefind for static search.

### Pagefind Setup

Pagefind is automatically built during `astro build`:

```bash
# Build includes Pagefind indexing
npm run build

# Output includes:
# dist/_pagefind/
#   ├── pagefind.js
#   ├── pagefind-ui.js
#   ├── pagefind-ui.css
#   └── pagefind-entry.json
```

### Ensuring Search Works

After deployment, verify:

1. **Search index exists**:
   ```bash
   curl https://your-domain.com/_pagefind/pagefind-entry.json
   # Should return JSON data
   ```

2. **Search UI loads**:
   - Visit any page
   - Open search (Cmd/Ctrl + K)
   - Try searching for "deployment"

3. **Search results work**:
   - Results should appear as you type
   - Clicking results should navigate to pages

### Troubleshooting Search

**Issue**: Search not working after deployment

```bash
# Check if _pagefind directory was deployed
ls -la dist/_pagefind/

# Ensure build ran successfully
npm run build 2>&1 | grep -i pagefind

# Look for: "Generated Pagefind search index"
```

**Issue**: Search index is empty

```bash
# Pagefind might be skipping pages
# Check page frontmatter doesn't have:
# pagefind: false

# Rebuild with verbose output
DEBUG=pagefind:* npm run build
```

## Performance Optimization

### Build Optimization

```javascript
// astro.config.mjs
export default defineConfig({
  build: {
    inlineStylesheets: 'auto',
  },
  compressHTML: true,
  integrations: [
    starlight({
      // Optimize for production
      customCss: ['./src/styles/custom.css'],
    }),
  ],
});
```

### Image Optimization

Astro automatically optimizes images in the `src/` directory:

```markdown
<!-- Uses Astro's image optimization -->
![Architecture diagram](../../../diagrams/code_server_diy_diagram.png)

<!-- For external images -->
![External](https://example.com/image.png)
```

### Font Optimization

Use font subsetting to reduce font file size:

```css
/* custom.css */
@font-face {
  font-family: 'Inter';
  font-display: swap; /* Prevent font rendering blocking */
  src: url('/fonts/inter-subset.woff2') format('woff2');
  unicode-range: U+0000-00FF; /* Latin characters only */
}
```

## Monitoring & Analytics

### Datadog RUM

Already configured in `astro.config.mjs`:

```javascript
head: [
  {
    tag: 'script',
    attrs: {
      src: 'https://www.datadoghq-browser-agent.com/us5/v5/datadog-rum.js',
    },
  },
  {
    tag: 'script',
    content: `
      if (typeof window !== 'undefined' && import.meta.env.PUBLIC_DATADOG_CLIENT_TOKEN) {
        window.DD_RUM.init({
          clientToken: import.meta.env.PUBLIC_DATADOG_CLIENT_TOKEN,
          applicationId: import.meta.env.PUBLIC_DATADOG_APPLICATION_ID,
          site: 'datadoghq.com',
          service: 'vibecode-docs',
          env: 'production',
          version: '1.0.0',
          sessionSampleRate: 100,
          sessionReplaySampleRate: 20,
          trackUserInteractions: true,
          trackResources: true,
          trackLongTasks: true,
        });
      }
    `,
  },
],
```

Set environment variables:
```bash
PUBLIC_DATADOG_CLIENT_TOKEN=your_token
PUBLIC_DATADOG_APPLICATION_ID=your_app_id
```

### Google Analytics

Add to `astro.config.mjs`:

```javascript
head: [
  {
    tag: 'script',
    attrs: {
      async: true,
      src: 'https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX',
    },
  },
  {
    tag: 'script',
    content: `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-XXXXXXXXXX');
    `,
  },
],
```

### Plausible Analytics (Privacy-Friendly)

```javascript
head: [
  {
    tag: 'script',
    attrs: {
      defer: true,
      'data-domain': 'docs.vibecode.com',
      src: 'https://plausible.io/js/script.js',
    },
  },
],
```

## Testing Deployment

### Pre-Deployment Checklist

- [ ] Build completes without errors
- [ ] All pages render correctly locally (`npm run preview`)
- [ ] Search functionality works
- [ ] All images load
- [ ] All links work (no 404s)
- [ ] Mobile responsive layout
- [ ] Fast page load times

### Automated Testing

```bash
# Build and test
npm run build
npm run preview &
PREVIEW_PID=$!

# Wait for server
sleep 5

# Test homepage
curl -f http://localhost:4321/vibecode-webgui/ || echo "Homepage failed"

# Test search index
curl -f http://localhost:4321/vibecode-webgui/_pagefind/pagefind-entry.json || echo "Search failed"

# Kill preview server
kill $PREVIEW_PID
```

### Lighthouse CI

```bash
# Install Lighthouse CI
npm install -g @lhci/cli

# Run audit
lhci autorun --collect.url=https://your-docs-site.com

# Target scores:
# Performance: 95+
# Accessibility: 95+
# Best Practices: 95+
# SEO: 95+
```

## Troubleshooting

### Build Errors

**Issue**: Out of memory during build

```bash
# Increase Node.js memory
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

**Issue**: Module not found errors

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json .astro
npm install
npm run build
```

### Deployment Issues

**Issue**: 404 on all pages except homepage

- Check `base` path in `astro.config.mjs`
- Ensure trailing slashes are consistent
- Verify hosting platform configuration

**Issue**: Assets not loading (CSS/JS)

- Check browser console for CORS errors
- Verify `site` URL in `astro.config.mjs`
- Ensure `base` path matches deployment

**Issue**: Search not working

```bash
# Verify search index was built
ls -la dist/_pagefind/

# Check browser console for errors
# Common issue: wrong base path

# Rebuild with clean cache
rm -rf .astro dist
npm run build
```

### Performance Issues

**Issue**: Slow page loads

1. Enable CDN caching headers
2. Compress images (use WebP/AVIF)
3. Minimize custom CSS
4. Enable compression (Gzip/Brotli)
5. Use font subsetting

**Issue**: Large bundle size

```bash
# Analyze build output
npm run build -- --stats

# Check for:
# - Large images (optimize with Astro Image)
# - Unused dependencies (remove from package.json)
# - Large CSS files (minimize custom styles)
```

## Security Best Practices

### Content Security Policy

Add CSP headers in your hosting platform:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://www.datadoghq-browser-agent.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' data:;
  connect-src 'self' https://browser-intake-datadoghq.com;
```

### Security Headers

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### HTTPS Only

Always use HTTPS in production:
- GitHub Pages: Automatic
- Vercel: Automatic
- Netlify: Automatic
- Cloudflare: Automatic
- AWS: Configure ACM certificate

## Rollback Procedure

### GitHub Pages

```bash
# Revert last commit
git revert HEAD
git push origin main

# Or deploy specific version
git checkout <commit-hash>
git push -f origin main
```

### Vercel

```bash
# Via CLI
vercel rollback

# Via dashboard
# Deployments > Select previous > Promote to Production
```

### Netlify

```bash
# Via dashboard
# Deploys > Select previous > Publish deploy
```

## Maintenance

### Regular Updates

```bash
# Update dependencies monthly
npm update
npm audit fix

# Test after updates
npm run build
npm run preview

# Commit and deploy
git add package.json package-lock.json
git commit -m "Update dependencies"
git push
```

### Content Updates

```bash
# Add new page
# Create: docs/src/content/docs/your-page.md

# Update sidebar
# Edit: docs/astro.config.mjs

# Test locally
npm run dev

# Deploy
git add .
git commit -m "Add new documentation page"
git push
```

## Next Steps

- [Next.js Application Deployment →](/deployment/nextjs/)
- [Production Deployment Guide →](https://github.com/ryanmaclean/vibecode-webgui/blob/main/docs/deployment/DOCKER_PRODUCTION.md)
- [Monitoring Setup →](https://github.com/ryanmaclean/vibecode-webgui/blob/main/docs/deployment/MONITORING.md)
- [Back to Deployment Overview →](/deployment/)
