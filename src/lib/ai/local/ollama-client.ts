import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  repeatPenalty?: number;
  seed?: number;
  numCtx?: number;
  numGpu?: number;
  numThread?: number;
  timeout?: number;
}

export interface OllamaModelInfo {
  name: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
  modified_at: string;
}

export interface OllamaGenerateOptions {
  model: string;
  prompt: string;
  system?: string;
  template?: string;
  context?: number[];
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    repeat_penalty?: number;
    seed?: number;
    num_predict?: number;
    num_ctx?: number;
    num_gpu?: number;
    num_thread?: number;
  };
  stream?: boolean;
}

export interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_duration?: number;
  eval_duration?: number;
  eval_count?: number;
}

export class OllamaClient {
  private config: OllamaConfig;
  private baseUrl: string;

  constructor(config: OllamaConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl.endsWith('/') 
      ? config.baseUrl.slice(0, -1) 
      : config.baseUrl;
  }

  /**
   * Generate text using Ollama
   */
  async generate(options: OllamaGenerateOptions): Promise<OllamaGenerateResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
        signal: AbortSignal.timeout(this.config.timeout || 30000),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      throw new Error(`Failed to generate text: ${error.message}`);
    }
  }

  /**
   * Generate text with streaming support
   */
  async *generateStream(options: OllamaGenerateOptions): AsyncGenerator<OllamaGenerateResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...options, stream: true }),
        signal: AbortSignal.timeout(this.config.timeout || 30000),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim()) {
              try {
                const parsed = JSON.parse(line);
                yield parsed;
              } catch (parseError) {
                console.warn('Failed to parse Ollama response line:', line);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      throw new Error(`Failed to generate streaming text: ${error.message}`);
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<OllamaModelInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.config.timeout || 10000),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result.models || [];
    } catch (error) {
      throw new Error(`Failed to list models: ${error.message}`);
    }
  }

  /**
   * Pull a model from Ollama Hub
   */
  async pullModel(modelName: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: modelName }),
        signal: AbortSignal.timeout(this.config.timeout || 300000), // 5 minutes for model download
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      // Wait for the pull to complete
      const reader = response.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (line.trim()) {
                try {
                  const parsed = JSON.parse(line);
                  if (parsed.status === 'success') {
                    console.log(`Model ${modelName} pulled successfully`);
                    return;
                  }
                } catch (parseError) {
                  // Ignore parse errors for progress updates
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      }
    } catch (error) {
      throw new Error(`Failed to pull model: ${error.message}`);
    }
  }

  /**
   * Remove a model
   */
  async removeModel(modelName: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: modelName }),
        signal: AbortSignal.timeout(this.config.timeout || 10000),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      console.log(`Model ${modelName} removed successfully`);
    } catch (error) {
      throw new Error(`Failed to remove model: ${error.message}`);
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get model information
   */
  async getModelInfo(modelName: string): Promise<OllamaModelInfo | null> {
    try {
      const models = await this.listModels();
      return models.find(model => model.name === modelName) || null;
    } catch (error) {
      console.error('Failed to get model info:', error);
      return null;
    }
  }

  /**
   * Create a LangChain-compatible ChatOpenAI instance
   */
  createLangChainClient(): ChatOpenAI {
    return new ChatOpenAI({
      modelName: this.config.model,
      temperature: this.config.temperature || 0.1,
      openAIApiKey: 'ollama', // Dummy key for Ollama
      configuration: {
        baseURL: `${this.baseUrl}/api`,
        defaultHeaders: {
          'Content-Type': 'application/json',
        },
      },
    });
  }

  /**
   * Create a prompt template with Ollama
   */
  async createPromptTemplate(
    template: string,
    variables: string[]
  ): Promise<PromptTemplate> {
    return PromptTemplate.fromTemplate(template);
  }

  /**
   * Execute a prompt with Ollama
   */
  async executePrompt(
    template: string,
    variables: Record<string, any>
  ): Promise<string> {
    try {
      // Replace variables in template
      let prompt = template;
      for (const [key, value] of Object.entries(variables)) {
        prompt = prompt.replace(new RegExp(`{${key}}`, 'g'), String(value));
      }

      const response = await this.generate({
        model: this.config.model,
        prompt,
        options: {
          temperature: this.config.temperature,
          top_p: this.config.topP,
          top_k: this.config.topK,
          repeat_penalty: this.config.repeatPenalty,
          seed: this.config.seed,
          num_ctx: this.config.numCtx,
          num_gpu: this.config.numGpu,
          num_thread: this.config.numThread,
        },
      });

      return response.response;
    } catch (error) {
      throw new Error(`Failed to execute prompt: ${error.message}`);
    }
  }

  /**
   * Create a chain for complex workflows
   */
  createChain(): RunnableSequence<any, any> {
    const prompt = PromptTemplate.fromTemplate('{input}');
    const model = this.createLangChainClient();
    const outputParser = new StringOutputParser();

<<<<<<< HEAD
<<<<<<< HEAD
    // @ts-expect-error - Type incompatibility with LangChain's RunnableSequence
=======
    // @ts-ignore - Type incompatibility with LangChain's RunnableSequence
>>>>>>> fix/consolidated-dependency-updates
=======
<<<<<<< Updated upstream
    // @ts-ignore - Type incompatibility with LangChain's RunnableSequence
=======
    // @ts-expect-error - Type incompatibility with LangChain's RunnableSequence
>>>>>>> main
>>>>>>> merge-conflict-cleanup
    return RunnableSequence.from([
      prompt,
      model,
      outputParser,
    ]);
  }
}

// Predefined Ollama model configurations
export const OLLAMA_MODELS = {
  CODE_LLAMA: {
    name: 'codellama:7b',
    description: 'Code-focused language model for programming tasks',
    recommendedUse: ['code generation', 'code review', 'debugging'],
    requirements: {
      ram: '8GB',
      gpu: 'Optional',
      storage: '4GB'
    }
  },
  
  LLAMA3: {
    name: 'llama3:8b',
    description: 'General-purpose language model for various tasks',
    recommendedUse: ['text generation', 'conversation', 'analysis'],
    requirements: {
      ram: '8GB',
      gpu: 'Optional',
      storage: '5GB'
    }
  },
  
  QWEN_CODER: {
    name: 'qwen2.5-coder:7b',
    description: 'Code-specialized model with strong reasoning',
    recommendedUse: ['complex coding', 'algorithm design', 'system architecture'],
    requirements: {
      ram: '8GB',
      gpu: 'Recommended',
      storage: '4GB'
    }
  },
  
  MISTRAL_CODER: {
    name: 'mistral-coder:7b',
    description: 'Balanced model for code and general tasks',
    recommendedUse: ['mixed tasks', 'documentation', 'code explanation'],
    requirements: {
      ram: '8GB',
      gpu: 'Optional',
      storage: '4GB'
    }
  }
};

// Factory function to create Ollama client with common configurations
export function createOllamaClient(
  model: keyof typeof OLLAMA_MODELS | string,
  config: Partial<OllamaConfig> = {}
): OllamaClient {
  const modelConfig = typeof model === 'string' 
    ? { name: model }
    : OLLAMA_MODELS[model];

  const defaultConfig: OllamaConfig = {
    baseUrl: 'http://localhost:11434',
    model: modelConfig.name,
    temperature: 0.1,
    topP: 0.9,
    topK: 40,
    repeatPenalty: 1.1,
    numCtx: 4096,
    numGpu: 1,
    numThread: 4,
    timeout: 30000,
    ...config
  };

  return new OllamaClient(defaultConfig);
}

export default OllamaClient;
