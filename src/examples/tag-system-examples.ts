/**
 * TAG System Usage Examples
 * 
 * This file demonstrates how to use the Tool-Augmented Generation (TAG) system
 * for intelligent tool orchestration and AI-powered task execution.
 */

import { 
  ToolRegistry,
  ToolOrchestrator,
  createToolOrchestrator,
  ToolExecutionContext
} from '../lib/agent-framework';

import {
  enhancedCodeExecutionTool,
  searchDocsTool,
  performanceProfilerTool,
  securityScannerTool
} from '../lib/agent-framework/tools/tag-tools';

// Create and configure the TAG system
function setupTAGSystem(): ToolOrchestrator {
  // Create tool registry
  const registry = new ToolRegistry();
  
  // Register TAG tools
  registry.registerTool(enhancedCodeExecutionTool);
  registry.registerTool(searchDocsTool);
  registry.registerTool(performanceProfilerTool);
  registry.registerTool(securityScannerTool);
  
  // Create orchestrator
  const orchestrator = createToolOrchestrator(registry);
  
  // Set up event listeners for monitoring
  orchestrator.on('intentsClassified', ({ input, intents }) => {
    console.log(`Classified intents for "${input}":`, intents);
  });
  
  orchestrator.on('planCreated', ({ plan }) => {
    console.log(`Created execution plan with ${plan.steps.length} steps`);
  });
  
  orchestrator.on('stepStarted', ({ step }) => {
    console.log(`Starting step: ${step.toolName}`);
  });
  
  orchestrator.on('stepCompleted', ({ step, result }) => {
    console.log(`Completed step: ${step.toolName} in ${result.duration}ms`);
  });
  
  orchestrator.on('taskCompleted', (result) => {
    console.log(`Task completed: ${result.summary}`);
  });
  
  return orchestrator;
}

// Example: Security scanning
async function exampleSecurityScanning() {
  console.log('=== Security Scanning Example ===');
  
  const orchestrator = setupTAGSystem();
  
  const context: ToolExecutionContext = {
    agentId: 'security-assistant',
    taskContext: {
      type: `
        const mysql = require('mysql');
        
        function loginUser(username, password) {
          const query = "SELECT * FROM users WHERE username = '" + username + 
                       "' AND password = '" + password + "'";
          return db.query(query);
        }
        
        app.get('/search', (req, res) => {
          const userInput = req.query.q;
          res.send('<div>' + userInput + '</div>');
        });
      `,
      priority: 'high',
      timeout: 45000,
    },
    resources: {
      cpu: 50,
      memory: 512,
      networkAccess: false,
    },
  };
  
  try {
    const result = await orchestrator.executeTask(
      'Check this code for security vulnerabilities',
      context
    );
    
    console.log('Security Scan Results:');
    result.results.forEach((stepResult) => {
      if (stepResult.toolName === 'check_security' && stepResult.result) {
        const securityResult = stepResult.result;
        console.log(`  Overall Risk: ${securityResult.overallRisk}`);
        console.log(`  Issues Found: ${securityResult.summary?.total || 0}`);
        
        if (securityResult.issues) {
          securityResult.issues.forEach((issue: any, index: number) => {
            console.log(`    Issue ${index + 1}: ${issue.type} (${issue.severity})`);
            console.log(`      ${issue.description}`);
          });
        }
      }
    });
  } catch (error) {
    console.error('Security scanning failed:', error);
  }
}

// Export for use in other files
export {
  setupTAGSystem,
  exampleSecurityScanning,
};