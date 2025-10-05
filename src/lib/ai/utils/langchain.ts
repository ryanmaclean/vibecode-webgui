export function extractText(output: unknown): string {
  if (typeof output === 'string') {
    return output
  }

  if (output && typeof output === 'object') {
    const candidate = (output as { content?: unknown; output?: unknown }).content ??
      (output as { output?: unknown }).output

    if (typeof candidate === 'string') {
      return candidate
    }

    if (Array.isArray(candidate)) {
      return candidate
        .map((item) => (typeof item === 'string' ? item : ''))
        .filter(Boolean)
        .join('\n')
    }
  }

  try {
    return JSON.stringify(output)
  } catch {
    return ''
  }
}
