type ChatOpenAIOptions = {
  modelName?: string
  temperature?: number
  openAIApiKey?: string
  configuration?: {
    baseURL?: string
    defaultHeaders?: Record<string, string>
  }
}

export class ChatOpenAI {
  modelName: string
  temperature: number
  configuration?: ChatOpenAIOptions['configuration']

  constructor(options: ChatOpenAIOptions = {}) {
    this.modelName = options.modelName ?? 'stub-model'
    this.temperature = options.temperature ?? 0
    this.configuration = options.configuration
  }

  async call(prompt: string): Promise<string> {
    return `Stubbed ChatOpenAI response for model ${this.modelName}: ${prompt}`
  }

  async invoke(_input: unknown): Promise<string> {
    return `Stubbed ChatOpenAI invoke for model ${this.modelName}`
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
