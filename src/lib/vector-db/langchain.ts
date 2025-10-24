import { EnhancedVectorStore } from "./enhanced-vector-store";
import {
BaseRetriever,
  RetrievalQAChain,
  PromptTemplate,
} from "langchain/chains";
import { OpenAIEmbeddings } from "@langchain/openai";
import { mlflowClient } from "../mlflow/tracker";
// import { logger } from '@/lib/logger';
/**
 * Configuration for the LangChain retriever.
 */
export interface LangChainConfig {
  /** The underlying vector store that will actually perform the search. */
  store: EnhancedVectorStore;
  /** Optional name of the LLM to use in the QA chain helper. */
  modelName?: string; // e.g., "gpt-4o-mini"
}

/**
 * A minimal LangChain retriever that forwards queries to an
 * {@link EnhancedVectorStore}. It implements LangChain's `BaseRetriever`
 * interface so it can be passed directly into any chain or prompt.
 */
export class VectorRetriever extends BaseRetriever {
  private readonly store: EnhancedVectorStore;

  constructor({ store }: LangChainConfig) {
    super();
    this.store = store;
  }

  /**
   * Executes a vector search against the underlying store and returns
   * an array of objects that LangChain can consume.
   *
   * @param query The text to search for.
   */
  async invoke(query: string, options?: any): Promise<any> {
    const startTime = Date.now();
    const results = await this.store.search("pgvector", { query });
    const content = results.map((r) => ({ content: r.embedding }));
    const latency = Date.now() - startTime;
    try {
      const run = await mlflowClient.startRun(`VectorRetrieval-${Date.now()}`);
      await mlflowClient.logMetric(run.run_id, "latency_ms", latency);
      await mlflowClient.endRun(run.run_id);
    } catch (e) {
      console.warn("MLflow metric logging failed:", e);
    }
    return content;
  }

  /**
   * Convenience helper that builds a RetrievalQA chain using this retriever
   * and an OpenAI embedding model.
   *
   * @param retriever The retriever instance to use.
   * @param modelName Optional LLM name; defaults to "gpt-4o-mini".
   */
  static async qaChain(
    retriever: VectorRetriever,
    modelName = "gpt-4o-mini",
  ): Promise<RetrievalQAChain> {
    const prompt = PromptTemplate.fromTemplate(
      "Answer the question based on the following context:\n{context}\n\nQuestion: {question}"
    );

    return RetrievalQAChain.fromLLM(
      new OpenAIEmbeddings({ modelName }),
      retriever,
      { prompt },
    );
  }
}
