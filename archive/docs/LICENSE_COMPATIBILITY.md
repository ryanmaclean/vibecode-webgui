# License Compatibility Research

## VibeCode License

**MIT License** - Fully permissive, OSI-approved open source

Allows:
- Commercial use
- Modification
- Distribution
- Private use
- Sublicensing

## Third-Party Tools Evaluated

### Compatible (Can Use/Integrate)

**Podman** - Apache 2.0
- ✅ MIT compatible
- Used as architecture reference
- No code copied, just studied approach

**VirtualBuddy** - MIT License  
- ✅ MIT compatible
- Studied VZ implementation patterns
- Referenced for disk attachment modes

### Incompatible (Reference Only)

**Tart** - Fair Source License v0.9
- ❌ NOT MIT compatible
- ❌ NOT true open source (not OSI-approved)
- ❌ Has usage limits (100 CPU cores)
- ❌ Requires paid license for organizations

**Source**: [tart.run/licensing](https://tart.run/licensing/)

**Tart License Restrictions**:
```
Use Limitation: 100 users (defined as CPU cores)
The Use Limitation does not apply to CPUs installed 
in devices used by a single individual.
```

**Impact for VibeCode**:
- ❌ Cannot use Tart's code
- ❌ Cannot redistribute Tart's VM images
- ❌ Cannot integrate Tart as dependency
- ✅ CAN study their architecture (documentation only)
- ✅ CAN implement similar patterns (VZ API is public)

## What We Can Do

### From Tart (Architecture Reference Only)

Study their approach:
- How they distribute VM images (container registry)
- How they handle VirtIO-FS (directory mounting)
- How they solve bootloader issues
- Their Swift code patterns for VZ

**Credit**: Acknowledge Tart as architectural inspiration in docs.

**Do NOT**: Use their code, images, or integrate their tool.

### From Other Sources

**Podman (Apache 2.0)** - ✅ Compatible
- Can reference code
- Can use similar patterns
- Already used as reference

**VirtualBuddy (MIT)** - ✅ Compatible  
- Can reference code
- Can use similar patterns
- Already used as reference

**Apple VZ Documentation** - ✅ Public API
- Can use freely
- Official Apple documentation
- Recommended patterns

## Decision

**Do NOT integrate Tart or use their VM images.**

Reasons:
1. License incompatibility (Fair Source vs MIT)
2. Would require paid license for organizations
3. Not true open source
4. Creates legal complications

**Do**: Continue with independent MIT-licensed implementation.

## Alternative Solutions

Instead of Tart images, use:
1. Official Alpine/Ubuntu cloud images (free, open)
2. Build our own images with Packer (open source tool)
3. Pre-boot images with our own scripts
4. Document the manual setup process

## References

- Tart website: https://tart.run/
- Tart licensing: https://tart.run/licensing/
- Fair Source License: https://fair.io/
- VibeCode license: MIT (see LICENSE file)

## Conclusion

Tart is interesting as a reference but cannot be integrated due to licensing restrictions. We remain fully MIT-licensed and independent.

