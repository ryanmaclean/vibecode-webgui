import { EnhancedVectorStore } from "./enhanced-vector-store";
import { mlflowClient } from "../mlflow/tracker";

interface RetrieverDocument {
  pageContent: string;
  metadata: Record<string, unknown>;
}

/** Simple prompt helper compatible with the original LangChain usage. */
export class PromptTemplate {
  private constructor(private readonly template: string) {}

  static fromTemplate(template: string): PromptTemplate {
    return new PromptTemplate(template);
  }

  format(vars: { context: string; question: string }): string {
    return this.template
      .replace('{context}', vars.context)
      .replace('{question}', vars.question);
  }
}

/** Minimal QA chain implementation used for testing and demos. */
export class RetrievalQAChain {
  constructor(
    private readonly retriever: VectorRetriever,
    private readonly prompt: PromptTemplate,
  ) {}

  static fromRetriever(retriever: VectorRetriever, prompt: PromptTemplate): RetrievalQAChain {
    return new RetrievalQAChain(retriever, prompt);
  }

  async call(input: { question: string }): Promise<{ text: string }> {
    const docs = await this.retriever.invoke(input.question);
    const context = docs
      .map((doc: RetrieverDocument) => doc.pageContent)
      .filter(Boolean)
      .join('\n');

    const formattedPrompt = this.prompt.format({
      context,
      question: input.question,
    });

    return { text: formattedPrompt };
  }
}

/**
 * Configuration for the custom retriever.
 */
export interface LangChainConfig {
  store: EnhancedVectorStore;
  modelName?: string; // kept for compatibility
}

/**
 * Lightweight retriever that forwards queries to our EnhancedVectorStore.
 */
export class VectorRetriever {
  private readonly store: EnhancedVectorStore;

  constructor({ store }: LangChainConfig) {
    this.store = store;
  }

  async invoke(query: string): Promise<RetrieverDocument[]> {
    const startTime = Date.now();
    const results = await this.store.searchWithText(query);

    const docs: RetrieverDocument[] = results.map((result) => ({
      pageContent: result.chunk.content,
      metadata: result.chunk.metadata || {},
    }));

    const latency = Date.now() - startTime;
    try {
      const run = await mlflowClient.startRun(`VectorRetrieval-${Date.now()}`);
      await mlflowClient.logMetric(run.run_id, 'latency_ms', latency);
      await mlflowClient.endRun(run.run_id);
    } catch (error) {
      console.warn('MLflow metric logging failed:', error);
    }

    return docs;
  }

  static createQAChain(retriever: VectorRetriever): RetrievalQAChain {
    const prompt = PromptTemplate.fromTemplate(
      'Answer the question based on the following context:\n{context}\n\nQuestion: {question}'
    );
    return RetrievalQAChain.fromRetriever(retriever, prompt);
  }
}
