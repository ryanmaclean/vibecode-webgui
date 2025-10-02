import React, { memo} from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import {
  Send,
  Paperclip,
  Zap,
  Mic,
  MicOff,
  Radio,
  Clock,
  DollarSign,
  Image,
  FileCode,
  FileText,
  Headphones
} from 'lucide-react';
import { cn } from '../lib/utils';

interface FileAttachment {
  id: string;
  name: string;
  type: 'image' | 'code' | 'document' | 'audio';
  size: number;
  url?: string;
  content?: string;
  mimeType?: string;
  duration?: number;
}

interface ModelConfig {
  supportsFiles: boolean;
  supportsAudio: boolean;
}

interface InputAreaProps {
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onEnhancePrompt: () => void;
  isTyping: boolean;
  attachments: FileAttachment[];
  onRemoveAttachment: (id: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  currentModel: ModelConfig | undefined;
  voiceSupported: boolean;
  isListening: boolean;
  isRecording: boolean;
  interimTranscript: string;
  voiceLevel: number;
  onStartVoiceRecognition: () => void;
  onStopVoiceRecognition: () => void;
  onStartAudioRecording: () => void;
  onStopAudioRecording: () => void;
  estimateTokens: (text: string) => number;
  estimateCost: (tokens: number, model: ModelConfig) => number;
}

const InputArea = memo(function InputArea({
  input,
  onInputChange,
  onSend,
  onEnhancePrompt,
  isTyping,
  attachments,
  onRemoveAttachment,
  fileInputRef,
  onFileUpload,
  currentModel,
  voiceSupported,
  isListening,
  isRecording,
  interimTranscript,
  voiceLevel,
  onStartVoiceRecognition,
  onStopVoiceRecognition,
  onStartAudioRecording,
  onStopAudioRecording,
  estimateTokens,
  estimateCost
}: InputAreaProps) {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="p-4 border-t border-border/50">
      {/* Voice Level Indicator */}
      {(isListening || isRecording) && (
        <div className="mb-3 flex items-center gap-2">
          <div className={cn(
            "w-3 h-3 rounded-full animate-pulse",
            isListening ? "bg-green-500" : "bg-red-500"
          )} />
          <span className="text-sm text-muted-foreground">
            {isListening ? "Listening..." : "Recording..."}
            {interimTranscript && ` "${interimTranscript}"`}
          </span>
          {isRecording && (
            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-red-500 transition-all duration-100"
                style={{ width: `${voiceLevel}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="flex items-center gap-2 p-2 bg-muted rounded border group">
              {attachment.type === 'image' && <Image className="w-4 h-4" />}
              {attachment.type === 'code' && <FileCode className="w-4 h-4" />}
              {attachment.type === 'document' && <FileText className="w-4 h-4" />}
              {attachment.type === 'audio' && <Headphones className="w-4 h-4" />}
              <span className="text-sm truncate max-w-24">{attachment.name}</span>
              {attachment.type === 'audio' && (
                <span className="text-xs text-muted-foreground">
                  🎵 Audio
                </span>
              )}
              <button
                onClick={() => onRemoveAttachment(attachment.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type, upload files, or speak to me..."
            className="min-h-12 max-h-32 resize-none pr-32"
            disabled={isTyping}
          />
          <div className="absolute bottom-2 right-2 flex gap-1">
            {/* Voice Recognition Button */}
            {voiceSupported && (
              <Button
                variant="ghost"
                size="sm"
                onClick={isListening ? onStopVoiceRecognition : onStartVoiceRecognition}
                className={cn(
                  "p-1 h-8 w-8",
                  isListening && "bg-green-100 text-green-600"
                )}
                disabled={isRecording}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
            )}

            {/* Audio Recording Button */}
            {currentModel?.supportsAudio && (
              <Button
                variant="ghost"
                size="sm"
                onClick={isRecording ? onStopAudioRecording : onStartAudioRecording}
                className={cn(
                  "p-1 h-8 w-8",
                  isRecording && "bg-red-100 text-red-600"
                )}
                disabled={isListening}
              >
                <Radio className="w-4 h-4" />
              </Button>
            )}

            {/* File Upload */}
            {currentModel?.supportsFiles && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="p-1 h-8 w-8"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
            )}

            {/* Prompt Enhancement */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onEnhancePrompt}
              disabled={!input.trim() || isTyping}
              className="p-1 h-8 w-8"
            >
              <Zap className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <Button
          onClick={onSend}
          disabled={(!input.trim() && attachments.length === 0) || isTyping}
          className="bg-gradient-to-r from-purple-500 to-blue-600 hover:opacity-90"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>

      {/* Input Info */}
      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>Press Enter to send, Shift+Enter for new line</span>
          {input && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              ~{estimateTokens(input)} tokens
            </span>
          )}
          {voiceSupported && (
            <span className="flex items-center gap-1">
              <Mic className="w-3 h-3" />
              Voice ready
            </span>
          )}
        </div>
        {currentModel && input && (
          <span className="flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            ~${estimateCost(estimateTokens(input), currentModel).toFixed(4)}
          </span>
        )}
      </div>
    </div>
  );
});

export default InputArea;
