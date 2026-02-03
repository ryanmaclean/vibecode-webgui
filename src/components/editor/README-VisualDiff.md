# Visual Diff Component

A side-by-side file comparison component powered by Monaco Editor's DiffEditor.

## Features

✅ **Side-by-side comparison** - View original and modified content side by side  
✅ **Syntax highlighting** - Support for JavaScript, TypeScript, Python, Go, Rust, HTML, CSS, JSON, Markdown, and more  
✅ **Inline change indicators** - Visual markers showing added, removed, and modified lines  
✅ **Theme support** - Light, dark, and high-contrast themes  
✅ **Read-only and editable modes** - Default read-only with optional editing  
✅ **Resizable split view** - Adjust the divider between original and modified  
✅ **SSR-safe** - Dynamic loading to prevent server-side rendering issues  

## Installation

The Visual Diff component uses existing dependencies:
- `@monaco-editor/react` (^4.7.0)
- `monaco-editor` (^0.55.1)
- `next-themes` (for theme detection)

No additional packages needed!

## Usage

### Basic Example

```tsx
import { VisualDiff } from '@/components/editor/VisualDiff';

function MyComponent() {
  return (
    <VisualDiff
      original="const x = 1;"
      modified="const x = 2;"
      language="javascript"
      height="500px"
    />
  );
}
```

### With Theme Control

```tsx
import { VisualDiff } from '@/components/editor/VisualDiff';

function MyComponent() {
  return (
    <VisualDiff
      original={originalCode}
      modified={modifiedCode}
      language="typescript"
      theme="vs-dark"
      height="600px"
      readOnly={true}
    />
  );
}
```

### Editable Mode with Change Callback

```tsx
import { VisualDiff } from '@/components/editor/VisualDiff';
import { useState } from 'react';

function MyComponent() {
  const [modified, setModified] = useState("const x = 2;");

  return (
    <VisualDiff
      original="const x = 1;"
      modified={modified}
      language="javascript"
      height="500px"
      readOnly={false}
      onModifiedChange={(value) => setModified(value || '')}
    />
  );
}
```

## API Reference

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `original` | `string` | *required* | Original content (left side) |
| `modified` | `string` | *required* | Modified content (right side) |
| `language` | `string` | `'plaintext'` | Programming language for syntax highlighting |
| `theme` | `'vs-dark' \| 'light' \| 'hc-black'` | Auto-detected | Editor theme |
| `height` | `string \| number` | `'100%'` | Height of the editor |
| `width` | `string \| number` | `'100%'` | Width of the editor |
| `readOnly` | `boolean` | `true` | Enable/disable editing |
| `options` | `IStandaloneDiffEditorConstructionOptions` | `{}` | Additional Monaco options |
| `className` | `string` | `''` | Custom CSS class |
| `onModifiedChange` | `(value: string \| undefined) => void` | - | Callback when modified content changes |

### Supported Languages

The component supports all languages supported by Monaco Editor, including:

- JavaScript / TypeScript
- Python
- Go
- Rust
- Java / C# / C++
- HTML / CSS / SCSS
- JSON / YAML / TOML
- Markdown
- Shell / Bash
- SQL
- And many more...

## Demo

Visit `/demo/visual-diff` to see an interactive demo with multiple examples.

The demo includes:
- JavaScript code comparison
- TypeScript interface changes
- JSON configuration updates
- Theme switching
- Usage examples

## Use Cases

### 1. Git Integration
Display diffs for version control operations:
```tsx
<VisualDiff
  original={previousCommit}
  modified={currentCommit}
  language="javascript"
/>
```

### 2. Code Review
Compare original and reviewed code:
```tsx
<VisualDiff
  original={submittedCode}
  modified={reviewedCode}
  language="typescript"
/>
```

### 3. Conflict Resolution
Show merge conflicts:
```tsx
<VisualDiff
  original={baseVersion}
  modified={conflictVersion}
  language="javascript"
/>
```

### 4. Documentation
Display before/after examples:
```tsx
<VisualDiff
  original="// Before refactoring\nfunction old() { ... }"
  modified="// After refactoring\nfunction improved() { ... }"
  language="javascript"
/>
```

## Advanced Configuration

### Custom Monaco Options

```tsx
<VisualDiff
  original={original}
  modified={modified}
  language="javascript"
  options={{
    renderSideBySide: true,
    enableSplitViewResizing: true,
    minimap: { enabled: true },
    lineNumbers: 'on',
    folding: true,
    renderOverviewRuler: true,
  }}
/>
```

### Custom Styling

```tsx
<VisualDiff
  original={original}
  modified={modified}
  language="javascript"
  className="rounded-lg border border-gray-300 shadow-lg"
  height="700px"
  width="100%"
/>
```

## Testing

The component includes comprehensive unit tests:

```bash
npm test -- tests/unit/components/VisualDiff.test.tsx
```

Test coverage includes:
- Basic rendering
- Theme switching
- Language support
- Read-only/editable modes
- Custom dimensions
- Edge cases (special characters, unicode, multi-line)

## Performance

- **Lazy Loading**: Component is dynamically imported to reduce initial bundle size
- **SSR Disabled**: Prevents hydration issues with Monaco Editor
- **Loading Skeleton**: Shows a loading indicator while Monaco loads
- **Minimal Bundle Impact**: Reuses existing Monaco Editor dependency

## Accessibility

- **Keyboard Navigation**: Full keyboard support inherited from Monaco Editor
- **High Contrast Mode**: Supports `hc-black` theme for accessibility
- **ARIA Labels**: Proper ARIA attributes from Monaco

## Browser Support

The component supports the same browsers as Monaco Editor:
- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)

## Related Components

- `src/components/editors/monaco.tsx` - Basic Monaco editor
- `src/components/editor/AgentMonacoEditor.tsx` - AI-enhanced editor
- `src/components/collaboration/CollaborativeEditor.tsx` - Real-time collaboration

## Contributing

When contributing to the Visual Diff component:

1. Maintain TypeScript types
2. Add tests for new features
3. Update documentation
4. Follow existing code style
5. Test with multiple languages and themes

## License

Same license as the VibeCode project.
