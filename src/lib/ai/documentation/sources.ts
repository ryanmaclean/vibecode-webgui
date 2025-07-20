import { DocumentationIngester } from './ingest';
import axios from 'axios';

type Framework = {
  name: string;
  url: string;
  type: 'typescript' | 'python' | 'javascript' | 'other';
  documentationUrl?: string;
  apiDocsUrl?: string;
};

export class DocumentationSources {
  private ingester: DocumentationIngester;
  private frameworks: Framework[];

  constructor() {
    this.ingester = new DocumentationIngester();
    this.frameworks = this.getDefaultFrameworks();
  }

  private getDefaultFrameworks(): Framework[] {
    return [
      {
        name: 'Mastra',
        url: 'https://github.com/mastra-ai/mastra',
        type: 'typescript',
        documentationUrl: 'https://mastra.ai/docs'
      },
      {
        name: 'CrewAI',
        url: 'https://github.com/joaomdmoura/crewAI',
        type: 'python',
        documentationUrl: 'https://docs.crewai.com'
      },
      {
        name: 'LangChain',
        url: 'https://github.com/langchain-ai/langchain',
        type: 'python',
        documentationUrl: 'https://python.langchain.com/'
      },
      {
        name: 'HuggingFace Transformers',
        url: 'https://github.com/huggingface/transformers',
        type: 'python',
        documentationUrl: 'https://huggingface.co/docs/transformers/'
      },
      {
        name: 'LlamaIndex',
        url: 'https://github.com/run-llama/llama_index',
        type: 'python',
        documentationUrl: 'https://docs.llamaindex.ai/'
      },
      {
        name: 'Chroma',
        url: 'https://github.com/chroma-core/chroma',
        type: 'python',
        documentationUrl: 'https://docs.trychroma.com/'
      },
      {
        name: 'Vercel AI SDK',
        url: 'https://github.com/vercel/ai',
        type: 'typescript',
        documentationUrl: 'https://sdk.vercel.ai/docs'
      }
    ];
  }

  async loadFrameworkDocumentation() {
    for (const framework of this.frameworks) {
      try {
        // Try to fetch from documentation URL first
        if (framework.documentationUrl) {
          await this.loadFromUrl(
            framework.name,
            framework.documentationUrl,
            { type: 'documentation', framework: framework.name, language: framework.type }
          );
        }
        
        // Then try API docs if available
        if (framework.apiDocsUrl) {
          await this.loadFromUrl(
            `${framework.name} API`,
            framework.apiDocsUrl,
            { type: 'api', framework: framework.name, language: framework.type }
          );
        }
        
        // Finally, try GitHub README
        await this.loadFromUrl(
          `${framework.name} README`,
          `https://raw.githubusercontent.com/${framework.url.split('github.com/')[1]}/main/README.md`,
          { type: 'readme', framework: framework.name, source: 'github' }
        );
        
        console.log(`Successfully loaded documentation for ${framework.name}`);
      } catch (error) {
        console.error(`Failed to load ${framework.name}:`, error.message);
      }
    }
  }

  async loadAPIDocumentation(apiSpec: any) {
    try {
      const content = typeof apiSpec === 'string' ? apiSpec : JSON.stringify(apiSpec);
      const metadata = {
        type: 'api',
        format: 'openapi',
        ...(apiSpec.info ? {
          title: apiSpec.info.title,
          version: apiSpec.info.version,
          description: apiSpec.info.description,
        } : {})
      };
      
      await this.ingester.ingestDocumentation(
        metadata.title || 'API Documentation',
        content,
        metadata
      );
      
      return true;
    } catch (error) {
      console.error('Failed to load API documentation:', error);
      return false;
    }
  }

  async loadFromUrl(name: string, url: string, metadata: Record<string, any> = {}) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'VibeCode-Documentation-Loader/1.0',
          'Accept': 'text/plain, application/json, */*'
        },
        timeout: 10000
      });
      
      await this.ingester.ingestDocumentation(
        name,
        typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
        {
          source: url,
          ...metadata,
          fetchedAt: new Date().toISOString()
        }
      );
      
      return true;
    } catch (error) {
      console.error(`Failed to load from ${url}:`, error.message);
      return false;
    }
  }

  async loadFromFile(name: string, filePath: string, metadata: Record<string, any> = {}) {
    try {
      // Using dynamic import for Node.js fs module
      const fs = await import('fs/promises');
      const content = await fs.readFile(filePath, 'utf-8');
      
      await this.ingester.ingestDocumentation(
        name,
        content,
        {
          source: filePath,
          type: 'file',
          ...metadata
        }
      );
      
      return true;
    } catch (error) {
      console.error(`Failed to load from file ${filePath}:`, error.message);
      return false;
    }
  }
}
