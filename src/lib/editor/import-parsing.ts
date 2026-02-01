export interface ImportParseResult {
  imports: string[]
}

const RUST_PATH_PREFIXES = new Set(['crate', 'self', 'super'])

function normalizeRustRoot(path: string): string | null {
  const cleaned = path.trim().replace(/^::/, '')
  if (!cleaned) return null
  const segments = cleaned.split('::').map(seg => seg.trim()).filter(Boolean)
  if (!segments.length) return null
  const first = segments[0]
  if (RUST_PATH_PREFIXES.has(first)) {
    return segments[1] || null
  }
  return first
}

function extractRustImports(lines: string[]): string[] {
  const imports: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('//')) continue

    const externMatch = trimmed.match(/^extern\s+crate\s+([\w_]+)\s*;/)
    if (externMatch) {
      imports.push(externMatch[1])
      continue
    }

    const useMatch = trimmed.match(/^(?:pub\s+)?use\s+([^;]+);/)
    if (!useMatch) continue

    const statement = useMatch[1]
      .replace(/\{[^}]*\}/g, '')
      .replace(/\s+as\s+\w+/g, '')
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)

    for (const part of statement) {
      const root = normalizeRustRoot(part)
      if (root) imports.push(root)
    }
  }
  return imports
}

export function parseImportsFromContent(content: string): ImportParseResult {
  const imports: string[] = []

  // JavaScript/TypeScript imports
  const jsImportRegex = /import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g
  let match
  while ((match = jsImportRegex.exec(content)) !== null) {
    imports.push(match[1])
  }

  const lines = content.split('\n')

  // Python imports - process line by line to avoid multiline matching issues
  for (const line of lines) {
    const fromMatch = line.match(/from\s+([\w.]+)\s+import\s+([\w.,\s*]+)/)
    if (fromMatch) {
      imports.push(fromMatch[1])
      continue
    }

    const importMatch = line.match(/import\s+([\w.,\s*]+)/)
    if (importMatch) {
      const importedModules = importMatch[1]
        .split(',')
        .map(m => {
          const parts = m.trim().split(/\s+as\s+/)
          return parts[0].split('.')[0].trim()
        })
        .filter(m => m && m !== '*')
      imports.push(...importedModules)
    }
  }

  imports.push(...extractRustImports(lines))

  return { imports }
}
