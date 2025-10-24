---
name: High-Value Test Conversion
about: Convert mocked tests to real integration tests for better validation
title: "🧪 Convert High-Value Tests to Real Integration Tests"
labels: ["testing", "integration", "monitoring", "collaboration", "priority-medium"]
assignees: []
---

## 🧪 **High-Value Test Conversion**

**Source**: Codex Salvage Branch TODO.md  
**Priority**: Medium (Test Quality)  
**Status**: ✅ **Perfect Candidates Identified**

### **Problem**
- **Heavy mocking** in critical tests reduces validation value
- **Mock contamination** affecting test reliability
- **Limited real integration testing** for core features

### **✅ SOLUTION IDENTIFIED** (from Codex Salvage)
- ✅ **Real testing pattern established** - `jest.restoreAllMocks()` + real fetch
- ✅ **Mock contamination fixed** - Resolved global jest.setup.js issues
- ✅ **Perfect candidates identified** - High-value conversion targets

### **🎯 HIGH-VALUE CONVERSION CANDIDATES**

#### **1. `monitoring-api.test.ts` - ⭐ PERFECT CANDIDATE**
- **Status**: ✅ **REAL VERSION CREATED**
- **Current**: Heavy mocking (NextAuth, server monitoring, metrics collection)
- **Real approach**: Test actual API endpoints with real system metrics
- **Value**: Real monitoring validation vs testing that mocks work
- **Impact**: Critical infrastructure monitoring validation

#### **2. `collaboration-integration.test.ts` - ⭐ HIGH VALUE**
- **Status**: ⏳ **READY FOR CONVERSION**
- **Current**: Mocked WebSocket, IndexedDB, collaboration managers
- **Real approach**: Test actual collaboration features
- **Value**: Real collaboration validation
- **Impact**: Core collaboration functionality testing

### **Real Testing Pattern Established**
```typescript
// Before: Heavy mocking
jest.mock('@/lib/monitoring', () => ({
  monitoring: {
    recordMetric: jest.fn(),
    recordTrace: jest.fn(),
    // ... 16 jest.fn mocks
  }
}));

// After: Real integration testing
beforeEach(() => {
  jest.restoreAllMocks(); // Clean up global mocks
});

test('real monitoring integration', async () => {
  const response = await fetch('/api/monitoring/metrics');
  expect(response.status).toBe(200);
  // Test actual metrics collection
});
```

### **Tasks**
- [ ] **Convert monitoring-api.test.ts** - Implement real API endpoint testing
- [ ] **Convert collaboration-integration.test.ts** - Implement real collaboration testing
- [ ] **Apply real testing pattern** - Use `jest.restoreAllMocks()` + real fetch
- [ ] **Validate real integration** - Ensure actual service testing
- [ ] **Update test documentation** - Document real testing approach
- [ ] **Train team on pattern** - Establish real testing standards

### **Implementation Steps**
1. **Convert monitoring tests**:
   ```typescript
   // Remove heavy mocking
   // Implement real API calls
   // Test actual metrics collection
   ```

2. **Convert collaboration tests**:
   ```typescript
   // Remove WebSocket mocking
   // Implement real collaboration features
   // Test actual collaboration functionality
   ```

3. **Apply real testing pattern**:
   ```typescript
   beforeEach(() => {
     jest.restoreAllMocks();
   });
   
   test('real integration', async () => {
     const response = await fetch('/api/endpoint');
     // Test actual response
   });
   ```

### **Expected Results**
- **Real Monitoring Validation**: Actual metrics collection testing
- **Real Collaboration Testing**: Actual collaboration feature testing
- **Improved Test Reliability**: No mock contamination
- **Better Integration Coverage**: Real service testing
- **Higher Test Value**: Testing actual functionality vs mocks

### **Files to Convert**
- [ ] `tests/integration/monitoring-api.test.ts` - Convert to real testing
- [ ] `tests/integration/collaboration-integration.test.ts` - Convert to real testing
- [ ] Test utilities for real integration patterns
- [ ] Documentation for real testing approach

### **Acceptance Criteria**
- [ ] Monitoring tests use real API endpoints
- [ ] Collaboration tests use real collaboration features
- [ ] No heavy mocking in converted tests
- [ ] Real integration validation working
- [ ] Test reliability improved
- [ ] Documentation updated

### **Benefits**
- **Higher Test Value**: Testing actual functionality
- **Better Reliability**: No mock contamination
- **Real Integration**: Actual service testing
- **Improved Coverage**: Real feature validation
- **Team Learning**: Real testing pattern established

---

**Related**: Codex Salvage Branch TODO.md, CI pipeline failures fix
