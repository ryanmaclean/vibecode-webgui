import { ChatCompletionRequest } from './openrouter-client';

export type InferredTask = 'chat' | 'code' | 'analysis' | 'creative' | 'general';

export class PromptAnalyzer {
  analyze(request: ChatCompletionRequest): { task: InferredTask } {
    try {
      const text = JSON.stringify(request.messages || []).toLowerCase();
      if (/function|class|typescript|javascript|code|refactor|bugfix/.test(text)) return { task: 'code' };
      if (/analyz(e|is)|investigate|compare|summarize|explain/.test(text)) return { task: 'analysis' };
      if (/story|poem|creative|lyrics|imagine|design/.test(text)) return { task: 'creative' };
      return { task: 'chat' };
    } catch {
      return { task: 'general' };
    }
  }
}
