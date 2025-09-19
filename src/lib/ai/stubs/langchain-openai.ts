export class ChatOpenAI {
  modelName: string
  temperature: number
  constructor(options: { modelName?: string; temperature?: number; openAIApiKey?: string } = {}) {
    this.modelName = options.modelName ?? 'stub-model'
    this.temperature = options.temperature ?? 0
  }

  async call(prompt: string): Promise<string> {
    return `Stubbed ChatOpenAI response for model ${this.modelName}: ${prompt}`
  }

  async invoke(input: unknown): Promise<{ output: string }> {
    return { output: `Stubbed ChatOpenAI invoke for model ${this.modelName}` }
  }
}

export class OpenAIEmbeddings {
  constructor(_options: Record<string, unknown> = {}) {}

  async embedQuery(_input: string): Promise<number[]> {
    return [0]
  }

  async embedDocuments(inputs: string[]): Promise<number[][]> {
    return inputs.map(() => [0])
  }
}
