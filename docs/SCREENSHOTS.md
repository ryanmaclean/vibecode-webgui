# Technical Screenshot Requirements

## Purpose
Technical documentation only - show functionality, architecture, and features.
NOT for marketing or promotional use.

## Required Screenshots

### Architecture
1. **System Architecture Diagram**
   - Components: Next.js, Tauri, VMs, Docker
   - File: `docs/images/architecture/system-diagram.png`
   - Tool: Excalidraw, diagrams.net, or ASCII art (see DIAGRAMS.md)

2. **VM Management Flow**
   - vfkit/Lima VM lifecycle
   - File: `docs/images/architecture/vm-flow.png`
   - Shows: Create → Start → Stop → Delete workflow

3. **CI/CD Pipeline**
   - GitHub Actions workflow visualization
   - File: `docs/images/architecture/cicd-pipeline.png`
   - Shows: Lint → Test → Build → Release flow

### Features (Technical)
4. **Monaco Editor Integration**
   - Code editor with syntax highlighting
   - File: `docs/images/features/monaco-editor.png`
   - Shows: TypeScript/JavaScript editing with IntelliSense

5. **AI Code Completion**
   - Monacopilot in action
   - File: `docs/images/features/ai-completion.png`
   - Shows: Real AI suggestions, not mocked data

6. **VM Management UI**
   - List of VMs, start/stop controls
   - File: `docs/images/features/vm-management.png`
   - Shows: VM status, resource usage, actions

7. **Terminal Integration**
   - Integrated terminal with VM access
   - File: `docs/images/features/terminal.png`
   - Shows: xterm.js terminal connected to VM

8. **Git Integration**
   - Git operations in UI
   - File: `docs/images/features/git-integration.png`
   - Shows: Commit, push, pull, branch operations

### Technical Details
9. **Build Output**
   - Next.js build results, bundle sizes
   - File: `docs/images/technical/build-output.png`
   - Shows: Route sizes, chunks, first load JS

10. **Test Coverage**
    - Jest coverage report
    - File: `docs/images/technical/test-coverage.png`
    - Shows: Statements, branches, functions, lines coverage

11. **Lighthouse Scores**
    - Performance metrics
    - File: `docs/images/technical/lighthouse.png`
    - Shows: Performance, accessibility, best practices, SEO

12. **Datadog Dashboard**
    - Performance monitoring
    - File: `docs/images/technical/datadog-dashboard.png`
    - Shows: RUM metrics, APM traces, logs

## Screenshot Guidelines

### Format
- **Image Format**: PNG (lossless compression)
- **Resolution**:
  - 1920x1080 (standard)
  - 2560x1440 (retina displays, preferred)
  - 3840x2160 (4K for detail-heavy diagrams)
- **DPI**: 72 DPI minimum, 144 DPI for retina
- **Color Space**: sRGB

### Content Rules
- Show ONLY technical functionality
- NO marketing copy or claims
- NO user testimonials
- NO download buttons or CTAs
- Include version numbers where relevant
- Show real code examples, not Lorem Ipsum
- Use realistic data (not "foo bar baz")
- Avoid unnecessary UI chrome (focus on content)

### Privacy & Security
- Blur/remove any API keys
- Redact authentication tokens
- Use placeholder data for sensitive info
- Don't show real user data
- Don't show internal IP addresses
- Redact organizational information

### Accessibility
- Ensure sufficient contrast
- Include alt text in documentation
- Use descriptive file names
- Avoid relying solely on color
- Test with screen readers

### File Naming
- **Format**: `component-feature-context.png`
- **Examples**:
  - `monaco-editor-typescript.png`
  - `terminal-vm-connection.png`
  - `build-output-nextjs.png`
- Lowercase, hyphenated
- Descriptive and specific
- Include component/feature name

## Capture Methods

### macOS Native
```bash
# Full screen
Cmd + Shift + 3

# Selection
Cmd + Shift + 4

# Window
Cmd + Shift + 4, then Space

# Screenshots saved to ~/Desktop by default
```

### Browser DevTools
```bash
# Chrome/Edge
1. Open DevTools (Cmd+Opt+I)
2. Device toolbar (Cmd+Shift+M)
3. Options → Capture screenshot

# Firefox
1. Open DevTools (Cmd+Opt+I)
2. Settings → Take a screenshot
```

### CLI Tools
```bash
# screencapture (macOS)
screencapture -x -t png docs/images/features/feature-name.png

# Playwright (automated)
npx playwright test --screenshot=on
```

## Screenshot Workflow

### 1. Setup Development Environment
```bash
# Start development server
npm run dev

# Open in browser
open http://localhost:3000
```

### 2. Prepare UI State
- Clear browser console
- Remove development warnings
- Use realistic data
- Set appropriate zoom level (100%)
- Hide personal bookmarks/extensions

### 3. Capture Screenshot
- Use appropriate method (see above)
- Verify image quality
- Check for sensitive data
- Validate file size (< 500KB preferred)

### 4. Post-Processing
- Optimize with ImageOptim or similar
- Verify PNG compression
- Add to version control
- Update documentation references

### 5. Documentation Integration
```markdown
![Monaco Editor with TypeScript](./images/features/monaco-editor-typescript.png)
*Monaco editor with TypeScript IntelliSense and syntax highlighting*
```

## Video Recordings

### Format
- **Container**: MP4 (H.264 codec)
- **Duration**: 15-30 seconds max
- **Resolution**: 1920x1080
- **Frame Rate**: 30 fps
- **Audio**: None (technical demos)

### Tools
```bash
# QuickTime (macOS)
File → New Screen Recording

# OBS Studio (cross-platform)
# Configure output to MP4, H.264

# FFmpeg (CLI)
ffmpeg -f avfoundation -i "1" -t 30 output.mp4
```

### Video Guidelines
- Show ONE feature or workflow
- Keep under 30 seconds
- No audio narration (use captions)
- Compress to < 5MB
- Store in `docs/videos/`

## Diagram Creation

### ASCII Diagrams
- Use in DIAGRAMS.md for simple flows
- Good for code documentation
- Version control friendly
- See `docs/images/architecture/DIAGRAMS.md`

### Visual Diagrams
- **Excalidraw**: Hand-drawn style, open source
- **diagrams.net**: Professional, free
- **Mermaid**: Code-based, GitHub-native
- **PlantUML**: Text-based UML

### Export Settings
- PNG: Lossless, transparent background
- SVG: Vector, preferred for diagrams
- Include source file (.excalidraw, .drawio)

## Storage & Organization

### Directory Structure
```
docs/images/
├── screenshots/     # UI screenshots
├── architecture/    # System diagrams
├── features/        # Feature demonstrations
└── technical/       # Build output, metrics
```

### File Size Limits
- Screenshots: < 500KB (optimize if larger)
- Diagrams: < 200KB
- Videos: < 5MB
- GIFs: < 2MB (use MP4 instead if possible)

### Version Control
- Commit images with descriptive messages
- Use Git LFS for large files (> 1MB)
- Don't commit temporary/test screenshots
- Clean up outdated images

## Maintenance

### Review Schedule
- **Monthly**: Check for outdated screenshots
- **Quarterly**: Update version numbers
- **Major releases**: Refresh all screenshots

### Deprecation
- Move old screenshots to `docs/images/archive/`
- Document what changed
- Update documentation references

## Examples

### Good Screenshot
- Shows Monaco editor with real TypeScript code
- Clear syntax highlighting
- Realistic file structure
- No sensitive data
- Proper file name: `monaco-editor-typescript-intellisense.png`

### Bad Screenshot
- Shows "TODO: Add code here"
- Marketing text overlay
- Personal information visible
- Generic file name: `screenshot1.png`
- Excessive file size (> 2MB)

## Automation

### Playwright Screenshot Script
```typescript
// scripts/capture-screenshots.ts
import { test } from '@playwright/test';

test('capture monaco editor', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.screenshot({
    path: 'docs/images/features/monaco-editor.png',
    fullPage: false
  });
});
```

### CI Integration
```yaml
# .github/workflows/screenshots.yml
name: Update Screenshots
on:
  workflow_dispatch:

jobs:
  screenshots:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run dev &
      - run: npx playwright test screenshots.spec.ts
      - uses: actions/upload-artifact@v4
        with:
          name: screenshots
          path: docs/images/
```

## Quality Checklist

Before committing screenshots:

- [ ] No sensitive data (API keys, tokens, passwords)
- [ ] No personal information
- [ ] Realistic data (not placeholders)
- [ ] Proper file name (descriptive, lowercase, hyphenated)
- [ ] Optimized file size (< 500KB)
- [ ] PNG format (lossless)
- [ ] Appropriate resolution (1920x1080+)
- [ ] Documentation updated
- [ ] Technical purpose only (not marketing)
- [ ] Version numbers visible (if applicable)
- [ ] Accessibility considered

## Resources

### Tools
- [Excalidraw](https://excalidraw.com/) - Hand-drawn diagrams
- [diagrams.net](https://www.diagrams.net/) - Professional diagrams
- [ImageOptim](https://imageoptim.com/) - Image optimization
- [OBS Studio](https://obsproject.com/) - Screen recording
- [Playwright](https://playwright.dev/) - Automated screenshots

### References
- [Next.js Documentation](https://nextjs.org/docs) - Framework reference
- [Tauri Documentation](https://tauri.app/v1/guides/) - Desktop app reference
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - Editor API

## Support

Questions about screenshots?
- Check existing screenshots in `docs/images/`
- Review architecture diagrams in `DIAGRAMS.md`
- Open an issue with label `documentation`
