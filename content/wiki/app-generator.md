# App Generator Documentation

## Overview
The App Generator is a core feature of VibeCode that allows users to generate complete project structures using AI. It provides a seamless experience from project generation to opening the project in a live development environment.

## API Reference

### Project Generation Endpoint

**Endpoint:** `POST /api/ai/generate-project`

**Request Body:**
```typescript
{
  prompt: string;           // Required: Description of the project to generate
  projectName?: string;     // Optional: Name for the generated project
  language?: string;        // Optional: Programming language (e.g., 'typescript', 'python')
  framework?: string;       // Optional: Framework (e.g., 'nextjs', 'react')
  features?: string[];      // Optional: Array of features to include
}
```

**Response:**
- **200 OK**: Stream of progress updates with the following format:
  ```typescript
  {
    status: 'initializing' | 'generating' | 'seeding' | 'installing' | 'finalizing' | 'completed' | 'error';
    message: string;        // Human-readable status message
    progress?: number;      // Progress percentage (0-100)
    workspaceId?: string;   // ID of the generated workspace
    projectName?: string;   // Name of the generated project
    codeServerUrl?: string; // URL to access the code-server instance
    error?: string;         // Error message if status is 'error'
    details?: any;          // Additional error details
  }
  ```

**Error Responses:**
- **400 Bad Request**: Invalid input parameters
- **401 Unauthorized**: User not authenticated
- **500 Internal Server Error**: Server error during project generation

## UI Components

### ProjectGenerator

A React component that provides the UI for project generation.

**Props:**
```typescript
interface ProjectGeneratorProps {
  initialPrompt?: string;   // Initial prompt value
  onComplete?: (data: { workspaceId: string; projectName: string }) => void;
  autoStart?: boolean;      // Automatically start generation if initialPrompt is provided
}
```

**Usage Example:**
```tsx
<ProjectGenerator
  initialPrompt="Create a React app with TypeScript and Tailwind CSS"
  onComplete={({ workspaceId }) => {
    console.log(`Project ready at /workspace/${workspaceId}`);
  }}
  autoStart={true}
/>
```

### useProjectGenerator Hook

A custom React hook that handles the project generation logic.

**Return Value:**
```typescript
{
  isGenerating: boolean;    // Whether generation is in progress
  progress: ProgressData;   // Current progress information
  generateProject: (prompt: string, options?: GenerateOptions) => Promise<void>;
  cancelGeneration: () => void;  // Cancel the current generation
  updateProgress: (data: Partial<ProgressData>) => void; // Update progress manually
}
```

## Error Handling

### Common Error Codes

| Code | Status | Description | Recovery Suggestion |
|------|--------|-------------|---------------------|
| 4001 | 400    | Invalid prompt | Provide a more detailed prompt |
| 4002 | 400    | Unsupported language | Use one of the supported languages |
| 4010 | 401    | Authentication required | Sign in to generate projects |
| 5001 | 500    | Generation failed | Try again with a different prompt |
| 5002 | 500    | Workspace creation failed | Check if you have available workspaces |

### Recovery Options

When an error occurs, the following recovery options are provided:

1. **Retry**: Attempt the operation again
2. **Modify Prompt**: Update the project description
3. **Contact Support**: Get help from the VibeCode team

## Performance Metrics

The following metrics are tracked for monitoring and optimization:

- `project_generation_time`: Total time to generate a project
- `workspace_provisioning_time`: Time to provision a new workspace
- `code_server_startup_time`: Time to start the code-server instance
- `dependency_installation_time`: Time to install project dependencies
- `generation_errors`: Count of failed generation attempts

## Best Practices

1. **Prompt Engineering**:
   - Be specific about the type of project you want to create
   - Include preferred technologies and frameworks
   - Specify any required dependencies or configurations

2. **Error Recovery**:
   - Check the error message for specific guidance
   - Try simplifying your prompt if generation fails
   - Ensure you have sufficient permissions and resources

3. **Performance**:
   - Project generation typically takes 30-60 seconds
   - Workspace provisioning takes 5-10 seconds
   - Code-server starts within 10-15 seconds

## Troubleshooting

### Common Issues

1. **Generation Stuck at 0%**
   - Check your internet connection
   - Refresh the page and try again
   - Contact support if the issue persists

2. **Dependency Installation Failed**
   - The project might have incompatible dependencies
   - Try generating with a different set of features
   - Check the logs for specific dependency errors

3. **Workspace Not Starting**
   - Ensure you have available workspace slots
   - Check your account's resource limits
   - Try again in a few minutes

## Integration with Other Systems

The App Generator integrates with:

- **Kubernetes**: For workspace provisioning
- **GitHub**: For template repositories
- **OpenRouter**: For AI-powered code generation
- **Datadog**: For monitoring and observability

## Security Considerations

- All generated code is scanned for security vulnerabilities
- Workspaces are isolated in separate containers
- User authentication is required for project generation
- Sensitive data is never stored in logs or analytics
