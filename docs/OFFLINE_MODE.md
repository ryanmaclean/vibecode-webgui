# Offline Mode / Air-Gapped Operation

VibeCode supports fully offline and air-gapped operation for enterprise security requirements, government deployments, and work in restricted network environments. Once configured, you can develop with full AI assistance using local models without any internet connection.

## Table of Contents

- [Overview](#overview)
- [Why Offline Mode?](#why-offline-mode)
- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
  - [1. Install Ollama](#1-install-ollama)
  - [2. Download Recommended Models](#2-download-recommended-models)
  - [3. Verify Offline Readiness](#3-verify-offline-readiness)
- [Using Offline Mode](#using-offline-mode)
  - [Automatic Fallback](#automatic-fallback)
  - [Manual Configuration](#manual-configuration)
  - [Offline Indicator](#offline-indicator)
- [Cached Resources](#cached-resources)
  - [Documentation Search](#documentation-search)
  - [Project Templates](#project-templates)
  - [Cache Management](#cache-management)
- [Recommended Models](#recommended-models)
- [Troubleshooting](#troubleshooting)
- [Advanced Configuration](#advanced-configuration)
- [Performance Considerations](#performance-considerations)
- [Security & Compliance](#security--compliance)

---

## Overview

Offline mode enables VibeCode to function completely without internet connectivity. When offline, VibeCode automatically:

- **Detects network status** and switches to offline mode
- **Falls back to local AI models** (Ollama) for code assistance
- **Serves cached documentation** and templates from local storage
- **Displays clear offline indicators** in the UI
- **Maintains full IDE functionality** without degradation

This feature is critical for:
- **Enterprise Security**: Air-gapped environments with strict network isolation
- **Government Deployments**: Classified networks and secure facilities
- **Remote Development**: Working on flights, remote locations, or unreliable networks
- **Data Privacy**: Keeping all AI processing local and confidential

---

## Why Offline Mode?

### Competitive Advantage
Replit, GitHub Codespaces, and other cloud-based IDEs **require** constant internet connectivity. VibeCode is the **only AI-powered IDE** that can operate completely offline, unlocking markets these competitors cannot reach:

- Defense contractors and government agencies
- Financial institutions with air-gapped development environments
- Healthcare organizations with strict data residency requirements
- International travelers and remote workers

### Real-World Use Cases

**Enterprise Security Officer**: "I need air-gapped operation so I can deploy VibeCode in our secure development environment without violating security policies."

**Traveling Developer**: "I want offline coding with AI so I can work productively on long flights without relying on spotty in-flight WiFi."

---

## Quick Start

**Already have Ollama installed?** Jump straight to verification:

```bash
# Check comprehensive offline readiness with feature availability
curl http://localhost:3000/api/offline/status | jq
```

Or visit the enhanced setup wizard:
```
http://localhost:3000/offline-setup
```

The wizard provides:
- Visual readiness score (0-100%)
- Step-by-step setup guidance
- Feature-by-feature status breakdown
- One-click model installation

**New to Ollama?** Follow the [Installation & Setup](#installation--setup) guide below.

---

## Prerequisites

Before enabling offline mode, ensure you have:

- **VibeCode**: Installed and running locally
- **Node.js**: >= 18.18.0 (required by VibeCode)
- **Disk Space**: Minimum 2 GB for recommended models (qwen2.5-coder:1.5b)
- **Operating System**: macOS, Linux, or Windows (Ollama supports all platforms)

---

## Installation & Setup

### 1. Install Ollama

Ollama is a lightweight, local AI model runtime that powers offline AI assistance.

**macOS / Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows:**
Download the installer from [ollama.ai](https://ollama.ai/download/windows) and run it.

**Verify Installation:**
```bash
ollama --version
# Expected output: ollama version 0.x.x
```

**Start Ollama Service:**
```bash
ollama serve
```

Leave this running in a terminal. Ollama will listen on `http://localhost:11434` by default.

> **Tip**: Ollama can run as a background service. On macOS/Linux, use systemd or launchd. On Windows, install as a Windows Service.

---

### 2. Download Recommended Models

VibeCode recommends the following models for offline coding, optimized for speed and code quality:

| Model | Size | Description | Best For |
|-------|------|-------------|----------|
| **qwen2.5-coder:1.5b** | 1.7 GB | Fast, lightweight code model | Quick completions, low-end hardware |
| **qwen2.5-coder:7b** | 4.7 GB | Balanced model for code | Best quality/speed trade-off |
| **deepseek-coder-v2:16b** | 9.0 GB | High-quality code generation | Complex refactoring, architecture |
| **starcoder2:7b** | 4.0 GB | Multilingual code model | Polyglot projects |

**Install the Essential Model (1.5b):**
```bash
ollama pull qwen2.5-coder:1.5b
```

This takes 2-5 minutes depending on your connection. Once downloaded, it's available offline forever.

**Install Additional Models (Optional):**
```bash
# For better code quality (if you have 8+ GB RAM)
ollama pull qwen2.5-coder:7b

# For advanced code generation (if you have 16+ GB RAM)
ollama pull deepseek-coder-v2:16b
```

**Verify Models:**
```bash
ollama list
# Expected output:
# NAME                      ID              SIZE     MODIFIED
# qwen2.5-coder:1.5b        abc123def456    1.7 GB   2 minutes ago
```

---

### 3. Verify Offline Readiness

Navigate to the **Offline Setup Page** in VibeCode:

```
http://localhost:3000/offline-setup
```

**Enhanced Readiness Wizard Features:**

The offline setup page includes a comprehensive readiness wizard with visual feedback and step-by-step guidance:

**Overall Readiness Score:**
- Visual progress bar showing percentage ready (0-100%)
- Color-coded status:
  - 🟢 Green (80-100%): Fully ready for offline operation
  - 🟡 Yellow (40-79%): Partial offline capability
  - 🔴 Red (0-39%): Setup required for offline mode

**Step-by-Step Wizard (4 Stages):**

1. **Ollama Installation**
   - Service status (Running / Not Running)
   - Version information
   - Installation instructions if not installed
   - Quick-start commands for your OS

2. **AI Models**
   - List of installed models with sizes
   - Recommended models for offline coding
   - One-click model download buttons
   - Model count and total disk usage

3. **Vector Database**
   - Connection status (Connected / Disconnected)
   - pgvector extension status (Installed / Not Installed)
   - Database provider information (PostgreSQL)
   - Local vector storage readiness

4. **Cache System**
   - Cache availability status
   - Cache backend information (Redis/Memory)
   - Storage capacity information

Each stage shows:
- ✅ Green checkmark: Component ready
- ⚠️ Yellow warning: Component degraded or optional
- ❌ Red cross: Component unavailable or setup needed

**Check Readiness via API:**

The enhanced `/api/offline/status` endpoint provides comprehensive feature availability information:

```bash
curl http://localhost:3000/api/offline/status | jq
```

**Enhanced Response with Feature Availability:**
```json
{
  "online": true,
  "status": {
    "offline": false,
    "lastChecked": "2026-02-22T08:00:00.000Z"
  },
  "features": {
    "ai": {
      "status": "AVAILABLE",
      "available": true,
      "ollamaAvailable": true,
      "installedModels": ["qwen2.5-coder:1.5b", "qwen2.5-coder:7b"],
      "recommendedModels": ["qwen2.5-coder:1.5b", "qwen2.5-coder:7b"],
      "hasRecommendedModel": true,
      "modelCount": 2
    },
    "vectorDb": {
      "status": "AVAILABLE",
      "available": true,
      "connected": true,
      "pgVectorInstalled": true,
      "provider": "postgresql"
    },
    "cache": {
      "status": "AVAILABLE",
      "available": true,
      "enabled": true,
      "backend": "redis"
    },
    "templates": {
      "status": "AVAILABLE",
      "available": true,
      "templateCount": 10,
      "localOnly": false
    },
    "offlineReady": true,
    "availableFeatures": ["AI Models", "Vector Search", "Cache", "Templates"],
    "unavailableFeatures": []
  },
  "config": {
    "autoFallback": true,
    "preferredModel": "qwen2.5-coder:1.5b"
  }
}
```

**Key Response Fields:**
- `features.offlineReady`: Overall offline readiness (true/false)
- `features.ai.available`: Local AI models ready for offline use
- `features.vectorDb.available`: Local vector database operational
- `features.cache.available`: Caching system available
- `features.templates.available`: Project templates accessible offline
- `features.availableFeatures`: List of features that work offline
- `features.unavailableFeatures`: List of features requiring connectivity

If `features.offlineReady: true`, you're fully prepared for offline operation!

**Legacy Setup Endpoint:**

The original setup endpoint is still available for configuration:

```bash
curl http://localhost:3000/api/offline/setup -X POST \
  -H "Content-Type: application/json" \
  -d '{"action": "check"}' | jq
```

---

## Using Offline Mode

### Automatic Fallback

VibeCode **automatically detects** when you go offline and switches to local models. No manual configuration required!

**How It Works:**
1. **Online Mode**: VibeCode uses cloud AI providers (OpenRouter, Anthropic, OpenAI)
2. **Network Loss Detected**: Browser or server detects network unavailability
3. **Automatic Fallback**: VibeCode switches to Ollama with local models
4. **Offline Mode Active**: All AI requests route to `http://localhost:11434`
5. **Network Restored**: VibeCode automatically switches back to cloud providers

**Test Automatic Fallback:**
1. Start VibeCode with internet connected (online indicator shows "Online")
2. Enable Airplane Mode or disconnect WiFi
3. Wait 5-10 seconds for offline detection
4. Offline indicator updates to "Offline Mode" (yellow badge)
5. Open AI Chat and send a message — it will use Ollama automatically

### Manual Configuration

You can force offline mode even when online, or configure which model to use:

**Via Offline Setup Page:**
1. Navigate to `http://localhost:3000/offline-setup`
2. Click **"Configure Offline Settings"**
3. Toggle **"Enable Auto-Fallback to Ollama"** (on by default)
4. Select **"Preferred Offline Model"** from dropdown (default: qwen2.5-coder:1.5b)
5. Click **"Save Configuration"**

**Via API:**
```bash
curl http://localhost:3000/api/offline/setup -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "action": "configure",
    "config": {
      "autoFallback": true,
      "preferredModel": "qwen2.5-coder:7b"
    }
  }'
```

**Configuration Options:**
- `autoFallback` (boolean): Automatically switch to Ollama when offline (default: `true`)
- `preferredModel` (string): Which Ollama model to use offline (default: `"qwen2.5-coder:1.5b"`)
- `ollamaHost` (string): Custom Ollama URL (default: `"http://localhost:11434"`)

### Offline Indicator

The **OfflineIndicator** component appears in the top-right corner of every page:

- 🟢 **"Online"** (green badge): Connected to internet, using cloud AI providers
- 🟡 **"Offline Mode"** (yellow badge): No internet, using local Ollama models

**Enhanced Feature Availability Dropdown:**

Click the indicator badge to open an interactive dropdown menu showing real-time feature availability:

**Features Available Offline:**
- ✅ **Browse Local Files**: Access your project files without connectivity
- ✅ **View Organizations**: View cached organization data
- ✅ **View Projects**: Browse local project information

**Features Requiring Connection:**
- ❌ **Create Tasks**: Requires server connection to create new tasks
- ❌ **Sync Data**: Real-time data synchronization needs internet
- ❌ **Real-time Updates**: Live collaboration requires connectivity

The dropdown automatically updates as network status changes, providing instant visibility into which capabilities are currently available. Click outside the dropdown or press ESC to close it.

---

## Feature Availability

VibeCode provides transparent visibility into which features work offline vs require internet connectivity. The system continuously monitors the availability of key capabilities and provides real-time status updates.

### Checking Feature Availability

**Via UI:**
1. Click the **OfflineIndicator** badge in the top-right corner
2. View the feature availability dropdown showing all capabilities
3. Green checkmarks (✅) indicate features available in current mode
4. Red crosses (❌) indicate features requiring connectivity

**Via Offline Setup Page:**
1. Navigate to `http://localhost:3000/offline-setup`
2. View the comprehensive readiness wizard
3. Check the overall readiness score (percentage)
4. Review individual feature status in each wizard stage

**Via API:**
```bash
curl http://localhost:3000/api/offline/status | jq '.features'
```

### Feature Categories

**Core Offline Capabilities (Always Available):**

- **AI Code Assistance** (when Ollama installed with models)
  - Code completion and suggestions
  - Code generation and refactoring
  - AI chat for coding questions
  - Requires: Ollama service + at least one model installed

- **Vector Similarity Search** (when pgvector configured)
  - Semantic code search
  - Documentation similarity search
  - Embedding-based retrieval
  - Requires: PostgreSQL with pgvector extension

- **Local File Operations**
  - Browse and edit project files
  - File tree navigation
  - Syntax highlighting
  - Requires: Local file system access only

- **Project Templates**
  - Browse available templates
  - Create new projects from templates
  - Template configuration
  - Requires: No external dependencies (built-in)

- **Cache System** (when configured)
  - Documentation caching
  - API response caching
  - Template caching
  - Requires: Redis or in-memory cache

**Network-Dependent Capabilities:**

- **Real-time Collaboration**
  - Live cursor sharing
  - Real-time document editing
  - Presence indicators
  - Requires: WebSocket connection to server

- **Cloud AI Providers**
  - OpenAI, Anthropic, OpenRouter APIs
  - Premium models (GPT-4, Claude, etc.)
  - Cloud-based embeddings
  - Requires: Internet connection + API keys

- **Data Synchronization**
  - Project sync across devices
  - Settings synchronization
  - Backup to cloud storage
  - Requires: Server connection

- **Package Management**
  - npm/yarn package installation
  - Dependency updates
  - Registry access
  - Requires: Internet connection to package registries

### Feature Status Indicators

Each feature can have one of three statuses:

**AVAILABLE (Green ✅)**
- Feature is fully operational
- All dependencies are met
- Ready for immediate use

**DEGRADED (Yellow ⚠️)**
- Feature partially available
- Some capabilities may be limited
- Example: AI available but with limited model selection

**UNAVAILABLE (Red ❌)**
- Feature cannot be used
- Missing required dependencies or connectivity
- Setup required or wait for network restoration

### Monitoring Feature Health

The **FeatureAvailabilityPanel** component (accessible via OfflineIndicator dropdown) provides:

- **Real-time Status**: Updates every 30 seconds automatically
- **Detailed Information**: Shows specific status for each feature area
- **Visual Feedback**: Color-coded indicators for quick assessment
- **Actionable Guidance**: Links to setup pages when features unavailable

**Example Feature Status Display:**

```
AI Models: ✅ Available
  - 2 models installed (qwen2.5-coder:1.5b, qwen2.5-coder:7b)
  - Ollama service running
  - Ready for offline code assistance

Vector Search: ✅ Available
  - PostgreSQL connected
  - pgvector extension installed
  - Local similarity search operational

Cache: ✅ Available
  - Redis backend active
  - 128 MB cached data
  - Documentation and templates cached

Templates: ✅ Available
  - 10 templates available
  - All templates accessible offline
```

---

## Cached Resources

VibeCode caches essential resources locally so they're available offline.

### Documentation Search

**What's Cached:**
- Documentation index (all searchable docs)
- Search metadata and keywords
- Full documentation content

**Cache Behavior:**
1. **First Load (Online)**: Docs fetched from `public/docs-index.json` and cached
2. **Subsequent Loads**: Served from cache (instant, works offline)
3. **Cache Duration**: 24 hours (refreshed automatically when online)

**Search Offline:**
```bash
# Works completely offline once cached
curl http://localhost:3000/api/docs/search?q=react
```

**Response Headers:**
```
X-Offline-Capable: true
X-Cache-Source: cache
Cache-Control: public, max-age=3600
```

### Project Templates

**What's Cached:**
- All project templates (Next.js, React, Vue, etc.)
- Template metadata and descriptions
- Template file structures

**Cache Behavior:**
Templates are hardcoded in the app and always available offline (no caching needed).

**Browse Templates Offline:**
```bash
curl http://localhost:3000/api/templates
```

### Cache Management

**View Cache Stats:**
```typescript
import { OfflineCacheManager } from '@/lib/cache/offline-cache';

const cacheManager = OfflineCacheManager.getInstance();
const stats = cacheManager.getStats();

console.log(stats);
// {
//   totalSize: "12.5 MB",
//   totalCount: 47,
//   byType: {
//     "docs-index": { count: 1, size: "8.2 MB" },
//     "templates": { count: 12, size: "3.8 MB" }
//   }
// }
```

**Clear Cache:**
```typescript
// Clear all cached resources
cacheManager.clear();

// Clear only documentation cache
cacheManager.clearByType('docs-index');
```

**Cache Limits:**
- **Max Size**: 50 MB (automatic LRU eviction when exceeded)
- **Storage**: localStorage (browser) or memory (server-side)
- **TTL**: 24 hours for docs, 7 days for templates

---

## Recommended Models

### qwen2.5-coder:1.5b (Essential)
- **Size**: 1.7 GB
- **RAM Required**: 4 GB minimum
- **Speed**: Very fast (~50 tokens/sec on M1 Mac)
- **Quality**: Good for autocomplete, simple refactoring
- **Use Case**: Default offline model, low-end hardware

### qwen2.5-coder:7b (Recommended)
- **Size**: 4.7 GB
- **RAM Required**: 8 GB minimum
- **Speed**: Fast (~30 tokens/sec on M1 Mac)
- **Quality**: Excellent for most coding tasks
- **Use Case**: Best balance of speed and quality

### deepseek-coder-v2:16b (Advanced)
- **Size**: 9.0 GB
- **RAM Required**: 16 GB minimum
- **Speed**: Moderate (~15 tokens/sec on M1 Mac)
- **Quality**: Highest quality, best for complex tasks
- **Use Case**: Architecture design, complex refactoring

### Choosing the Right Model

**Low-End Hardware (4-8 GB RAM):**
```bash
ollama pull qwen2.5-coder:1.5b
```

**Mid-Range Hardware (8-16 GB RAM):**
```bash
ollama pull qwen2.5-coder:7b
```

**High-End Hardware (16+ GB RAM):**
```bash
ollama pull deepseek-coder-v2:16b
```

**Switch Models Anytime:**
```bash
# Download a new model
ollama pull qwen2.5-coder:7b

# Update VibeCode configuration
curl http://localhost:3000/api/offline/setup -X POST \
  -H "Content-Type: application/json" \
  -d '{"action": "configure", "config": {"preferredModel": "qwen2.5-coder:7b"}}'
```

---

## Troubleshooting

### Problem: Offline indicator shows "Offline Mode" but I have internet

**Cause**: VibeCode detected a network error and switched to offline mode.

**Solution**:
1. Check your internet connection (try loading google.com)
2. Refresh the page (Cmd+R / Ctrl+R)
3. If issue persists, check browser console for network errors

### Problem: AI chat returns "Ollama not available" error

**Cause**: Ollama service is not running or not reachable.

**Solution**:
```bash
# Check if Ollama is running
curl http://localhost:11434/api/version

# If no response, start Ollama
ollama serve
```

### Problem: AI responses are slow in offline mode

**Cause**: Model is too large for your hardware, or CPU is throttled.

**Solution**:
1. Switch to a smaller model (qwen2.5-coder:1.5b)
2. Close other applications to free up RAM
3. Check CPU usage (Activity Monitor / Task Manager)
4. Consider upgrading hardware or using cloud AI when online

### Problem: Documentation search returns empty results offline

**Cause**: Documentation cache is not populated yet.

**Solution**:
1. Go online temporarily
2. Search for any query (e.g., "react") to populate cache
3. Go offline — search will now work

### Problem: "Quota Exceeded" error when caching resources

**Cause**: Browser localStorage is full (usually 10 MB limit).

**Solution**:
```typescript
import { OfflineCacheManager } from '@/lib/cache/offline-cache';

// Clear old cache to make space
OfflineCacheManager.getInstance().clear();
```

### Problem: Ollama model download stalls or fails

**Cause**: Network issue, disk space, or Ollama bug.

**Solution**:
```bash
# Cancel and retry download
ollama rm qwen2.5-coder:1.5b  # Remove partial download
ollama pull qwen2.5-coder:1.5b  # Try again

# Check disk space
df -h  # Linux/Mac
# Ensure you have 2x model size free (e.g., 3.5 GB for 1.7 GB model)
```

### Still Having Issues?

1. **Check logs**: Open browser DevTools → Console tab
2. **Check Ollama logs**: `ollama logs` (if available on your platform)
3. **Verify setup**: Visit `http://localhost:3000/offline-setup`
4. **File an issue**: [GitHub Issues](https://github.com/ryanmaclean/vibecode/issues)

---

## Advanced Configuration

### Custom Ollama Host

If running Ollama on a different machine or port:

**Via Environment Variable:**
```bash
# .env.local
OLLAMA_HOST=http://192.168.1.100:11434
```

**Via API:**
```bash
curl http://localhost:3000/api/offline/setup -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "action": "configure",
    "config": {
      "ollamaHost": "http://192.168.1.100:11434"
    }
  }'
```

### Disable Automatic Fallback

Force VibeCode to always use cloud AI, even when offline (will fail with errors):

```bash
curl http://localhost:3000/api/offline/setup -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "action": "configure",
    "config": {
      "autoFallback": false
    }
  }'
```

### Pre-Populate Cache for Air-Gapped Deployment

If deploying to a completely air-gapped environment:

**1. Export Cache (Online Machine):**
```typescript
import { getOfflineConfig, OfflineCacheManager } from '@/lib/config/offline-config';

const config = getOfflineConfig();
const cacheData = OfflineCacheManager.getInstance().export();

// Save to file
fs.writeFileSync('offline-cache-export.json', JSON.stringify({
  config,
  cache: cacheData
}));
```

**2. Import Cache (Air-Gapped Machine):**
```typescript
import { updateOfflineConfig, OfflineCacheManager } from '@/lib/config/offline-config';

const data = JSON.parse(fs.readFileSync('offline-cache-export.json'));

updateOfflineConfig(data.config);
OfflineCacheManager.getInstance().import(data.cache);
```

---

## Performance Considerations

### Model Performance Benchmarks

Tested on Apple M1 MacBook Pro (16 GB RAM):

| Model | Tokens/Sec | First Token Latency | RAM Usage |
|-------|------------|---------------------|-----------|
| qwen2.5-coder:1.5b | 50-60 | 200ms | 2.5 GB |
| qwen2.5-coder:7b | 25-35 | 400ms | 5.8 GB |
| deepseek-coder-v2:16b | 12-18 | 800ms | 12 GB |

**Lower-End Hardware (Intel i5, 8 GB RAM):**
- qwen2.5-coder:1.5b: 20-30 tokens/sec (acceptable)
- qwen2.5-coder:7b: 8-12 tokens/sec (slow but usable)
- deepseek-coder-v2:16b: Not recommended (will swap to disk)

### Optimization Tips

**1. Run Ollama on GPU (Nvidia/AMD):**
Ollama automatically uses GPU if available. Expect 2-5x speedup.

**2. Increase Ollama Context Size:**
```bash
# Default: 2048 tokens
# Increase for longer conversations (uses more RAM)
OLLAMA_CONTEXT_SIZE=4096 ollama serve
```

**3. Reduce Model Quantization (Faster, Lower Quality):**
```bash
# Q4 quantization (default, best balance)
ollama pull qwen2.5-coder:7b

# Q3 quantization (faster, lower quality)
ollama pull qwen2.5-coder:7b-q3
```

**4. Pre-Load Models into RAM:**
```bash
# Keep model in memory for instant responses
ollama run qwen2.5-coder:1.5b ""  # Load but don't generate

# Now all subsequent requests are instant (no load time)
```

---

## Security & Compliance

### Why Offline Mode Meets Security Requirements

**No Data Leaves Your Machine:**
- All AI inference happens locally on your device
- No API calls to external services (OpenAI, Anthropic, etc.)
- No telemetry or usage data sent to cloud providers

**Air-Gapped Compliance:**
- Works completely disconnected from internet
- No outbound network connections required
- Suitable for classified networks (SCIF, air-gapped labs)

**Data Residency:**
- All code and AI context stays on local storage
- Meets GDPR, CCPA, HIPAA data residency requirements
- No third-party data processing agreements needed

### Security Best Practices

**1. Verify Ollama Binary Integrity:**
```bash
# Check Ollama signature (macOS)
codesign -dv /usr/local/bin/ollama

# Verify hash matches official release
shasum -a 256 /usr/local/bin/ollama
```

**2. Restrict Ollama Network Access:**
```bash
# Only listen on localhost (default)
OLLAMA_HOST=127.0.0.1:11434 ollama serve

# Block external access via firewall (Linux example)
sudo ufw deny 11434
```

**3. Encrypt Model Storage:**
Models are stored in `~/.ollama/models/`. Ensure this directory is on an encrypted volume (FileVault, LUKS, BitLocker).

**4. Audit Network Activity:**
```bash
# Verify no outbound connections (macOS)
sudo lsof -i -P | grep ollama

# Should only show localhost:11434
```

**5. Regular Security Updates:**
```bash
# Update Ollama to latest version
curl -fsSL https://ollama.ai/install.sh | sh

# Update models (security patches)
ollama pull qwen2.5-coder:1.5b
```

---

## Frequently Asked Questions

**Q: Can I use offline mode with cloud-hosted VibeCode?**
A: No, offline mode requires VibeCode to be running locally. Cloud-hosted instances (Vercel, AWS) cannot access your local Ollama service.

**Q: Do I need to download models every time I restart?**
A: No, models are downloaded once and stored permanently in `~/.ollama/models/`. They persist across restarts.

**Q: Can I use multiple models simultaneously?**
A: VibeCode uses one model at a time (the configured `preferredModel`). You can switch models anytime via the Offline Setup page.

**Q: What happens if I run out of disk space?**
A: Ollama will fail to download new models. VibeCode's cache will automatically evict old entries (LRU) to stay under 50 MB.

**Q: Is offline mode slower than cloud AI?**
A: Local models (1.5b-7b) are comparable to cloud AI for simple tasks. Large models (16b+) may be slower unless you have high-end hardware.

**Q: Can I use Ollama with other applications?**
A: Yes! Ollama exposes a REST API at `http://localhost:11434`. Many tools (Continue, Cody, Jan.ai) integrate with Ollama.

**Q: How do I uninstall offline mode?**
A: Simply stop Ollama (`killall ollama`) and disable auto-fallback in VibeCode settings. Optionally, delete models with `ollama rm <model-name>`.

---

## Next Steps

Now that you have offline mode configured:

1. **Test Offline Development**: Disconnect from internet and write some code with AI assistance
2. **Explore Advanced Models**: Try qwen2.5-coder:7b or deepseek-coder-v2:16b for better quality
3. **Optimize Performance**: Tune Ollama settings for your hardware
4. **Deploy Air-Gapped**: Roll out VibeCode to secure environments

**Happy Offline Coding!** 🚀

---

## Additional Resources

- **Ollama Documentation**: [https://ollama.ai/docs](https://ollama.ai/docs)
- **Qwen2.5-Coder Model Card**: [https://ollama.ai/library/qwen2.5-coder](https://ollama.ai/library/qwen2.5-coder)
- **DeepSeek Coder V2**: [https://ollama.ai/library/deepseek-coder-v2](https://ollama.ai/library/deepseek-coder-v2)
- **VibeCode Contributing Guide**: [CONTRIBUTING.md](../CONTRIBUTING.md)
- **VibeCode Architecture**: [docs/ARCHITECTURE.md](./ARCHITECTURE.md)

---

**Document Version**: 1.1.0
**Last Updated**: 2026-02-22
**Maintained By**: VibeCode Team

**Changelog:**
- v1.1.0 (2026-02-22): Enhanced with feature availability tracking, improved setup wizard documentation, and comprehensive API response examples
- v1.0.0 (2026-02-19): Initial offline mode documentation
