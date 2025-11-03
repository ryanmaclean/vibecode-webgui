---
name: Study Tart/UTM implementations to improve VibeCode
about: Research how Tart and UTM solve problems we're facing
title: 'Research: Learn from Tart and UTM VZ implementations'
labels: research, enhancement
assignees: ''
---

## Objective

Study how Tart and UTM (production VZ tools) solve problems we're currently facing.

**Legal Note**: We can read and learn from their code, but cannot copy it. Tart is Fair Source (incompatible with our MIT license), UTM is Apache 2.0 (compatible).

## Tools to Study

### 1. Tart
- **Source**: https://github.com/cirruslabs/tart
- **License**: Fair Source (can study, cannot copy)
- **Language**: Swift
- **Focus**: Production VM management with VZ

### 2. UTM
- **Source**: https://github.com/utmapp/UTM
- **License**: Apache 2.0 (can study and reference)
- **Language**: Swift + Objective-C
- **Focus**: Full-featured VM manager

### 3. VirtualBuddy (already studied)
- **Source**: https://github.com/insidegui/VirtualBuddy
- **License**: MIT (fully compatible)

## Specific Problems to Solve

### 1. Bootloader Configuration

**Our Issue**: Fresh Alpine images don't boot ("invalid bootloader")

**Research Questions**:
- How does Tart handle fresh Linux images?
- How does UTM configure EFI for Linux VMs?
- What's their EFI initialization process?
- Do they use cloud-init ISOs?

**Files to Check**:
- Tart: VM boot configuration
- UTM: QEMUGuest.swift, UTMVirtualMachine.swift

### 2. VirtIO-FS (Directory Mounting)

**Our Gap**: No host-VM file sharing

**Research Questions**:
- How does Tart implement `--dir` mounting?
- What VZ APIs do they use for VirtIO-FS?
- How do they configure the shared directories?

**Tart Feature**:
```bash
tart run --dir=project:~/src/project vm
```

**What to Learn**: VZ VirtioFS configuration

### 3. VM Image Distribution

**Our Problem**: VM images too large for git

**Research Questions**:
- How does Tart use container registries for VMs?
- What's their image format?
- How do they handle downloads?
- Could we do similar with GitHub Releases?

**Tart Approach**:
```bash
tart clone ghcr.io/cirruslabs/ubuntu:latest
```

### 4. SSH Access

**Our Gap**: No easy SSH to VMs

**Research Questions**:
- How does `tart ip <vm>` work?
- Do they use DHCP leases?
- How do they discover VM IPs?
- What's their networking setup?

### 5. Linux Guest Support

**Our Question**: How to make Linux boot reliably?

**Research Questions**:
- What Linux distros do they use?
- How do they configure bootloader?
- Do they pre-install services?
- What's their cloud-init approach?

## Research Tasks

- [ ] Clone Tart repository, read source code
- [ ] Clone UTM repository, read source code
- [ ] Document EFI/bootloader patterns they use
- [ ] Document VirtIO-FS implementation
- [ ] Document image distribution approach
- [ ] Document networking/IP discovery
- [ ] Create implementation tasks based on findings

## Implementation Rules

**Can Do**:
- Read their code to understand patterns
- Implement similar functionality ourselves
- Use same VZ APIs (public Apple API)
- Credit them in documentation

**Cannot Do**:
- Copy their code (even with modification)
- Use their VM images
- Integrate their tools
- Violate their licenses

## Deliverables

After research:
1. Document findings in `docs/TART_UTM_RESEARCH.md`
2. Create specific implementation issues
3. Provide code examples (our own implementation)
4. Credit sources appropriately

## Success Criteria

- [ ] Understand how they solve bootloader issues
- [ ] Understand VirtIO-FS implementation
- [ ] Have actionable improvements for VibeCode
- [ ] All solutions are MIT-compatible (our own code)

## Timeline

Research: 2-4 hours  
Implementation: Depends on findings

This is important work that could unblock all remaining issues.

