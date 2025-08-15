import { test, expect } from '@playwright/test';

test.describe('AI Project Generation E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the AI project generator page
    await page.goto('/ai-project-generator');
    await page.waitForLoadState('networkidle');
  });

  test('should display AI project generation interface', async ({ page }) => {
    // Check that the main interface is visible
    await expect(page.locator('h1')).toContainText(/AI Project Generator|Generate Project/i);
    
    // Check for input field
    await expect(page.locator('input[placeholder*="description"], textarea[placeholder*="description"]')).toBeVisible();
    
    // Check for generate button
    await expect(page.locator('button:has-text("Generate"), button:has-text("Create")')).toBeVisible();
  });

  test('should generate project from natural language description', async ({ page }) => {
    // Fill in project description
    const descriptionInput = page.locator('input[placeholder*="description"], textarea[placeholder*="description"]');
    await descriptionInput.fill('A modern React dashboard with dark mode, charts, and responsive design');
    
    // Click generate button
    const generateButton = page.locator('button:has-text("Generate"), button:has-text("Create")');
    await generateButton.click();
    
    // Wait for generation to start
    await expect(page.locator('text=Generating, text=Creating, text=Building')).toBeVisible();
    
    // Wait for generation to complete (with timeout)
    await expect(page.locator('text=Project Generated, text=Success, text=Complete')).toBeVisible({ timeout: 30000 });
    
    // Check that project details are displayed
    await expect(page.locator('text=React Dashboard, text=Dashboard')).toBeVisible();
  });

  test('should handle project generation errors gracefully', async ({ page }) => {
    // Try to generate with empty description
    const generateButton = page.locator('button:has-text("Generate"), button:has-text("Create")');
    await generateButton.click();
    
    // Should show validation error
    await expect(page.locator('text=Please enter a description, text=Description is required')).toBeVisible();
  });

  test('should allow project customization after generation', async ({ page }) => {
    // Generate a basic project first
    const descriptionInput = page.locator('input[placeholder*="description"], textarea[placeholder*="description"]');
    await descriptionInput.fill('A simple todo app with React');
    
    const generateButton = page.locator('button:has-text("Generate"), button:has-text("Create")');
    await generateButton.click();
    
    // Wait for generation to complete
    await expect(page.locator('text=Project Generated, text=Success, text=Complete')).toBeVisible({ timeout: 30000 });
    
    // Check for customization options
    await expect(page.locator('text=Customize, text=Edit, text=Modify')).toBeVisible();
    
    // Test customization functionality
    const customizeButton = page.locator('button:has-text("Customize"), button:has-text("Edit")');
    if (await customizeButton.isVisible()) {
      await customizeButton.click();
      
      // Should show customization interface
      await expect(page.locator('text=Customize Project, text=Edit Project')).toBeVisible();
    }
  });

  test('should save and load generated projects', async ({ page }) => {
    // Generate a project
    const descriptionInput = page.locator('input[placeholder*="description"], textarea[placeholder*="description"]');
    await descriptionInput.fill('A weather app with location services');
    
    const generateButton = page.locator('button:has-text("Generate"), button:has-text("Create")');
    await generateButton.click();
    
    // Wait for generation to complete
    await expect(page.locator('text=Project Generated, text=Success, text=Complete')).toBeVisible({ timeout: 30000 });
    
    // Save the project
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Save Project")');
    if (await saveButton.isVisible()) {
      await saveButton.click();
      
      // Should show save success message
      await expect(page.locator('text=Project Saved, text=Saved Successfully')).toBeVisible();
    }
    
    // Navigate to projects list
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    
    // Check that the generated project appears in the list
    await expect(page.locator('text=Weather App, text=weather app')).toBeVisible();
  });

  test('should support multiple AI models for generation', async ({ page }) => {
    // Look for model selection dropdown
    const modelSelector = page.locator('select[name="model"], [data-testid="model-selector"]');
    
    if (await modelSelector.isVisible()) {
      // Check available models
      await modelSelector.click();
      
      // Should show multiple model options
      await expect(page.locator('option[value="gpt-4"], option[value="claude-3"]')).toBeVisible();
      
      // Select a different model
      await modelSelector.selectOption('gpt-4');
      
      // Generate project with selected model
      const descriptionInput = page.locator('input[placeholder*="description"], textarea[placeholder*="description"]');
      await descriptionInput.fill('A Python API with FastAPI and PostgreSQL');
      
      const generateButton = page.locator('button:has-text("Generate"), button:has-text("Create")');
      await generateButton.click();
      
      // Wait for generation to complete
      await expect(page.locator('text=Project Generated, text=Success, text=Complete')).toBeVisible({ timeout: 30000 });
    } else {
      // Skip test if model selection is not available
      test.skip();
    }
  });

  test('should provide project templates and examples', async ({ page }) => {
    // Look for templates or examples section
    const templatesSection = page.locator('text=Templates, text=Examples, text=Sample Projects');
    
    if (await templatesSection.isVisible()) {
      // Click on templates
      await templatesSection.click();
      
      // Should show template options
      await expect(page.locator('text=React Dashboard, text=API Service, text=Mobile App')).toBeVisible();
      
      // Select a template
      const templateOption = page.locator('text=React Dashboard').first();
      await templateOption.click();
      
      // Should populate the description field
      const descriptionInput = page.locator('input[placeholder*="description"], textarea[placeholder*="description"]');
      await expect(descriptionInput).toHaveValue(/React.*dashboard/i);
      
      // Generate from template
      const generateButton = page.locator('button:has-text("Generate"), button:has-text("Create")');
      await generateButton.click();
      
      // Wait for generation to complete
      await expect(page.locator('text=Project Generated, text=Success, text=Complete')).toBeVisible({ timeout: 30000 });
    } else {
      // Skip test if templates are not available
      test.skip();
    }
  });

  test('should handle concurrent project generation', async ({ page }) => {
    // Start first generation
    const descriptionInput1 = page.locator('input[placeholder*="description"], textarea[placeholder*="description"]');
    await descriptionInput1.fill('A Node.js backend service');
    
    const generateButton1 = page.locator('button:has-text("Generate"), button:has-text("Create")');
    await generateButton1.click();
    
    // Wait for first generation to start
    await expect(page.locator('text=Generating, text=Creating, text=Building')).toBeVisible();
    
    // Try to start second generation (should be blocked or queued)
    const descriptionInput2 = page.locator('input[placeholder*="description"], textarea[placeholder*="description"]');
    await descriptionInput2.fill('A Vue.js frontend application');
    
    const generateButton2 = page.locator('button:has-text("Generate"), button:has-text("Create")');
    
    // Check if second generation is blocked
    if (await generateButton2.isDisabled()) {
      await expect(page.locator('text=Generation in progress, text=Please wait')).toBeVisible();
    } else {
      // If not blocked, start second generation
      await generateButton2.click();
      
      // Should show multiple generation indicators
      await expect(page.locator('text=Generating, text=Creating, text=Building')).toHaveCount(2);
    }
    
    // Wait for first generation to complete
    await expect(page.locator('text=Project Generated, text=Success, text=Complete')).toBeVisible({ timeout: 30000 });
  });
});

test.describe('AI Project Generation Performance Tests', () => {
  test('should generate project within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    // Navigate to AI project generator
    await page.goto('/ai-project-generator');
    await page.waitForLoadState('networkidle');
    
    // Fill description and generate
    const descriptionInput = page.locator('input[placeholder*="description"], textarea[placeholder*="description"]');
    await descriptionInput.fill('A simple calculator app');
    
    const generateButton = page.locator('button:has-text("Generate"), button:has-text("Create")');
    await generateButton.click();
    
    // Wait for completion
    await expect(page.locator('text=Project Generated, text=Success, text=Complete')).toBeVisible({ timeout: 30000 });
    
    const endTime = Date.now();
    const generationTime = endTime - startTime;
    
    // Should complete within 30 seconds
    expect(generationTime).toBeLessThan(30000);
    
    console.log(`🚀 Project generation completed in ${generationTime}ms`);
  });

  test('should handle large project descriptions efficiently', async ({ page }) => {
    // Create a very long description
    const longDescription = 'A comprehensive enterprise application with ' + 
      'microservices architecture, React frontend, Node.js backend, ' +
      'PostgreSQL database, Redis caching, Docker containerization, ' +
      'Kubernetes orchestration, CI/CD pipeline, monitoring, logging, ' +
      'authentication, authorization, API gateway, load balancing, ' +
      'auto-scaling, backup strategies, disaster recovery, security ' +
      'compliance, performance optimization, and comprehensive testing. ' +
      'The application should support multiple user roles, real-time ' +
      'collaboration, offline functionality, mobile responsiveness, ' +
      'accessibility compliance, internationalization, and analytics.';
    
    await page.goto('/ai-project-generator');
    await page.waitForLoadState('networkidle');
    
    const descriptionInput = page.locator('input[placeholder*="description"], textarea[placeholder*="description"]');
    await descriptionInput.fill(longDescription);
    
    const generateButton = page.locator('button:has-text("Generate"), button:has-text("Create")');
    await generateButton.click();
    
    // Should handle long descriptions without crashing
    await expect(page.locator('text=Generating, text=Creating, text=Building')).toBeVisible();
    
    // Wait for completion (may take longer for complex projects)
    await expect(page.locator('text=Project Generated, text=Success, text=Complete')).toBeVisible({ timeout: 60000 });
  });
});
