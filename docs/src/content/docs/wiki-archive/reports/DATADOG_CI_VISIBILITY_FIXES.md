---
title: Datadog Ci Visibility Fixes
description: Auto-generated placeholder. Update as needed.
---

# 🔧 **Datadog CI Visibility Fixes - Based on Official Troubleshooting Guide**

## 📚 **Reference Documentation**
Based on the [Datadog CI Visibility Troubleshooting Guide](https://docs.datadoghq.com/tests/troubleshooting/#data-appears-in-test-runs-but-not-tests), we've identified and fixed several common issues that prevent test data from appearing properly in Datadog.

## 🎯 **Issues Identified & Fixed**

### 1. **Test Session Fingerprint Instability**
**Problem**: The documentation states that if test commands contain non-deterministic strings (like temporary folders), Datadog considers sessions unrelated, causing test data to appear in "test runs" but not in "tests".

**Solution**: Added `DD_TEST_SESSION_NAME` environment variable to stabilize test session fingerprints:
```javascript
DD_TEST_SESSION_NAME: `root-tests-${category}`
```

This ensures consistent session identification across test runs.

### 2. **Missing Git Metadata**
**Problem**: The documentation explains that if no CI provider environment variables are found, test results are sent with no Git metadata, which can cause issues with test tracking and organization.

**Solution**: Added comprehensive Git metadata environment variables to our CI pipeline:
```yaml
# Git metadata for Datadog CI Visibility
DD_GIT_COMMIT_SHA: ${{ github.sha }}
DD_GIT_REPOSITORY_URL: ${{ github.server_url }}/${{ github.repository }}
DD_GIT_BRANCH: ${{ github.ref_name }}
DD_GIT_COMMIT_MESSAGE: ${{ github.event.head_commit.message }}
DD_GIT_COMMIT_AUTHOR_NAME: ${{ github.event.head_commit.author.name }}
DD_GIT_COMMIT_AUTHOR_EMAIL: ${{ github.event.head_commit.author.email }}
DD_GIT_COMMIT_AUTHOR_DATE: ${{ github.event.head_commit.timestamp }}
DD_GIT_COMMIT_COMMITTER_NAME: ${{ github.event.head_commit.committer.name }}
DD_GIT_COMMIT_COMMITTER_EMAIL: ${{ github.event.head_commit.committer.email }}
DD_GIT_COMMIT_COMMITTER_DATE: ${{ github.event.head_commit.timestamp }}
```

### 3. **Test Status Aggregation Issues**
**Problem**: The documentation explains that if the same test is collected several times with different statuses, Datadog follows a specific aggregation algorithm. Our tests might be running multiple times and getting different results.

**Solution**: Enhanced test result metadata with better identification:
```javascript
const testResult = {
  service: DD_SERVICE,
  env: DD_ENV,
  version: DD_VERSION,
  test_name: testName,
  test_category: category,
  test_suite: `root-tests-${category}`,        // NEW
  test_session_name: `root-tests-${category}`, // NEW
  status: success ? 'pass' : 'fail',
  duration_ms: duration,
  timestamp: new Date().toISOString(),
  tags: [
    `test.name:${testName}`,
    `test.category:${category}`,
    `test.suite:root-tests-${category}`,       // NEW
    `test.session:root-tests-${category}`,     // NEW
    `test.status:${success ? 'pass' : 'fail'}`,
    `service:${DD_SERVICE}`,
    `env:${DD_ENV}`,
    `version:${DD_VERSION}`
  ]
};
```

## 🔍 **Additional Considerations from Documentation**

### **Test Status Aggregation Algorithm**
According to the documentation, Datadog follows this algorithm for test status aggregation:

| **Test Status - First Try** | **Test Status - Retry #1** | **Result** |
| --------------------------- | -------------------------- | ---------- |
| Passed                      | Passed                     | Passed     |
| Passed                      | Failed                     | Passed     |
| Passed                      | Skipped                    | Passed     |
| Failed                      | Passed                     | Passed     |
| Failed                      | Failed                     | Failed     |
| Failed                      | Skipped                    | Failed     |
| Skipped                     | Passed                     | Passed     |
| Skipped                     | Failed                     | Failed     |
| Skipped                     | Skipped                    | Skipped    |

This means our tests should show as "Passed" even if they fail on retry, which is good for our current setup.

### **Default Branch Configuration**
The documentation mentions that the default branch is used to power features like:
- Default branches list on the Tests page
- New flaky tests detection
- Pipelines list

Our CI pipeline should now properly set the default branch with the Git metadata.

## 🚀 **Expected Results**

With these fixes, our Datadog CI Visibility should now:

1. **✅ Stable Test Sessions**: Tests will be properly grouped and tracked across runs
2. **✅ Complete Git Metadata**: Full commit and repository information available
3. **✅ Proper Test Identification**: Tests will appear in both "test runs" and "tests" sections
4. **✅ Consistent Aggregation**: Test statuses will be properly aggregated according to Datadog's algorithm
5. **✅ Better Organization**: Tests will be properly categorized and searchable

## 📊 **Monitoring Integration**

Our enhanced Datadog integration now includes:

- **Test Session Tracking**: Consistent session fingerprints
- **Git Integration**: Complete commit and repository metadata
- **Enhanced Tagging**: Better test categorization and filtering
- **CI Visibility**: Full integration with GitHub Actions
- **Test Optimization**: Ready for flaky test detection and test impact analysis

## 🎯 **Next Steps**

1. **Monitor Datadog Dashboard**: Check if test data now appears properly in both "test runs" and "tests"
2. **Verify Git Metadata**: Ensure commit information is properly displayed
3. **Check Test Sessions**: Verify that test sessions are stable across runs
4. **Test Flaky Detection**: Monitor for any flaky test detection
5. **Performance Tracking**: Check if test duration and performance metrics are accurate

## 🔗 **References**

- [Datadog CI Visibility Troubleshooting Guide](https://docs.datadoghq.com/tests/troubleshooting/#data-appears-in-test-runs-but-not-tests)
- [Datadog CI Visibility Documentation](https://docs.datadoghq.com/ci/)
- [Test Optimization Features](https://docs.datadoghq.com/ci/test-optimization/)

The fixes we've implemented address the most common issues mentioned in the official Datadog troubleshooting documentation, ensuring our test data appears correctly in Datadog CI Visibility.
