
/**
 * Multimodal Prompt Interface Component
 * Advanced input interface supporting text, voice, and image inputs for AI interactions
 */

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MicrophoneIcon,
  StopIcon,
  PaperAirplaneIcon,
  PhotoIcon,
  DocumentIcon,
  XMarkIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  CogIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { MicrophoneIcon as MicrophoneIconSolid } from '@heroicons/react/24/solid';
import { logger } from '@/lib/logger';
export interface MultimodalMessage {
  id: string;
  type: 'text' | 'voice' | 'image' | 'file';
  content: string;
  file?: File;
  preview?: string;
  timestamp: Date;
  metadata?: {
    duration?: number;
    size?: number;
    mimeType?: string;
  };
}

export interface MultimodalPromptInterfaceProps {
  onSubmit?: (messages: MultimodalMessage[]) => Promise<void>;
  onVoiceStart?: () => void;
  onVoiceEnd?: (transcript: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxFiles?: number;
  acceptedFileTypes?: string[];
  enableVoice?: boolean;
  enableImages?: boolean;
  enableFiles?: boolean;
  className?: string;
}

export function MultimodalPromptInterface({
  onSubmit,
  onVoiceStart,
  onVoiceEnd,
  placeholder = 'Ask me anything...',
  disabled = false,
  maxFiles = 5,
  acceptedFileTypes = ['image/*', 'text/*', '.pdf', '.doc', '.docx'],
  enableVoice = true,
  enableImages = true,
  enableFiles = true,
  className = ''
}: MultimodalPromptInterfaceProps) {
  const [messages, setMessages] = useState<MultimodalMessage[]>([]);
  const [textInput, setTextInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout>();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize speech recognition
  useEffect(() => {
    if (enableVoice && 'webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setTranscript('');
        onVoiceStart?.();
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptSegment = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptSegment;
          } else {
            interimTranscript += transcriptSegment;
          }
        }

        setTranscript(finalTranscript || interimTranscript);
      };

      recognition.onerror = (event: any) => {
        logger.error('Speech recognition error:', event.error);
        setError(`Speech recognition error: ${event.error}`);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        if (transcript) {
          onVoiceEnd?.(transcript);
          setTextInput(prev => prev + transcript);
          setTranscript('');
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, [enableVoice, transcript, onVoiceStart, onVoiceEnd]);

  const handleTextSubmit = async () => {
    if (!textInput.trim() || disabled || isProcessing) return;

    const textMessage: MultimodalMessage = {
      id: `msg-${Date.now()}`,
      type: 'text',
      content: textInput.trim(),
      timestamp: new Date()
    };

    const allMessages = [...messages, textMessage];
    setMessages(allMessages);
    setTextInput('');
    setIsProcessing(true);
    setError(null);

    try {
      await onSubmit?.(allMessages);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to submit');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoiceToggle = () => {
    if (!recognitionRef.current) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setError(null);
      recognitionRef.current.start();
    }
  };

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const remainingSlots = maxFiles - messages.length;

    if (fileArray.length > remainingSlots) {
      setError(`Maximum ${maxFiles} files allowed`);
      return;
    }

    for (const file of fileArray) {
      try {
        let preview = '';
        let type: MultimodalMessage['type'] = 'file';

        // Generate preview for images
        if (file.type.startsWith('image/')) {
          type = 'image';
          preview = await generateImagePreview(file);
        }
        // Handle text files
        else if (file.type.startsWith('text/')) {
          const content = await file.text();
          preview = content.slice(0, 200) + (content.length > 200 ? '...' : '');
        }
        // Handle other file types
        else {
          preview = `File: ${file.name} (${formatFileSize(file.size)})`;
        }

        const message: MultimodalMessage = {
          id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type,
          content: file.name,
          file,
          preview,
          timestamp: new Date(),
          metadata: {
            size: file.size,
            mimeType: file.type
          }
        };

        setMessages(prev => [...prev, message]);
      } catch (error) {
        logger.error('Error processing file:', error);
        setError(`Failed to process ${file.name}`);
      }
    }
  }, [messages.length, maxFiles]);

  const generateImagePreview = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const removeMessage = (messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  };

  const clearAll = () => {
    setMessages([]);
    setTextInput('');
    setError(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit();
    }
  };

  return (
    <div className={`flex flex-col bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">AI</span>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Multimodal Assistant</h3>
              <p className="text-sm text-gray-600">Voice, image, and text input</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Settings */}
            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100">
              <CogIcon className="h-4 w-4" />
            </button>

            {/* Help */}
            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100">
              <InformationCircleIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px] max-h-[400px]">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MicrophoneIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h4 className="font-medium text-gray-900 mb-2">Start a conversation</h4>
            <p className="text-sm text-gray-600">
              Type a message, use voice input, or upload files to get started
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="flex items-start space-x-3">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                message.type === 'voice' ? 'bg-green-100' :
                message.type === 'image' ? 'bg-blue-100' :
                message.type === 'file' ? 'bg-purple-100' :
                'bg-gray-100'
              }`}>
                {message.type === 'text' && <span className="text-gray-600 text-sm font-medium">T</span>}
                {message.type === 'voice' && <MicrophoneIcon className="h-4 w-4 text-green-600" />}
                {message.type === 'image' && <PhotoIcon className="h-4 w-4 text-blue-600" />}
                {message.type === 'file' && <DocumentIcon className="h-4 w-4 text-purple-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900 capitalize">
                    {message.type}
                  </span>
                  <button
                    onClick={() => removeMessage(message.id)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>

                {message.type === 'text' && (
                  <p className="text-sm text-gray-700">{message.content}</p>
                )}

                {message.type === 'voice' && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-700">{message.content}</p>
                    {message.metadata?.duration && (
                      <p className="text-xs text-gray-500">
                        Duration: {message.metadata.duration}s
                      </p>
                    )}
                  </div>
                )}

                {message.type === 'image' && (
                  <div className="space-y-2">
                    <img
                      src={message.preview}
                      alt={message.content}
                      className="max-w-xs rounded-lg border border-gray-200"
                    />
                    <p className="text-sm text-gray-700">{message.content}</p>
                  </div>
                )}

                {message.type === 'file' && (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg">
                      <DocumentIcon className="h-5 w-5 text-gray-600" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {message.content}
                        </p>
                        {message.metadata?.size && (
                          <p className="text-xs text-gray-500">
                            {formatFileSize(message.metadata.size)}
                          </p>
                        )}
                      </div>
                    </div>
                    {message.preview && (
                      <div className="p-2 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600 font-mono">
                          {message.preview}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-xs text-gray-500 mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200">
          <div className="flex items-center space-x-2">
            <XMarkIcon className="h-4 w-4 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Voice Status */}
      {isListening && (
        <div className="px-4 py-2 bg-blue-50 border-t border-blue-200">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
            <p className="text-sm text-blue-700">
              Listening... {transcript && <span className="font-medium">"{transcript}"</span>}
            </p>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200">
        {/* Text Input */}
        <div className="flex items-end space-x-3 mb-3">
          <div className="flex-1">
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={placeholder}
              disabled={disabled || isProcessing}
              rows={1}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
              style={{ minHeight: '40px', maxHeight: '120px' }}
            />
          </div>

          {/* Voice Button */}
          {enableVoice && (
            <button
              onClick={handleVoiceToggle}
              disabled={disabled}
              className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                isListening
                  ? 'bg-red-600 text-white animate-pulse'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50'
              }`}
            >
              {isListening ? (
                <StopIcon className="h-5 w-5" />
              ) : (
                <MicrophoneIcon className="h-5 w-5" />
              )}
            </button>
          )}

          {/* Send Button */}
          <button
            onClick={handleTextSubmit}
            disabled={!textInput.trim() || disabled || isProcessing}
            className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              textInput.trim() && !disabled && !isProcessing
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isProcessing ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <PaperAirplaneIcon className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* File Upload Area */}
        {(enableImages || enableFiles) && (
          <div className="flex items-center space-x-2">
            {/* Image Upload */}
            {enableImages && (
              <button
                onClick={() => imageInputRef.current?.click()}
                disabled={disabled || messages.length >= maxFiles}
                className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                <PhotoIcon className="h-4 w-4" />
                <span>Image</span>
              </button>
            )}

            {/* File Upload */}
            {enableFiles && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || messages.length >= maxFiles}
                className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                <DocumentIcon className="h-4 w-4" />
                <span>File</span>
              </button>
            )}

            {/* Clear All */}
            {messages.length > 0 && (
              <button
                onClick={clearAll}
                className="px-3 py-2 text-sm text-red-600 hover:text-red-700"
              >
                Clear All
              </button>
            )}

            {/* File Counter */}
            <div className="flex-1 text-right">
              <span className={`text-sm ${messages.length >= maxFiles ? 'text-red-600' : 'text-gray-500'}`}>
                {messages.length}/{maxFiles} files
              </span>
            </div>
          </div>
        )}

        {/* Hidden File Inputs */}
        {enableImages && (
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
          />
        )}

        {enableFiles && (
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedFileTypes.join(',')}
            multiple
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
          />
        )}
      </div>
    </div>
  );
}
