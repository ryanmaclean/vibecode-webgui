# OpenVSCode Server UI Design

Visual design specification for the VibeCode embedded editor interface.

## Color Palette

### Dark Theme (Default)

```
Background:
- Primary:   #0f172a (slate-900)
- Secondary: #1e293b (slate-800)
- Tertiary:  #334155 (slate-700)

Text:
- Primary:   #ffffff (white)
- Secondary: #94a3b8 (slate-400)
- Muted:     #64748b (slate-500)

Accent Colors:
- Blue:      #2563eb (blue-600)
- Purple:    #9333ea (purple-600)
- Indigo:    #4f46e5 (indigo-700)

Status Colors:
- Success:   #22c55e (green-500)
- Warning:   #eab308 (yellow-500)
- Error:     #ef4444 (red-500)
- Info:      #3b82f6 (blue-500)

Borders:
- Default:   #334155 (slate-700)
- Subtle:    #475569 (slate-600)
```

## Component Layouts

### 1. Loading Screen

```
┌─────────────────────────────────────────────────────────┐
│                                                          │
│                    [Logo Icon]                           │
│                  Gradient Circle                         │
│                                                          │
│                   [Spinner Ring]                         │
│              Animated Blue/Purple                        │
│                                                          │
│              Starting VibeCode...                        │
│         Initializing development environment             │
│                                                          │
│         ████████████████░░░░░░░░ 65%                   │
│                                                          │
│  ✓ Locating code-server binary                          │
│  ✓ Allocating port                                      │
│  ⊙ Starting server process                              │
│  ○ Waiting for server to be ready                       │
│                                                          │
└─────────────────────────────────────────────────────────┘

Dimensions: Full screen
Animation: Spinner rotates, progress bar animates, dots pulse
```

### 2. Editor View (Main Layout)

```
┌─────────────────────────────────────────────────────────┐
│ [Icon] VibeCode Editor          [Status Badge] [Close]  │ ← Header (56px)
│        Development Environment   ● Online :8080          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│                                                          │
│              [IFRAME: Code Server]                       │
│                                                          │
│         VSCode UI loads here at                          │
│         http://127.0.0.1:8080                            │
│                                                          │
│                                                          │
│                                                          │
└─────────────────────────────────────────────────────────┘

Dimensions:
- Header: 56px fixed
- Content: calc(100vh - 56px)
```

### 3. Editor with Status Panel

```
┌────────────────────────────────────┬────────────────────┐
│ [Icon] VibeCode       [●] :8080 [≡]│                   │
├────────────────────────────────────┤  Server Status     │
│                                    │  ───────────────   │
│                                    │  [●] Running       │
│        [IFRAME: Editor]            │                   │
│                                    │  Port: 8080        │
│                                    │  PID: 12345        │
│                                    │  Time: 1234ms      │
│                                    │                   │
│                                    │  [Restart]         │
│                                    │  [Stop]            │
└────────────────────────────────────┴────────────────────┘

Dimensions:
- Editor: 100% - 320px
- Panel: 320px fixed (collapsible)
```

### 4. Error State

```
┌─────────────────────────────────────────────────────────┐
│                                                          │
│                   [Error Icon]                           │
│               Red Circle with !                          │
│                                                          │
│           Failed to Start Server                         │
│                                                          │
│  Failed to spawn OpenVSCode Server: binary not found    │
│                                                          │
│                  [Retry Button]                          │
│                                                          │
│         ─────────────────────────                       │
│         Troubleshooting tips:                           │
│         • Check if port 8080 is available               │
│         • Ensure code-server is installed               │
│         • Check Tauri backend logs                      │
│                                                          │
└─────────────────────────────────────────────────────────┘

Dimensions: Centered card (max-width: 448px)
Colors: Red theme (#7f1d1d bg, #ef4444 border)
```

### 5. Status Badge (Compact)

```
┌──────────────────┐
│ ● Online  :8080  │
└──────────────────┘

Dimensions: Auto width, 36px height
States:
- Online:  Green dot (animate-pulse)
- Offline: Gray dot (static)
```

### 6. Status Panel (Full)

```
┌─────────────────────────────────┐
│  Code Server          [Running]  │
│  ──────────────────────────────  │
│                                  │
│  Status        [●] Running       │
│  Port          8080              │
│  Process ID    12345             │
│  Startup Time  1234ms            │
│  URL           http://127...     │
│                                  │
│  ┌──────────┐  ┌──────────┐    │
│  │ Restart  │  │   Stop   │    │
│  └──────────┘  └──────────┘    │
│                                  │
└─────────────────────────────────┘

Dimensions: 320px width, auto height
Padding: 16px
Gap between elements: 12px
```

## Typography

```
Headings:
- H1: 2xl (24px), font-bold, text-white
- H2: xl (20px), font-semibold, text-white
- H3: lg (18px), font-semibold, text-white

Body:
- Regular: sm (14px), text-slate-300
- Small:   xs (12px), text-slate-400
- Mono:    sm (14px), font-mono, text-white

Buttons:
- Large:   sm (14px), font-semibold
- Regular: sm (14px), font-medium
- Small:   xs (12px), font-medium
```

## Spacing

```
Component Padding:
- Card: p-4 (16px) or p-6 (24px)
- Panel: p-4 (16px)
- Button: px-4 py-2 (16px x 8px)
- Badge: px-3 py-1.5 (12px x 6px)

Gaps:
- Stack: gap-4 (16px)
- Grid: gap-6 (24px)
- Inline: gap-2 (8px)

Margins:
- Section: mb-6 (24px) or mb-8 (32px)
- Element: mb-4 (16px)
- Tight: mb-2 (8px)
```

## Interactive States

### Buttons

```css
Default:   bg-blue-600 text-white
Hover:     bg-blue-700
Active:    bg-blue-800
Disabled:  bg-slate-600 opacity-50 cursor-not-allowed
Loading:   bg-blue-600 + spinner
```

### Status Indicator

```css
Running:   bg-green-500 shadow-green-500/50 animate-pulse
Stopped:   bg-gray-500
Error:     bg-red-500 shadow-red-500/50
Loading:   bg-yellow-500 animate-pulse
```

### Borders

```css
Default:   border border-slate-700
Focus:     border-blue-500 ring-2 ring-blue-500/20
Error:     border-red-500 ring-2 ring-red-500/20
```

## Animations

### Spinner

```css
.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

### Pulse (Status Dot)

```css
.pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

### Progress Bar

```css
.progress-bar {
  transition: width 500ms ease-out;
}
```

### Fade In

```css
.fade-in {
  animation: fadeIn 300ms ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

## Responsive Breakpoints

```css
Mobile:     < 640px   (sm)
Tablet:     640-1024px (md-lg)
Desktop:    > 1024px  (xl)

Adjustments:
- Mobile:  Single column, full width panels
- Tablet:  Collapsible sidebar
- Desktop: Full layout with sidebar
```

## Accessibility

### Focus States

- All interactive elements have visible focus rings
- Tab order follows visual flow
- Keyboard shortcuts: Ctrl+K (open command palette)

### ARIA Labels

```tsx
<button aria-label="Start server">
<div role="status" aria-live="polite">
<iframe title="OpenVSCode Server">
```

### Color Contrast

- All text meets WCAG AA standards (4.5:1 minimum)
- Status indicators use both color and icons
- Error messages include descriptive text

## Example Screens

### 1. Startup Sequence

```
T+0s:   Loading screen appears
T+1s:   ✓ Binary located
T+2s:   ✓ Port allocated
T+3s:   ✓ Server started
T+4s:   ✓ Health check passed
T+4.5s: Fade to editor view
```

### 2. Error Recovery

```
1. Server start fails
2. Error screen shows with details
3. User clicks "Retry"
4. Loading screen appears
5. Success → Editor view
```

### 3. Normal Operation

```
Header:
  [Logo] VibeCode Editor  [● Online :8080]

Body:
  [━━━━━━━━━ VSCode UI ━━━━━━━━━]
  Full-screen iframe, no borders
```

## Implementation Notes

### Z-Index Layers

```
Base:       z-0   (Editor iframe)
Overlay:    z-10  (Loading screen)
Panel:      z-20  (Status panel)
Modal:      z-30  (Error dialogs)
Header:     z-40  (Fixed header)
```

### Performance

- Loading screen should appear within 100ms
- Spinner frame rate: 60fps
- Progress updates: Max 10/second
- Health checks: Every 30 seconds
- Debounce resize: 150ms

### Dark Mode Only

Currently, components are dark mode only. Future versions may support:
- Light mode variant
- System preference detection
- Manual theme toggle

---

**Visual References**

The design is inspired by:
- VSCode's dark theme
- Tailwind UI components
- Modern developer tools (Vercel, Railway)

**Figma File**: (Coming soon)

**Screenshots**: See `/Users/studio/vibecode-webgui/docs/screenshots/`

---

**Last Updated**: 2025-11-14
**Designer**: VibeCode Team
**Status**: ✅ Implemented
