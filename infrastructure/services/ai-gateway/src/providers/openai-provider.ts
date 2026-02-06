import axios from 'axios';
import { Provider, ChatRequest, ChatResponse } from './provider';

export class OpenAIProvider implements Provider {
  public name = 'openai';

  private baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  private apiKey = process.env.OPENAI_API_KEY || '';

  private buildPayload(req: ChatRequest, userId?: string): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      model: req.model || 'gpt-4o-mini',
      messages: req.messages.map(m => ({ role: m.role, content: m.content })),
    };

    if (typeof req.max_tokens === 'number') payload.max_tokens = req.max_tokens;
    if (typeof req.temperature === 'number') payload.temperature = req.temperature;
    if (typeof req.top_p === 'number') payload.top_p = req.top_p;
    if (Array.isArray(req.stop)) payload.stop = req.stop;
    if (userId || req.user) payload.user = userId || req.user;

    return payload;
  }

  async chatCompletion(req: ChatRequest, userId?: string): Promise<ChatResponse> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is required to use OpenAI provider');
    }

    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;

    const payload = this.buildPayload(req, userId);

    const resp = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    });

    const data = resp.data as {
      id?: string;
      model: string;
      choices?: Array<{ index?: number; message?: { role: 'assistant' | 'user' | 'system'; content: string }; finish_reason?: string | null }>;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };
    return {
      id: data.id,
      model: data.model,
      choices: data.choices?.map((c, idx) => ({
        index: typeof c.index === 'number' ? c.index : idx,
        message: c.message,
        finish_reason: c.finish_reason ?? null,
      })) || [],
      usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };
  }
}
