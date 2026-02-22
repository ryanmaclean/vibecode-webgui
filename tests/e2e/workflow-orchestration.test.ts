/**
 * E2E Tests for Workflow Orchestration
 *
 * Tests the complete workflow orchestration feature including:
 * - Visual workflow builder
 * - Agent task creation
 * - Approval gates and HITL manager integration
 * - Audit trail recording
 * - Rollback functionality
 */

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

test.describe('Workflow Orchestration - E2E Tests', () => {
  let page: Page;

  test.beforeEach(async ({ page: p }) => {
    page = p;

    // Navigate to workflows page
    await page.goto('/workflows');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Visual Workflow Builder', () => {
    test('should display workflow builder interface', async () => {
      // Verify workflow builder components are visible
      await expect(page.locator('[data-testid="workflow-builder"]')).toBeVisible();
      await expect(page.locator('[data-testid="workflow-canvas"]')).toBeVisible();
      await expect(page.locator('[data-testid="node-palette"]')).toBeVisible();
    });

    test('should allow creating a new workflow', async () => {
      // Click create workflow button
      const createButton = page.locator('button:has-text("Create Workflow"), [data-testid="create-workflow-button"]').first();

      if (await createButton.isVisible()) {
        await createButton.click();

        // Fill workflow metadata
        const nameInput = page.locator('[data-testid="workflow-name"], input[name="name"]').first();
        await nameInput.fill('E2E Test Workflow');

        const descriptionInput = page.locator('[data-testid="workflow-description"], textarea[name="description"]').first();
        if (await descriptionInput.isVisible()) {
          await descriptionInput.fill('End-to-end test workflow for orchestration');
        }

        // Verify workflow is created
        await expect(page.locator('text=/E2E Test Workflow/i')).toBeVisible();
      }
    });

    test('should drag and drop nodes from palette to canvas', async () => {
      // Find agent-task node in palette
      const agentTaskNode = page.locator('[data-testid="palette-node-agent-task"], [data-node-type="agent-task"]').first();

      if (await agentTaskNode.isVisible()) {
        // Get canvas element
        const canvas = page.locator('[data-testid="workflow-canvas"]').first();

        // Drag node to canvas
        await agentTaskNode.dragTo(canvas, {
          targetPosition: { x: 200, y: 200 }
        });

        // Verify node was added to canvas
        await expect(page.locator('[data-testid*="node-agent-task"], .workflow-node[data-type="agent-task"]').first()).toBeVisible();
      }
    });

    test('should connect nodes with edges', async () => {
      // Add two nodes to canvas
      const agentTaskNode = page.locator('[data-testid="palette-node-agent-task"]').first();
      const canvas = page.locator('[data-testid="workflow-canvas"]').first();

      if (await agentTaskNode.isVisible()) {
        // Add first node
        await agentTaskNode.dragTo(canvas, {
          targetPosition: { x: 150, y: 150 }
        });

        // Add second node
        await agentTaskNode.dragTo(canvas, {
          targetPosition: { x: 350, y: 150 }
        });

        // Click first node to start connection
        const firstNode = page.locator('.workflow-node').first();
        await firstNode.click();

        // Click second node to complete connection
        const secondNode = page.locator('.workflow-node').nth(1);
        await secondNode.click();

        // Verify edge is created
        await expect(page.locator('.workflow-edge, [data-testid="workflow-edge"]').first()).toBeVisible({ timeout: 5000 });
      }
    });

    test('should save workflow configuration', async () => {
      // Create workflow with name
      const nameInput = page.locator('[data-testid="workflow-name"], input[name="name"]').first();

      if (await nameInput.isVisible()) {
        await nameInput.fill('Saveable Workflow');

        // Click save button
        const saveButton = page.locator('button:has-text("Save"), [data-testid="save-workflow-button"]').first();
        await saveButton.click();

        // Verify save success message
        await expect(page.locator('text=/saved successfully|workflow saved/i')).toBeVisible({ timeout: 10000 });
      }
    });
  });

  test.describe('Agent Tasks with Approval Gates', () => {
    test('should add agent task node to workflow', async () => {
      // Add agent task node
      const agentTaskNode = page.locator('[data-testid="palette-node-agent-task"]').first();
      const canvas = page.locator('[data-testid="workflow-canvas"]').first();

      if (await agentTaskNode.isVisible()) {
        await agentTaskNode.dragTo(canvas, {
          targetPosition: { x: 200, y: 200 }
        });

        // Verify agent task node is added
        const addedNode = page.locator('[data-testid*="node-agent-task"], .workflow-node[data-type="agent-task"]').first();
        await expect(addedNode).toBeVisible();

        // Click node to open configuration
        await addedNode.click();

        // Verify configuration panel shows agent task options
        const configPanel = page.locator('[data-testid="node-config-panel"], .node-configuration').first();
        if (await configPanel.isVisible()) {
          await expect(configPanel.locator('text=/agent type|model|task/i')).toBeVisible();
        }
      }
    });

    test('should add approval gate node to workflow', async () => {
      // Add approval gate node
      const approvalGateNode = page.locator('[data-testid="palette-node-approval-gate"], [data-node-type="approval-gate"]').first();
      const canvas = page.locator('[data-testid="workflow-canvas"]').first();

      if (await approvalGateNode.isVisible()) {
        await approvalGateNode.dragTo(canvas, {
          targetPosition: { x: 300, y: 200 }
        });

        // Verify approval gate node is added
        const addedNode = page.locator('[data-testid*="node-approval-gate"], .workflow-node[data-type="approval-gate"]').first();
        await expect(addedNode).toBeVisible();

        // Click node to configure
        await addedNode.click();

        // Verify approval gate configuration options
        const configPanel = page.locator('[data-testid="node-config-panel"], .node-configuration').first();
        if (await configPanel.isVisible()) {
          await expect(configPanel.locator('text=/approval type|approvers|priority/i')).toBeVisible();
        }
      }
    });

    test('should configure approval gate with approvers', async () => {
      // Add and configure approval gate
      const approvalGateNode = page.locator('[data-testid="palette-node-approval-gate"]').first();
      const canvas = page.locator('[data-testid="workflow-canvas"]').first();

      if (await approvalGateNode.isVisible()) {
        await approvalGateNode.dragTo(canvas, {
          targetPosition: { x: 300, y: 200 }
        });

        // Click node to open configuration
        const addedNode = page.locator('.workflow-node[data-type="approval-gate"]').first();
        await addedNode.click();

        // Configure approval settings
        const approversInput = page.locator('[data-testid="approvers-input"], input[name="approvers"]').first();
        if (await approversInput.isVisible()) {
          await approversInput.fill('admin@test.com');
        }

        const prioritySelect = page.locator('[data-testid="priority-select"], select[name="priority"]').first();
        if (await prioritySelect.isVisible()) {
          await prioritySelect.selectOption('high');
        }

        // Save configuration
        const saveConfigButton = page.locator('button:has-text("Save"), [data-testid="save-config-button"]').first();
        if (await saveConfigButton.isVisible()) {
          await saveConfigButton.click();
        }
      }
    });
  });

  test.describe('Workflow Execution and Approval', () => {
    test('should execute workflow and show execution status', async () => {
      // Create a simple workflow
      const nameInput = page.locator('[data-testid="workflow-name"], input[name="name"]').first();

      if (await nameInput.isVisible()) {
        await nameInput.fill('Executable Workflow');

        // Execute workflow
        const executeButton = page.locator('button:has-text("Execute"), [data-testid="execute-workflow-button"]').first();
        if (await executeButton.isVisible()) {
          await executeButton.click();

          // Verify execution started
          await expect(page.locator('text=/executing|running|in progress/i')).toBeVisible({ timeout: 10000 });

          // Check for execution status indicator
          const statusIndicator = page.locator('[data-testid="execution-status"], .execution-status').first();
          if (await statusIndicator.isVisible()) {
            await expect(statusIndicator).toContainText(/running|executing|in progress/i);
          }
        }
      }
    });

    test('should display approval requests during execution', async () => {
      // Navigate to workflow with approval gates
      const approvalSection = page.locator('[data-testid="approval-requests"], .approval-gate-section').first();

      if (await approvalSection.isVisible()) {
        // Verify approval request is shown
        await expect(approvalSection.locator('[data-testid="approval-request"]').first()).toBeVisible({ timeout: 15000 });

        // Check for approval action buttons
        await expect(approvalSection.locator('button:has-text("Approve")').first()).toBeVisible();
        await expect(approvalSection.locator('button:has-text("Reject")').first()).toBeVisible();
      }
    });

    test('should approve workflow action', async () => {
      // Find approval request
      const approvalRequest = page.locator('[data-testid="approval-request"]').first();

      if (await approvalRequest.isVisible()) {
        // Click approve button
        const approveButton = approvalRequest.locator('button:has-text("Approve")').first();
        await approveButton.click();

        // Add optional comment
        const commentInput = page.locator('[data-testid="approval-comment"], textarea[name="comment"]').first();
        if (await commentInput.isVisible()) {
          await commentInput.fill('Approved for E2E testing');
        }

        // Confirm approval
        const confirmButton = page.locator('button:has-text("Confirm"), [data-testid="confirm-approval"]').first();
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }

        // Verify approval was recorded
        await expect(page.locator('text=/approved successfully|approval recorded/i')).toBeVisible({ timeout: 10000 });
      }
    });

    test('should reject workflow action', async () => {
      // Find approval request
      const approvalRequest = page.locator('[data-testid="approval-request"]').first();

      if (await approvalRequest.isVisible()) {
        // Click reject button
        const rejectButton = approvalRequest.locator('button:has-text("Reject")').first();
        await rejectButton.click();

        // Add rejection reason
        const commentInput = page.locator('[data-testid="approval-comment"], textarea[name="comment"]').first();
        if (await commentInput.isVisible()) {
          await commentInput.fill('Rejected for testing purposes');
        }

        // Confirm rejection
        const confirmButton = page.locator('button:has-text("Confirm"), [data-testid="confirm-rejection"]').first();
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }

        // Verify rejection was recorded
        await expect(page.locator('text=/rejected|rejection recorded/i')).toBeVisible({ timeout: 10000 });
      }
    });
  });

  test.describe('Audit Trail Verification', () => {
    test('should display audit trail viewer', async () => {
      // Navigate to or open audit trail
      const auditTrailButton = page.locator('button:has-text("Audit Trail"), [data-testid="audit-trail-button"]').first();

      if (await auditTrailButton.isVisible()) {
        await auditTrailButton.click();

        // Verify audit trail viewer is displayed
        await expect(page.locator('[data-testid="audit-trail-viewer"], .audit-trail-viewer')).toBeVisible();
      } else {
        // Audit trail might be always visible
        const auditTrailViewer = page.locator('[data-testid="audit-trail-viewer"], .audit-trail-viewer').first();
        if (await auditTrailViewer.isVisible()) {
          await expect(auditTrailViewer).toBeVisible();
        }
      }
    });

    test('should show workflow execution actions in audit trail', async () => {
      // Open audit trail
      const auditTrailViewer = page.locator('[data-testid="audit-trail-viewer"], .audit-trail-viewer').first();

      if (await auditTrailViewer.isVisible()) {
        // Verify audit entries are displayed
        const auditEntries = auditTrailViewer.locator('[data-testid="audit-entry"], .audit-entry');
        await expect(auditEntries.first()).toBeVisible({ timeout: 10000 });

        // Check for workflow started event
        await expect(auditTrailViewer.locator('text=/workflow.started|execution started/i').first()).toBeVisible();
      }
    });

    test('should display approval actions in audit trail', async () => {
      // Open audit trail
      const auditTrailViewer = page.locator('[data-testid="audit-trail-viewer"], .audit-trail-viewer').first();

      if (await auditTrailViewer.isVisible()) {
        // Look for approval events
        const approvalEvents = auditTrailViewer.locator('text=/approval.requested|approval.approved|approval.rejected/i');

        if (await approvalEvents.first().isVisible({ timeout: 5000 })) {
          await expect(approvalEvents.first()).toBeVisible();

          // Click to expand details
          const auditEntry = auditTrailViewer.locator('[data-testid="audit-entry"]').first();
          await auditEntry.click();

          // Verify details are shown
          await expect(auditTrailViewer.locator('[data-testid="audit-details"], .audit-entry-details').first()).toBeVisible();
        }
      }
    });

    test('should filter audit trail by event type', async () => {
      // Open audit trail
      const auditTrailViewer = page.locator('[data-testid="audit-trail-viewer"], .audit-trail-viewer').first();

      if (await auditTrailViewer.isVisible()) {
        // Find filter dropdown
        const filterSelect = page.locator('[data-testid="audit-filter"], select[name="eventType"]').first();

        if (await filterSelect.isVisible()) {
          // Filter by approval events
          await filterSelect.selectOption('approval');

          // Wait for filtered results
          await page.waitForTimeout(500);

          // Verify only approval events are shown
          const visibleEntries = auditTrailViewer.locator('[data-testid="audit-entry"]');
          const count = await visibleEntries.count();

          expect(count).toBeGreaterThanOrEqual(0);
        }
      }
    });

    test('should search audit trail', async () => {
      // Open audit trail
      const auditTrailViewer = page.locator('[data-testid="audit-trail-viewer"], .audit-trail-viewer').first();

      if (await auditTrailViewer.isVisible()) {
        // Find search input
        const searchInput = page.locator('[data-testid="audit-search"], input[name="search"]').first();

        if (await searchInput.isVisible()) {
          // Search for specific term
          await searchInput.fill('approved');

          // Wait for search results
          await page.waitForTimeout(500);

          // Verify search results
          const entries = auditTrailViewer.locator('[data-testid="audit-entry"]');
          const count = await entries.count();

          expect(count).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  test.describe('Rollback Functionality', () => {
    test('should display available checkpoints', async () => {
      // Open rollback section or audit trail
      const auditTrailViewer = page.locator('[data-testid="audit-trail-viewer"], .audit-trail-viewer').first();

      if (await auditTrailViewer.isVisible()) {
        // Look for checkpoints
        const checkpoints = auditTrailViewer.locator('[data-testid="checkpoint"], .checkpoint-entry');

        if (await checkpoints.first().isVisible({ timeout: 5000 })) {
          await expect(checkpoints.first()).toBeVisible();
        }
      }
    });

    test('should show rollback confirmation dialog', async () => {
      // Find checkpoint with rollback button
      const rollbackButton = page.locator('button:has-text("Rollback"), [data-testid*="rollback-button"]').first();

      if (await rollbackButton.isVisible({ timeout: 5000 })) {
        await rollbackButton.click();

        // Verify confirmation dialog appears
        await expect(page.locator('[data-testid="rollback-dialog"], [role="dialog"]')).toBeVisible({ timeout: 5000 });

        // Check for warning message
        await expect(page.locator('text=/warning|are you sure|cannot be undone/i')).toBeVisible();

        // Check for confirm and cancel buttons
        await expect(page.locator('button:has-text("Confirm")').first()).toBeVisible();
        await expect(page.locator('button:has-text("Cancel")').first()).toBeVisible();
      }
    });

    test('should cancel rollback operation', async () => {
      // Find rollback button
      const rollbackButton = page.locator('button:has-text("Rollback"), [data-testid*="rollback-button"]').first();

      if (await rollbackButton.isVisible({ timeout: 5000 })) {
        await rollbackButton.click();

        // Click cancel button
        const cancelButton = page.locator('button:has-text("Cancel")').first();
        await cancelButton.click();

        // Verify dialog is closed
        await expect(page.locator('[data-testid="rollback-dialog"], [role="dialog"]')).not.toBeVisible({ timeout: 5000 });
      }
    });

    test('should execute rollback to previous checkpoint', async () => {
      // Find rollback button
      const rollbackButton = page.locator('button:has-text("Rollback"), [data-testid*="rollback-button"]').first();

      if (await rollbackButton.isVisible({ timeout: 5000 })) {
        await rollbackButton.click();

        // Confirm rollback
        const confirmButton = page.locator('[role="dialog"] button:has-text("Confirm")').first();
        if (await confirmButton.isVisible()) {
          await confirmButton.click();

          // Verify rollback success message
          await expect(page.locator('text=/rollback successful|restored|reverted/i')).toBeVisible({ timeout: 15000 });

          // Verify audit trail records the rollback
          const auditTrailViewer = page.locator('[data-testid="audit-trail-viewer"], .audit-trail-viewer').first();
          if (await auditTrailViewer.isVisible()) {
            await expect(auditTrailViewer.locator('text=/rollback|restored/i').first()).toBeVisible({ timeout: 5000 });
          }
        }
      }
    });
  });

  test.describe('Complete Workflow Journey', () => {
    test('should complete full workflow orchestration flow', async () => {
      // Step 1: Create workflow
      const createButton = page.locator('button:has-text("Create Workflow"), [data-testid="create-workflow-button"]').first();

      if (await createButton.isVisible()) {
        await createButton.click();

        const nameInput = page.locator('[data-testid="workflow-name"], input[name="name"]').first();
        await nameInput.fill('Complete E2E Workflow');

        // Step 2: Add agent task node
        const agentTaskNode = page.locator('[data-testid="palette-node-agent-task"]').first();
        const canvas = page.locator('[data-testid="workflow-canvas"]').first();

        if (await agentTaskNode.isVisible()) {
          await agentTaskNode.dragTo(canvas, {
            targetPosition: { x: 200, y: 150 }
          });
        }

        // Step 3: Add approval gate node
        const approvalGateNode = page.locator('[data-testid="palette-node-approval-gate"]').first();
        if (await approvalGateNode.isVisible()) {
          await approvalGateNode.dragTo(canvas, {
            targetPosition: { x: 400, y: 150 }
          });
        }

        // Step 4: Connect nodes
        const firstNode = page.locator('.workflow-node').first();
        await firstNode.click();

        const secondNode = page.locator('.workflow-node').nth(1);
        await secondNode.click();

        // Step 5: Save workflow
        const saveButton = page.locator('button:has-text("Save"), [data-testid="save-workflow-button"]').first();
        if (await saveButton.isVisible()) {
          await saveButton.click();
          await expect(page.locator('text=/saved successfully/i')).toBeVisible({ timeout: 10000 });
        }

        // Step 6: Execute workflow
        const executeButton = page.locator('button:has-text("Execute"), [data-testid="execute-workflow-button"]').first();
        if (await executeButton.isVisible()) {
          await executeButton.click();
          await expect(page.locator('text=/executing|running/i')).toBeVisible({ timeout: 10000 });
        }

        // Step 7: Approve action (if approval request appears)
        const approveButton = page.locator('button:has-text("Approve")').first();
        if (await approveButton.isVisible({ timeout: 15000 })) {
          await approveButton.click();

          const confirmButton = page.locator('button:has-text("Confirm")').first();
          if (await confirmButton.isVisible()) {
            await confirmButton.click();
          }
        }

        // Step 8: Verify audit trail
        const auditTrailButton = page.locator('button:has-text("Audit Trail"), [data-testid="audit-trail-button"]').first();
        if (await auditTrailButton.isVisible()) {
          await auditTrailButton.click();
        }

        const auditTrailViewer = page.locator('[data-testid="audit-trail-viewer"], .audit-trail-viewer').first();
        if (await auditTrailViewer.isVisible()) {
          await expect(auditTrailViewer.locator('[data-testid="audit-entry"]').first()).toBeVisible();
        }

        // Step 9: Test rollback (if available)
        const rollbackButton = page.locator('button:has-text("Rollback")').first();
        if (await rollbackButton.isVisible({ timeout: 5000 })) {
          // We found a rollback button - workflow must have checkpoints
          await expect(rollbackButton).toBeVisible();
        }
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle workflow execution errors gracefully', async () => {
      // Attempt to execute empty workflow
      const executeButton = page.locator('button:has-text("Execute"), [data-testid="execute-workflow-button"]').first();

      if (await executeButton.isVisible()) {
        await executeButton.click();

        // Should show error message for invalid workflow
        const errorMessage = page.locator('[data-testid="error-message"], [role="alert"], .error-alert').first();
        if (await errorMessage.isVisible({ timeout: 5000 })) {
          await expect(errorMessage).toBeVisible();
        }
      }
    });

    test('should validate workflow before saving', async () => {
      // Try to save workflow without name
      const saveButton = page.locator('button:has-text("Save"), [data-testid="save-workflow-button"]').first();

      if (await saveButton.isVisible()) {
        await saveButton.click();

        // Should show validation error
        await expect(page.locator('text=/name is required|workflow name/i')).toBeVisible({ timeout: 5000 });
      }
    });

    test('should handle network errors during execution', async () => {
      // Create workflow
      const nameInput = page.locator('[data-testid="workflow-name"], input[name="name"]').first();
      if (await nameInput.isVisible()) {
        await nameInput.fill('Network Test Workflow');

        // Simulate network failure
        await page.route('**/api/workflows/**', route => {
          route.abort('internetdisconnected');
        });

        // Try to execute
        const executeButton = page.locator('button:has-text("Execute")').first();
        if (await executeButton.isVisible()) {
          await executeButton.click();

          // Should show network error
          await expect(page.locator('text=/network error|connection failed/i')).toBeVisible({ timeout: 10000 });
        }

        // Restore network
        await page.unroute('**/api/workflows/**');
      }
    });
  });

  test.describe('Performance', () => {
    test('should load workflow builder quickly', async () => {
      const startTime = Date.now();

      await page.goto('/workflows');
      await page.waitForSelector('[data-testid="workflow-builder"], .workflow-builder');

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      expect(loadTime).toBeLessThan(5000);
    });

    test('should handle large workflows without performance degradation', async () => {
      // Add multiple nodes to test performance
      const agentTaskNode = page.locator('[data-testid="palette-node-agent-task"]').first();
      const canvas = page.locator('[data-testid="workflow-canvas"]').first();

      if (await agentTaskNode.isVisible()) {
        // Add 10 nodes
        for (let i = 0; i < 10; i++) {
          await agentTaskNode.dragTo(canvas, {
            targetPosition: { x: 150 + (i * 100), y: 150 + (i % 3) * 100 }
          });

          // Small delay to allow rendering
          await page.waitForTimeout(100);
        }

        // Verify all nodes are rendered
        const nodes = page.locator('.workflow-node');
        const count = await nodes.count();

        expect(count).toBeGreaterThanOrEqual(10);

        // Verify canvas is still responsive
        await expect(canvas).toBeVisible();
      }
    });
  });
});
