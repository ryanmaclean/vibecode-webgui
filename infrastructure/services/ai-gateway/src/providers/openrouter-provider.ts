import { Provider, ChatRequest, ChatResponse } from './provider';
import { OpenRouterClient, ChatCompletionRequest } from '../services/openrouter-client';

export class OpenRouterProvider implements Provider {
  public name = 'openrouter';
  private client: OpenRouterClient;

  constructor() {
    this.client = new OpenRouterClient();
  }

  async chatCompletion(req: ChatRequest, userId?: string): Promise<ChatResponse> {
    const reqData: ChatCompletionRequest = {
      model: req.model || 'auto',
      messages: req.messages.map(m => ({ role: m.role, content: m.content })),
      max_tokens: req.max_tokens,
      temperature: req.temperature,
      top_p: req.top_p,
      stream: !!req.stream,
      stop: req.stop,
      user: userId || req.user,
    };

    const resp = await this.client.chatCompletion(reqData, userId || req.user);
    // Return as-is; shape is compatible
    return {
      id: (resp as any).id, // tolerate missing id
      model: resp.model,
      choices: resp.choices as any,
      usage: resp.usage as any,
    };
  }
}
