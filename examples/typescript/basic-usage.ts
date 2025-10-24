/**
 * Basic Usage Example - TypeScript SDK
 *
 * Demonstrates basic operations with the VibeCode API:
 * - Creating and initializing the client
 * - Managing authentication
 * - Creating and managing workspaces
 * - Basic error handling
 */

import { createVibeCodeClient, VibeCodeError } from '@vibecode/client';

async function main() {
  // Create client instance
  const client = createVibeCodeClient({
    baseUrl: process.env.VIBECODE_API_URL || 'http://localhost:3000/api',
    token: process.env.VIBECODE_TOKEN,
    autoManageCSRF: true,
  });

  try {
    // Initialize client (fetches CSRF token)
    console.log('Initializing client...');
    await client.init();

    // List existing workspaces
    console.log('\nListing workspaces...');
    const workspaces = await client.listWorkspaces({ page: 1, limit: 10 });
    console.log(`Found ${workspaces.total} workspaces`);

    workspaces.workspaces.forEach((ws) => {
      console.log(`  - ${ws.projectName} (${ws.status})`);
    });

    // Create a new workspace
    console.log('\nCreating new workspace...');
    const newWorkspace = await client.createWorkspace({
      projectId: `demo-${Date.now()}`,
      projectName: 'Demo Project',
      framework: 'react',
      files: {
        'package.json': JSON.stringify(
          {
            name: 'demo-project',
            version: '1.0.0',
            dependencies: {
              react: '^18.0.0',
              'react-dom': '^18.0.0',
            },
          },
          null,
          2
        ),
        'src/App.jsx': `export default function App() {
  return <h1>Hello from VibeCode!</h1>;
}`,
        'README.md': '# Demo Project\n\nCreated with VibeCode API',
      },
      dependencies: ['react', 'react-dom'],
    });

    console.log(`Workspace created: ${newWorkspace.id}`);
    console.log(`Status: ${newWorkspace.status}`);

    // Get workspace details
    console.log('\nFetching workspace details...');
    const workspace = await client.getWorkspace(newWorkspace.id);
    console.log(`Files in workspace: ${Object.keys(workspace.files || {}).length}`);

    // Update workspace
    console.log('\nUpdating workspace...');
    await client.updateWorkspace(newWorkspace.id, {
      projectName: 'Demo Project - Updated',
      environment: {
        NODE_ENV: 'development',
      },
    });
    console.log('Workspace updated successfully');

    // Check rate limit
    const rateLimitInfo = client.getRateLimitInfo();
    if (rateLimitInfo) {
      console.log('\nRate limit info:');
      console.log(`  Limit: ${rateLimitInfo.limit}`);
      console.log(`  Remaining: ${rateLimitInfo.remaining}`);
      console.log(`  Resets at: ${new Date(rateLimitInfo.reset * 1000).toISOString()}`);
    }

    // Clean up (optional - delete the workspace)
    console.log('\nCleaning up...');
    await client.deleteWorkspace(newWorkspace.id);
    console.log('Workspace deleted successfully');
  } catch (error) {
    if (error instanceof Error) {
      const vibeError = error as VibeCodeError;
      console.error('\nError occurred:');
      console.error(`  Type: ${vibeError.error}`);
      console.error(`  Message: ${vibeError.message}`);
      console.error(`  Status: ${vibeError.statusCode}`);
      console.error(`  Request ID: ${vibeError.requestId}`);
    }
    process.exit(1);
  }
}

main();
