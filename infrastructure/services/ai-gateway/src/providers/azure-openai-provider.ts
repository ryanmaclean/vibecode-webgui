import axios from 'axios';
import { Provider, ChatRequest, ChatResponse } from './provider';

export class AzureOpenAIProvider implements Provider {
  public name = 'azure';

  private endpoint = (process.env.AZURE_OPENAI_ENDPOINT || '').replace(/\/$/, '');
  private apiKey = process.env.AZURE_OPENAI_API_KEY || '';
  private apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';
  private deploymentsMap = (() => {
    const raw = process.env.AZURE_OPENAI_DEPLOYMENTS || '';
    try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
  })() as Record<string, string>;

  private resolveDeployment(model?: string): string {
    // If model provided and appears in deployments map, use mapping; otherwise treat as deployment name
    if (model) {
      if (this.deploymentsMap && typeof this.deploymentsMap === 'object' && this.deploymentsMap[model]) {
        return this.deploymentsMap[model];
      }
      return model; // assume it is a deployment name
    }
    // Fallback: first mapping entry or a sensible default
    const first = Object.values(this.deploymentsMap)[0];
    if (first) return first;
    // Last resort
    return 'gpt-4o';
  }

  async chatCompletion(req: ChatRequest, userId?: string): Promise<ChatResponse> {
    if (!this.endpoint || !this.apiKey) {
      throw new Error('AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY are required to use Azure OpenAI provider');
    }

    const deployment = this.resolveDeployment(req.model);
    const url = `${this.endpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(this.apiVersion)}`;

    const payload: any = {
      messages: req.messages.map(m => ({ role: m.role, content: m.content })),
    };

    // Some Azure deployments require explicit model param off; rely on deployment instead
    if (typeof req.max_tokens === 'number') payload.max_tokens = req.max_tokens;
    if (typeof req.temperature === 'number') payload.temperature = req.temperature;
    if (typeof req.top_p === 'number') payload.top_p = req.top_p;
    if (Array.isArray(req.stop)) payload.stop = req.stop;
    if (userId || req.user) payload.user = userId || req.user;

    const resp = await axios.post(url, payload, {
      headers: {
        'api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    });

    const data = resp.data;
    return {
      id: data.id,
      model: deployment, // report deployment as model identifier
      choices: data.choices?.map((c: any, idx: number) => ({
        index: typeof c.index === 'number' ? c.index : idx,
        message: c.message,
        finish_reason: c.finish_reason ?? null,
      })) || [],
      usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };
  }
}
