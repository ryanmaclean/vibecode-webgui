---
title: CI/CD Pipeline Fix Guide
description: Comprehensive guide for fixing CI/CD pipeline issues
---

# 🔧 CI/CD Pipeline Fix Guide

## 🎯 **Root Cause: Missing Git Metadata for Datadog Test Visibility**

The CI/CD pipelines are failing to show test results in Datadog because Git metadata is missing from test runs. This prevents tests from appearing in the "Tests" tab in Datadog.

## 🔍 **Problem Analysis**

### **Symptoms:**
- ✅ Test runs appear in "Test Runs" tab
- ❌ No data appears in "Tests" tab
- ❌ Missing `git.repository_url`, `git.commit.sha`, `git.branch` in test execution metadata

### **Root Causes:**
1. **Missing Git Environment Variables**: Required Datadog Git metadata not set
2. **CI Provider Detection Failure**: GitHub Actions environment not properly detected
3. **Missing .git Folder Access**: Git commands not available during test execution

## ✅ **Solutions Implemented**

### 1. **Added Git Metadata to CI Pipeline**

Updated `.github/workflows/ci.yml` and `.github/workflows/working-ci.yml` with:

```yaml
env:
  # Git metadata for Datadog Test Visibility
  DD_GIT_REPOSITORY_URL: ${{ github.server_url }}/${{ github.repository }}
  DD_GIT_COMMIT_SHA: ${{ github.sha }}
  DD_GIT_BRANCH: ${{ github.ref_name }}
  DD_API_KEY: ${{ secrets.DD_API_KEY }}
  DD_APP_KEY: ${{ secrets.DD_APP_KEY }}
```

### 2. **Enhanced Environment Setup**

Added comprehensive Git metadata collection:

```yaml
- name: Setup test environment
  run: |
    # Add Git metadata for Datadog Test Visibility
    echo "DD_GIT_REPOSITORY_URL=${{ github.server_url }}/${{ github.repository }}" >> .env.local
    echo "DD_GIT_COMMIT_SHA=${{ github.sha }}" >> .env.local
    echo "DD_GIT_BRANCH=${{ github.ref_name }}" >> .env.local
    echo "DD_GIT_COMMIT_MESSAGE=$(git log -1 --pretty=%B)" >> .env.local
    echo "DD_GIT_COMMIT_AUTHOR_NAME=$(git log -1 --pretty=%an)" >> .env.local
    echo "DD_GIT_COMMIT_AUTHOR_EMAIL=$(git log -1 --pretty=%ae)" >> .env.local
    echo "DD_GIT_COMMIT_AUTHOR_DATE=$(git log -1 --pretty=%aI)" >> .env.local
    echo "DD_GIT_COMMIT_COMMITTER_NAME=$(git log -1 --pretty=%cn)" >> .env.local
    echo "DD_GIT_COMMIT_COMMITTER_EMAIL=$(git log -1 --pretty=%ce)" >> .env.local
    echo "DD_GIT_COMMIT_COMMITTER_DATE=$(git log -1 --pretty=%cI)" >> .env.local
```

### 3. **Required Environment Variables**

| Variable | Source | Description |
|----------|--------|-------------|
| `DD_GIT_REPOSITORY_URL` | `${{ github.server_url }}/${{ github.repository }}` | Repository URL |
| `DD_GIT_COMMIT_SHA` | `${{ github.sha }}` | Full commit hash |
| `DD_GIT_BRANCH` | `${{ github.ref_name }}` | Branch name |
| `DD_GIT_COMMIT_MESSAGE` | `$(git log -1 --pretty=%B)` | Commit message |
| `DD_GIT_COMMIT_AUTHOR_NAME` | `$(git log -1 --pretty=%an)` | Author name |
| `DD_GIT_COMMIT_AUTHOR_EMAIL` | `$(git log -1 --pretty=%ae)` | Author email |

## 🚀 **Next Steps**

### **Immediate Actions:**
1. **Test the Updated Pipeline**: Commit changes and trigger CI/CD
2. **Verify Datadog Integration**: Check that tests appear in both "Test Runs" and "Tests" tabs
3. **Monitor Pipeline Success**: Ensure Git metadata is properly collected

### **Pipeline Priorities:**
1. **Start with Simple Pipeline**: Use `working-ci.yml` for basic functionality
2. **Gradually Enable Features**: Add integration tests once basic pipeline works
3. **Fix One Issue at a Time**: Don't try to solve all 23 workflow problems simultaneously

### **Expected Results:**
- ✅ Tests appear in Datadog "Tests" tab
- ✅ Git metadata visible in test execution details
- ✅ Proper test result attribution to commits and branches
- ✅ Test trend analysis available in Datadog

## 🔧 **Troubleshooting**

### **If Tests Still Don't Appear:**

1. **Check Environment Variables**:
   ```bash
   # In CI, verify these are set:
   echo "DD_GIT_REPOSITORY_URL: $DD_GIT_REPOSITORY_URL"
   echo "DD_GIT_COMMIT_SHA: $DD_GIT_COMMIT_SHA"
   echo "DD_GIT_BRANCH: $DD_GIT_BRANCH"
   ```

2. **Verify Git Access**:
   ```bash
   # Ensure git commands work:
   git log -1 --pretty=%H
   git branch --show-current
   ```

3. **Check Datadog API Keys**:
   ```bash
   # Verify secrets are available (don't log actual values):
   [ -n "$DD_API_KEY" ] && echo "DD_API_KEY is set" || echo "DD_API_KEY is missing"
   [ -n "$DD_APP_KEY" ] && echo "DD_APP_KEY is set" || echo "DD_APP_KEY is missing"
   ```

### **Manual Override (if needed):**

If automatic detection fails, set manually:

```yaml
env:
  DD_GIT_REPOSITORY_URL: "https://github.com/ryanmaclean/vibecode-webgui"
  DD_GIT_COMMIT_SHA: "${{ github.sha }}"
  DD_GIT_BRANCH: "${{ github.ref_name }}"
```

## 📊 **Success Metrics**

### **Before Fix:**
- ❌ 100% pipeline failure rate
- ❌ No test visibility in Datadog
- ❌ Missing Git attribution

### **After Fix (Expected):**
- ✅ At least one working pipeline
- ✅ Tests visible in Datadog "Tests" tab
- ✅ Proper Git metadata attribution
- ✅ Test trend analysis available

---

**This fix addresses the fundamental issue preventing CI/CD test visibility in Datadog. Once implemented, we can focus on fixing individual test failures with proper tracking and attribution.**
