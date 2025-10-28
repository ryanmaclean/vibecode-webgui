// Type definitions for langchain modules
declare module 'langchain/prompts' {
  interface PromptTemplateValues {
    [key: string]: string | number | boolean | null | undefined;
  }

  export class PromptTemplate {
    static fromTemplate(template: string): PromptTemplate;
    template: string;
    format(values: PromptTemplateValues): string;
  }
}

declare module 'langchain/embeddings/openai' {
  export class OpenAIEmbeddings {
    constructor(config: { openAIApiKey?: string });
    embedDocuments(texts: string[]): Promise<number[][]>;
    embedQuery(text: string): Promise<number[]>;
  }
}

declare module 'langchain/vectorstores/base' {
  interface DocumentMetadata {
    source?: string;
    [key: string]: string | number | boolean | null | undefined;
  }

  export interface VectorStoreRetriever {
    getRelevantDocuments(query: string, k?: number): Promise<Array<{
      pageContent: string;
      metadata: DocumentMetadata;
    }>>;
    addDocuments(documents: Array<{
      pageContent: string;
      metadata?: DocumentMetadata;
    }>): Promise<void>;
  }
}
