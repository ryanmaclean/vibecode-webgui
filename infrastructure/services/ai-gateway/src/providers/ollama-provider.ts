import axios from 'axios';
import { Provider, ChatRequest, ChatResponse } from './provider';

// Ollama local provider (dev/local). Default host http://localhost:11434.
// License note: uses axios (MIT). No additional runtime deps.
export class OllamaProvider implements Provider {
  public name = 'ollama';

  private host = (process.env.OLLAMA_HOST || 'http://localhost:11434').replace(/\/$/, '');

  async chatCompletion(req: ChatRequest, _userId?: string): Promise<ChatResponse> {
    const model = (req.model || 'llama3.2').replace(/^ollama:/, '');
    const url = `${this.host}/api/chat`;

    const payload: any = {
      model,
      messages: req.messages.map(m => ({ role: m.role, content: m.content })),
      stream: false,
      options: {}
    };
    if (typeof req.temperature === 'number') payload.options.temperature = req.temperature;
    if (typeof req.top_p === 'number') payload.options.top_p = req.top_p;
    if (typeof req.max_tokens === 'number') payload.options.num_predict = req.max_tokens;

    const resp = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000,
    });

    const data = resp.data;
    // Ollama chat response has structure { message: { role, content }, ... }
    const content = data?.message?.content || '';

    return {
      id: undefined,
      model,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content },
          finish_reason: 'stop',
        }
      ],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    };
  }
}
