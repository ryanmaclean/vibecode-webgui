========================================
  VibeCode Unified Services v3.2.0
========================================

Welcome to VibeCode Unified Services!

INSTALLATION
------------
1. Drag "UnifiedServicesVibeCodeApp.app" to the Applications folder
2. Open the app from your Applications folder or via Spotlight
3. Look for the VibeCode icon in your menubar (top-right of screen)
4. Wait ~2 minutes for initial boot and network setup

IMPORTANT NOTES
---------------
- This is a MENUBAR app - it will NOT appear in the Dock
- Look for the VibeCode icon in your menubar after launching
- First boot takes ~2 minutes for VM initialization

SERVICES
--------
All services are accessible on localhost:

  SSH:        localhost:2222
  Valkey:     localhost:6379
  PostgreSQL: localhost:5432
  OpenVSCode: http://localhost:8080

CONNECTION EXAMPLES
-------------------
SSH:
  ssh root@localhost -p 2222
  Password: vibecode

Valkey (Redis-compatible):
  redis-cli -h localhost -p 6379
  redis-cli -h localhost -p 6379 ping

PostgreSQL:
  psql -h localhost -p 5432 -U vibecode vibecode
  Password: vibecode

OpenVSCode:
  Open http://localhost:8080 in your browser

SYSTEM REQUIREMENTS
-------------------
- macOS 13.0 (Ventura) or later
- Apple Silicon (M1/M2/M3/M4)
- 8GB RAM recommended
- 2GB free disk space

TROUBLESHOOTING
---------------
Services not working?
- Wait full 2 minutes after launch
- Check menubar shows VM IP address
- Verify ports aren't in use: lsof -i :8080

Can't find the app?
- It's in the MENUBAR (top-right), not the Dock
- This is intentional - it's designed as a background service

DOCUMENTATION
-------------
Full release notes and documentation:
  /azure/SwiftUI-Apps/docs/releases/RELEASE-NOTES-v3.2.0.md

LICENSE
-------
MIT License

SUPPORT
-------
Report issues via GitHub Issues

========================================
Version: 3.2.0
Release Date: January 13, 2026
Build: menubar-app
========================================
