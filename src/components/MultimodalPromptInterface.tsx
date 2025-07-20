import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  Send, 
  Mic, 
  MicOff, 
  Camera, 
  Upload,
  FileCode,
  Image,
  Zap,
  Bot,
  User,
  Volume2,
  VolumeX,
  Settings,
  Sparkles,
  Play,
  Pause,
  Download,
  Eye,
  Code,
  Wand2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { MultimodalAgent, MultimodalInput, AgentMessage } from '../lib/multimodal-agent';
import { MultimodalSampleGenerator, SampleScenario } from '../samples/multimodal-agent-samples';

interface MultimodalPromptInterfaceProps {
  agent: MultimodalAgent;
  onMessage?: (message: AgentMessage) => void;
  onSampleRun?: (sampleId: string, result: any) => void;
}

export default function MultimodalPromptInterface({ 
  agent, 
  onMessage, 
  onSampleRun 
}: MultimodalPromptInterfaceProps) {
  // State management
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [attachedImages, setAttachedImages] = useState<File[]>([]);
  const [currentAudio, setCurrentAudio] = useState<string | null>(null);
  
  // Voice and multimodal state
  const [isListening, setIsListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [autoPlayVoice, setAutoPlayVoice] = useState(false);
  
  // Sample and demo state
  const [selectedSample, setSelectedSample] = useState<SampleScenario | null>(null);
  const [runningSample, setRunningSample] = useState<string | null>(null);
  const [sampleResults, setSampleResults] = useState<any[]>([]);
  
  // UI state
  const [activeTab, setActiveTab] = useState("chat");
  const [showCapabilities, setShowCapabilities] = useState(false);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  
  // Initialize sample generator
  const sampleGenerator = new MultimodalSampleGenerator(agent);
  const samples = sampleGenerator.getAllSamples();

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';
      
      recognitionRef.current.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0])
          .map(result => result.transcript)
          .join('');
          
        setInput(transcript);
      };
      
      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle voice input toggle
  const toggleVoiceInput = useCallback(() => {
    if (!recognitionRef.current) return;
    
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  // Handle audio recording
  const toggleAudioRecording = useCallback(async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        
        const audioChunks: Blob[] = [];
        
        mediaRecorder.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          handleAudioInput(audioBlob);
          stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorder.start();
        setIsRecording(true);
      } catch (error) {
        console.error('Error starting audio recording:', error);
      }
    }
  }, [isRecording]);

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setAttachedFiles(prev => [...prev, ...files]);
  };

  // Handle image upload
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setAttachedImages(prev => [...prev, ...files]);
  };

  // Handle audio input from recording
  const handleAudioInput = (audioBlob: Blob) => {
    // Add audio to the current input processing
    console.log('Audio recorded:', audioBlob.size, 'bytes');
  };

  // Process multimodal input
  const handleSendMessage = async () => {
    if (!input.trim() && attachedFiles.length === 0 && attachedImages.length === 0) return;
    
    setIsProcessing(true);
    
    try {
      // Create user message
      const userMessage: AgentMessage = {
        id: `user_${Date.now()}`,
        role: 'user',
        content: input,
        timestamp: new Date(),
        multimodal: {
          fileChanges: attachedFiles.map(file => ({
            path: file.name,
            operation: 'create',
            reason: 'User uploaded file'
          }))
        },
        metadata: {
          model: 'user-input',
          tokens: input.length / 4, // Rough estimate
          cost: 0,
          processingTime: 0,
          confidence: 1.0
        }
      };
      
      setMessages(prev => [...prev, userMessage]);
      
      // Process files to ProjectFile format
      const projectFiles = await Promise.all(
        attachedFiles.map(async (file) => ({
          path: file.name,
          content: await file.text(),
          type: file.name.includes('.ts') || file.name.includes('.js') ? 'code' as const : 'documentation' as const,
          language: getFileLanguage(file.name),
          size: file.size,
          lastModified: new Date(file.lastModified)
        }))
      );
      
      // Create multimodal input
      const multimodalInput: MultimodalInput = {
        text: input,
        images: attachedImages,
        files: projectFiles,
        voice: {
          enabled: voiceEnabled,
          language: 'en-US'
        },
        context: {
          workspaceId: 'current_workspace',
          userId: 'current_user',
          sessionId: `session_${Date.now()}`,
          previousMessages: messages.slice(-5), // Last 5 messages for context
          userPreferences: {
            codeStyle: 'typescript',
            framework: 'react',
            uiLibrary: 'shadcn',
            voiceSettings: {
              enabled: voiceEnabled,
              autoplay: autoPlayVoice,
              speed: 1.0,
              voice: 'en-US-Standard-A'
            },
            assistantPersonality: 'encouraging'
          },
          projectMetadata: {
            name: 'Current Project',
            description: 'Multimodal development session',
            type: 'web-app',
            technologies: ['React', 'TypeScript', 'Tailwind CSS'],
            complexity: 'intermediate',
            estimatedTime: 60,
            targetAudience: 'developers',
            features: ['multimodal input', 'voice interface', 'file processing']
          }
        }
      };
      
      // Process with agent
      const response = await agent.processMultimodalInput(multimodalInput);
      
      setMessages(prev => [...prev, response]);
      onMessage?.(response);
      
      // Play voice response if enabled
      if (autoPlayVoice && response.multimodal?.audioUrl) {
        setCurrentAudio(response.multimodal.audioUrl);
      }
      
      // Clear inputs
      setInput("");
      setAttachedFiles([]);
      setAttachedImages([]);
      
    } catch (error) {
      console.error('Error processing multimodal input:', error);
      
      // Add error message
      const errorMessage: AgentMessage = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error processing your request: ${error.message}`,
        timestamp: new Date(),
        metadata: {
          model: 'error-handler',
          tokens: 0,
          cost: 0,
          processingTime: 0,
          confidence: 0
        }
      };
      
      setMessages(prev => [...prev, errorMessage]);
    }
    
    setIsProcessing(false);
  };

  // Run sample scenario
  const runSample = async (sampleId: string) => {
    setRunningSample(sampleId);
    
    try {
      const result = await sampleGenerator.runSample(sampleId);
      setSampleResults(prev => [...prev, result]);
      
      // Add sample result to messages
      setMessages(prev => [...prev, result.result]);
      
      onSampleRun?.(sampleId, result);
    } catch (error) {
      console.error('Error running sample:', error);
    }
    
    setRunningSample(null);
  };

  // Get file language for syntax highlighting
  const getFileLanguage = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts': case 'tsx': return 'typescript';
      case 'js': case 'jsx': return 'javascript';
      case 'py': return 'python';
      case 'css': return 'css';
      case 'html': return 'html';
      case 'json': return 'json';
      default: return 'text';
    }
  };

  // Render message with multimodal content
  const renderMessage = (message: AgentMessage) => (
    <div
      key={message.id}
      className={cn(
        "flex gap-3 p-4 rounded-lg",
        message.role === 'user' ? "bg-blue-50 ml-12" : "bg-gray-50 mr-12"
      )}
    >
      <div className="flex-shrink-0">
        {message.role === 'user' ? (
          <User className="w-6 h-6 text-blue-600" />
        ) : (
          <Bot className="w-6 h-6 text-purple-600" />
        )}
      </div>
      
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-medium">
            {message.role === 'user' ? 'You' : 'VibeCode AI'}
          </span>
          <Badge variant="outline" className="text-xs">
            {message.metadata.model}
          </Badge>
          <span className="text-xs text-gray-500">
            {message.timestamp.toLocaleTimeString()}
          </span>
        </div>
        
        <div className="prose prose-sm max-w-none">
          {message.content}
        </div>
        
        {/* Multimodal content */}
        {message.multimodal && (
          <div className="mt-4 space-y-3">
            {/* Audio output */}
            {message.multimodal.audioUrl && (
              <div className="flex items-center gap-2 p-2 bg-purple-50 rounded">
                <Volume2 className="w-4 h-4 text-purple-600" />
                <audio controls src={message.multimodal.audioUrl} className="flex-1" />
              </div>
            )}
            
            {/* Generated code */}
            {message.multimodal.codeGenerated && (
              <div className="p-3 bg-gray-900 rounded text-white text-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Code className="w-4 h-4" />
                  <span>Generated {message.multimodal.codeGenerated.language} code</span>
                </div>
                <pre className="overflow-x-auto">
                  {message.multimodal.codeGenerated.files.map(file => 
                    `// ${file.path}\n${file.content}`
                  ).join('\n\n')}
                </pre>
              </div>
            )}
            
            {/* File changes */}
            {message.multimodal.fileChanges && message.multimodal.fileChanges.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-1">
                  <FileCode className="w-4 h-4" />
                  File Changes
                </h4>
                {message.multimodal.fileChanges.map((change, i) => (
                  <div key={i} className="text-xs p-2 bg-yellow-50 rounded border-l-2 border-yellow-400">
                    <span className="font-medium">{change.operation}</span> {change.path}
                    <div className="text-gray-600 mt-1">{change.reason}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Metadata */}
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span>⚡ {message.metadata.processingTime}ms</span>
          <span>🎯 {(message.metadata.confidence * 100).toFixed(0)}%</span>
          <span>💰 ${message.metadata.cost.toFixed(4)}</span>
          <span>📝 {message.metadata.tokens} tokens</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-purple-600" />
            <div>
              <h1 className="text-xl font-semibold">VibeCode Multimodal AI</h1>
              <p className="text-sm text-gray-600">
                Voice, Vision, Code & Collaboration Agent
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant={voiceEnabled ? "default" : "secondary"} className="text-xs">
              <Mic className="w-3 h-3 mr-1" />
              Voice {voiceEnabled ? 'On' : 'Off'}
            </Badge>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCapabilities(!showCapabilities)}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="mx-4 mt-4">
              <TabsTrigger value="chat">💬 Chat</TabsTrigger>
              <TabsTrigger value="samples">🎯 Samples</TabsTrigger>
              <TabsTrigger value="analytics">📊 Analytics</TabsTrigger>
            </TabsList>
            
            <TabsContent value="chat" className="flex-1 flex flex-col m-4">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                {messages.length === 0 ? (
                  <div className="text-center py-12">
                    <Wand2 className="w-12 h-12 text-purple-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Start your multimodal conversation
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Use voice, upload images, share files, or just type to get started
                    </p>
                    <div className="flex justify-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setActiveTab('samples')}>
                        🎯 Try Samples
                      </Button>
                    </div>
                  </div>
                ) : (
                  messages.map(renderMessage)
                )}
                <div ref={messagesEndRef} />
              </div>
              
              {/* Input Area */}
              <div className="border-t bg-gray-50 p-4">
                {/* Attached Files Preview */}
                {(attachedFiles.length > 0 || attachedImages.length > 0) && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {attachedFiles.map((file, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        <FileCode className="w-3 h-3 mr-1" />
                        {file.name}
                      </Badge>
                    ))}
                    {attachedImages.map((image, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        <Image className="w-3 h-3 mr-1" />
                        {image.name}
                      </Badge>
                    ))}
                  </div>
                )}
                
                <div className="flex gap-2">
                  {/* Voice Input */}
                  <Button
                    variant={isListening ? "default" : "outline"}
                    size="sm"
                    onClick={toggleVoiceInput}
                    disabled={!recognitionRef.current}
                    className={isListening ? "bg-red-500 hover:bg-red-600" : ""}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </Button>
                  
                  {/* Audio Recording */}
                  <Button
                    variant={isRecording ? "default" : "outline"}
                    size="sm"
                    onClick={toggleAudioRecording}
                    className={isRecording ? "bg-red-500 hover:bg-red-600" : ""}
                  >
                    <div className="w-4 h-4 rounded-full bg-current animate-pulse" />
                  </Button>
                  
                  {/* File Upload */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4" />
                  </Button>
                  
                  {/* Image Upload */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => imageInputRef.current?.click()}
                  >
                    <Camera className="w-4 h-4" />
                  </Button>
                  
                  {/* Text Input */}
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type, speak, or upload files to start coding..."
                    className="flex-1"
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  />
                  
                  {/* Send */}
                  <Button
                    onClick={handleSendMessage}
                    disabled={isProcessing || (!input.trim() && attachedFiles.length === 0 && attachedImages.length === 0)}
                  >
                    {isProcessing ? (
                      <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="samples" className="flex-1 m-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {samples.map((sample) => (
                  <Card key={sample.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{sample.title}</CardTitle>
                          <p className="text-sm text-gray-600 mt-1">{sample.description}</p>
                        </div>
                        <Badge variant="outline">
                          {sample.category}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>{sample.complexity}</span>
                          <span>~{sample.estimatedTime}s</span>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => runSample(sample.id)}
                          disabled={runningSample === sample.id}
                        >
                          {runningSample === sample.id ? (
                            <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="analytics" className="flex-1 m-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Messages</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{messages.length}</div>
                    <p className="text-sm text-gray-600">Total conversations</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Samples Run</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{sampleResults.length}</div>
                    <p className="text-sm text-gray-600">Demonstrations completed</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Total Cost</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ${messages.reduce((sum, msg) => sum + msg.metadata.cost, 0).toFixed(4)}
                    </div>
                    <p className="text-sm text-gray-600">API usage cost</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Capabilities Sidebar */}
        {showCapabilities && (
          <div className="w-80 border-l bg-gray-50 p-4">
            <h3 className="font-medium mb-4">AI Capabilities</h3>
            <div className="space-y-3">
              {agent['capabilities']?.map((capability: any) => (
                <div key={capability.id} className="p-3 bg-white rounded border">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      capability.enabled ? "bg-green-500" : "bg-gray-300"
                    )} />
                    <span className="font-medium text-sm">{capability.name}</span>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">{capability.description}</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">
                      Confidence: {(capability.confidence * 100).toFixed(0)}%
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {capability.inputs.length} inputs
                    </Badge>
                  </div>
                </div>
              )) || (
                <p className="text-sm text-gray-500">No capabilities loaded</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".ts,.tsx,.js,.jsx,.py,.css,.html,.json,.md,.txt"
        onChange={handleFileUpload}
        className="hidden"
      />
      
      <input
        ref={imageInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />
    </div>
  );
} 