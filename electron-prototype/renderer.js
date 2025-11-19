// Renderer process script
// This runs in the browser context with access to electronAPI via preload

const startTime = performance.now();

// DOM elements
let statusDot, statusText, launchBtn, refreshBtn, serverStatus;
let welcomeScreen, loadingScreen, errorMessage;
let platform, arch, electronVersion, loadTime;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('Renderer script loaded');

  // Get DOM elements
  statusDot = document.getElementById('statusDot');
  statusText = document.getElementById('statusText');
  launchBtn = document.getElementById('launchBtn');
  refreshBtn = document.getElementById('refreshBtn');
  serverStatus = document.getElementById('serverStatus');
  welcomeScreen = document.getElementById('welcomeScreen');
  loadingScreen = document.getElementById('loadingScreen');
  errorMessage = document.getElementById('errorMessage');
  platform = document.getElementById('platform');
  arch = document.getElementById('arch');
  electronVersion = document.getElementById('electronVersion');
  loadTime = document.getElementById('loadTime');

  // Set platform info
  if (window.electronAPI) {
    platform.textContent = window.electronAPI.platform;
    arch.textContent = window.electronAPI.arch;
    electronVersion.textContent = window.electronAPI.version;
  }

  // Check server status
  checkServerStatus();

  // Event listeners
  launchBtn.addEventListener('click', loadVSCode);
  refreshBtn.addEventListener('click', checkServerStatus);

  // Listen for server ready event
  if (window.electronAPI && window.electronAPI.onServerReady) {
    window.electronAPI.onServerReady((data) => {
      console.log('Server ready:', data);
      updateServerStatus(true, data);
    });
  }

  // Calculate load time
  const currentTime = performance.now();
  const duration = Math.round(currentTime - startTime);
  loadTime.textContent = `Loaded in ${duration}ms`;
});

// Check server status
async function checkServerStatus() {
  console.log('Checking server status...');

  if (!window.electronAPI) {
    console.error('electronAPI not available');
    updateServerStatus(false);
    return;
  }

  try {
    const status = await window.electronAPI.getServerStatus();
    console.log('Server status:', status);
    updateServerStatus(status.ready, status);
  } catch (error) {
    console.error('Failed to get server status:', error);
    updateServerStatus(false);
  }
}

// Update UI based on server status
function updateServerStatus(ready, data = {}) {
  if (ready) {
    // Server is ready
    statusDot.className = 'status-dot ready';
    statusText.textContent = 'VS Code Server Ready';
    serverStatus.textContent = `Ready (port ${data.port})`;
    launchBtn.disabled = false;
    errorMessage.style.display = 'none';
  } else {
    // Server not ready
    statusDot.className = 'status-dot error';
    statusText.textContent = 'Server Not Available';
    serverStatus.textContent = 'Not Running';
    launchBtn.disabled = true;
    errorMessage.style.display = 'block';
  }
}

// Load VS Code in the window
async function loadVSCode() {
  console.log('Loading VS Code...');

  // Show loading screen
  welcomeScreen.style.display = 'none';
  loadingScreen.style.display = 'flex';
  statusText.textContent = 'Loading VS Code...';

  try {
    const result = await window.electronAPI.loadVSCode();

    if (result.success) {
      console.log('VS Code loaded successfully');
      statusText.textContent = 'VS Code Loaded';
    } else {
      console.error('Failed to load VS Code:', result.error);
      welcomeScreen.style.display = 'flex';
      loadingScreen.style.display = 'none';
      statusText.textContent = 'Failed to Load';
      alert(`Failed to load VS Code: ${result.error}`);
    }
  } catch (error) {
    console.error('Error loading VS Code:', error);
    welcomeScreen.style.display = 'flex';
    loadingScreen.style.display = 'none';
    statusText.textContent = 'Error';
    alert(`Error loading VS Code: ${error.message}`);
  }
}

// Performance monitoring
if (window.electronAPI && window.electronAPI.performance) {
  window.electronAPI.performance.mark('renderer-start');

  window.addEventListener('load', () => {
    window.electronAPI.performance.mark('renderer-loaded');

    try {
      const measure = window.electronAPI.performance.measure(
        'renderer-load-time',
        'renderer-start',
        'renderer-loaded'
      );

      if (measure) {
        console.log(`Renderer load time: ${Math.round(measure.duration)}ms`);
      }
    } catch (err) {
      console.error('Performance measurement error:', err);
    }
  });
}

// Global error handler
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

console.log('Renderer script initialized');
