"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenRouterClient = void 0;
const vscode = __importStar(require("vscode"));
const axios_1 = __importDefault(require("axios"));
class OpenRouterClient {
    constructor() {
        this.baseURL = 'https://openrouter.ai/api/v1';
        this.models = [];
        this.apiKey = this.getApiKey();
        this.client = axios_1.default.create({
            baseURL: this.baseURL,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'HTTP-Referer': 'https://vibecode.dev',
                'X-Title': 'VibeCode AI Assistant',
                'Content-Type': 'application/json'
            },
            timeout: 60000
        });
    }
    getApiKey() {
        const config = vscode.workspace.getConfiguration('vibecode');
        return config.get('openRouterApiKey') || '';
    }
    updateConfiguration() {
        this.apiKey = this.getApiKey();
        this.client.defaults.headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    async validateApiKey() {
        if (!this.apiKey) {
            return false;
        }
        try {
            const response = await this.client.get('/models');
            return response.status === 200;
        }
        catch (error) {
            console.error('API key validation failed:', error);
            return false;
        }
    }
    async getModels() {
        try {
            const response = await this.client.get('/models');
            this.models = response.data.data;
            return this.models;
        }
        catch (error) {
            console.error('Failed to fetch models:', error);
            throw new Error('Failed to fetch available models');
        }
    }
    async chatCompletion(messages, model, stream = false) {
        const config = vscode.workspace.getConfiguration('vibecode');
        const selectedModel = model || config.get('defaultModel') || 'anthropic/claude-3-sonnet-20240229';
        const maxTokens = config.get('maxTokens') || 4000;
        const temperature = config.get('temperature') || 0.7;
        const requestData = {
            model: selectedModel,
            messages,
            max_tokens: maxTokens,
            temperature,
            stream
        };
        try {
            const response = await this.client.post('/chat/completions', requestData);
            return response.data;
        }
        catch (error) {
            console.error('Chat completion failed:', error);
            if (error.response?.status === 401) {
                throw new Error('Invalid API key. Please check your OpenRouter API key in settings.');
            }
            else if (error.response?.status === 402) {
                throw new Error('Insufficient credits. Please check your OpenRouter account balance.');
            }
            else if (error.response?.status === 429) {
                throw new Error('Rate limit exceeded. Please try again later.');
            }
            else {
                throw new Error(`AI request failed: ${error.response?.data?.error?.message || error.message}`);
            }
        }
    }
    async streamChatCompletion(messages, model, onChunk) {
        const config = vscode.workspace.getConfiguration('vibecode');
        const selectedModel = model || config.get('defaultModel') || 'anthropic/claude-3-sonnet-20240229';
        const maxTokens = config.get('maxTokens') || 4000;
        const temperature = config.get('temperature') || 0.7;
        const requestData = {
            model: selectedModel,
            messages,
            max_tokens: maxTokens,
            temperature,
            stream: true
        };
        try {
            const response = await this.client.post('/chat/completions', requestData, {
                responseType: 'stream'
            });
            let fullResponse = '';
            return new Promise((resolve, reject) => {
                response.data.on('data', (chunk) => {
                    const lines = chunk.toString().split('\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') {
                                resolve(fullResponse);
                                return;
                            }
                            try {
                                const parsed = JSON.parse(data);
                                const content = parsed.choices[0]?.delta?.content;
                                if (content) {
                                    fullResponse += content;
                                    onChunk?.(content);
                                }
                            }
                            catch (e) {
                                // Skip invalid JSON lines
                            }
                        }
                    }
                });
                response.data.on('end', () => {
                    resolve(fullResponse);
                });
                response.data.on('error', (error) => {
                    reject(error);
                });
            });
        }
        catch (error) {
            console.error('Streaming chat completion failed:', error);
            throw new Error(`Streaming AI request failed: ${error.response?.data?.error?.message || error.message}`);
        }
    }
    async generateCode(prompt, context, language) {
        const systemPrompt = `You are a skilled software developer. Generate high-quality, clean, and well-documented code based on the user's request.
        ${language ? `The code should be in ${language}.` : ''}
        ${context ? `Context: ${context}` : ''}

        Rules:
        - Write clean, readable code
        - Include appropriate comments
        - Follow best practices and conventions
        - Handle edge cases and errors
        - Return only the code, no explanations`;
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
        ];
        const response = await this.chatCompletion(messages);
        return response.choices[0].message.content;
    }
    async explainCode(code) {
        const systemPrompt = `You are a code expert. Explain the provided code in clear, understandable terms.
        Include:
        - What the code does
        - How it works
        - Key concepts and patterns used
        - Any potential issues or improvements`;
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Please explain this code:\n\n${code}` }
        ];
        const response = await this.chatCompletion(messages);
        return response.choices[0].message.content;
    }
    async optimizeCode(code) {
        const systemPrompt = `You are a performance optimization expert. Analyze the provided code and suggest optimizations.
        Focus on:
        - Performance improvements
        - Code readability
        - Best practices
        - Security considerations
        - Memory efficiency

        Provide the optimized code with explanations of changes made.`;
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Please optimize this code:\n\n${code}` }
        ];
        const response = await this.chatCompletion(messages);
        return response.choices[0].message.content;
    }
    async fixCode(code, error) {
        const systemPrompt = `You are a debugging expert. Fix the issues in the provided code.
        ${error ? `Error message: ${error}` : ''}

        Provide:
        - The corrected code
        - Explanation of what was wrong
        - How the fix addresses the issue`;
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Please fix this code:\n\n${code}` }
        ];
        const response = await this.chatCompletion(messages);
        return response.choices[0].message.content;
    }
    async generateTests(code, framework) {
        const systemPrompt = `You are a test automation expert. Generate comprehensive tests for the provided code.
        ${framework ? `Use ${framework} testing framework.` : ''}

        Include:
        - Unit tests for all functions
        - Edge case testing
        - Error handling tests
        - Mock data where appropriate
        - Clear test descriptions`;
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Please generate tests for this code:\n\n${code}` }
        ];
        const response = await this.chatCompletion(messages);
        return response.choices[0].message.content;
    }
}
exports.OpenRouterClient = OpenRouterClient;
//# sourceMappingURL=openrouter-client.js.map
