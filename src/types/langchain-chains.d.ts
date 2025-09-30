declare module 'langchain/chains' {
  export type ChainInput = Record<string, unknown>;
  export type ChainOutput = Record<string, unknown> & { text?: string };

  export class BaseRetriever {
    constructor(...args: unknown[]);
    invoke(query: string, options?: ChainInput): Promise<ChainOutput>;
  }

  export interface RetrievalQAChainOptions {
    returnSourceDocuments?: boolean;
    prompt?: unknown;
    verbose?: boolean;
    callbacks?: unknown[];
  }

  export class RetrievalQAChain {
    static fromLLM(
      model: unknown,
      retriever: BaseRetriever,
      options?: RetrievalQAChainOptions,
    ): RetrievalQAChain;
    call(input: ChainInput): Promise<ChainOutput>;
  }

  export class PromptTemplate {
    static fromTemplate(template: string): PromptTemplate;
    format(values: ChainInput): string;
  }
}
