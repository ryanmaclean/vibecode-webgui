export class PromptTemplate {
  template: string
  constructor(options: { template: string }) {
    this.template = options.template
  }

  static fromTemplate(template: string): PromptTemplate {
    return new PromptTemplate({ template })
  }

  async format(values: Record<string, unknown>): Promise<string> {
    let output = this.template
    for (const [key, value] of Object.entries(values)) {
      output = output.replace(new RegExp(`{${key}}`, 'g'), String(value))
    }
    return output
  }
}
