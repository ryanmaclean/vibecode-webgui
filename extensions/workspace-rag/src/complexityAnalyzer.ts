export interface ComplexityScore {
  lineCount: number;
  maxIndentLevel: number;
  branchCount: number;
  complexityScore: number;
}

export class ComplexityAnalyzer {
  static analyze(code: string): ComplexityScore {
    const lines = code.split(/\r?\n/);

    let maxIndentLevel = 0;
    let branchCount = 0;

    const branchPatterns = [/\bif\b/, /\bfor\b/, /\bwhile\b/, /\bswitch\b/, /\bcase\b/, /&&/, /\|\|/];

    for (const line of lines) {
      const indentMatch = line.match(/^\s*/);
      const indent = indentMatch ? indentMatch[0].length : 0;
      if (indent > maxIndentLevel) {
        maxIndentLevel = indent;
      }

      const normalized = line.trim();
      for (const pattern of branchPatterns) {
        if (pattern.test(normalized)) {
          branchCount += 1;
        }
      }
    }

    const lineCount = lines.filter(l => l.trim().length > 0).length;

    const complexityScore =
      lineCount * 0.1 +
      maxIndentLevel * 0.05 +
      branchCount * 0.5;

    return {
      lineCount,
      maxIndentLevel,
      branchCount,
      complexityScore,
    };
  }
}
