# Documentation Assets

Technical screenshots, diagrams, and videos for VibeCode WebGUI documentation.

## Purpose

These assets are created **exclusively for technical documentation** to help developers and contributors understand the architecture, features, and functionality of VibeCode.

## Directory Structure

```
docs/images/
├── README.md              # This file
├── screenshots/           # UI screenshots (empty - to be populated)
├── architecture/          # System diagrams and ASCII art
│   └── DIAGRAMS.md        # Comprehensive architecture diagrams
├── features/              # Feature demonstrations (empty - to be populated)
└── technical/             # Build output, metrics, performance data
```

### Current Assets

| Directory | Files | Description |
|-----------|-------|-------------|
| `architecture/` | 1 | ASCII diagrams of system architecture, data flows, CI/CD |
| `screenshots/` | 0 | UI screenshots (to be captured manually) |
| `features/` | 0 | Feature demonstrations (to be captured manually) |
| `technical/` | 0 | Build stats, test coverage, metrics |

## Usage Policy

### Permitted Uses ✅

These assets may be used for:
- **Technical documentation** in README.md, docs/, wiki pages
- **Developer guides** and contributor documentation
- **Architecture explanations** in technical blog posts
- **Issue discussions** and pull request descriptions
- **Tutorial content** for educational purposes
- **Conference talks** about technical implementation
- **Academic research** and technical analysis

### Prohibited Uses ❌

These assets **must not** be used for:
- Marketing materials or promotional campaigns
- Sales presentations or pitch decks
- Social media advertisements
- Product landing pages
- Press releases or media kits
- Promotional blog posts
- Paid advertising campaigns
- Misleading comparisons with competitors

## Asset Requirements

### Screenshots

- **Format**: PNG (lossless compression)
- **Resolution**: 1920x1080 or higher
- **File Size**: < 500KB (optimized)
- **Content**: Real functionality, not mockups
- **Privacy**: No API keys, tokens, or personal data

See [SCREENSHOTS.md](../SCREENSHOTS.md) for detailed requirements.

### Diagrams

- **Format**: SVG (preferred) or PNG
- **Source**: Include .excalidraw, .drawio, or ASCII source
- **Style**: Clean, professional, accessible
- **File Size**: < 200KB

See [architecture/DIAGRAMS.md](./architecture/DIAGRAMS.md) for examples.

### Videos

- **Format**: MP4 (H.264 codec)
- **Duration**: 15-30 seconds max
- **Resolution**: 1920x1080
- **File Size**: < 5MB
- **Audio**: None (use captions)

## Creating New Assets

### 1. Screenshots

```bash
# Capture specific UI area
Cmd + Shift + 4

# Save to appropriate directory
mv ~/Desktop/Screenshot*.png docs/images/features/feature-name.png

# Optimize file size
# Use ImageOptim or similar tool
```

### 2. Diagrams

```bash
# ASCII diagrams
# Edit directly in architecture/DIAGRAMS.md

# Visual diagrams
# Use Excalidraw: https://excalidraw.com
# Export as PNG and SVG
# Save source .excalidraw file
```

### 3. Videos

```bash
# Record with QuickTime
# File → New Screen Recording

# Convert to MP4 (if needed)
ffmpeg -i input.mov -c:v libx264 -crf 23 output.mp4

# Keep under 5MB
ffmpeg -i input.mp4 -vf scale=1920:1080 -b:v 800k output.mp4
```

## File Naming Conventions

### Screenshots

- Format: `component-feature-context.png`
- Examples:
  - `monaco-editor-typescript-intellisense.png`
  - `terminal-vm-ssh-connection.png`
  - `vm-manager-list-view.png`

### Diagrams

- Format: `system-type-context.png` or `.svg`
- Examples:
  - `architecture-system-overview.svg`
  - `dataflow-ai-chat-request.png`
  - `deployment-kubernetes-topology.svg`

### Videos

- Format: `feature-action-demo.mp4`
- Examples:
  - `vm-create-start-demo.mp4`
  - `ai-completion-inline-demo.mp4`
  - `terminal-split-pane-demo.mp4`

## Quality Standards

### Before Committing

- [ ] **No sensitive data**: API keys, tokens, passwords removed
- [ ] **No personal info**: Real names, emails, internal URLs redacted
- [ ] **Realistic content**: Use real code, not placeholder text
- [ ] **Proper naming**: Descriptive, lowercase, hyphenated
- [ ] **Optimized size**: Compressed without quality loss
- [ ] **Correct format**: PNG for screenshots, SVG for diagrams
- [ ] **Documentation updated**: References added to relevant docs
- [ ] **Technical focus**: Shows functionality, not marketing claims

### Accessibility

- Sufficient color contrast (WCAG AA minimum)
- Text readable at standard sizes
- Include descriptive alt text in documentation
- Avoid relying solely on color to convey information

## Integration with Documentation

### Markdown Syntax

```markdown
![Description of image](./images/category/file-name.png)
*Optional caption explaining the screenshot*
```

### Example

```markdown
![Monaco Editor with TypeScript](./images/features/monaco-editor-typescript.png)
*Monaco editor showing TypeScript code with IntelliSense autocomplete*
```

### Reference from External Docs

```markdown
![System Architecture](https://github.com/ryanmaclean/vibecode-webgui/blob/main/docs/images/architecture/system-overview.png)
```

## Maintenance

### Regular Reviews

- **Monthly**: Check for outdated screenshots (version numbers, UI changes)
- **Quarterly**: Update diagrams to reflect architecture changes
- **Major releases**: Refresh all screenshots and technical assets

### Deprecation Process

1. Create `docs/images/archive/` directory
2. Move old assets to archive with date suffix
   - Example: `monaco-editor-2024-10.png`
3. Update documentation to remove references
4. Add deprecation note in commit message

### Version Control

- Commit with descriptive messages
- Use Git LFS for files > 1MB
- Don't commit temporary/test screenshots
- Keep source files (.excalidraw, .drawio) in version control

## Automation

### Screenshot Testing with Playwright

```typescript
// tests/e2e/screenshots.spec.ts
import { test } from '@playwright/test';

test('capture monaco editor', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.locator('.monaco-editor').screenshot({
    path: 'docs/images/features/monaco-editor.png'
  });
});
```

### CI Integration

```yaml
# .github/workflows/update-screenshots.yml
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

## File Size Guidelines

| Asset Type | Recommended | Maximum | Notes |
|------------|-------------|---------|-------|
| Screenshots | 200-300KB | 500KB | Optimize with ImageOptim |
| Diagrams (PNG) | 50-100KB | 200KB | Use SVG when possible |
| Diagrams (SVG) | 10-50KB | 100KB | Smaller and scalable |
| Videos | 2-3MB | 5MB | Use H.264, 30fps |
| GIFs | < 1MB | 2MB | Prefer MP4 over GIF |

## Tools & Resources

### Image Optimization

- [ImageOptim](https://imageoptim.com/) - macOS image compression
- [TinyPNG](https://tinypng.com/) - Web-based PNG/JPEG optimizer
- [Squoosh](https://squoosh.app/) - Browser-based image compressor

### Diagram Creation

- [Excalidraw](https://excalidraw.com/) - Hand-drawn style diagrams
- [diagrams.net](https://www.diagrams.net/) - Professional diagramming
- [Mermaid](https://mermaid.js.org/) - Code-based diagrams
- [ASCIIFlow](https://asciiflow.com/) - ASCII diagram editor

### Screen Recording

- QuickTime Player (macOS built-in)
- [OBS Studio](https://obsproject.com/) - Open source recording
- [Loom](https://www.loom.com/) - Quick screen recording (free tier)

### Video Editing

- [FFmpeg](https://ffmpeg.org/) - Command-line video processing
- [HandBrake](https://handbrake.fr/) - Video transcoding
- iMovie (macOS built-in)

## Contributing

When adding new assets:

1. **Check existing assets** first to avoid duplication
2. **Follow naming conventions** strictly
3. **Optimize file sizes** before committing
4. **Update this README** if adding new categories
5. **Reference in documentation** where the asset is used
6. **Verify no sensitive data** is visible
7. **Test accessibility** (contrast, readability)

### Pull Request Checklist

- [ ] Assets follow naming conventions
- [ ] File sizes within guidelines
- [ ] No sensitive data visible
- [ ] Documentation updated
- [ ] SCREENSHOTS.md requirements met
- [ ] Technical focus maintained (not marketing)

## License

All documentation assets are licensed under **MIT License**, same as the VibeCode codebase.

```
Copyright (c) 2025 VibeCode Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

## Attribution

When using these assets in external documentation:

```markdown
Source: VibeCode WebGUI Documentation
Repository: https://github.com/ryanmaclean/vibecode-webgui
License: MIT
```

## Support

### Questions about Assets

- Review [SCREENSHOTS.md](../SCREENSHOTS.md) for screenshot requirements
- Check [architecture/DIAGRAMS.md](./architecture/DIAGRAMS.md) for diagram examples
- Search existing issues for similar questions
- Open new issue with label `documentation`

### Reporting Issues

Found outdated or incorrect assets?
1. Open an issue with:
   - Asset path/filename
   - What's outdated/incorrect
   - Screenshot of current state (if applicable)
   - Suggested update
2. Tag with `documentation` label

## Statistics

Last updated: 2025-11-01

| Metric | Count |
|--------|-------|
| Total Directories | 4 |
| Screenshots | 0 (to be captured) |
| Diagrams | 1 (ASCII) |
| Videos | 0 |
| Documentation Files | 3 |

## Roadmap

### Planned Assets

- [ ] System architecture diagram (visual PNG/SVG)
- [ ] Monaco editor screenshot (TypeScript)
- [ ] Terminal integration screenshot
- [ ] VM management UI screenshot
- [ ] AI code completion screenshot
- [ ] Build output screenshot
- [ ] Test coverage screenshot
- [ ] Lighthouse performance screenshot
- [ ] VM creation flow video
- [ ] AI completion demo video

### Future Enhancements

- Automated screenshot capture in CI
- Screenshot diff testing for UI regressions
- Internationalized screenshots (multi-language)
- Dark mode vs light mode variants
- Responsive design screenshots (mobile, tablet, desktop)

## Contact

- Repository: https://github.com/ryanmaclean/vibecode-webgui
- Documentation: https://github.com/ryanmaclean/vibecode-webgui/tree/main/docs
- Issues: https://github.com/ryanmaclean/vibecode-webgui/issues
