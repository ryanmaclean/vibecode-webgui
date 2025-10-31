# VibeCode Icon Generation Guide

## Quick Reference for Creating macOS Application Icons

This guide provides scripts and instructions for generating all required icon assets for VibeCode.

---

## Prerequisites

**macOS Tools**:
- `sips` (built-in) - Image resizing
- `iconutil` (built-in) - .icns generation
- Design software: Sketch, Figma, Affinity Designer, or Photoshop

**Master File Requirements**:
- Format: PNG with transparency
- Size: 1024x1024 pixels
- Color mode: RGB
- Bit depth: 8-bit per channel
- Transparency: Alpha channel

---

## Step 1: Design the Master Icon

### Design Guidelines

**Visual Requirements**:
- Simple, recognizable shape at all sizes
- Clear silhouette (works at 16x16)
- Appropriate padding (10-15% margin)
- Works in light and dark modes
- Distinct from VS Code's infinity symbol

**Recommended Approach**:
- Start with vector design (SVG)
- Export to 1024x1024 PNG
- Test at smallest size (16x16) first

**Color Palette Suggestions**:
- Primary: Deep purple/blue gradient (#5B21B6 → #3B82F6)
- Accent: Cyan/teal (#06B6D4)
- Alternative: Gradient overlays on geometric shapes

**Shape Ideas**:
1. Abstract "V" with flowing curves (suggests "vibe" + code)
2. Neural network node pattern (AI emphasis)
3. Waveform + bracket (flow + code)
4. Minimalist geometric (modern, clean)

---

## Step 2: Generate All Icon Sizes

### Automated Script

Save this as `generate-icons.sh`:

```bash
#!/bin/bash
# VibeCode Icon Generator
# Generates all required macOS icon sizes from a 1024x1024 master PNG

set -e

# Configuration
MASTER_ICON="vibecode-master-1024.png"
ICONSET_DIR="vibecode.iconset"
OUTPUT_ICNS="vibecode.icns"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if master icon exists
if [ ! -f "$MASTER_ICON" ]; then
    echo -e "${RED}Error: Master icon not found: $MASTER_ICON${NC}"
    echo "Please create a 1024x1024 PNG file named $MASTER_ICON"
    exit 1
fi

# Verify master icon dimensions
WIDTH=$(sips -g pixelWidth "$MASTER_ICON" | awk '{print $2}' | tail -1)
HEIGHT=$(sips -g pixelHeight "$MASTER_ICON" | awk '{print $2}' | tail -1)

if [ "$WIDTH" != "1024" ] || [ "$HEIGHT" != "1024" ]; then
    echo -e "${RED}Error: Master icon must be 1024x1024 pixels${NC}"
    echo "Current size: ${WIDTH}x${HEIGHT}"
    exit 1
fi

echo -e "${GREEN}Master icon verified: ${WIDTH}x${HEIGHT}${NC}"

# Create iconset directory
echo -e "${YELLOW}Creating iconset directory...${NC}"
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

# Generate all required sizes
echo -e "${YELLOW}Generating icon sizes...${NC}"

# 16x16
sips -z 16 16 "$MASTER_ICON" --out "$ICONSET_DIR/icon_16x16.png" > /dev/null
echo "  ✓ 16x16 (@1x)"

# 32x32 (16x16@2x)
sips -z 32 32 "$MASTER_ICON" --out "$ICONSET_DIR/icon_16x16@2x.png" > /dev/null
echo "  ✓ 32x32 (@2x for 16x16)"

# 32x32
sips -z 32 32 "$MASTER_ICON" --out "$ICONSET_DIR/icon_32x32.png" > /dev/null
echo "  ✓ 32x32 (@1x)"

# 64x64 (32x32@2x)
sips -z 64 64 "$MASTER_ICON" --out "$ICONSET_DIR/icon_32x32@2x.png" > /dev/null
echo "  ✓ 64x64 (@2x for 32x32)"

# 64x64
sips -z 64 64 "$MASTER_ICON" --out "$ICONSET_DIR/icon_64x64.png" > /dev/null
echo "  ✓ 64x64 (@1x) - Finder sidebar"

# 128x128 (64x64@2x)
sips -z 128 128 "$MASTER_ICON" --out "$ICONSET_DIR/icon_64x64@2x.png" > /dev/null
echo "  ✓ 128x128 (@2x for 64x64)"

# 128x128
sips -z 128 128 "$MASTER_ICON" --out "$ICONSET_DIR/icon_128x128.png" > /dev/null
echo "  ✓ 128x128 (@1x) - Finder icon view"

# 256x256 (128x128@2x)
sips -z 256 256 "$MASTER_ICON" --out "$ICONSET_DIR/icon_128x128@2x.png" > /dev/null
echo "  ✓ 256x256 (@2x for 128x128)"

# 256x256
sips -z 256 256 "$MASTER_ICON" --out "$ICONSET_DIR/icon_256x256.png" > /dev/null
echo "  ✓ 256x256 (@1x)"

# 512x512 (256x256@2x)
sips -z 512 512 "$MASTER_ICON" --out "$ICONSET_DIR/icon_256x256@2x.png" > /dev/null
echo "  ✓ 512x512 (@2x for 256x256)"

# 512x512
sips -z 512 512 "$MASTER_ICON" --out "$ICONSET_DIR/icon_512x512.png" > /dev/null
echo "  ✓ 512x512 (@1x) - Dock"

# 1024x1024 (512x512@2x)
sips -z 1024 1024 "$MASTER_ICON" --out "$ICONSET_DIR/icon_512x512@2x.png" > /dev/null
echo "  ✓ 1024x1024 (@2x for 512x512) - Retina displays"

# Generate .icns file
echo -e "${YELLOW}Generating .icns file...${NC}"
iconutil -c icns "$ICONSET_DIR" -o "$OUTPUT_ICNS"

if [ -f "$OUTPUT_ICNS" ]; then
    SIZE=$(du -h "$OUTPUT_ICNS" | awk '{print $1}')
    echo -e "${GREEN}✓ Successfully created: $OUTPUT_ICNS ($SIZE)${NC}"
else
    echo -e "${RED}✗ Failed to create .icns file${NC}"
    exit 1
fi

# Optional: Keep iconset for inspection
echo -e "${YELLOW}Keeping iconset directory for inspection: $ICONSET_DIR${NC}"

echo ""
echo -e "${GREEN}=== Icon Generation Complete ===${NC}"
echo "Files created:"
echo "  • $OUTPUT_ICNS - macOS icon file"
echo "  • $ICONSET_DIR/ - Individual PNG sizes"
echo ""
echo "Next steps:"
echo "  1. Preview: qlmanage -p $OUTPUT_ICNS"
echo "  2. Copy to: openvscode-server/resources/darwin/vibecode.icns"
echo "  3. Test in build: npm run compile"
```

**Usage**:
```bash
chmod +x generate-icons.sh
./generate-icons.sh
```

---

## Step 3: Generate Web Assets

### Create PNG Assets for Web/Server

```bash
#!/bin/bash
# Generate web assets from master icon

MASTER="vibecode-master-1024.png"

echo "Generating web assets..."

# Favicon and PWA icons
sips -z 192 192 "$MASTER" --out vibecode-192.png
echo "  ✓ vibecode-192.png (PWA icon)"

sips -z 512 512 "$MASTER" --out vibecode-512.png
echo "  ✓ vibecode-512.png (Splash screen)"

# Optional: Generate favicon.ico (requires ImageMagick)
if command -v convert &> /dev/null; then
    convert "$MASTER" -resize 16x16 -resize 32x32 -resize 48x48 vibecode.ico
    echo "  ✓ vibecode.ico (Browser favicon)"
else
    echo "  ⚠ Skipping .ico generation (ImageMagick not installed)"
fi

echo ""
echo "Web assets created:"
echo "  • vibecode-192.png → Copy to: openvscode-server/resources/server/"
echo "  • vibecode-512.png → Copy to: openvscode-server/resources/server/"
```

---

## Step 4: Verify Icon Quality

### Visual Inspection Script

```bash
#!/bin/bash
# Preview generated icons

ICNS_FILE="vibecode.icns"

if [ ! -f "$ICNS_FILE" ]; then
    echo "Error: $ICNS_FILE not found"
    exit 1
fi

echo "Opening icon preview..."
qlmanage -p "$ICNS_FILE" &> /dev/null

# Extract and display all sizes
echo ""
echo "Extracting individual sizes for inspection..."
iconutil -c iconset "$ICNS_FILE" -o vibecode-preview.iconset

echo "Icon sizes generated:"
ls -lh vibecode-preview.iconset/

echo ""
echo "Check each size for:"
echo "  • Clarity (especially 16x16)"
echo "  • Color accuracy"
echo "  • Proper transparency"
echo "  • No aliasing artifacts"
```

### Manual Testing Checklist

Test the icon in various contexts:

- [ ] **Finder**
  - [ ] List view (16x16)
  - [ ] Icon view (128x128)
  - [ ] Cover Flow (512x512)
  - [ ] Dark mode
  - [ ] Light mode

- [ ] **Dock**
  - [ ] Normal size
  - [ ] Large size
  - [ ] Magnification enabled
  - [ ] Retina display

- [ ] **Launchpad**
  - [ ] Grid view
  - [ ] Search results

- [ ] **Other**
  - [ ] Spotlight results
  - [ ] Activity Monitor
  - [ ] App switcher (Cmd+Tab)
  - [ ] Mission Control

---

## Step 5: Deploy Icons

### Copy to Project

```bash
#!/bin/bash
# Deploy icons to project

PROJECT_ROOT="/Users/ryan.maclean/vibecode-webgui"
OPENVSCODE="$PROJECT_ROOT/openvscode-server"

echo "Deploying icons to project..."

# macOS application icon
cp vibecode.icns "$OPENVSCODE/resources/darwin/"
echo "  ✓ Copied to: resources/darwin/vibecode.icns"

# Web/server assets
cp vibecode-192.png "$OPENVSCODE/resources/server/vibecode-192.png"
cp vibecode-512.png "$OPENVSCODE/resources/server/vibecode-512.png"
echo "  ✓ Copied web assets to: resources/server/"

# Linux icon
cp vibecode-512.png "$OPENVSCODE/resources/linux/vibecode.png"
echo "  ✓ Copied to: resources/linux/vibecode.png"

# Update product.json reference
echo ""
echo "Update product.json to reference new icons:"
echo "  • linuxIconName: 'vibecode'"
echo "  • Update any hardcoded icon paths"
```

---

## Icon Size Reference

### macOS .icns Required Sizes

| Filename | Dimensions | Scale | Usage |
|----------|------------|-------|-------|
| `icon_16x16.png` | 16×16 | @1x | Menu bar, list views |
| `icon_16x16@2x.png` | 32×32 | @2x | Menu bar (Retina) |
| `icon_32x32.png` | 32×32 | @1x | List views, Finder sidebar |
| `icon_32x32@2x.png` | 64×64 | @2x | List views (Retina) |
| `icon_64x64.png` | 64×64 | @1x | Finder sidebar |
| `icon_64x64@2x.png` | 128×128 | @2x | Finder sidebar (Retina) |
| `icon_128x128.png` | 128×128 | @1x | Finder icon view |
| `icon_128x128@2x.png` | 256×256 | @2x | Finder icon view (Retina) |
| `icon_256x256.png` | 256×256 | @1x | Finder icon view |
| `icon_256x256@2x.png` | 512×512 | @2x | Finder icon view (Retina) |
| `icon_512x512.png` | 512×512 | @1x | Dock, Quick Look |
| `icon_512x512@2x.png` | 1024×1024 | @2x | Dock (Retina), Spotlight |

### Web/Server Assets

| File | Size | Usage |
|------|------|-------|
| `vibecode-192.png` | 192×192 | PWA icon, browser |
| `vibecode-512.png` | 512×512 | Splash screen, large icon |
| `vibecode.ico` | Multi-size | Browser favicon (optional) |

---

## Troubleshooting

### Common Issues

**Icon appears blurry**:
- Ensure master is exactly 1024×1024
- Check alpha channel is preserved
- Verify no JPEG compression artifacts

**Icon not updating in Finder**:
```bash
# Clear icon cache
sudo rm -rf /Library/Caches/com.apple.iconservices.store
killall Finder
killall Dock
```

**Wrong icon displaying**:
- Check bundle identifier in Info.plist
- Verify .icns file in app bundle: `VibeCode.app/Contents/Resources/`
- Rebuild app completely

**Transparent areas showing wrong**:
- Ensure PNG has alpha channel
- Check for premultiplied alpha issues
- Test on both light and dark backgrounds

---

## Design Resources

### Inspiration

Study these well-designed IDE/editor icons:
- VS Code: Infinity symbol, blue gradient
- Sublime Text: Stylized "S"
- Atom: Electron orbits (deprecated but iconic)
- IntelliJ IDEA: Geometric "IJ"
- Xcode: Hammer blueprint style

### Tools

**Free Design Tools**:
- [Figma](https://www.figma.com/) - Web-based, collaborative
- [GIMP](https://www.gimp.org/) - Open-source Photoshop alternative
- [Inkscape](https://inkscape.org/) - Vector graphics

**Paid Design Tools**:
- [Affinity Designer](https://affinity.serif.com/) - One-time purchase
- [Sketch](https://www.sketch.com/) - macOS-native (subscription)
- Adobe Photoshop / Illustrator - Industry standard

**Icon Testing**:
- [Icon Slate](https://www.kodlian.com/apps/icon-slate) - macOS icon editor
- [Image2icon](https://img2icnsapp.com/) - Drag-and-drop converter

---

## Quality Checklist

Before finalizing the icon:

**Visual Design**:
- [ ] Recognizable at 16×16 pixels
- [ ] Works in light and dark modes
- [ ] Distinct from competitors (especially VS Code)
- [ ] Matches VibeCode brand identity
- [ ] Professional appearance

**Technical Quality**:
- [ ] No jagged edges or aliasing
- [ ] Proper transparency
- [ ] Consistent color across all sizes
- [ ] Appropriate padding/margins
- [ ] File size reasonable (<500KB for .icns)

**Testing**:
- [ ] Previewed in Finder (all views)
- [ ] Checked in Dock (light/dark mode)
- [ ] Verified in Launchpad
- [ ] Tested on Retina display
- [ ] Tested on non-Retina display

**Integration**:
- [ ] Copied to correct directories
- [ ] product.json updated
- [ ] App bundle rebuilds with new icon
- [ ] No conflicts with old icons

---

## Next Steps

Once icons are generated and tested:

1. **Update build scripts** to reference new icon files
2. **Modify Info.plist** to use `vibecode.icns`
3. **Test full build** to ensure icon embeds correctly
4. **Create DMG installer** with custom background/icon
5. **Document** icon usage in brand guidelines

---

## Additional Resources

- [Apple Human Interface Guidelines - App Icons](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- [macOS Icon Design Tutorial](https://applypixels.com/blog/macos-icon-design)
- [iconutil Documentation](https://ss64.com/osx/iconutil.html)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-28
