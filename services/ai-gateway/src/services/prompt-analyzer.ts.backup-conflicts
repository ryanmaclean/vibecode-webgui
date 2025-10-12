import { ChatCompletionRequest } from './openrouter-client';

export type InferredTask = 'chat' | 'code' | 'analysis' | 'creative' | 'general';

<<<<<<< HEAD
export interface PromptAnalysisResult {
  task: InferredTask;
  maxCost?: number;
  minPerformance?: number;
  preferredProviders?: string[];
  excludeModels?: string[];
  requireFeatures?: string[];
}

export class PromptAnalyzer {
  public analyze(request: ChatCompletionRequest): PromptAnalysisResult {
    const content = this.extractUserContent(request);
    const lowered = content.toLowerCase();

    // Basic heuristics for task inference
    if (this.looksLikeCode(content)) {
      return { task: 'code' };
    }

    if (this.isCreative(lowered)) {
      return { task: 'creative' };
    }

    if (this.isAnalysis(lowered)) {
      return { task: 'analysis' };
    }

    if (lowered.includes('chat') || lowered.includes('conversation')) {
      return { task: 'chat' };
    }

    return { task: 'general' };
  }

  private extractUserContent(request: ChatCompletionRequest): string {
    const msgs = request.messages || [];
    // Prefer last user message content
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i]?.role === 'user' && typeof msgs[i]?.content === 'string') {
        return msgs[i].content as string;
      }
    }
    // Fallback to last message
    const last = msgs[msgs.length - 1]?.content;
    return typeof last === 'string' ? last : JSON.stringify(last ?? '');
  }

  private looksLikeCode(text: string): boolean {
    if (!text) return false;
    if (text.includes('```')) return true;
    const codeHints = ['function ', 'class ', 'const ', 'let ', 'var ', 'def ', '#include', 'public static void', 'SELECT ', 'CREATE TABLE'];
    return codeHints.some(h => text.includes(h));
  }

  private isCreative(lowered: string): boolean {
    const creativeHints = ['write a story', 'poem', 'lyrics', 'creative writing', 'character backstory', 'narrative'];
    return creativeHints.some(h => lowered.includes(h));
  }

  private isAnalysis(lowered: string): boolean {
    const analysisHints = ['analyze', 'analysis', 'explain', 'compare', 'evaluate', 'summarize'];
    return analysisHints.some(h => lowered.includes(h));
=======
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
>>>>>>> merge-conflict-cleanup
  }
}
