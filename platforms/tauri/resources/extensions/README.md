# Bundled VS Code extensions

`install-extensions.sh` installs every `*.vsix` in this directory and skips
cleanly when there is none. The VSIX is a build output and is not committed
(untracked 2026-10-24, WS2 of the repo split). Rebuild it with:

```sh
cd extensions/workspace-rag && npm ci && npm run package
cp extensions/workspace-rag/workspace-rag-*.vsix platforms/tauri/resources/extensions/
```

`tauri.conf.json` does not bundle this directory, so the Tauri build does not
need the VSIX. `manifest.json` records the last packaged file and its sha256.
