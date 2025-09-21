import axios from 'axios';
import { Provider, ChatRequest, ChatResponse } from './provider';

// Minimal Hugging Face Inference API adapter
// License note: axios (MIT). No new runtime deps beyond axios.
export class HuggingFaceProvider implements Provider {
  public name = 'hf';

  private baseUrl = (process.env.HUGGINGFACE_BASE_URL || 'https://api-inference.huggingface.co/models').replace(/\/$/, '');
  private apiToken = process.env.HUGGINGFACE_API_TOKEN || '';

  private buildPrompt(messages: ChatRequest['messages']): string {
    // Simple prompt joiner to support chat-like inputs
    // System and assistant messages are included for context; user content appended naturally
    return messages
      .map(m => {
        const role = m.role.toUpperCase();
        return `[${role}] ${m.content}`;
      })
      .join('\n');
  }

  async chatCompletion(req: ChatRequest, _userId?: string): Promise<ChatResponse> {
    if (!this.apiToken) {
      throw new Error('HUGGINGFACE_API_TOKEN is required to use Hugging Face provider');
    }

    // Model: expect repo id (e.g., mistralai/Mixtral-8x7B-Instruct-v0.1)
    // If not provided, default to a small, commonly accessible model
    const model = req.model || 'tiiuae/falcon-7b-instruct';
    const url = `${this.baseUrl}/${encodeURIComponent(model)}`;

    // Inference API payload
    const inputs = this.buildPrompt(req.messages);
    const parameters: Record<string, any> = {};
    if (typeof req.max_tokens === 'number') parameters.max_new_tokens = req.max_tokens;
    if (typeof req.temperature === 'number') parameters.temperature = req.temperature;
    if (typeof req.top_p === 'number') parameters.top_p = req.top_p;
    if (Array.isArray(req.stop) && req.stop.length) parameters.stop = req.stop;

    const resp = await axios.post(url, { inputs, parameters }, {
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    });

    // The HF Inference API may return an array of generated_text or structured results depending on model
    let text = '';
    const data = resp.data;
    if (Array.isArray(data) && data[0]?.generated_text) {
      text = data[0].generated_text as string;
    } else if (typeof data === 'object' && data && (data.generated_text || data[0]?.summary_text)) {
      text = data.generated_text || data[0]?.summary_text || '';
    } else if (typeof data === 'string') {
      text = data;
    } else {
      text = JSON.stringify(data);
    }

    // Usage unknown from API; set to 0 best-effort
    return {
      id: undefined,
      model,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: text },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };
  }
}
