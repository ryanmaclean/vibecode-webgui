declare module 'langchain/chains' {
  export class BaseRetriever {
    constructor(...args: any[]);
    invoke(query: string, options?: any): Promise<any>;
  }

  export class RetrievalQAChain {
    static fromLLM(model: any, retriever: any, options?: any): RetrievalQAChain;
    call(input: any): Promise<{ text: string }>;
  }

  export class PromptTemplate {
    static fromTemplate(template: string): PromptTemplate;
  }
}
