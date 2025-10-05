---
title: vscode extensions
description: vscode extensions documentation
---

# 🔧 VS Code Extension Configuration: Auto-Install & Warning Bypass

**Challenge:** Ensure VibeCode AI Assistant and essential extensions work seamlessly in code-server  
**Goal:** Pre-install extensions, bypass security warnings, enable by default  
**Status:** ✅ Current implementation analysis + enhancement recommendations

## 🎯 Current State Analysis

### **Existing Extension Infrastructure**

From the codebase analysis, VibeCode already has a solid foundation:

#### ✅ **What's Working:**
1. **Custom Dockerfile** with extension pre-installation:
```dockerfile
# docker/code-server/Dockerfile
RUN code-server --install-extension ms-python.python \
    && code-server --install-extension bradlc.vscode-tailwindcss \
    && code-server --install-extension esbenp.prettier-vscode \
    && code-server --install-extension ms-vscode.vscode-typescript-next
```

2. **Settings Configuration** properly configured:
```json
// docker/code-server/settings.json
{
  "extensions.autoUpdate": false,
  "extensions.autoCheckUpdates": false,
  "security.workspace.trust.enabled": false,
  "workbench.startupEditor": "none",
  "workbench.tips.enabled": false,
  "workbench.welcome.enabled": false
}
```

3. **VibeCode AI Assistant Extension** exists at `extensions/vibecode-ai-assistant/`

#### ⚠️ **Issues Identified:**

1. **VibeCode AI Assistant not pre-installed** in Docker image
2. **Extension activation warnings** may still appear
3. **Marketplace extensions** need proper configuration
4. **Extension settings** not fully optimized for auto-enable

## 🚀 Enhanced Configuration Strategy

### **Phase 1: Extension Pre-Installation (Docker Layer)**

#### **Updated Dockerfile with VibeCode Extensions**

```dockerfile
# docker/code-server/Dockerfile.enhanced
FROM codercom/code-server:4.101.2 AS base

USER root

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl git openssh-client sudo wget gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 18 LTS  
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Create extension directory with proper permissions
RUN mkdir -p /home/coder/.local/share/code-server/extensions \
    && chown -R coder:coder /home/coder

# Switch to coder user for extension installation
USER coder

# Install essential marketplace extensions
RUN code-server --install-extension ms-python.python \
    --install-extension bradlc.vscode-tailwindcss \
    --install-extension esbenp.prettier-vscode \
    --install-extension ms-vscode.vscode-typescript-next \
    --install-extension ms-vscode.vscode-json \
    --install-extension redhat.vscode-yaml \
    --install-extension ms-vscode.theme-github \
    --install-extension ms-vscode.vscode-eslint \
    --install-extension formulahendry.auto-rename-tag \
    --install-extension christian-kohler.path-intellisense \
    --install-extension ms-vscode.vscode-css-peek

# Copy and install VibeCode AI Assistant extension
COPY --chown=coder:coder extensions/vibecode-ai-assistant /tmp/vibecode-ai-assistant
RUN cd /tmp/vibecode-ai-assistant \
    && npm install \
    && npm run package \
    && code-server --install-extension *.vsix \
    && rm -rf /tmp/vibecode-ai-assistant

# Copy optimized settings and configuration
COPY --chown=coder:coder docker/code-server/settings.json /home/coder/.local/share/code-server/User/settings.json
COPY --chown=coder:coder docker/code-server/extensions.json /home/coder/.local/share/code-server/extensions.json
COPY --chown=coder:coder docker/code-server/keybindings.json /home/coder/.local/share/code-server/User/keybindings.json

# Set extension permissions and ownership
RUN chown -R coder:coder /home/coder/.local/share/code-server

WORKDIR /home/coder/workspace
EXPOSE 8080

CMD ["code-server", "--bind-addr", "0.0.0.0:8080", "--auth", "none", "/home/coder/workspace"]
```

### **Phase 2: Warning-Free Settings Configuration**

#### **Enhanced settings.json**

```json
{
  "workbench.startupEditor": "none",
  "workbench.tips.enabled": false,
  "workbench.welcome.enabled": false,
  "workbench.colorTheme": "GitHub Dark Default",
  
  // Extension Configuration
  "extensions.autoUpdate": false,
  "extensions.autoCheckUpdates": false,
  "extensions.ignoreRecommendations": true,
  "extensions.showRecommendationsOnlyOnDemand": true,
  
  // Security & Trust Settings (Bypass Warnings)
  "security.workspace.trust.enabled": false,
  "security.workspace.trust.banner": "never",
  "security.workspace.trust.emptyWindow": false,
  "security.workspace.trust.untrustedFiles": "open",
  
  // Disable Telemetry & Updates
  "telemetry.telemetryLevel": "off",
  "update.mode": "none",
  "extensions.autoUpdate": false,
  
  // AI Assistant Configuration
  "vibecode-ai-assistant.enableOnStartup": true,
  "vibecode-ai-assistant.showWelcome": false,
  "vibecode-ai-assistant.skipActivationPrompt": true,
  
  // Disable Confirmation Dialogs
  "explorer.confirmDelete": false,
  "explorer.confirmDragAndDrop": false,
  "git.confirmSync": false,
  "git.enableSmartCommit": true,
  
  // Performance Optimizations
  "search.followSymlinks": false,
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.next": true,
    "**/build": true
  },
  "files.watcherExclude": {
    "**/node_modules/**": true,
    "**/.git/objects/**": true,
    "**/.git/subtree-cache/**": true,
    "**/dist/**": true,
    "**/.next/**": true
  },
  
  // Editor Configuration
  "editor.fontFamily": "'JetBrains Mono', 'Fira Code', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
  "editor.fontSize": 14,
  "editor.lineHeight": 1.6,
  "editor.tabSize": 2,
  "editor.insertSpaces": true,
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll": "explicit",
    "source.organizeImports": "explicit"
  },
  
  // TypeScript/JavaScript Settings
  "typescript.updateImportsOnFileMove.enabled": "always",
  "typescript.suggest.autoImports": true,
  "javascript.updateImportsOnFileMove.enabled": "always",
  "javascript.suggest.autoImports": true,
  
  // Terminal Configuration
  "terminal.integrated.fontSize": 13,
  "terminal.integrated.fontFamily": "'JetBrains Mono', 'Fira Code', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
  "terminal.integrated.defaultProfile.linux": "bash"
}
```

#### **Extension Recommendations (extensions.json)**

```json
{
  "recommendations": [
    "vibecode.vibecode-ai-assistant",
    "ms-python.python",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml",
    "ms-vscode.theme-github",
    "ms-vscode.vscode-eslint",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense",
    "ms-vscode.vscode-css-peek"
  ],
  "unwantedRecommendations": [
    "ms-vscode.cpptools",
    "ms-vscode.powershell",
    "ms-python.pylance"
  ]
}
```

### **Phase 3: Kubernetes Configuration Updates**

#### **Enhanced ConfigMap for Code-Server**

```yaml
# k8s/code-server-config-enhanced.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: code-server-config-enhanced
  namespace: vibecode
data:
  config.yaml: |
    bind-addr: 0.0.0.0:8080
    auth: none
    cert: false
    disable-telemetry: true
    disable-update-check: true
    disable-file-downloads: false
    disable-workspace-trust: true
    extensions-dir: /home/coder/.local/share/code-server/extensions
    user-data-dir: /home/coder/.local/share/code-server
    install-source: vibecode-platform
    
  startup-script.sh: |
    #!/bin/bash
    set -euo pipefail
    
    echo "🚀 Starting VibeCode workspace for user: ${USER_ID:-default}"
    
    # Ensure extension directory exists
    mkdir -p /home/coder/.local/share/code-server/extensions
    mkdir -p /home/coder/.local/share/code-server/User
    
    # Copy global settings if user settings don't exist
    if [ ! -f "/home/coder/.local/share/code-server/User/settings.json" ]; then
      cp /etc/code-server/settings.json /home/coder/.local/share/code-server/User/settings.json
    fi
    
    # Set proper permissions
    chown -R coder:coder /home/coder/.local/share/code-server
    
    # Check if VibeCode AI Assistant is installed
    if [ ! -d "/home/coder/.local/share/code-server/extensions/vibecode.vibecode-ai-assistant*" ]; then
      echo "⚠️  VibeCode AI Assistant not found, auto-installing..."
      code-server --install-extension /etc/extensions/vibecode-ai-assistant.vsix || true
    fi
    
    # Disable first-run experience
    touch /home/coder/.local/share/code-server/first-run-complete
    
    echo "✅ VibeCode workspace ready!"
    
  settings.json: |
    {
      "workbench.startupEditor": "none",
      "workbench.tips.enabled": false,
      "workbench.welcome.enabled": false,
      "security.workspace.trust.enabled": false,
      "security.workspace.trust.banner": "never",
      "extensions.autoUpdate": false,
      "extensions.autoCheckUpdates": false,
      "extensions.ignoreRecommendations": true,
      "telemetry.telemetryLevel": "off",
      "update.mode": "none",
      "vibecode-ai-assistant.enableOnStartup": true,
      "vibecode-ai-assistant.showWelcome": false,
      "explorer.confirmDelete": false,
      "explorer.confirmDragAndDrop": false,
      "git.confirmSync": false,
      "workbench.colorTheme": "GitHub Dark Default",
      "editor.fontFamily": "'JetBrains Mono', 'Fira Code', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
      "editor.fontSize": 14,
      "editor.formatOnSave": true,
      "typescript.updateImportsOnFileMove.enabled": "always",
      "javascript.updateImportsOnFileMove.enabled": "always"
    }
```

#### **Updated Deployment with Extension Volume**

```yaml
# k8s/code-server-deployment-enhanced.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: code-server-enhanced
  namespace: vibecode
spec:
  replicas: 1
  selector:
    matchLabels:
      app: code-server
  template:
    metadata:
      labels:
        app: code-server
    spec:
      initContainers:
      - name: setup-extensions
        image: vibecode/code-server:enhanced
        command: ["/bin/bash", "/etc/code-server/startup-script.sh"]
        env:
        - name: USER_ID
          value: "$(USER_ID)"
        volumeMounts:
        - name: workspace-storage
          mountPath: /home/coder
        - name: config-volume
          mountPath: /etc/code-server
        - name: extensions-volume
          mountPath: /etc/extensions
          
      containers:
      - name: code-server
        image: vibecode/code-server:enhanced
        args:
          - --bind-addr=0.0.0.0:8080
          - --auth=none
          - --disable-telemetry
          - --disable-update-check
          - --config=/etc/code-server/config.yaml
          - /home/coder/workspace
        env:
        - name: USER_ID
          value: "default"
        - name: HOME
          value: "/home/coder"
        - name: SHELL
          value: "/bin/bash"
        # AI Integration Environment Variables
        - name: OPENROUTER_API_KEY
          valueFrom:
            secretKeyRef:
              name: ai-integration-secrets
              key: openrouter-api-key
        - name: VIBECODE_AI_ENABLED
          value: "true"
        ports:
        - containerPort: 8080
          name: http
        volumeMounts:
        - name: workspace-storage
          mountPath: /home/coder
        - name: config-volume
          mountPath: /etc/code-server
        - name: extensions-volume
          mountPath: /etc/extensions
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
            
      volumes:
      - name: workspace-storage
        persistentVolumeClaim:
          claimName: workspace-storage
      - name: config-volume
        configMap:
          name: code-server-config-enhanced
          defaultMode: 0755
      - name: extensions-volume
        configMap:
          name: vibecode-extensions
          defaultMode: 0644
```

### **Phase 4: VibeCode AI Assistant Auto-Configuration**

#### **Extension Package Script**

```bash
#!/bin/bash
# scripts/package-vibecode-extension.sh

set -e

echo "📦 Packaging VibeCode AI Assistant extension..."

cd extensions/vibecode-ai-assistant

# Install dependencies
npm install

# Build extension
npm run compile

# Package extension
npx vsce package --no-dependencies

# Copy to Docker build context
cp *.vsix ../../docker/code-server/vibecode-ai-assistant.vsix

echo "✅ Extension packaged successfully"
```

#### **Extension Auto-Activation**

```typescript
// extensions/vibecode-ai-assistant/src/extension.ts
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('🚀 VibeCode AI Assistant activating...');

    // Skip activation prompts in code-server environment
    const isCodeServer = vscode.env.appName.includes('code-server');
    
    if (isCodeServer) {
        // Auto-configure for VibeCode platform
        const config = vscode.workspace.getConfiguration('vibecode-ai-assistant');
        
        // Set default configurations to bypass setup
        if (!config.get('apiKey')) {
            // Get API key from environment (set by Kubernetes)
            const apiKey = process.env.OPENROUTER_API_KEY;
            if (apiKey) {
                config.update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
            }
        }
        
        // Enable features by default
        config.update('enableOnStartup', true, vscode.ConfigurationTarget.Global);
        config.update('showWelcome', false, vscode.ConfigurationTarget.Global);
        config.update('skipActivationPrompt', true, vscode.ConfigurationTarget.Global);
        
        // Show ready notification
        vscode.window.showInformationMessage(
            '✅ VibeCode AI Assistant is ready!', 
            'Open Chat'
        ).then(selection => {
            if (selection === 'Open Chat') {
                vscode.commands.executeCommand('vibecode-ai.openChat');
            }
        });
    }

    // Register commands and providers
    registerCommands(context);
    registerProviders(context);
    
    console.log('✅ VibeCode AI Assistant activated successfully');
}

function registerCommands(context: vscode.ExtensionContext) {
    // Register all AI assistant commands
    const commands = [
        vscode.commands.registerCommand('vibecode-ai.generateCode', generateCode),
        vscode.commands.registerCommand('vibecode-ai.explainCode', explainCode),
        vscode.commands.registerCommand('vibecode-ai.openChat', openChat),
        // ... other commands
    ];
    
    commands.forEach(command => context.subscriptions.push(command));
}
```

## 🔧 Implementation Checklist

### **Immediate Actions (Week 1)**

- [ ] **Update Dockerfile** with enhanced extension pre-installation
- [ ] **Package VibeCode AI Assistant** using vsce
- [ ] **Update settings.json** with warning bypass configuration
- [ ] **Test extension auto-activation** in code-server environment

### **Configuration Updates (Week 2)**

- [ ] **Update Kubernetes ConfigMaps** with enhanced settings
- [ ] **Modify Helm charts** to include extension configuration
- [ ] **Add startup script** for extension verification
- [ ] **Environment variable** setup for AI API keys

### **Testing & Validation (Week 3)**

- [ ] **Deploy test environment** with new configuration
- [ ] **Verify extension auto-installation** works
- [ ] **Test warning-free startup** experience
- [ ] **Validate AI assistant** functionality

### **Production Deployment (Week 4)**

- [ ] **Build enhanced Docker image** with extensions
- [ ] **Update production Helm charts** 
- [ ] **Deploy to staging** environment
- [ ] **Roll out to production** with monitoring

## 🚀 Expected User Experience

### **Before Enhancement:**
```
User opens workspace → VS Code loads → Extension warnings → Manual setup → Configure AI → Start coding
```

### **After Enhancement:**
```
User opens workspace → VS Code loads → Extensions ready → AI assistant active → Start coding immediately
```

### **Key Improvements:**

1. **Zero Setup Required** - Extensions pre-installed and configured
2. **No Security Warnings** - Workspace trust disabled, warnings bypassed  
3. **AI Ready** - VibeCode AI Assistant active on startup
4. **Optimized Performance** - Telemetry disabled, unnecessary features turned off
5. **Developer Focused** - Only essential tools and features enabled

---

**Result:** VibeCode users get a completely ready-to-code environment with AI assistance enabled from the first second, no setup required! 🎯 