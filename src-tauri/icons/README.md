# Tauri App Icons

This directory should contain the application icons in various sizes:

- `32x32.png` - Small icon
- `128x128.png` - Standard size
- `128x128@2x.png` - Retina display
- `icon.icns` - macOS icon bundle
- `icon.ico` - Windows icon

## Generating Icons

You can use the Tauri icon generator to create all required sizes from a single source image:

```bash
npx @tauri-apps/cli icon path/to/your/icon.png
```

This will automatically generate all the required icon sizes and formats.

## Icon Requirements

- Source image should be at least 1024x1024 pixels
- PNG format with transparency
- Square aspect ratio
- Simple, recognizable design that works at small sizes
