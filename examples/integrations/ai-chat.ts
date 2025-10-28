/**
 * AI Chat Integration Example
 * 
 * This example demonstrates:
 * - LiteLLM client integration
 * - Streaming chat responses
 * - Cost tracking and optimization
 * - Error handling and retries
 * - Conversation management
 * - Model selection strategies
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { litellmClient } from '@/lib/ai/litellm-client';
import { useSession } from 'next-auth/react';
import { useToast } from '@/components/ui/use-toast';

// Types
export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: Date;
  model?: string;
  cost?: number;
  tokens?: {
    input: number;
    output: number;
    total: number;
  };
  metadata?: {
    duration: number;
    cached: boolean;
    error?: string;
  };
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  totalCost: number;
  totalTokens: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelInfo {
  name: string;
  provider: string;
  category: 'premium' | 'standard' | 'economy';
  costPerInputToken: number;
  costPerOutputToken: number;
  maxTokens: number;
  supportsStreaming: boolean;
  supportsVision: boolean;
}

interface UseChatOptions {
  conversationId?: string;
  initialMessages?: ChatMessage[];
  autoSelectModel?: boolean;
  maxCostPerMessage?: number;
  systemPrompt?: string;
}

interface UseChatReturn {
  // State
  messages: ChatMessage[];
  conversation: ChatConversation | null;
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  
  // Chat actions
  sendMessage: (content: string, options?: SendMessageOptions) => Promise<void>;
  regenerateLastResponse: () => Promise<void>;
  clearConversation: () => void;
  
  // Model management
  availableModels: ModelInfo[];
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  
  // Cost tracking
  totalCost: number;
  messageCount: number;
  tokensUsed: number;
  
  // Utilities
  exportConversation: () => string;
  importConversation: (data: string) => void;
  estimateCost: (content: string, model?: string) => number;
}

interface SendMessageOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

// Model selection strategy
export class ModelSelector {
  private models: ModelInfo[] = [];
  
  constructor(models: ModelInfo[]) {
    this.models = models;
  }
  
  selectOptimalModel(
    messageContent: string, 
    conversationLength: number,
    maxCost?: number
  ): string {
    const contentLength = messageContent.length;
    
    // For short, simple queries - use economy model
    if (contentLength < 200 && conversationLength < 5) {
      return this.getModelByCategory('economy') || 'gpt-4o-mini';
    }
    
    // For code-related content - prefer code-optimized models
    if (this.isCodeRelated(messageContent)) {
      const codeModel = this.models.find(m => 
        m.name.includes('code') || m.name.includes('coder')
      );
      if (codeModel) return codeModel.name;
    }
    
    // For complex reasoning - use premium models
    if (this.isComplexReasoning(messageContent) && !maxCost) {
      return this.getModelByCategory('premium') || 'gpt-4o';
    }
    
    // Default to standard model
    return this.getModelByCategory('standard') || 'gpt-4o-mini';
  }
  
  private getModelByCategory(category: string): string | undefined {
    return this.models.find(m => m.category === category)?.name;
  }
  
  private isCodeRelated(content: string): boolean {
    const codeKeywords = [
      'function', 'class', 'import', 'export', 'const', 'let', 'var',
      'typescript', 'javascript', 'python', 'react', 'api', 'component'
    ];
    return codeKeywords.some(keyword => 
      content.toLowerCase().includes(keyword)
    );
  }
  
  private isComplexReasoning(content: string): boolean {
    const complexKeywords = [
      'analyze', 'compare', 'explain why', 'architecture', 'strategy',
      'pros and cons', 'best practices', 'design pattern'
    ];
    return complexKeywords.some(keyword => 
      content.toLowerCase().includes(keyword)
    );
  }
}

// Cost estimator utility
export class CostEstimator {
  private models: Map<string, ModelInfo> = new Map();
  
  constructor(models: ModelInfo[]) {
    models.forEach(model => {
      this.models.set(model.name, model);
    });
  }
  
  estimateMessageCost(content: string, model = 'gpt-4o-mini'): number {
    const modelInfo = this.models.get(model);
    if (!modelInfo) return 0;
    
    // Rough token estimation (1 token ≈ 4 characters)
    const inputTokens = Math.ceil(content.length / 4);
    const outputTokens = Math.ceil(inputTokens * 0.5); // Assume 50% response length
    
    const inputCost = inputTokens * modelInfo.costPerInputToken;
    const outputCost = outputTokens * modelInfo.costPerOutputToken;
    
    return inputCost + outputCost;
  }
}

// Main chat hook
export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const {
    conversationId,
    initialMessages = [],
    autoSelectModel = true,
    maxCostPerMessage = 0.10, // $0.10 limit per message
    systemPrompt = "You are a helpful AI assistant specialized in software development and coding tasks."
  } = options;

  const { data: session } = useSession();
  const { toast } = useToast();
  
  // State
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');
  
  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const modelSelector = useRef<ModelSelector | null>(null);
  const costEstimator = useRef<CostEstimator | null>(null);

  // Initialize models and utilities
  useEffect(() => {
    const initializeModels = async () => {
      try {
        const models = await litellmClient.getModels();
        setAvailableModels(models);
        modelSelector.current = new ModelSelector(models);
        costEstimator.current = new CostEstimator(models);
      } catch (error) {
        console.error('Failed to load models:', error);
      }
    };

    initializeModels();
  }, []);

  // Send message function
  const sendMessage = useCallback(async (
    content: string, 
    options: SendMessageOptions = {}
  ): Promise<void> => {
    if (!session?.user?.id || !content.trim()) return;

    setIsLoading(true);
    setError(null);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      // Auto-select model if enabled
      let modelToUse = options.model || selectedModel;
      
      if (autoSelectModel && modelSelector.current) {
        modelToUse = modelSelector.current.selectOptimalModel(
          content,
          messages.length,
          maxCostPerMessage
        );
      }

      // Estimate cost
      const estimatedCost = costEstimator.current?.estimateMessageCost(content, modelToUse) || 0;
      
      if (estimatedCost > maxCostPerMessage) {
        // Fall back to cheaper model
        modelToUse = 'gpt-4o-mini';
        toast({
          title: 'Model adjusted',
          description: `Switched to ${modelToUse} to stay within cost limits.`,
        });
      }

      // Create user message
      const userMessage: ChatMessage = {
        id: `user_${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date(),
        model: modelToUse,
      };

      setMessages(prev => [...prev, userMessage]);

      // Prepare conversation history
      const conversationHistory = [
        { role: 'system' as const, content: systemPrompt },
        ...messages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })),
        { role: 'user' as const, content }
      ];

      const startTime = Date.now();
      
      // Stream response if supported
      if (options.stream !== false && availableModels.find(m => m.name === modelToUse)?.supportsStreaming) {
        setIsStreaming(true);
        
        const assistantMessage: ChatMessage = {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          model: modelToUse,
        };
        
        setMessages(prev => [...prev, assistantMessage]);

        await litellmClient.streamChatCompletion(
          {
            model: modelToUse,
            messages: conversationHistory,
            temperature: options.temperature || 0.7,
            max_tokens: options.maxTokens || 4000,
          },
          (chunk) => {
            if (chunk.choices?.[0]?.delta?.content) {
              setMessages(prev => 
                prev.map(msg => 
                  msg.id === assistantMessage.id
                    ? { ...msg, content: msg.content + chunk.choices[0].delta.content }
                    : msg
                )
              );
            }
          },
          session.user.id,
          conversationId ? parseInt(conversationId) : undefined
        );

      } else {
        // Regular completion
        const response = await litellmClient.chatCompletion(
          {
            model: modelToUse,
            messages: conversationHistory,
            temperature: options.temperature || 0.7,
            max_tokens: options.maxTokens || 4000,
          },
          session.user.id,
          conversationId ? parseInt(conversationId) : undefined
        );

        const assistantMessage: ChatMessage = {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          content: response.choices[0].message.content,
          timestamp: new Date(),
          model: modelToUse,
          cost: response.cost,
          tokens: {
            input: response.usage.prompt_tokens,
            output: response.usage.completion_tokens,
            total: response.usage.total_tokens,
          },
          metadata: {
            duration: Date.now() - startTime,
            cached: false, // Would be determined by cache hit
          }
        };

        setMessages(prev => [...prev, assistantMessage]);
      }

      // Update conversation
      setConversation(prev => {
        if (prev) {
          return {
            ...prev,
            messages: messages,
            totalCost: prev.totalCost + (estimatedCost || 0),
            totalTokens: prev.totalTokens + (estimatedCost * 1000 || 0), // Rough estimate
            updatedAt: new Date(),
          };
        }
        
        // Create new conversation
        return {
          id: conversationId || `conv_${Date.now()}`,
          title: content.slice(0, 50) + (content.length > 50 ? '...' : ''),
          messages: messages,
          totalCost: estimatedCost || 0,
          totalTokens: estimatedCost * 1000 || 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      });

      toast({
        title: 'Message sent',
        description: `Using ${modelToUse} • Estimated cost: $${estimatedCost.toFixed(4)}`,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });

      // Remove user message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [
    session, 
    messages, 
    selectedModel, 
    autoSelectModel, 
    maxCostPerMessage, 
    systemPrompt,
    availableModels,
    conversationId,
    toast
  ]);

  // Regenerate last response
  const regenerateLastResponse = useCallback(async (): Promise<void> => {
    const lastUserMessage = [...messages].reverse().find(msg => msg.role === 'user');
    
    if (lastUserMessage) {
      // Remove last assistant message
      setMessages(prev => {
        const lastAssistantIndex = [...prev].reverse().findIndex(msg => msg.role === 'assistant');
        if (lastAssistantIndex !== -1) {
          const actualIndex = prev.length - 1 - lastAssistantIndex;
          return prev.slice(0, actualIndex);
        }
        return prev;
      });
      
      // Resend with different temperature for variety
      await sendMessage(lastUserMessage.content, { temperature: 0.9 });
    }
  }, [messages, sendMessage]);

  // Clear conversation
  const clearConversation = useCallback(() => {
    setMessages([]);
    setConversation(null);
    setError(null);
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Export conversation
  const exportConversation = useCallback((): string => {
    const exportData = {
      conversation,
      messages,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    return JSON.stringify(exportData, null, 2);
  }, [conversation, messages]);

  // Import conversation
  const importConversation = useCallback((data: string) => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.messages && Array.isArray(parsed.messages)) {
        setMessages(parsed.messages);
        setConversation(parsed.conversation);
      }
    } catch (error) {
      toast({
        title: 'Import failed',
        description: 'Invalid conversation data format.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Estimate cost
  const estimateCost = useCallback((content: string, model?: string): number => {
    return costEstimator.current?.estimateMessageCost(content, model || selectedModel) || 0;
  }, [selectedModel]);

  // Computed values
  const totalCost = messages.reduce((sum, msg) => sum + (msg.cost || 0), 0);
  const messageCount = messages.filter(msg => msg.role !== 'system').length;
  const tokensUsed = messages.reduce((sum, msg) => sum + (msg.tokens?.total || 0), 0);

  return {
    // State
    messages,
    conversation,
    isLoading,
    isStreaming,
    error,
    
    // Chat actions
    sendMessage,
    regenerateLastResponse,
    clearConversation,
    
    // Model management
    availableModels,
    selectedModel,
    setSelectedModel,
    
    // Cost tracking
    totalCost,
    messageCount,
    tokensUsed,
    
    // Utilities
    exportConversation,
    importConversation,
    estimateCost,
  };
}

/**
 * Usage Examples:
 * 
 * Basic chat:
 * const { messages, sendMessage, isLoading } = useChat();
 * await sendMessage('Hello, how can you help me?');
 * 
 * With cost limits:
 * const chat = useChat({ 
 *   maxCostPerMessage: 0.05,
 *   autoSelectModel: true 
 * });
 * 
 * Code-focused chat:
 * const chat = useChat({
 *   systemPrompt: "You are an expert software engineer...",
 *   selectedModel: "qwen2.5-coder"
 * });
 * 
 * Streaming responses:
 * await sendMessage('Explain React hooks', { stream: true });
 * 
 * Custom model and temperature:
 * await sendMessage('Be creative!', { 
 *   model: 'gpt-4o', 
 *   temperature: 0.9 
 * });
 */