// Chromium Kiosk launcher - Faster than Electron
// Uses system Chromium instead of bundling Electron

const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const CODE_SERVER_PORT = 8080;
const BACKEND_PORT = 3030;

// Detect system Chromium
function findChromium() {
    const platform = process.platform;
    
    if (platform === 'darwin') {
        // macOS: Use Chrome/Chromium if installed
        const chromePaths = [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        ];
        
        for (const chromePath of chromePaths) {
            if (require('fs').existsSync(chromePath)) {
                return chromePath;
            }
        }
        
        // Fallback: use system default browser
        return null;
    } else if (platform === 'linux') {
        // Linux: Try common Chromium paths
        const chromiumPaths = [
            'chromium',
            'chromium-browser',
            'google-chrome',
            'google-chrome-stable',
        ];
        
        for (const cmd of chromiumPaths) {
            try {
                require('child_process').execSync(`which ${cmd}`, { stdio: 'ignore' });
                return cmd;
            } catch (e) {
                continue;
            }
        }
    } else if (platform === 'win32') {
        // Windows: Use Edge WebView2 or Chrome
        const chromePaths = [
            process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
            process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
            process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
            process.env.LOCALAPPDATA + '\\Microsoft\\Edge\\Application\\msedge.exe',
        ];
        
        for (const chromePath of chromePaths) {
            if (require('fs').existsSync(chromePath)) {
                return chromePath;
            }
        }
    }
    
    return null;
}

// Start Rust backend
function startBackend() {
    console.log('🚀 Starting Rust backend...');
    
    const isMac = process.platform === 'darwin';
    const backendPath = isMac
        ? path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'vibecode')
        : path.join(__dirname, '..', 'target', 'release', 'vibecode-backend');
    
    return spawn(backendPath, isMac ? ['--service'] : [], {
        stdio: 'inherit',
        env: {
            ...process.env,
            VIBECODE_SERVICE_MODE: '1',
            VIBECODE_SERVICE_PORT: BACKEND_PORT.toString(),
        }
    });
}

// Start code-server
function startCodeServer() {
    console.log('🚀 Starting code-server...');
    
    // Kill any existing code-server
    const { execSync } = require('child_process');
    try {
        if (process.platform === 'darwin') {
            execSync('lsof -ti:8080 | xargs kill -9', { stdio: 'ignore' });
        } else if (process.platform === 'linux') {
            execSync('killall code-server 2>/dev/null', { stdio: 'ignore' });
        }
    } catch (e) {
        // Ignore
    }
    
    return spawn('code-server', [
        '--bind-addr', '127.0.0.1:8080',
        '--auth', 'none',
        '--disable-telemetry',
        '--disable-update-check',
        '--disable-workspace-trust',
        '.'
    ], {
        stdio: 'pipe',
        cwd: path.join(__dirname, '..'),
    });
}

// Wait for service to be ready
async function waitForService(url, retries = 30) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url);
            if (response.ok) return true;
        } catch (err) {
            // Not ready yet
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    return false;
}

// Launch Chromium in kiosk mode
function launchChromium(chromiumPath) {
    console.log('🚀 Launching Chromium in kiosk mode...');
    
    const url = `http://localhost:${CODE_SERVER_PORT}`;
    
    // Kiosk mode flags for performance
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
        url
    ];
    
    const chromium = spawn(chromiumPath, args, {
        stdio: 'inherit',
    });
    
    chromium.on('exit', () => {
        console.log('Chromium closed');
        process.exit(0);
    });
    
    return chromium;
}

// Main
async function main() {
    console.log('🚀 VibeCode Chromium Kiosk Launcher');
    console.log('Using system Chromium (faster than Electron)');
    
    // Find system Chromium
    const chromiumPath = findChromium();
    if (!chromiumPath) {
        console.error('❌ No Chromium browser found!');
        console.error('Please install Chrome, Chromium, or Edge');
        process.exit(1);
    }
    
    console.log(`✅ Found Chromium: ${chromiumPath}`);
    
    // Start backend
    const backend = startBackend();
    await waitForService(`http://localhost:${BACKEND_PORT}/health`);
    
    // Start code-server
    const codeServer = startCodeServer();
    await waitForService(`http://localhost:${CODE_SERVER_PORT}`);
    
    console.log('✅ Services ready');
    
    // Launch Chromium
    const chromium = launchChromium(chromiumPath);
    
    // Cleanup on exit
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down...');
        chromium.kill();
        codeServer.kill();
        backend.kill();
        process.exit(0);
    });
}

main().catch(console.error);

// Polyfill fetch for Node < 18
if (typeof fetch === 'undefined') {
    global.fetch = require('node-fetch');
}

