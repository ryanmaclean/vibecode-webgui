#!/usr/bin/env node
/**
 * Manual verification script for production operations triggering approval workflow
 * Set NODE_ENV=production and attempt various agent operations to verify HITL approval dialog appears
 */

const {
  checkFileOperation,
  checkDatabaseOperation,
  checkDeploymentOperation,
  checkSystemConfigOperation,
  initializeEnvironmentGuard,
  setHITLManager,
} = require('../src/lib/middleware/environment-guard.ts');

const { getEnvironmentContext } = require('../src/lib/env-validation.ts');

// Mock HITL Manager for demonstration
class MockHITLManager {
  constructor() {
    this.requests = [];
  }

  createRequest(request) {
    const approvalRequest = {
      id: `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...request,
      status: 'pending',
      createdAt: new Date(),
    };
    this.requests.push(approvalRequest);

    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│                    🔔 APPROVAL REQUEST CREATED                  │');
    console.log('└─────────────────────────────────────────────────────────────────┘');
    console.log(`\nID: ${approvalRequest.id}`);
    console.log(`Type: ${approvalRequest.type}`);
    console.log(`Title: ${approvalRequest.title}`);
    console.log(`Priority: ${approvalRequest.priority}`);
    console.log(`\nDescription:\n${approvalRequest.description}`);
    console.log(`\nRequired Approvers: ${approvalRequest.requiredApprovers.join(', ')}`);
    console.log(`Expires In: ${approvalRequest.expiresInMinutes} minutes`);

    return approvalRequest;
  }

  approveRequest(id) {
    const request = this.requests.find(r => r.id === id);
    if (request) {
      request.status = 'approved';
    }
    return request;
  }

  rejectRequest(id) {
    const request = this.requests.find(r => r.id === id);
    if (request) {
      request.status = 'rejected';
    }
    return request;
  }

  cancelRequest(id) {
    const request = this.requests.find(r => r.id === id);
    if (request) {
      request.status = 'cancelled';
    }
    return request;
  }

  getRequest(id) {
    return this.requests.find(r => r.id === id);
  }

  listRequests() {
    return [...this.requests];
  }

  waitForApproval(id) {
    return Promise.resolve(this.getRequest(id));
  }

  on() {}
  off() {}
}

// Helper to display environment info
function displayEnvironmentInfo() {
  const envContext = getEnvironmentContext();

  console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║              CURRENT ENVIRONMENT CONFIGURATION                    ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');

  if (envContext) {
    console.log(`\nEnvironment: ${envContext.current.environment.toUpperCase()}`);
    console.log(`Confidence: ${envContext.current.confidence}`);
    console.log(`Is Production: ${envContext.isProduction ? 'YES' : 'NO'}`);
    console.log(`Is Development: ${envContext.isDevelopment ? 'YES' : 'NO'}`);
    console.log(`Is Staging: ${envContext.isStaging ? 'YES' : 'NO'}`);
    console.log(`Safety Enabled: ${envContext.safetyEnabled ? 'YES' : 'NO'}`);

    if (envContext.current.signals && envContext.current.signals.length > 0) {
      console.log('\nDetection Signals:');
      envContext.current.signals.forEach((signal, idx) => {
        console.log(`  ${idx + 1}. ${signal.source}: ${signal.value} → ${signal.indicates}`);
      });
    }

    if (envContext.current.warnings && envContext.current.warnings.length > 0) {
      console.log('\nWarnings:');
      envContext.current.warnings.forEach(w => console.log(`  ⚠️  ${w}`));
    }
  } else {
    console.log('\n⚠️  Could not detect environment context');
  }
}

// Helper to display operation result
function displayOperationResult(operation, result) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`OPERATION: ${operation}`);
  console.log(`${'═'.repeat(70)}`);
  console.log(`Environment: ${result.environment}`);
  console.log(`Allowed: ${result.allowed ? '✅ YES' : '❌ NO'}`);
  console.log(`Requires Approval: ${result.requiresApproval ? '⏸️  YES' : 'NO'}`);
  console.log(`Reason: ${result.reason}`);

  if (result.permissionCheck) {
    console.log(`\nPermission Check:`);
    console.log(`  Decision: ${result.permissionCheck.decision}`);
    if (result.permissionCheck.appliedRule) {
      console.log(`  Applied Rule: ${result.permissionCheck.appliedRule.action} → ${result.permissionCheck.appliedRule.decision}`);
    }
    if (result.permissionCheck.requiredApprovers) {
      console.log(`  Required Approvers: ${result.permissionCheck.requiredApprovers.join(', ')}`);
    }
  }

  if (result.approvalRequest) {
    console.log(`\nApproval Request: ${result.approvalRequest.id}`);
  }

  console.log(`\nChecked At: ${result.checkedAt.toISOString()}`);
}

// Test scenarios
async function runTests() {
  console.log('\n');
  console.log('╔' + '═'.repeat(68) + '╗');
  console.log('║' + ' '.repeat(10) + 'PRODUCTION APPROVAL WORKFLOW VERIFICATION' + ' '.repeat(15) + '║');
  console.log('╚' + '═'.repeat(68) + '╝');

  // Display current environment
  displayEnvironmentInfo();

  // Create mock HITL manager
  const hitlManager = new MockHITLManager();

  // Initialize environment guard
  console.log('\n\nInitializing environment guard with mock HITL manager...');
  initializeEnvironmentGuard({
    enabled: true,
    bypassInTest: false,
    logChecks: true,
    hitlManager,
  });

  console.log('✅ Environment guard initialized\n');

  // Test scenarios
  const scenarios = [
    {
      name: 'File Write Operation (medium risk)',
      test: () => checkFileOperation('write', '/app/config/production.json', 'medium', 'config-updater'),
    },
    {
      name: 'File Delete Operation (high risk)',
      test: () => checkFileOperation('delete', '/app/data/user_data.db', 'high', 'cleanup-agent'),
    },
    {
      name: 'File Read Operation (low risk)',
      test: () => checkFileOperation('read', '/app/logs/access.log', 'low', 'log-analyzer'),
    },
    {
      name: 'Database Write Operation',
      test: () => checkDatabaseOperation('write', 'Update user records in production', ['users', 'profiles'], 'high', 'db-migrator'),
    },
    {
      name: 'Database Read Operation',
      test: () => checkDatabaseOperation('read', 'Query user analytics', ['users', 'sessions'], 'medium', 'analytics-agent'),
    },
    {
      name: 'Deployment Operation (critical risk)',
      test: () => checkDeploymentOperation('Deploy v2.0 to production', ['api', 'frontend', 'workers'], 'critical', 'deployment-bot'),
    },
    {
      name: 'System Configuration Change',
      test: () => checkSystemConfigOperation('Update nginx SSL certificates', ['nginx.conf', 'ssl/'], 'high', 'config-manager'),
    },
  ];

  let approved = 0;
  let denied = 0;
  let requiresApproval = 0;

  for (const scenario of scenarios) {
    try {
      const result = await scenario.test();
      displayOperationResult(scenario.name, result);

      if (result.allowed) {
        approved++;
      } else if (result.requiresApproval) {
        requiresApproval++;
      } else {
        denied++;
      }
    } catch (error) {
      console.log(`\n❌ ERROR running test: ${scenario.name}`);
      console.log(`   ${error.message}`);
    }
  }

  // Summary
  console.log('\n\n');
  console.log('╔' + '═'.repeat(68) + '╗');
  console.log('║' + ' '.repeat(28) + 'TEST SUMMARY' + ' '.repeat(28) + '║');
  console.log('╚' + '═'.repeat(68) + '╝');
  console.log(`\nTotal operations tested: ${scenarios.length}`);
  console.log(`✅ Allowed: ${approved}`);
  console.log(`⏸️  Requires Approval: ${requiresApproval}`);
  console.log(`❌ Denied: ${denied}`);
  console.log(`\nTotal approval requests created: ${hitlManager.requests.length}`);

  if (hitlManager.requests.length > 0) {
    console.log('\nApproval Requests:');
    hitlManager.requests.forEach((req, idx) => {
      console.log(`  ${idx + 1}. [${req.priority.toUpperCase()}] ${req.title} (${req.id})`);
    });
  }

  // Expected behavior message
  console.log('\n');
  console.log('╔' + '═'.repeat(68) + '╗');
  console.log('║' + ' '.repeat(22) + 'EXPECTED BEHAVIOR' + ' '.repeat(23) + '║');
  console.log('╚' + '═'.repeat(68) + '╝');
  console.log('\nIn PRODUCTION environment:');
  console.log('  ✅ Read operations should be ALLOWED');
  console.log('  ⏸️  Write operations should REQUIRE APPROVAL');
  console.log('  ⏸️  Delete operations should REQUIRE APPROVAL');
  console.log('  ⏸️  Database write operations should REQUIRE APPROVAL');
  console.log('  ⏸️  Deployment operations should REQUIRE APPROVAL');
  console.log('  ⏸️  System config changes should REQUIRE APPROVAL');

  console.log('\nIn DEVELOPMENT environment:');
  console.log('  ✅ Most operations should be ALLOWED');
  console.log('  ❌ Deployment operations should be DENIED');

  console.log('\nIn STAGING environment:');
  console.log('  ✅ Read operations should be ALLOWED');
  console.log('  ⏸️  Write operations (medium+ risk) should REQUIRE APPROVAL');
  console.log('  ⏸️  Database write operations should REQUIRE APPROVAL');

  console.log('\n');
}

// Run tests
runTests().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
