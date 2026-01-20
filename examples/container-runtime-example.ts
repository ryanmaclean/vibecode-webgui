/**
 * Container Runtime Integration Example
 * 
 * Example showing how to use the unified container runtime interface
 */

import { getRuntimeWithFallback, detectRuntime } from '@/lib/container';

async function main() {
  console.log('=== Container Runtime Integration Example ===\n');

  // Step 1: Auto-detect available runtime
  console.log('Step 1: Detecting available runtime...');
  const detectedRuntime = await detectRuntime();
  console.log(`Detected runtime: ${detectedRuntime || 'none'}\n`);

  if (!detectedRuntime) {
    console.log('No container runtime available. Please install Docker, Podman, or Kubernetes.');
    return;
  }

  // Step 2: Get runtime instance
  console.log('Step 2: Getting runtime instance...');
  const runtime = await getRuntimeWithFallback(detectedRuntime);
  console.log(`Using ${runtime.name} runtime\n`);

  // Step 3: Get runtime status
  console.log('Step 3: Getting runtime status...');
  const status = await runtime.getStatus();
  console.log('Runtime Status:', JSON.stringify(status, null, 2), '\n');

  // Step 4: List existing containers
  console.log('Step 4: Listing existing containers...');
  const listResult = await runtime.list({ all: true });
  
  if (listResult.success) {
    console.log(`Found ${listResult.containers.length} containers:`);
    listResult.containers.forEach(container => {
      console.log(`  - ${container.name} (${container.id}): ${container.state}`);
    });
  } else {
    console.log(`Error listing containers: ${listResult.error}`);
  }
  console.log();

  // Step 5: Start a test container (optional - commented out to avoid side effects)
  /*
  console.log('Step 5: Starting a test container...');
  const startResult = await runtime.start('nginx:alpine', {
    name: 'vibecode-test-nginx',
    ports: { 8080: 80 },
    env: { NGINX_HOST: 'localhost' },
    labels: { 'app': 'vibecode-test' },
    rm: true, // Remove after stop
  });

  if (startResult.success) {
    console.log(`Container started: ${startResult.id}`);
    
    // Step 6: Get container info
    console.log('\nStep 6: Getting container info...');
    const containerInfo = await runtime.inspect(startResult.id!);
    if (containerInfo) {
      console.log('Container Info:', JSON.stringify(containerInfo, null, 2));
    }

    // Step 7: Get container logs
    console.log('\nStep 7: Getting container logs...');
    const logsResult = await runtime.logs(startResult.id!, { tail: 10 });
    if (logsResult.success) {
      console.log('Container Logs:');
      console.log(logsResult.logs);
    }

    // Step 8: Stop and remove container
    console.log('\nStep 8: Stopping container...');
    await runtime.stop(startResult.id!);
    console.log('Container stopped');

    await runtime.remove(startResult.id!);
    console.log('Container removed');
  } else {
    console.log(`Error starting container: ${startResult.error}`);
  }
  */

  console.log('\n=== Example Complete ===');
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

export { main };
