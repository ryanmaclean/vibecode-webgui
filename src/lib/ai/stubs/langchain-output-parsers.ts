export class StringOutputParser {
  async parse(input: string): Promise<string> {
    return input
  }
}

export class StructuredOutputParser {
  constructor(private schema: Record<string, unknown> = {}) {}

  getFormatInstructions(): string {
    return JSON.stringify(this.schema)
  }

  async parse(input: string): Promise<Record<string, unknown>> {
    try {
      return JSON.parse(input)
    } catch {
      return { output: input }
    }
  }
}
