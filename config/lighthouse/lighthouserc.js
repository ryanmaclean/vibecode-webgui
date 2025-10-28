{
  "ci": {
    "collect": {
      "numberOfRuns": 5,
      "settings": {
        "chromeFlags": "--no-sandbox --disable-dev-shm-usage"
      }
    },
    "assert": {
      "assertions": {
        "categories:performance": ["warn", {"minScore": 0.8}],
        "categories:accessibility": ["warn", {"minScore": 0.9}],
        "categories:best-practices": ["warn", {"minScore": 0.8}],
        "categories:seo": ["warn", {"minScore": 0.8}]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  },
  "urls": [
    {
      "url": "http://localhost:8080",
      "name": "VibeCode-Tauri-WebKit"
    },
    {
      "url": "http://localhost:3000",
      "name": "VibeCode-Electron-Chromium"
    }
  ]
}