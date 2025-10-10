# VibeCode Tauri Backend

This directory contains the Rust backend for the VibeCode desktop application, built with Tauri 2.x.

## Project Structure

```
src-tauri/
├── src/
│   ├── main.rs           # Application entry point
│   ├── commands.rs       # Tauri command handlers (exposed to frontend)
│   └── docker.rs         # Docker integration via Bollard
├── icons/                # Application icons (placeholder - needs proper assets)
├── Cargo.toml            # Rust dependencies
├── tauri.conf.json       # Tauri configuration
└── build.rs              # Build script
```

## Features

### Implemented Commands

1. **ping()** - Health check command (Issue #491)
   - Returns: `"pong"`
   - Usage: `await invoke('ping')`

2. **launch_browser(url: string)** - Auto-launch system default browser (Issue #491 - P0)
   - Parameters: `url: String`
   - Returns: `Result<(), String>`
   - Usage: `await invoke('launch_browser', { url: 'http://localhost:3000' })`
   - Platform support: macOS, Windows, Linux

3. **greet(name: string)** - Simple greeting command for testing
   - Returns: `String`
   - Usage: `await invoke('greet', { name: 'Developer' })`

4. **check_docker()** - Verifies if Docker is running and accessible
   - Returns: `Result<bool, String>`
   - Usage: `await invoke('check_docker')`

5. **get_docker_version()** - Returns Docker daemon version
   - Returns: `Result<String, String>`
   - Usage: `await invoke('get_docker_version')`

6. **get_docker_status()** - Get Docker availability and version
   - Returns: `Result<{ available: bool, version?: string }, String>`
   - Usage: `await invoke('get_docker_status')`

7. **get_docker_info()** - Get detailed Docker system information
   - Returns: `Result<{ containers, images, memory_total, cpus, os_type, architecture }, String>`
   - Usage: `await invoke('get_docker_info')`

### Dependencies

- **tauri**: Desktop application framework
- **tauri-plugin-shell**: Shell command execution
- **bollard**: Docker API client for Rust
- **mdns-sd**: mDNS/Bonjour service discovery
- **tokio**: Async runtime
- **serde/serde_json**: Serialization

## Development

### Prerequisites

- Rust (latest stable)
- Node.js 18+
- Docker Desktop (for Docker features)

### Commands

```bash
# Run in development mode (from project root)
npm run tauri:dev

# Build production bundle
npm run tauri:build

# Build debug bundle
npm run tauri:build:debug

# Check Rust compilation
cd src-tauri && cargo check

# Run Rust tests
cd src-tauri && cargo test
```

## Frontend Integration

### Using Tauri Commands

```typescript
import { tauriCommands } from '@/lib/tauri';

// Check if running in Tauri
if (isTauri()) {
  // Call Tauri backend
  const greeting = await tauriCommands.greet('Developer');
  const dockerAvailable = await tauriCommands.checkDocker();
  const dockerVersion = await tauriCommands.getDockerVersion();
}
```

### React Hook

```typescript
import { useTauri } from '@/lib/tauri';

function MyComponent() {
  const { isTauri, commands } = useTauri();

  if (!isTauri) {
    return <div>Web version</div>;
  }

  // Use commands...
}
```

## Configuration

### Next.js Export Mode

Tauri requires static HTML/JS/CSS. The configuration uses `NEXT_OUTPUT_MODE=export`:

```bash
npm run build:export
```

This generates static files in the `out/` directory, which Tauri serves.

### Security

The `tauri.conf.json` includes Content Security Policy (CSP) settings aligned with the Next.js configuration:

- Allows required external services (Datadog, OpenRouter, OpenAI, Anthropic)
- Permits WebSocket connections for development
- Restricts script sources to trusted domains

## Next Steps

### Issue #489 - Tauri Backend Scaffolding - ✅ COMPLETE

- [x] Initialize Tauri project structure
- [x] Configure Next.js integration
- [x] Add Docker detection commands
- [x] Rust compilation successful (cargo build --release)
- [x] 7 functional IPC commands implemented
- [x] Error handling and Result types
- [x] Docker API integration via Bollard
- [x] Cross-platform command support
- [ ] Create proper application icons (deferred)
- [ ] Test development workflow (`npm run tauri:dev`) - needs Next.js dev server
- [ ] Add mDNS service discovery (future enhancement)

### Issue #491 - Browser Auto-Launch - ✅ COMPLETE

- [x] launch_browser command with cross-platform support
- [x] macOS: `open` command
- [x] Windows: `cmd /C start` command
- [x] Linux: `xdg-open` command
- [x] ping command for health checks
- [x] Error handling with descriptive messages
- [ ] Integration testing with frontend

### Issue #488 - Menu Bar Integration - 🔄 IN PROGRESS

- [ ] Basic menu structure in Tauri
- [ ] File menu (New, Open, Save, Quit)
- [ ] Edit menu (Undo, Redo, Cut, Copy, Paste)
- [ ] View menu (Toggle DevTools, Zoom)
- [ ] Help menu (Documentation, About)
- [ ] macOS-specific menu bar behavior

### Future Enhancements

- Container lifecycle management
- File system operations
- System tray integration
- Auto-updater
- Deep linking support
- Native notifications

## Troubleshooting

### Tauri CLI Issues

If you encounter "Cannot find native binding" errors:

```bash
rm -rf node_modules package-lock.json
npm install
```

### Rust Compilation Errors

```bash
cd src-tauri
cargo clean
cargo check
```

### Docker Connection Issues

Ensure Docker Desktop is running:

```bash
docker ps
```

## Resources

- [Tauri Documentation](https://tauri.app/v2/)
- [Bollard (Docker) Docs](https://docs.rs/bollard/)
- [Next.js Static Export](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
