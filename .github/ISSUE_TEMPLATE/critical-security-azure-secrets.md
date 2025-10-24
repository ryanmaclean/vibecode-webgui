---
name: Critical Security Issue - Azure Secrets
about: CRITICAL security vulnerability - plaintext API keys in .env.azure
title: "🔒 CRITICAL: Migrate Azure secrets to Keychain (#530)"
labels: ["security", "critical", "secrets", "azure", "keychain"]
assignees: []
---

## 🚨 **CRITICAL SECURITY VULNERABILITY**

**Source**: Codex Salvage Branch Issue #530  
**Priority**: CRITICAL (Security Risk)  
**Status**: ❌ **IMMEDIATE ACTION REQUIRED**

### **Problem**
- **Plaintext API keys** stored in `.env.azure` file
- **Security risk**: API keys exposed in version control
- **Compliance**: Violates security best practices
- **Impact**: Potential unauthorized access to Azure resources

### **Current State**
- **47 critical files** requiring `loadSecret()` updates
- **Plaintext credentials** in `k8s/vibecode-secrets.yaml` and `k8s/oauth-secrets.yaml`
- **No pre-commit hooks** for secret protection

### **✅ SOLUTION IMPLEMENTED** (from Codex Salvage)
- ✅ **Security warnings added** to existing secret files
- ✅ **Comprehensive guide created** - `k8s/SECRETS-SETUP.md`
- ✅ **Template files created** in `k8s/templates/` for production deployment
- ✅ **Pre-commit hook script** - `npm run security:install-hook`

### **Tasks**
- [ ] **Migrate `.env.azure`** - Move plaintext API keys to Keychain
- [ ] **Install pre-commit hooks** - Run `npm run security:install-hook`
- [ ] **Update 47 files** - Replace hardcoded secrets with `loadSecret()` calls
- [ ] **Replace placeholder credentials** in Kubernetes secret files
- [ ] **Verify secret protection** - Ensure no secrets in version control
- [ ] **Team training** - Educate team on secret management

### **Implementation Steps**
1. **Install Keychain integration**:
   ```bash
   npm run security:install-hook
   ```

2. **Migrate Azure secrets**:
   ```bash
   # Move .env.azure to Keychain
   # Update all references to use loadSecret()
   ```

3. **Update Kubernetes secrets**:
   ```bash
   # Replace placeholders in k8s/vibecode-secrets.yaml
   # Replace placeholders in k8s/oauth-secrets.yaml
   ```

4. **Verify security**:
   ```bash
   # Run security audit
   npm audit
   # Check for secrets in git history
   git log --all --full-history -- .env*
   ```

### **Files to Update**
- [ ] `.env.azure` - Migrate to Keychain
- [ ] `k8s/vibecode-secrets.yaml` - Replace placeholders
- [ ] `k8s/oauth-secrets.yaml` - Replace placeholders
- [ ] All 47 files with hardcoded secrets
- [ ] Pre-commit hook configuration

### **Acceptance Criteria**
- [ ] No plaintext secrets in version control
- [ ] All secrets migrated to Keychain
- [ ] Pre-commit hooks installed and working
- [ ] Security audit passes
- [ ] Team trained on secret management
- [ ] Documentation updated

### **Security Impact**
- **Before**: Plaintext API keys exposed
- **After**: Secure secret management with Keychain
- **Risk Reduction**: Eliminates unauthorized access risk
- **Compliance**: Meets security best practices

---

**Related**: Codex Salvage Branch Issue #530, GitHub Actions cost optimization
