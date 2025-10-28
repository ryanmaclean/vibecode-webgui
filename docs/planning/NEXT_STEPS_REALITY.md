# VibeCode - What Actually Needs to Be Built

## Current State ✅

### What Works Now
- ✅ code-server running in Apple Container
- ✅ Accessible at http://localhost:8080
- ✅ Version: 4.104.2 (latest)
- ✅ Multiple browser windows can connect
- ✅ Container CLI installed and working

### What Doesn't Exist Yet
- ❌ Native macOS .app
- ❌ Drag-to-Applications experience
- ❌ mDNS/Bonjour discovery
- ❌ Collaborative editing (SubEtha-style)
- ❌ Menu bar integration
- ❌ Auto-launch on startup

## User Experience Gaps

### Current (CLI-based) ❌
```bash
# Terminal required
brew install --cask container
container system start
container run -d -p 8080:8080 codercom/code-server
open http://localhost:8080
```

### Desired (Native App) ✅
```
1. Download VibeCode.dmg
2. Drag VibeCode.app to Applications
3. Double-click VibeCode.app
4. Browser opens automatically
5. Start coding
```

## What Needs to Be Built

### 1. Native macOS Application

**Technology**: Swift + SwiftUI
**Components**:
- Main app window
- Menu bar integration
- Container CLI wrapper
- Auto-start service
- Browser launcher

**Estimated Time**: 1-2 weeks

### 2. .pkg Installer

**What it does**:
1. Checks requirements (macOS 15+, Apple Silicon)
2. Installs Homebrew (if needed)
3. Installs container CLI
4. Copies VibeCode.app to /Applications
5. Starts container service
6. Launches app

**Estimated Time**: 3-4 days

### 3. mDNS/Bonjour Discovery

**Purpose**: Find other VibeCode instances on local network

**Implementation**:
```swift
import Network

// Advertise
let service = NWListener.Service(
    name: "Ryan's VibeCode",
    type: "_vibecode._tcp"
)

// Discover
let browser = NWBrowser(
    for: .bonjour(type: "_vibecode._tcp", domain: nil),
    using: .tcp
)
```

**Estimated Time**: 1 week

### 4. Collaborative Editing

**Current State**: code-server supports multiple connections
**Gap**: No real-time collaboration (like SubEtha/Google Docs)

**Options**:

#### Option A: VS Code Live Share Extension
- Install in code-server
- Native VS Code feature
- **Pros**: Already exists
- **Cons**: Requires Microsoft account

#### Option B: Custom WebSocket Sync
- Build our own using Yjs or ShareDB
- **Pros**: Full control, no external deps
- **Cons**: Complex to build

#### Option C: Hybrid
- Use code-server's built-in multi-user
- Add real-time cursor sync
- Add presence indicators
- **Pros**: Best of both worlds
- **Cons**: Moderate complexity

**Estimated Time**: 2-3 weeks

## Realistic Implementation Plan

### Phase 1: Native App (Priority 1)
**Time**: 2 weeks
**Deliverable**: VibeCode.app that launches code-server

```
Week 1:
- [ ] Create Xcode project
- [ ] Swift UI main window
- [ ] Container CLI integration
- [ ] Browser auto-launch

Week 2:
- [ ] Menu bar integration
- [ ] Preferences panel
- [ ] Auto-start on login
- [ ] Icon and branding
```

### Phase 2: Distribution (Priority 2)
**Time**: 1 week
**Deliverable**: .pkg installer + .dmg

```
- [ ] Create .pkg with scripts
- [ ] Design .dmg background
- [ ] Code signing
- [ ] Notarization
- [ ] Homebrew cask formula
```

### Phase 3: Network Discovery (Priority 3)
**Time**: 1 week
**Deliverable**: mDNS discovery and joining

```
- [ ] Bonjour service advertisement
- [ ] Network browser UI
- [ ] Session joining
- [ ] Authentication/trust
```

### Phase 4: Collaboration (Priority 4)
**Time**: 2-3 weeks
**Deliverable**: Real-time collaborative editing

```
Week 1:
- [ ] Test VS Code Live Share
- [ ] Evaluate alternatives
- [ ] Choose approach

Week 2-3:
- [ ] Implement chosen solution
- [ ] Real-time cursor sync
- [ ] User presence
- [ ] Conflict resolution
```

## What Can Be Done Now

### Immediate (This Week)
1. ✅ Create Xcode project for VibeCode.app
2. ✅ Build basic Swift wrapper around container CLI
3. ✅ Test browser auto-launch
4. ✅ Design app icon

### Short Term (Next 2 Weeks)
1. Complete native macOS app
2. Create .pkg installer
3. Test on fresh macOS install
4. Submit to Homebrew cask

### Medium Term (Next Month)
1. Add mDNS discovery
2. Implement collaborative editing
3. Submit to Mac App Store (if possible)
4. Beta testing with users

## Technical Questions to Answer

### 1. Can code-server support real-time collaboration?
**Answer**: Partially
- ✅ Multiple users can connect
- ❌ No real-time cursor sync
- ❌ No presence indicators
- **Solution**: Add WebSocket layer for sync

### 2. How to handle .pkg installation of Homebrew?
**Answer**: Pre-install script
```bash
#!/bin/bash
if ! command -v brew &> /dev/null; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi
```

### 3. Can we bundle container CLI in .app?
**Answer**: Technically yes, but...
- **Pros**: Self-contained
- **Cons**: Large bundle size, updates harder
- **Recommendation**: Use Homebrew dependency

### 4. mDNS security concerns?
**Answer**: Local network only
- Trust local network by default
- Optional: Add authentication
- Optional: Tailscale for remote access

### 5. Mac App Store compatibility?
**Answer**: Maybe
- **Blocker**: Requires container CLI (external dependency)
- **Solution**: Bundle everything (large app)
- **Alternative**: Distribute outside MAS

## Success Criteria

### Minimum Viable Product (MVP)
- ✅ VibeCode.app launches code-server
- ✅ Drag-to-Applications installation
- ✅ Auto-opens browser
- ✅ Menu bar integration

### Version 1.0
- ✅ MVP features
- ✅ .pkg installer
- ✅ Homebrew cask
- ✅ Code signed & notarized

### Version 1.1
- ✅ v1.0 features
- ✅ mDNS discovery
- ✅ Join remote sessions
- ✅ Basic collaboration

### Version 2.0
- ✅ v1.1 features
- ✅ Real-time collaborative editing
- ✅ Cursor sync
- ✅ User presence
- ✅ SubEtha-like experience

## Conclusion

**What we have**: Working CLI-based solution
**What we need**: Native macOS app experience
**Estimated time**: 4-6 weeks for full v1.0
**Next step**: Create Xcode project for VibeCode.app

The foundation is solid. Now we need to wrap it in a great macOS experience.

---

*Realistic assessment based on actual testing*
*October 1, 2025*
