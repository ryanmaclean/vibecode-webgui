---
title: VibeCode 5-Minute Quick Start
description: Get from zero to productive with VibeCode in under 5 minutes
---

# VibeCode 5-Minute Quick Start

This guide gets you from zero to a fully working AI-native IDE in under 5 minutes.

## Prerequisites

- **macOS** (Apple Silicon or Intel)
- **Node.js 18+** (check with `node --version`)
- **vfkit** for VM backend: `brew install vfkit`
- **Python 3.8+** (for backend scripts)

## Step 1: Install Dependencies

```bash
# Install VM backend
brew install vfkit

# Install Python dependencies
pip install -r scripts/requirements.txt
```

## Step 2: Run Quick Start

Single command to set up and launch VibeCode:

```bash
npm run quickstart
```

This command will:
1. ✅ Detect if this is your first run
2. ✅ Check Node.js version and dependencies
3. ✅ Set up development environment (.env, Tailwind CSS, Docker)
4. ✅ Create a sample project at `~/vibecode-sample`
5. ✅ Launch the VibeCode frontend (http://localhost:3000)
6. ✅ Open the onboarding wizard automatically

**Expected time:** 3-4 minutes

## Step 3: Complete Quick Onboarding

When the onboarding wizard opens, use **Quick Mode** for the fastest setup:

1. The wizard will automatically use smart defaults:
   - **IDE:** Windsurf
   - **CLI Editor:** Neovim
   - **Frameworks:** Next.js essentials (Prettier, ESLint, Tailwind)
   - **Integrations:** GitHub, Linear, Datadog
   - **AI Provider:** Claude (default)

2. Complete the 3-step wizard (Welcome → Essentials → Complete)

3. See your first AI suggestion demo on the completion screen!

**Expected time:** Under 2 minutes

## Step 4: Try the Sample Project

A sample project has been created at `~/vibecode-sample` demonstrating:

- **TypeScript + Express API** setup
- **AI-ready code comments** for quick suggestions
- **8 pre-configured tasks** in `.vibecode/tasks.json`

Open the sample project in VibeCode and try:

```bash
cd ~/vibecode-sample
npm install
npm run dev
```

Visit http://localhost:8080/api/hello to see the demo API.

**Expected time:** 1 minute

## What Happens Next?

After quick start completes, you'll have:

- ✅ **VibeCode Studio** running at http://localhost:3000
- ✅ **Ubuntu VM backend** ready via `vfkit`
- ✅ **Sample project** demonstrating key features
- ✅ **Onboarding complete** with your preferences saved
- ✅ **AI suggestions** ready to use

**Total time: Under 5 minutes** ⚡

## Command Options

The quickstart script supports several flags:

```bash
# Show execution plan without running
npm run quickstart -- --dry-run

# Skip setup phase (if already configured)
npm run quickstart -- --skip-setup

# Skip service launch (setup only)
npm run quickstart -- --skip-launch

# Show help
npm run quickstart -- --help
```

## Manual Launch (Advanced)

If you prefer to launch components separately:

### 1. Launch Backend VM
```bash
bin/vibecode-vm start
# or
python3 scripts/launch_ubuntu_vm.py
```

### 2. Launch Frontend
```bash
npm run tauri:dev
# or
npm run dev
```

### 3. Check Status
```bash
bin/vibecode-vm status  # Health check via Ralph Loop
```

## Troubleshooting

### "Command not found: npm"
Install Node.js 18+ from https://nodejs.org/ or via `brew install node`

### "vfkit not found"
Install vfkit: `brew install vfkit`

### "Port 3000 already in use"
Stop the conflicting service:
```bash
lsof -ti:3000 | xargs kill -9
```

### "First-run detection not working"
Reset first-run state:
```bash
node scripts/check-first-run.js complete
rm -f ~/.vibecode/.first-run
```

### "Setup fails with permission errors"
Ensure you have write permissions:
```bash
chmod +x scripts/*.js
chmod +x scripts/*.py
```

### "VM fails to start"
Check vfkit installation and try manual launch:
```bash
vfkit --version
python3 scripts/launch_ubuntu_vm.py --verbose
```

### "Onboarding wizard doesn't open"
Manually navigate to http://localhost:3000/onboarding?mode=quick

### "Sample project not created"
Check if directory exists and manually copy template:
```bash
ls ~/vibecode-sample
cp -r templates/sample-project ~/vibecode-sample
```

## Next Steps

After completing quick start:

1. **Explore the Dashboard** - View your projects and settings
2. **Try AI Features** - Use Claude for code completions and suggestions
3. **Configure Integrations** - Connect GitHub, Linear, or Datadog
4. **Read Full Docs** - See [README.md](../README.md) for advanced features

## CLI Tool Reference

Manage the VM environment:

```bash
bin/vibecode-vm status   # Check health via Ralph Loop
bin/vibecode-vm start    # Launch Ubuntu VM
bin/vibecode-vm stop     # Stop VM
```

## Menubar App (Optional)

For native macOS control:

```bash
cd platforms/macos/VibeCodeMenubar
swift build -c release
.build/release/VibeCodeMenubar
```

## Docker Alternative

If you prefer containers over VMs:

```bash
docker compose up -d
```

This launches the OpenClaw Gateway on port 18789.

## Support

- **Documentation:** [docs/](.)
- **Issues:** Report bugs and request features on GitHub
- **Community:** Join our Discord for help and discussions

---

**Ready to build?** 🚀 Start with `npm run quickstart` and you'll be coding with AI assistance in under 5 minutes!
