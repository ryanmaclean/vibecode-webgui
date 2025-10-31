// Enhanced Unified Launcher with Logging, OpenVSCode Support, and Lightweight VM Option
// Goal: Full OpenVSCode Server in super lightweight VM or app

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const CODE_SERVER_PORT = 8080;
const BACKEND_PORT = 3030;
const OPENVSCODE_PORT = 3000;
const VM_PORT = 3600; // OpenVSCode VM port

// Logger with timestamps and levels
const log = {
    info: (msg) => console.log(`[${new Date().toISOString()}] ℹ️  ${msg}`),
    success: (msg) => console.log(`[${new Date().toISOString()}] ✅ ${msg}`),
    warn: (msg) => console.warn(`[${new Date().toISOString()}] ⚠️  ${msg}`),
    error: (msg) => console.error(`[${new Date().toISOString()}] ❌ ${msg}`),
    debug: (msg) => process.env.DEBUG && console.log(`[${new Date().toISOString()}] 🔍 ${msg}`),
    section: (msg) => {
        console.log('\n' + '='.repeat(60));
        console.log(`  ${msg}`);
        console.log('='.repeat(60));
    }
};

// Detect system Chromium
function findChromium() {
    log.debug('Detecting system Chromium...');
    const platform = process.platform;
    
    if (platform === 'darwin') {
        const chromePaths = [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        ];
        
        for (const chromePath of chromePaths) {
            if (fs.existsSync(chromePath)) {
                log.info(`Found Chromium: ${chromePath}`);
                return chromePath;
            }
        }
    } else if (platform === 'linux') {
        const chromiumPaths = ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'];
        
        for (const cmd of chromiumPaths) {
            try {
                require('child_process').execSync(`which ${cmd}`, { stdio: 'ignore' });
                log.info(`Found Chromium: ${cmd}`);
                return cmd;
            } catch (e) {
                continue;
            }
        }
    } else if (platform === 'win32') {
        const chromePaths = [
            process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
            process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
            process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
            process.env.LOCALAPPDATA + '\\Microsoft\\Edge\\Application\\msedge.exe',
        ];
        
        for (const chromePath of chromePaths) {
            if (fs.existsSync(chromePath)) {
                log.info(`Found Chromium: ${chromePath}`);
                return chromePath;
            }
        }
    }
    
    log.warn('No system Chromium found');
    return null;
}

// Check if Electron is available
function findElectron() {
    log.debug('Detecting Electron...');
    const electronPath = path.join(__dirname, '..', 'node_modules', '.bin', 'electron');
    
    if (fs.existsSync(electronPath)) {
        log.info(`Found Electron: ${electronPath}`);
        return electronPath;
    }
    
    try {
        require('child_process').execSync('which electron', { stdio: 'ignore' });
        log.info('Found Electron: global');
        return 'electron';
    } catch (e) {
        log.warn('No Electron found');
        return null;
    }
}

// Detect OpenVSCode Server (preferred - lighter)
function findOpenVSCodeServer() {
    log.debug('Detecting OpenVSCode Server...');
    
    const candidates = [
        path.join(__dirname, '..', 'openvscode-server', 'bin', 'openvscode-server'),
        path.join(__dirname, '..', 'resources', 'openvscode-server', 'bin', 'openvscode-server'),
        '/opt/openvscode-server/bin/openvscode-server',
        '/usr/local/bin/openvscode-server',
        'openvscode-server',
    ];
    
    for (const candidate of candidates) {
        try {
            if (fs.existsSync(candidate)) {
                // Test if executable
                require('child_process').execSync(`${candidate} --version`, { stdio: 'ignore' });
                log.success(`Found OpenVSCode Server: ${candidate}`);
                return candidate;
            }
        } catch (e) {
            continue;
        }
    }
    
    log.debug('OpenVSCode Server not found');
    return null;
}

// Detect code-server (fallback)
function findCodeServer() {
    log.debug('Detecting code-server...');
    
    try {
        require('child_process').execSync('which code-server', { stdio: 'ignore' });
        log.success('Found code-server: system');
        return 'code-server';
    } catch (e) {
        log.warn('code-server not found');
        return null;
    }
}

// Check if lightweight VM is available
function findVMOption() {
    log.debug('Checking lightweight VM option...');
    
    const rootDir = path.resolve(__dirname, '..');
    const vmScript = path.join(rootDir, 'scripts', 'benchmarks', 'vscode_microvm.sh');
    const vmDir = path.join(rootDir, 'fast-openvscode-vm');
    
    // Check if script exists and is executable
    if (fs.existsSync(vmScript)) {
        // Check if VM artifacts exist (initramfs)
        const initramfs = path.join(vmDir, 'openvscode-initramfs.cpio.gz');
        if (fs.existsSync(initramfs)) {
            log.success('Found OpenVSCode lightweight VM option');
            return { script: vmScript, dir: vmDir };
        } else {
            log.debug('VM script found but artifacts not built');
        }
    } else {
        log.debug('VM script not found');
    }
    
    return null;
}

// Start Rust backend
function startBackend() {
    log.info('Starting Rust backend service...');
    
    const isMac = process.platform === 'darwin';
    const backendPath = isMac
        ? path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'vibecode')
        : path.join(__dirname, '..', 'target', 'release', 'vibecode-backend');
    
    // Check if backend exists
    if (!fs.existsSync(backendPath)) {
        log.warn(`Backend not found at ${backendPath}`);
        log.warn('Skipping backend (optional) - run: cd src-tauri && cargo build --release');
        return null;
    }
    
    log.info(`Starting backend: ${backendPath}`);
    const backend = spawn(backendPath, isMac ? ['--service'] : [], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
            ...process.env,
            VIBECODE_SERVICE_MODE: '1',
            VIBECODE_SERVICE_PORT: BACKEND_PORT.toString(),
        }
    });
    
    backend.stdout.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg) log.debug(`[Backend] ${msg}`);
    });
    
    backend.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg) log.debug(`[Backend] ${msg}`);
    });
    
    backend.on('error', (err) => {
        log.error(`Backend error: ${err.message}`);
    });
    
    backend.on('exit', (code) => {
        if (code !== 0) {
            log.warn(`Backend exited with code ${code}`);
        }
    });
    
    return backend;
}

// Start OpenVSCode Server (preferred - lighter)
function startOpenVSCodeServer(openvscodePath) {
    log.info('Starting OpenVSCode Server (lightweight)...');
    
    // Kill any existing on port
    const { execSync } = require('child_process');
    try {
        if (process.platform === 'darwin') {
            execSync(`lsof -ti:${OPENVSCODE_PORT} | xargs kill -9`, { stdio: 'ignore' });
        } else if (process.platform === 'linux') {
            execSync(`killall openvscode-server 2>/dev/null`, { stdio: 'ignore' });
        }
    } catch (e) {
        // Ignore
    }
    
    log.info(`Launching: ${openvscodePath}`);
    const server = spawn(openvscodePath, [
        '--host', '127.0.0.1',
        '--port', OPENVSCODE_PORT.toString(),
        '--without-connection-token',
        '--disable-telemetry',
        '.'
    ], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: path.join(__dirname, '..'),
    });
    
    server.stdout.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg.includes('Extension host agent listening')) {
            log.success('OpenVSCode Server ready!');
        }
        log.debug(`[OpenVSCode] ${msg}`);
    });
    
    server.stderr.on('data', (data) => {
        log.debug(`[OpenVSCode] ${data.toString().trim()}`);
    });
    
    server.on('error', (err) => {
        log.error(`OpenVSCode Server error: ${err.message}`);
    });
    
    server.on('exit', (code) => {
        log.warn(`OpenVSCode Server exited with code ${code}`);
    });
    
    return { process: server, port: OPENVSCODE_PORT, name: 'OpenVSCode Server' };
}

// Start code-server (fallback)
function startCodeServer() {
    log.info('Starting code-server...');
    
    const { execSync } = require('child_process');
    try {
        if (process.platform === 'darwin') {
            execSync(`lsof -ti:${CODE_SERVER_PORT} | xargs kill -9`, { stdio: 'ignore' });
        } else if (process.platform === 'linux') {
            execSync('killall code-server 2>/dev/null', { stdio: 'ignore' });
        }
    } catch (e) {
        // Ignore
    }
    
    const server = spawn('code-server', [
        '--bind-addr', `127.0.0.1:${CODE_SERVER_PORT}`,
        '--auth', 'none',
        '--disable-telemetry',
        '--disable-update-check',
        '--disable-workspace-trust',
        '.'
    ], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: path.join(__dirname, '..'),
    });
    
    server.stdout.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg.includes('HTTP server listening')) {
            log.success('code-server ready!');
        }
        log.debug(`[code-server] ${msg}`);
    });
    
    server.stderr.on('data', (data) => {
        log.debug(`[code-server] ${data.toString().trim()}`);
    });
    
    server.on('error', (err) => {
        log.error(`code-server error: ${err.message}`);
    });
    
    server.on('exit', (code) => {
        log.warn(`code-server exited with code ${code}`);
    });
    
    return { process: server, port: CODE_SERVER_PORT, name: 'code-server' };
}

// Start lightweight VM (super lightweight option)
function startLightweightVM(vmOption) {
    log.info('Starting lightweight OpenVSCode VM (super lightweight)...');
    
    const vmScript = vmOption.script;
    
    log.info(`Launching VM: ${vmScript}`);
    const vm = spawn('bash', [vmScript, 'start'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: path.join(__dirname, '..'),
    });
    
    vm.stdout.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg.includes('ready') || msg.includes('listening')) {
            log.success('OpenVSCode VM ready!');
        }
        log.debug(`[VM] ${msg}`);
    });
    
    vm.stderr.on('data', (data) => {
        log.debug(`[VM] ${data.toString().trim()}`);
    });
    
    vm.on('error', (err) => {
        log.error(`VM error: ${err.message}`);
    });
    
    vm.on('exit', (code) => {
        log.warn(`VM exited with code ${code}`);
    });
    
    return { process: vm, port: VM_PORT, name: 'OpenVSCode VM' };
}

// Wait for service to be ready
async function waitForService(url, name, retries = 30) {
    log.info(`Waiting for ${name} to be ready at ${url}...`);
    
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                log.success(`${name} is ready!`);
                return true;
            }
        } catch (err) {
            // Not ready yet
            if (i % 5 === 0 && i > 0) {
                log.debug(`Still waiting... (${i + 1}/${retries})`);
            }
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    log.warn(`${name} did not become ready after ${retries * 0.5} seconds`);
    return false;
}

// Launch Chromium in kiosk mode (FAST)
function launchChromiumKiosk(chromiumPath, editorPort, editorName) {
    log.info(`⚡ Using Chromium Kiosk mode (fastest)`);
    log.info(`   Editor: ${editorName} on port ${editorPort}`);
    
    const url = `http://localhost:${editorPort}`;
    
    const args = [
        '--kiosk',
        '--no-sandbox',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-breakpad',
        '--disable-client-side-phishing-detection',
        '--disable-component-extensions-with-background-pages',
        '--disable-default-apps',
        '--disable-dev-shm-usage',
        '--disable-extensions-file-access-check',
        '--disable-hang-monitor',
        '--disable-popup-blocking',
        '--disable-prompt-on-repost',
        '--disable-sync',
        '--disable-translate',
        '--disable-windows10-custom-titlebar',
        '--metrics-recording-only',
        '--no-first-run',
        '--no-default-browser-check',
        '--safebrowsing-disable-auto-update',
        '--enable-automation',
        '--password-store=basic',
        '--use-mock-keychain',
        '--memory-pressure-off',
        '--enable-fast-unload',
        '--force-color-profile=srgb',
        url
    ];
    
    log.info(`Launching Chromium: ${chromiumPath}`);
    log.debug(`URL: ${url}`);
    
    const chromium = spawn(chromiumPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    
    chromium.stdout.on('data', (data) => {
        log.debug(`[Chromium] ${data.toString().trim()}`);
    });
    
    chromium.stderr.on('data', (data) => {
        log.debug(`[Chromium] ${data.toString().trim()}`);
    });
    
    chromium.on('exit', (code) => {
        log.info(`Chromium closed (exit code: ${code})`);
        process.exit(0);
    });
    
    return chromium;
}

// Launch Electron (fallback)
function launchElectron(electronPath, editorPort, editorName) {
    log.info(`📦 Using Electron (fallback)`);
    log.info(`   Editor: ${editorName} on port ${editorPort}`);
    
    const mainJs = path.join(__dirname, '..', 'electron-vibecode', 'main.js');
    
    if (!fs.existsSync(mainJs)) {
        log.error('Electron main.js not found');
        return null;
    }
    
    log.info(`Launching Electron: ${electronPath}`);
    const electron = spawn(electronPath, [mainJs], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: path.join(__dirname, '..'),
        env: {
            ...process.env,
            CODE_SERVER_PORT: editorPort.toString(),
        }
    });
    
    electron.stdout.on('data', (data) => {
        log.debug(`[Electron] ${data.toString().trim()}`);
    });
    
    electron.stderr.on('data', (data) => {
        log.debug(`[Electron] ${data.toString().trim()}`);
    });
    
    electron.on('exit', (code) => {
        log.info(`Electron closed (exit code: ${code})`);
        process.exit(0);
    });
    
    return electron;
}

// Main launcher
async function main() {
    const args = process.argv.slice(2);
    const useVM = args.includes('--vm') || args.includes('-v');
    
    log.section('VibeCode Unified Launcher');
    log.info('Goal: Full OpenVSCode Server in super lightweight VM/app');
    console.log('');
    
    const startTime = Date.now();
    
    // Detect available components
    log.info('Detecting available components...');
    const chromiumPath = findChromium();
    const electronPath = findElectron();
    const openvscodePath = findOpenVSCodeServer();
    const codeServerPath = findCodeServer();
    const vmOption = findVMOption();
    
    console.log('\n📊 Detection Results:');
    console.log(`   Chromium: ${chromiumPath ? '✅' : '❌'}`);
    console.log(`   Electron: ${electronPath ? '✅' : '❌'}`);
    console.log(`   OpenVSCode Server: ${openvscodePath ? '✅' : '❌'} (preferred - lighter)`);
    console.log(`   code-server: ${codeServerPath ? '✅' : '❌'} (fallback)`);
    console.log(`   Lightweight VM: ${vmOption ? '✅' : '❌'} (super lightweight)\n`);
    
    if (!chromiumPath && !electronPath) {
        log.error('No browser found!');
        log.error('Please install Chrome, Chromium, Edge, or Electron');
        process.exit(1);
    }
    
    // Choose editor server (prefer VM, then OpenVSCode, then code-server)
    let editorServer;
    let editorPort;
    let editorName;
    
    if (useVM && vmOption) {
        log.info('🚀 Using lightweight VM option (super lightweight)');
        editorServer = startLightweightVM(vmOption);
        editorPort = VM_PORT;
        editorName = 'OpenVSCode VM';
        
        // Wait longer for VM to boot
        log.info('Waiting for VM to boot (this may take 5-10 seconds)...');
        await waitForService(`http://localhost:${VM_PORT}/healthz`, editorName, 60);
    } else if (openvscodePath) {
        log.info('Using OpenVSCode Server (lightweight)');
        editorServer = startOpenVSCodeServer(openvscodePath);
        editorPort = OPENVSCODE_PORT;
        editorName = 'OpenVSCode Server';
        await waitForService(`http://localhost:${editorPort}`, editorName, 60);
    } else if (codeServerPath) {
        log.info('Using code-server (fallback)');
        editorServer = startCodeServer();
        editorPort = CODE_SERVER_PORT;
        editorName = 'code-server';
        await waitForService(`http://localhost:${editorPort}`, editorName, 60);
    } else {
        log.error('No editor server found!');
        log.error('Options:');
        log.error('  1. Install OpenVSCode Server or code-server');
        log.error('  2. Use VM: npm start -- --vm');
        process.exit(1);
    }
    
    // Start backend (optional)
    log.info('Starting backend services...');
    const backend = startBackend();
    if (backend) {
        await waitForService(`http://localhost:${BACKEND_PORT}/health`, 'Rust Backend', 30);
    } else {
        log.warn('Backend not available - continuing without it');
    }
    
    const startupTime = ((Date.now() - startTime) / 1000).toFixed(2);
    log.success(`Startup complete in ${startupTime}s\n`);
    
    // Launch browser (prefer Chromium Kiosk)
    let browser;
    if (chromiumPath) {
        console.log('⚡ Performance Mode: Chromium Kiosk');
        console.log(`   Startup: ${startupTime}s`);
        console.log(`   Memory: ~30-40MB (vs 70-80MB Electron)`);
        console.log(`   Speed: 3-4x faster than Electron\n`);
        browser = launchChromiumKiosk(chromiumPath, editorPort, editorName);
    } else if (electronPath) {
        console.log('📦 Fallback Mode: Electron');
        console.log(`   Startup: ${startupTime}s`);
        console.log(`   Memory: ~70-80MB\n`);
        browser = launchElectron(electronPath, editorPort, editorName);
    }
    
    if (!browser) {
        log.error('Failed to launch browser');
        process.exit(1);
    }
    
    // Show status
    log.section('VibeCode Running');
    log.success(`Editor: http://localhost:${editorPort} (${editorName})`);
    if (backend) {
        log.success(`Backend: http://localhost:${BACKEND_PORT}`);
    }
    log.success(`Browser: ${chromiumPath ? 'Chromium Kiosk ⚡' : 'Electron 📦'}`);
    console.log('');
    
    // Cleanup on exit
    process.on('SIGINT', () => {
        console.log('\n');
        log.info('Shutting down...');
        browser.kill();
        editorServer.process.kill();
        if (backend) backend.kill();
        if (vmOption && useVM) {
            // Stop VM
            const vmStop = spawn('bash', [vmOption.script, 'stop'], {
                stdio: 'inherit',
                cwd: path.join(__dirname, '..'),
            });
        }
        log.success('All services stopped');
        process.exit(0);
    });
    
    // Keep process alive
    process.on('uncaughtException', (err) => {
        log.error(`Uncaught exception: ${err.message}`);
        console.error(err);
    });
}

main().catch((err) => {
    log.error(`Fatal error: ${err.message}`);
    console.error(err);
    process.exit(1);
});

// Polyfill fetch for Node < 18
if (typeof fetch === 'undefined') {
    global.fetch = require('node-fetch');
}
