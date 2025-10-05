/**
 * PromptInterface Type Definitions
 * Core types for the AI prompt interface component
 */

export interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachments?: FileAttachment[];
  audioUrl?: string; // For voice messages
  transcription?: string; // For voice message transcription
  metadata?: {
    codeGenerated?: boolean;
    deploymentUrl?: string;
    components?: string[];
    framework?: string;
    tokens?: number;
    cost?: number;
    model?: string;
    duration?: number;
    audioInputMethod?: 'microphone' | 'file';
  };
}

export interface FileAttachment {
  id: string;
  name: string;
  type: 'image' | 'code' | 'document' | 'audio';
  size: number;
  url?: string;
  content?: string;
  mimeType?: string;
  duration?: number; // For audio files
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  supportsImages: boolean;
  supportsFiles: boolean;
  supportsAudio: boolean;
  maxTokens: number;
  inputCostPer1k: number;
  outputCostPer1k: number;
  contextWindow: number;
}

export interface MCPServer {
  id: string;
  name: string;
  description: string;
  status: 'connected' | 'disconnected' | 'error';
  tools: string[];
  url?: string;
}

// Re-export speech recognition types
export * from './speech-recognition.types';
