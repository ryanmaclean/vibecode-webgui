# Workflow Automation Plugin

An example plugin demonstrating workflow automation capabilities in VibeCode. This plugin shows how to create scheduled tasks, event-driven workflows, and multi-step task orchestration.

## Features

- **Scheduled Task Execution**: Automate tasks on a schedule using cron expressions
- **Event-Driven Workflows**: Trigger workflows based on system events
- **Multi-Step Orchestration**: Chain multiple tasks together in a workflow
- **Manual Execution**: Run workflows on-demand via CLI or API
- **Workflow Management**: List, inspect, and control active workflows

## Installation

### Via CLI

```bash
vibecode plugin install ./plugins/examples/workflow-automation
```

### Via UI

1. Navigate to Settings → Plugins
2. Click "Install Plugin"
3. Select the plugin directory or upload the plugin package
4. Click "Install"

### Via API

```bash
curl -X POST http://localhost:3000/api/plugins/install \
  -H "Content-Type: application/json" \
  -d '{"source": "./plugins/examples/workflow-automation"}'
```

## Example Workflows

This plugin includes three example workflows:

### 1. Daily Cleanup Workflow

**ID**: `daily-cleanup`
**Schedule**: Daily at midnight
**Tasks**:
- Clean temporary files
- Archive old log files

```bash
# Run manually
vibecode workflow run daily-cleanup

# Schedule for automatic execution
vibecode workflow schedule daily-cleanup "0 0 * * *"
```

### 2. Code Quality Check Workflow

**ID**: `code-quality-check`
**Trigger**: Manual or pre-commit event
**Tasks**:
1. Run linting checks
2. Execute test suite
3. Verify code coverage threshold

```bash
# Run quality checks
vibecode workflow run code-quality-check
```

### 3. Auto Backup Workflow

**ID**: `auto-backup`
**Schedule**: Every 6 hours
**Tasks**:
1. Collect important files
2. Create compressed archive
3. Verify backup integrity

```bash
# Run backup manually
vibecode workflow run auto-backup

# Check workflow status
vibecode workflow status auto-backup
```

## Usage

### List Available Workflows

```typescript
import { listWorkflows } from './workflow-automation';

const workflows = listWorkflows();
console.log(workflows);
// [
//   {
//     id: 'daily-cleanup',
//     name: 'Daily Cleanup',
//     description: 'Automated daily cleanup of temporary files and logs',
//     taskCount: 2,
//     triggers: ['schedule']
//   },
//   ...
// ]
```

### Execute a Workflow

```typescript
import { executeWorkflow } from './workflow-automation';

const result = await executeWorkflow('code-quality-check');
console.log(result);
// {
//   success: true,
//   workflowId: 'code-quality-check',
//   tasksExecuted: 3,
//   duration: 650,
//   errors: undefined
// }
```

### Get Workflow Details

```typescript
import { getWorkflowDetails } from './workflow-automation';

const workflow = getWorkflowDetails('auto-backup');
console.log(workflow);
// {
//   id: 'auto-backup',
//   name: 'Auto Backup',
//   description: 'Automated backup of important project files',
//   tasks: [...],
//   triggers: [...]
// }
```

### Schedule a Workflow

```typescript
import { scheduleWorkflow, unscheduleWorkflow } from './workflow-automation';

// Run every hour (3600000ms)
scheduleWorkflow('daily-cleanup', 3600000);

// Stop scheduled execution
unscheduleWorkflow('daily-cleanup');
```

## Creating Custom Workflows

You can extend this plugin or create your own workflow plugin:

```typescript
interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  tasks: WorkflowTask[];
  triggers: WorkflowTrigger[];
}

interface WorkflowTask {
  id: string;
  name: string;
  description: string;
  execute: () => Promise<void>;
  schedule?: string;  // Cron expression
}

interface WorkflowTrigger {
  type: 'schedule' | 'event' | 'manual';
  config: Record<string, unknown>;
}
```

### Example: Custom Workflow

```typescript
const customWorkflow: WorkflowDefinition = {
  id: 'my-custom-workflow',
  name: 'My Custom Workflow',
  description: 'Does something useful',
  tasks: [
    {
      id: 'task-1',
      name: 'First Task',
      description: 'Description of first task',
      execute: async () => {
        // Task implementation
        console.log('Executing first task...');
      }
    },
    {
      id: 'task-2',
      name: 'Second Task',
      description: 'Description of second task',
      execute: async () => {
        // Task implementation
        console.log('Executing second task...');
      }
    }
  ],
  triggers: [
    { type: 'manual', config: {} },
    { type: 'schedule', config: { cron: '0 */2 * * *' } }
  ]
};
```

## Real-World Use Cases

### 1. Continuous Integration Workflow

Automate build, test, and deployment processes:

```typescript
const ciWorkflow = {
  id: 'ci-pipeline',
  name: 'CI Pipeline',
  tasks: [
    { id: 'install', name: 'Install Dependencies', execute: installDeps },
    { id: 'lint', name: 'Lint Code', execute: runLinter },
    { id: 'test', name: 'Run Tests', execute: runTests },
    { id: 'build', name: 'Build Project', execute: buildProject },
    { id: 'deploy', name: 'Deploy to Staging', execute: deployStaging }
  ],
  triggers: [
    { type: 'event', config: { event: 'git-push' } }
  ]
};
```

### 2. Database Maintenance Workflow

Schedule regular database maintenance tasks:

```typescript
const dbMaintenanceWorkflow = {
  id: 'db-maintenance',
  name: 'Database Maintenance',
  tasks: [
    { id: 'vacuum', name: 'Vacuum Database', execute: vacuumDB },
    { id: 'analyze', name: 'Analyze Tables', execute: analyzeTables },
    { id: 'backup', name: 'Create Backup', execute: backupDatabase }
  ],
  triggers: [
    { type: 'schedule', config: { cron: '0 2 * * 0' } } // Weekly, Sunday 2 AM
  ]
};
```

### 3. Security Audit Workflow

Regularly scan for security vulnerabilities:

```typescript
const securityAuditWorkflow = {
  id: 'security-audit',
  name: 'Security Audit',
  tasks: [
    { id: 'deps-audit', name: 'Audit Dependencies', execute: auditDeps },
    { id: 'scan-code', name: 'Scan Code', execute: scanCode },
    { id: 'check-secrets', name: 'Check for Secrets', execute: scanSecrets },
    { id: 'report', name: 'Generate Report', execute: generateReport }
  ],
  triggers: [
    { type: 'schedule', config: { cron: '0 0 * * 1' } } // Weekly, Monday
  ]
};
```

## Permissions

This plugin requires the following permissions:

- `filesystem:read` - Read project files for workflow tasks
- `filesystem:write` - Write backup files and reports
- `commands:register` - Register workflow commands
- `settings:read` - Read user preferences for workflow configuration

## API Reference

### Functions

#### `executeWorkflow(workflowId: string)`

Execute a workflow by ID.

**Returns**: Promise resolving to execution result with status, task count, duration, and any errors.

#### `listWorkflows()`

Get a list of all registered workflows.

**Returns**: Array of workflow summaries.

#### `getWorkflowDetails(workflowId: string)`

Get detailed information about a specific workflow.

**Returns**: WorkflowDefinition or null if not found.

#### `scheduleWorkflow(workflowId: string, intervalMs: number)`

Schedule a workflow for periodic execution.

**Returns**: Boolean indicating success.

#### `unscheduleWorkflow(workflowId: string)`

Cancel a scheduled workflow.

**Returns**: Boolean indicating success.

#### `getPluginInfo()`

Get plugin information including registered workflows and scheduled jobs.

**Returns**: Plugin metadata object.

## Lifecycle Hooks

This plugin implements all lifecycle hooks:

- `onInstall()` - Called when plugin is installed
- `onEnable()` - Called when plugin is enabled, re-registers workflows
- `onDisable()` - Called when plugin is disabled, stops all scheduled jobs
- `onUpdate()` - Called when plugin is updated, re-registers workflows
- `onUninstall()` - Called when plugin is uninstalled
- `initialize()` - Called to initialize the plugin, registers workflows and commands
- `destroy()` - Called to cleanup, stops all jobs and clears workflows

## Configuration

Future versions may support workflow configuration via settings:

```json
{
  "workflows": {
    "daily-cleanup": {
      "enabled": true,
      "schedule": "0 0 * * *",
      "tasks": {
        "cleanup-temp": {
          "path": "/tmp",
          "maxAge": "7d"
        }
      }
    }
  }
}
```

## Development

### Running Tests

```bash
npm test -- workflow-automation
```

### Debugging

Enable debug logging:

```bash
export DEBUG=plugin:workflow-automation
vibecode workflow run daily-cleanup
```

## Troubleshooting

### Workflow Not Executing

1. Check plugin is enabled: `vibecode plugin list`
2. Verify workflow exists: `vibecode workflow list`
3. Check logs for errors: `vibecode logs --plugin workflow-automation`

### Scheduled Jobs Not Running

1. Verify schedule syntax (cron expression)
2. Check system time and timezone
3. Ensure plugin hasn't been disabled

### Permission Errors

Ensure the plugin has required permissions in plugin.json:

```json
{
  "permissions": [
    "filesystem:read",
    "filesystem:write",
    "commands:register",
    "settings:read"
  ]
}
```

## Contributing

To contribute improvements or additional example workflows:

1. Fork the repository
2. Create a feature branch
3. Add your workflow examples
4. Submit a pull request

## License

MIT

## Links

- [Plugin API Documentation](https://vibecode.dev/docs/plugins/api)
- [Workflow Best Practices](https://vibecode.dev/docs/plugins/workflows)
- [Example Plugins](https://vibecode.dev/docs/plugins/examples)
- [VibeCode Homepage](https://vibecode.dev)
