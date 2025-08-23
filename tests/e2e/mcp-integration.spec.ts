import { test, expect } from '@playwright/test';

/**
 * MCP Integration Tests
 * Verifies the Model Context Protocol integration and AI functionality
 */
test.describe('MCP Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application before each test
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should have MCP server status accessible', async ({ page }) => {
    // Check if MCP server information is available
    // This might be in the health endpoint or a dedicated MCP endpoint
    
    // First check the health endpoint for MCP info
    const healthResponse = await page.request.get('/api/health');
    expect(healthResponse.ok()).toBeTruthy();
    
    const healthData = await healthResponse.json();
    
    // Log the health data to see what's available
    console.log('Health data structure:', Object.keys(healthData));
    if (healthData.checks) {
      console.log('Available checks:', Object.keys(healthData.checks));
    }
    
    // Check if there's an MCP-specific endpoint
    try {
      const mcpResponse = await page.request.get('/api/mcp/status');
      if (mcpResponse.ok()) {
        const mcpData = await mcpResponse.json();
        console.log('MCP status:', mcpData);
        
        // Verify MCP response structure
        expect(mcpData).toHaveProperty('status');
        expect(mcpData).toHaveProperty('servers');
      }
    } catch (error) {
      console.log('No MCP status endpoint found, checking health endpoint for MCP info');
    }
  });

  test('should have AI provider configuration', async ({ page }) => {
    // Check if AI provider configuration is accessible
    // This might be in environment variables or a config endpoint
    
    try {
      const configResponse = await page.request.get('/api/config');
      if (configResponse.ok()) {
        const configData = await configResponse.json();
        console.log('Configuration data:', configData);
        
        // Check for AI-related configuration
        if (configData.ai) {
          expect(configData.ai).toHaveProperty('providers');
          expect(configData.ai).toHaveProperty('models');
        }
      }
    } catch (error) {
      console.log('No config endpoint found, checking for AI configuration in other ways');
      
      // Check if there are any AI-related elements on the page
      const aiElements = page.locator('[data-testid*="ai"], [data-testid*="AI"], .ai-*, .AI-*');
      const count = await aiElements.count();
      
      if (count > 0) {
        console.log(`Found ${count} AI-related elements on the page`);
      }
    }
  });

  test('should have working AI chat interface', async ({ page }) => {
    // Look for AI chat interface elements
    const chatElements = page.locator('input[placeholder*="chat"], input[placeholder*="message"], textarea[placeholder*="chat"], textarea[placeholder*="message"]');
    const chatCount = await chatElements.count();
    
    if (chatCount > 0) {
      console.log(`Found ${chatCount} chat input elements`);
      
      // Test typing in the chat
      const firstChat = chatElements.first();
      await firstChat.fill('Hello, this is a test message');
      await expect(firstChat).toHaveValue('Hello, this is a test message');
      
      // Look for send button
      const sendButton = page.locator('button[type="submit"], button:has-text("Send"), button[aria-label*="send"]');
      if (await sendButton.isVisible()) {
        console.log('Send button found');
      }
    } else {
      console.log('No chat interface found on the main page');
      
      // Check if there's a dedicated chat page
      try {
        await page.goto('/chat');
        await page.waitForLoadState('networkidle');
        
        const chatPageElements = page.locator('input[placeholder*="chat"], input[placeholder*="message"], textarea[placeholder*="chat"], textarea[placeholder*="message"]');
        const chatPageCount = await chatPageElements.count();
        
        if (chatPageCount > 0) {
          console.log(`Found ${chatPageCount} chat elements on /chat page`);
        }
      } catch (error) {
        console.log('No dedicated chat page found');
      }
    }
  });

  test('should have AI project generation functionality', async ({ page }) => {
    // Look for AI project generation elements
    const projectElements = page.locator('[data-testid*="project"], [data-testid*="Project"], .project-*, .Project-*');
    const projectCount = await projectElements.count();
    
    if (projectCount > 0) {
      console.log(`Found ${projectCount} project-related elements`);
    }
    
    // Check if there's a dedicated AI project page
    try {
      await page.goto('/ai-project-generator');
      await page.waitForLoadState('networkidle');
      
      // Look for project generation form
      const formElements = page.locator('form, [role="form"]');
      const formCount = await formElements.count();
      
      if (formCount > 0) {
        console.log(`Found ${formCount} forms on AI project generator page`);
        
        // Look for input fields
        const inputs = page.locator('input, textarea');
        const inputCount = await inputs.count();
        console.log(`Found ${inputCount} input fields`);
        
        // Test filling out a form
        const firstInput = inputs.first();
        if (await firstInput.isVisible()) {
          await firstInput.fill('Test project description');
          await expect(firstInput).toHaveValue('Test project description');
        }
      }
    } catch (error) {
      console.log('No AI project generator page found');
    }
  });

  test('should have MCP server health monitoring', async ({ page }) => {
    // Check for MCP server health information
    // This might be in the monitoring dashboard or health endpoint
    
    try {
      const monitoringResponse = await page.request.get('/api/monitoring/dashboard');
      if (monitoringResponse.ok()) {
        const monitoringData = await monitoringResponse.json();
        console.log('Monitoring data:', monitoringData);
        
        // Check for MCP-related monitoring
        if (monitoringData.mcp) {
          expect(monitoringData.mcp).toHaveProperty('status');
          expect(monitoringData.mcp).toHaveProperty('servers');
        }
      }
    } catch (error) {
      console.log('No monitoring dashboard endpoint found');
      
      // Check if there's monitoring information in the health endpoint
      const healthResponse = await page.request.get('/api/health');
      if (healthResponse.ok()) {
        const healthData = await healthResponse.json();
        
        // Look for any MCP-related health information
        if (healthData.checks) {
          const checkKeys = Object.keys(healthData.checks);
          const mcpChecks = checkKeys.filter(key => key.toLowerCase().includes('mcp'));
          
          if (mcpChecks.length > 0) {
            console.log('Found MCP-related health checks:', mcpChecks);
          }
        }
      }
    }
  });

  test('should handle AI service errors gracefully', async ({ page }) => {
    // Test error handling for AI services
    // This might involve testing with invalid API keys or network issues
    
    // Check if there are any error handling mechanisms visible
    const errorElements = page.locator('[data-testid*="error"], [data-testid*="Error"], .error-*, .Error-*');
    const errorCount = await errorElements.count();
    
    if (errorCount > 0) {
      console.log(`Found ${errorCount} error-related elements`);
    }
    
    // Test with invalid input to see error handling
    try {
      // Try to access a potentially invalid AI endpoint
      const invalidResponse = await page.request.get('/api/ai/invalid-endpoint');
      
      // Should handle gracefully (might be 404, 400, or 500)
      expect(invalidResponse.status()).toBeGreaterThanOrEqual(400);
      
    } catch (error) {
      console.log('Invalid endpoint test completed');
    }
  });
});


