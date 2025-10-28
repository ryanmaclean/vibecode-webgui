#!/usr/bin/env npx tsx

/**
 * Automated API Documentation Generator
 * Extracts API endpoints, types, and generates documentation from TypeScript code
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

interface APIEndpoint {
  method: string;
  path: string;
  description: string;
  parameters: Parameter[];
  responses: Response[];
  authentication?: string;
  examples: Example[];
  filePath: string;
}

interface Parameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface Response {
  status: number;
  description: string;
  schema?: string;
}

interface Example {
  title: string;
  request?: string;
  response?: string;
}

class APIDocumentationGenerator {
  private apiRoutes: APIEndpoint[] = [];
  private srcDir = path.join(process.cwd(), 'src');

  async generate() {
    console.log('🔍 Scanning API routes...');
    await this.scanAPIRoutes();
    
    console.log(`📝 Found ${this.apiRoutes.length} API endpoints`);
    await this.generateMarkdown();
    
    console.log('✅ API documentation generated successfully');
  }

  private async scanAPIRoutes() {
    const routeFiles = await glob('src/app/api/**/route.{ts,tsx}', { 
      cwd: process.cwd() 
    });

    for (const file of routeFiles) {
      try {
        await this.parseRouteFile(file);
      } catch (error) {
        console.warn(`⚠️ Failed to parse ${file}:`, error.message);
      }
    }
  }

  private async parseRouteFile(filePath: string) {
    const content = await fs.readFile(filePath, 'utf-8');
    const routePath = this.extractRoutePath(filePath);

    // Extract HTTP methods
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    
    for (const method of methods) {
      const functionMatch = content.match(
        new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\([^)]*\\)\\s*{([\\s\\S]*?)}`, 'g')
      );

      if (functionMatch) {
        const endpoint = await this.parseEndpoint(method, routePath, content, filePath);
        if (endpoint) {
          this.apiRoutes.push(endpoint);
        }
      }
    }
  }

  private extractRoutePath(filePath: string): string {
    return filePath
      .replace('src/app/api', '/api')
      .replace('/route.ts', '')
      .replace('/route.tsx', '')
      .replace(/\[([^\]]+)\]/g, ':$1'); // Convert [id] to :id
  }

  private async parseEndpoint(
    method: string, 
    routePath: string, 
    content: string, 
    filePath: string
  ): Promise<APIEndpoint | null> {
    try {
      // Extract JSDoc comments
      const description = this.extractDescription(content, method);
      
      // Extract parameters from search params and route params
      const parameters = this.extractParameters(content, routePath);
      
      // Extract response types
      const responses = this.extractResponses(content);
      
      // Extract authentication requirements
      const authentication = this.extractAuthentication(content);
      
      // Extract examples from comments or tests
      const examples = this.extractExamples(content);

      return {
        method,
        path: routePath,
        description,
        parameters,
        responses,
        authentication,
        examples,
        filePath
      };
    } catch (error) {
      console.warn(`Failed to parse endpoint ${method} ${routePath}:`, error.message);
      return null;
    }
  }

  private extractDescription(content: string, method: string): string {
    // Look for JSDoc comments above the function
    const functionRegex = new RegExp(`/\\*\\*([\\s\\S]*?)\\*/[\\s\\S]*?export\\s+async\\s+function\\s+${method}`, 'i');
    const match = content.match(functionRegex);
    
    if (match) {
      return match[1]
        .split('\n')
        .map(line => line.replace(/^\s*\*\s?/, '').trim())
        .filter(line => line && !line.startsWith('@'))
        .join(' ')
        .trim();
    }

    // Fallback to inline comments
    const inlineMatch = content.match(new RegExp(`//\\s*${method}:([^\\n]+)`, 'i'));
    if (inlineMatch) {
      return inlineMatch[1].trim();
    }

    return `${method} endpoint`;
  }

  private extractParameters(content: string, routePath: string): Parameter[] {
    const parameters: Parameter[] = [];

    // Extract route parameters
    const routeParams = routePath.match(/:(\w+)/g);
    if (routeParams) {
      routeParams.forEach(param => {
        parameters.push({
          name: param.replace(':', ''),
          type: 'string',
          required: true,
          description: `${param.replace(':', '')} parameter`
        });
      });
    }

    // Extract query parameters from searchParams.get calls
    const queryParamMatches = content.match(/searchParams\.get\(['"`](\w+)['"`]\)/g);
    if (queryParamMatches) {
      queryParamMatches.forEach(match => {
        const paramName = match.match(/['"`](\w+)['"`]/)[1];
        if (!parameters.find(p => p.name === paramName)) {
          parameters.push({
            name: paramName,
            type: 'string',
            required: false,
            description: `${paramName} query parameter`
          });
        }
      });
    }

    // Extract request body parameters from interfaces
    const bodyParams = this.extractRequestBodyParams(content);
    parameters.push(...bodyParams);

    return parameters;
  }

  private extractRequestBodyParams(content: string): Parameter[] {
    const parameters: Parameter[] = [];
    
    // Look for request body parsing
    const bodyMatch = content.match(/const\s+(\w+)\s*=\s*await\s+request\.json\(\)/);
    if (bodyMatch) {
      // Try to find interface definition
      const interfaceMatch = content.match(/interface\s+\w+\s*{([^}]*)}/);
      if (interfaceMatch) {
        const interfaceBody = interfaceMatch[1];
        const propertyMatches = interfaceBody.match(/(\w+)(\?)?:\s*([^;]+)/g);
        
        if (propertyMatches) {
          propertyMatches.forEach(prop => {
            const [, name, optional, type] = prop.match(/(\w+)(\?)?:\s*([^;]+)/) || [];
            if (name && type) {
              parameters.push({
                name,
                type: type.trim(),
                required: !optional,
                description: `${name} field in request body`
              });
            }
          });
        }
      }
    }

    return parameters;
  }

  private extractResponses(content: string): Response[] {
    const responses: Response[] = [];
    
    // Extract NextResponse.json calls with status codes
    const responseMatches = content.match(/NextResponse\.json\([^,]*,\s*{\s*status:\s*(\d+)\s*}/g);
    if (responseMatches) {
      responseMatches.forEach(match => {
        const statusMatch = match.match(/status:\s*(\d+)/);
        if (statusMatch) {
          const status = parseInt(statusMatch[1]);
          responses.push({
            status,
            description: this.getStatusDescription(status)
          });
        }
      });
    }

    // Default success response if none found
    if (responses.length === 0) {
      responses.push({
        status: 200,
        description: 'Successful response'
      });
    }

    return responses;
  }

  private extractAuthentication(content: string): string | undefined {
    if (content.includes('getToken') || content.includes('NextAuth')) {
      return 'JWT Bearer token required';
    }
    if (content.includes('apiKey') || content.includes('API_KEY')) {
      return 'API key required';
    }
    return undefined;
  }

  private extractExamples(content: string): Example[] {
    const examples: Example[] = [];
    
    // Look for example comments
    const exampleMatches = content.match(/@example[^@]*$/gim);
    if (exampleMatches) {
      exampleMatches.forEach((example, index) => {
        examples.push({
          title: `Example ${index + 1}`,
          request: example.replace('@example', '').trim()
        });
      });
    }

    return examples;
  }

  private getStatusDescription(status: number): string {
    const descriptions = {
      200: 'Success',
      201: 'Created',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      500: 'Internal Server Error'
    };
    return descriptions[status] || 'Response';
  }

  private async generateMarkdown() {
    let markdown = `# API Documentation\n\n`;
    markdown += `*Generated on ${new Date().toISOString()}*\n\n`;
    markdown += `This documentation is automatically generated from the codebase.\n\n`;

    // Group endpoints by path
    const groupedEndpoints = this.groupEndpointsByPath();
    
    // Generate table of contents
    markdown += `## Table of Contents\n\n`;
    Object.keys(groupedEndpoints).forEach(path => {
      const anchor = path.toLowerCase().replace(/[^a-z0-9]/g, '-');
      markdown += `- [${path}](#${anchor})\n`;
    });
    markdown += `\n`;

    // Generate endpoint documentation
    for (const [basePath, endpoints] of Object.entries(groupedEndpoints)) {
      markdown += `## ${basePath}\n\n`;
      
      for (const endpoint of endpoints) {
        markdown += await this.generateEndpointMarkdown(endpoint);
      }
    }

    // Write to file
    await fs.writeFile(path.join(process.cwd(), 'docs/API.md'), markdown);
  }

  private groupEndpointsByPath(): Record<string, APIEndpoint[]> {
    const grouped: Record<string, APIEndpoint[]> = {};
    
    this.apiRoutes.forEach(endpoint => {
      const basePath = endpoint.path;
      if (!grouped[basePath]) {
        grouped[basePath] = [];
      }
      grouped[basePath].push(endpoint);
    });

    return grouped;
  }

  private async generateEndpointMarkdown(endpoint: APIEndpoint): Promise<string> {
    let markdown = `### ${endpoint.method} ${endpoint.path}\n\n`;
    
    if (endpoint.description) {
      markdown += `${endpoint.description}\n\n`;
    }

    // Authentication
    if (endpoint.authentication) {
      markdown += `**Authentication:** ${endpoint.authentication}\n\n`;
    }

    // Parameters
    if (endpoint.parameters.length > 0) {
      markdown += `#### Parameters\n\n`;
      markdown += `| Name | Type | Required | Description |\n`;
      markdown += `|------|------|----------|-------------|\n`;
      
      endpoint.parameters.forEach(param => {
        markdown += `| ${param.name} | ${param.type} | ${param.required ? 'Yes' : 'No'} | ${param.description} |\n`;
      });
      markdown += `\n`;
    }

    // Responses
    markdown += `#### Responses\n\n`;
    endpoint.responses.forEach(response => {
      markdown += `**${response.status}** - ${response.description}\n\n`;
    });

    // Examples
    if (endpoint.examples.length > 0) {
      markdown += `#### Examples\n\n`;
      endpoint.examples.forEach(example => {
        markdown += `**${example.title}**\n\n`;
        if (example.request) {
          markdown += `Request:\n\`\`\`\n${example.request}\n\`\`\`\n\n`;
        }
        if (example.response) {
          markdown += `Response:\n\`\`\`json\n${example.response}\n\`\`\`\n\n`;
        }
      });
    }

    // Source file reference
    markdown += `*Source: [${endpoint.filePath}](../${endpoint.filePath})*\n\n`;
    markdown += `---\n\n`;

    return markdown;
  }
}

// Script execution
if (require.main === module) {
  const generator = new APIDocumentationGenerator();
  generator.generate().catch(console.error);
}

export { APIDocumentationGenerator };