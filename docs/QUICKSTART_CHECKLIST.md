# VibeCode Quick Start Checklist

**Get VibeCode running in under 5 minutes**

**Version:** 1.0
**Last Updated:** February 28, 2026
**Deployment Mode:** Docker Compose (Fastest Path)

---

## Prerequisites Checklist

Before you begin, ensure you have:

- [ ] **macOS, Linux, or Windows** (WSL2 recommended for Windows)
- [ ] **8 GB RAM** minimum (16 GB recommended)
- [ ] **20 GB free disk space**
- [ ] **Internet connection** (for downloads)

---

## Software Requirements

Install these tools first:

### Required
- [ ] **Git** - Any recent version
  ```bash
  # macOS
  brew install git
  # Or comes with macOS Command Line Tools
  ```

- [ ] **Node.js** v22.15.1+
  ```bash
  # Using nvm (recommended)
  nvm install 22
  nvm use 22
  ```

- [ ] **npm** v10.9.4+ (comes with Node.js)
  ```bash
  npm --version  # Verify it's 10.9.4+
  ```

- [ ] **Docker Desktop** (latest version)
  - Download: https://www.docker.com/products/docker-desktop
  - Install and ensure Docker is running

---

## 5-Minute Setup

### Step 1: Clone Repository
```bash
cd ~/Projects  # Or your preferred directory
git clone https://github.com/ryanmaclean/vibecode-webgui.git
cd vibecode-webgui
```

**Checkpoint:**
- [ ] Repository cloned successfully
- [ ] Inside `vibecode-webgui` directory

---

### Step 2: Setup Node Environment
```bash
# Load nvm (if installed)
source ~/.nvm/nvm.sh

# Use Node 22
nvm use 22

# Verify versions
node --version  # Should be v22.15.1+
npm --version   # Should be v10.9.4+
```

**Checkpoint:**
- [ ] Node version is v22.15.1 or higher
- [ ] npm version is v10.9.4 or higher

---

### Step 3: Install Dependencies
```bash
npm install --legacy-peer-deps
```

**Expected:** 2-3 minutes install time

**Checkpoint:**
- [ ] No critical errors during install
- [ ] `node_modules/` directory created

---

### Step 4: Start Services
```bash
# Start all containers
docker-compose up -d

# Verify services are running
docker-compose ps
```

**Expected Output:**
```
NAME                     SERVICE             STATUS
vibecode-web            web                 running
vibecode-postgres       postgres            running
vibecode-valkey         valkey              running
```

**Checkpoint:**
- [ ] All 3 services show "running" status
- [ ] No error messages in output

---

### Step 5: Access VibeCode
Open your browser to: **http://localhost:3000**

**Checkpoint:**
- [ ] VibeCode dashboard loads successfully
- [ ] No connection errors in browser

---

### Step 6: Create First Workspace
1. Click **"+ New Workspace"** button
2. Choose a template or start empty
3. Enter name: `my-first-project`
4. Click **"Create"**
5. Wait for IDE to launch

**Checkpoint:**
- [ ] Workspace created successfully
- [ ] VS Code-like IDE opens in browser
- [ ] Can see file explorer and editor

---

## 🎉 Success!

You're now running VibeCode! Here's what you can do next:

### Immediate Next Steps
- [ ] **Create a file** - Test the editor by creating a new file
- [ ] **Open terminal** - Try the integrated terminal (Ctrl+`)
- [ ] **Install extension** - Add your favorite VS Code extension

### Optional Configuration
- [ ] **Setup authentication** - Settings → Authentication
- [ ] **Configure AI models** - Get OpenRouter API key
- [ ] **Install extensions** - Python, ESLint, Prettier, etc.
- [ ] **Customize settings** - Themes, keybindings, fonts

---

## Quick Troubleshooting

### Port 3000 Already in Use
```bash
# Find what's using the port
lsof -i :3000

# Kill the process or stop it
# Then retry: docker-compose up -d
```

### Services Won't Start
```bash
# Check logs for errors
docker-compose logs web

# Restart all services
docker-compose restart

# Or restart from scratch
docker-compose down
docker-compose up -d
```

### npm Install Fails
```bash
# Clear cache and retry
npm cache clean --force
npm install --legacy-peer-deps
```

### Docker Not Running
- Ensure Docker Desktop is launched
- Check Docker icon in system tray/menu bar
- Restart Docker Desktop if needed

### Wrong Node Version
```bash
# Switch to correct version
nvm use 22

# Set as default
nvm alias default 22
```

---

## Useful Commands

### Managing Services
```bash
# View logs
docker-compose logs -f web

# Stop services
docker-compose down

# Restart services
docker-compose restart

# Check status
docker-compose ps
```

### Cleanup & Reset
```bash
# Stop and remove containers
docker-compose down

# Remove volumes (CAUTION: deletes data)
docker-compose down -v

# Clean start
docker-compose down -v
docker-compose up -d
```

---

## Need More Help?

### Documentation
- **Full Setup Guide** - [docs/setup/GETTING_STARTED.md](./setup/GETTING_STARTED.md)
- **Troubleshooting** - [docs/TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- **Docker Compose Details** - [docs/setup/DOCKER_COMPOSE_SETUP.md](./setup/DOCKER_COMPOSE_SETUP.md)

### Alternative Deployment Modes
Not satisfied with Docker Compose? Try these:

- **KIND Kubernetes** - [docs/setup/KIND_KUBERNETES_SETUP.md](./setup/KIND_KUBERNETES_SETUP.md) (~10 min)
- **Tauri Desktop** - [docs/setup/TAURI_DESKTOP_SETUP.md](./setup/TAURI_DESKTOP_SETUP.md) (~15 min)
- **Apple Virtualization** - [docs/setup/APPLE_VIRTUALIZATION_SETUP.md](./setup/APPLE_VIRTUALIZATION_SETUP.md) (~20 min)

### Community Support
- **GitHub Issues** - https://github.com/ryanmaclean/vibecode-webgui/issues
- **GitHub Discussions** - https://github.com/ryanmaclean/vibecode-webgui/discussions

---

## Final Checklist

Before considering your setup complete:

- [ ] ✅ All prerequisites installed
- [ ] ✅ Repository cloned
- [ ] ✅ Dependencies installed
- [ ] ✅ Docker services running
- [ ] ✅ Can access http://localhost:3000
- [ ] ✅ Created first workspace
- [ ] ✅ IDE loads and is functional
- [ ] ✅ Can create and edit files

**All checked?** You're ready to start developing with VibeCode! 🚀

---

**Total Time:** 5 minutes (plus download time)
**Difficulty:** Beginner-friendly
**Prerequisites:** Basic command line knowledge

For advanced features, production deployment, or contributing to VibeCode, see the [complete documentation](./setup/GETTING_STARTED.md).
