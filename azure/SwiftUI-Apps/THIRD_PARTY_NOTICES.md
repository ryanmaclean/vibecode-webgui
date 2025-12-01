# Third-Party Notices

This project incorporates components from the projects listed below. The original copyright notices and the licenses under which VibeCode received such components are set forth below.

## Runtime Components

### Bun Runtime
- **License:** MIT License
- **Source:** https://github.com/oven-sh/bun
- **Usage:** JavaScript/TypeScript runtime used within the application
- **Copyright:** Copyright (c) 2021-present Jarred Sumner

The Bun runtime is included in the application bundle and is subject to the MIT License, which permits commercial use, modification, and distribution.

### Busybox
- **License:** GNU General Public License v2 (GPL v2)
- **Source:** https://busybox.net/
- **Usage:** Unix utilities running inside VM guest environment
- **Copyright:** Various contributors

**GPL Compliance Note:** Busybox runs exclusively inside the virtualized Linux guest environment and is NOT linked with or incorporated into the Swift application binary. The Swift application (host) communicates with the VM guest through standard virtualization interfaces (stdin/stdout/network sockets). This architecture ensures GPL compliance while maintaining the MIT license for the Swift application code.

The GPL requirements apply only to the VM guest environment where Busybox executes. Users who receive this software also receive:
1. The ability to run and inspect the VM guest environment
2. Access to Alpine Linux package sources where Busybox is obtained
3. No technical restrictions on modifying the VM guest environment

### Dropbear SSH
- **License:** MIT-style License
- **Source:** https://github.com/mkj/dropbear
- **Usage:** Lightweight SSH server for VM guest access
- **Copyright:** Copyright (c) 2002-2023 Matt Johnston

Dropbear is a small SSH server and client licensed under a permissive MIT-style license, allowing free use, modification, and distribution.

### Alpine Linux
- **License:** Various permissive licenses (MIT, BSD, GPL)
- **Source:** https://alpinelinux.org/
- **Usage:** Base Linux distribution for VM guest environment
- **Copyright:** Alpine Linux Development Team

Alpine Linux is used as the guest operating system within the virtualized environment. It consists of multiple packages, each with its own license:
- Core system utilities: Mix of BSD, GPL, and MIT licenses
- musl libc: MIT License
- BusyBox: GPL v2 (see separate notice above)

### OpenVSCode Server
- **License:** MIT License
- **Source:** https://github.com/gitpod-io/openvscode-server
- **Usage:** Web-based code editor running in VM guest
- **Copyright:** Copyright (c) Gitpod and Microsoft Corporation

OpenVSCode Server is a fork of Visual Studio Code that runs as a web server, licensed under the MIT License.

## Development Dependencies

The following components are used during development but are not distributed with the application:

- **Python 3:** PSF License
- **Datadog Tracing:** BSD-3-Clause License
- **Starlight Documentation:** MIT License

## License Compatibility Summary

This project's MIT license is compatible with all included components:

| Component | License | Distribution Method | Linked to Swift App |
|-----------|---------|---------------------|---------------------|
| Bun Runtime | MIT | Bundled in app | No (VM guest) |
| Busybox | GPL v2 | VM guest only | No |
| Dropbear | MIT-style | VM guest only | No |
| Alpine Linux | Various | VM guest only | No |
| OpenVSCode | MIT | VM guest only | No |

## GPL Compliance Details

**Important:** The use of GPL-licensed components (specifically Busybox) in this project does NOT affect the license of the Swift application code because:

1. **Separation via Virtualization:** The GPL components run inside a Linux virtual machine guest environment. The Swift application (host) and GPL components (guest) are separate processes in separate operating systems.

2. **No Static or Dynamic Linking:** The Swift application does not link against GPL libraries. All communication happens through standard I/O and network protocols.

3. **Distribution Transparency:** The VM guest environment is distributed as a separate .cpio.gz archive that can be extracted, modified, and rebuilt by users without restriction.

4. **Source Availability:** All GPL components are standard Alpine Linux packages. Source code is available from:
   - Alpine Linux package repositories: https://pkgs.alpinelinux.org/
   - Busybox source: https://busybox.net/downloads/

This architectural separation is similar to how:
- macOS (proprietary) can run Linux VMs with GPL software
- Docker Desktop (proprietary) can run GPL-licensed containers
- VMware/VirtualBox (mixed licensing) can run GPL operating systems

The virtualization boundary creates a clear separation that prevents GPL obligations from extending to the host application.

## Source Code Access

For all MIT-licensed components, source code is available at the GitHub repositories linked above. For GPL components, source code is available from the Alpine Linux package repositories.

Users wishing to modify GPL components should:
1. Extract the .cpio.gz guest filesystem archive
2. Modify the contents as desired
3. Rebuild using standard Alpine Linux tools
4. Replace the archive in the application bundle

## Questions?

For questions about licensing or to request source code, please open an issue at:
https://github.com/your-org/vibecode-webgui

---

Last Updated: 2025-11-25
