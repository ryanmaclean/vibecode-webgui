/**
 * OpenVSCode Server Test Script
 *
 * This demonstrates how to use the OpenVSCode Server commands from the frontend.
 * Run this in the Tauri webview console or as part of your app.
 */

import { invoke } from '@tauri-apps/api/core';

interface ServerStatus {
  running: boolean;
  port?: number;
  pid?: number;
  url?: string;
  startup_time?: number;
}

async function testOpenVSCode() {
  try {
    console.log('🧪 Testing OpenVSCode Server commands...\n');

    // 1. Get initial status
    console.log('1️⃣ Getting initial status...');
    const initialStatus = await invoke<ServerStatus>('openvscode_status');
    console.log('Status:', initialStatus);
    console.log('');

    // 2. Start the server
    console.log('2️⃣ Starting OpenVSCode Server...');
    const startStatus = await invoke<ServerStatus>('openvscode_start');
    console.log('Server started!');
    console.log('  - URL:', startStatus.url);
    console.log('  - Port:', startStatus.port);
    console.log('  - PID:', startStatus.pid);
    console.log('  - Startup Time:', startStatus.startup_time, 'ms');
    console.log('');

    // 3. Install bundled extensions
    console.log('3️⃣ Installing bundled extensions...');
    const extensions = await invoke<string[]>('openvscode_install_extensions');
    console.log('Extensions installed:', extensions);
    console.log('');

    // 4. Get status again
    console.log('4️⃣ Getting status after start...');
    const runningStatus = await invoke<ServerStatus>('openvscode_status');
    console.log('Status:', runningStatus);
    console.log('');

    // 5. Test restart
    console.log('5️⃣ Testing restart...');
    const restartStatus = await invoke<ServerStatus>('openvscode_restart');
    console.log('Server restarted!');
    console.log('  - URL:', restartStatus.url);
    console.log('  - Port:', restartStatus.port);
    console.log('');

    // 6. Stop the server
    console.log('6️⃣ Stopping OpenVSCode Server...');
    await invoke<void>('openvscode_stop');
    console.log('Server stopped!');
    console.log('');

    // 7. Get final status
    console.log('7️⃣ Getting final status...');
    const finalStatus = await invoke<ServerStatus>('openvscode_status');
    console.log('Status:', finalStatus);
    console.log('');

    console.log('✅ All tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Export for use in app
export { testOpenVSCode };

// If running directly, execute test
if (typeof window !== 'undefined') {
  console.log('Run testOpenVSCode() to test the OpenVSCode Server commands');
}
