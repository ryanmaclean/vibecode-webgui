import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './ui/resizable';
import {
  Sparkles,
  Code,
  Eye,
  Globe,
  Download,
  Github,
  Monitor,
  Smartphone,
  Tablet,
  RefreshCw,
  Play,
  Bot,
  Image,
  FileText,
  Settings,
  DollarSign,
  Clock,
  Database,
  Cpu,
  FileCode,
  Mic,
  Volume2,
  Headphones
} from 'lucide-react';
import { cn } from '../lib/utils';
import { DEMO_PROMPTS } from '@/data/demo-prompts';
import MessageList from './MessageList';
import InputArea from './InputArea';
import { MODELS } from './PromptInterface/config/models.config';
import { MCP_SERVERS } from './PromptInterface/config/mcp-servers.config';
import { MOCK_RESPONSES } from './PromptInterface/config/mock-responses.config';
import { useAuthState } from './PromptInterface/hooks/useAuthState';

// Voice recognition interfaces
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechGrammarList {
  readonly length: number;
  addFromString(string: string, weight?: number): void;
  addFromURI(src: string, weight?: number): void;
  item(index: number): SpeechGrammar;
}

interface SpeechGrammar {
  src: string;
  weight: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  grammars: SpeechGrammarList;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onaudioend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  serviceURI: string;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new (): SpeechRecognition;
    };
  }
}

interface Message {
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

interface FileAttachment {
  id: string;
  name: string;
  type: 'image' | 'code' | 'document' | 'audio';
  size: number;
  url?: string;
  content?: string;
  mimeType?: string;
  duration?: number; // For audio files
}

interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  supportsImages: boolean;
  supportsFiles: boolean;
  supportsAudio: boolean; // New audio support flag
  maxTokens: number;
  inputCostPer1k: number;
  outputCostPer1k: number;
  contextWindow: number;
}

interface MCPServer {
  id: string;
  name: string;
  description: string;
  status: 'connected' | 'disconnected' | 'error';
  tools: string[];
  url?: string;
}

export default function PromptInterface() {
  // Authentication & BYOK State (extracted to custom hook)
  const {
    isAuthenticated,
    showAuthModal,
    authMode,
    userEmail,
    userPassword,
    apiKeys,
    showApiKeySetup,
    setIsAuthenticated,
    setShowAuthModal,
    setAuthMode,
    setUserEmail,
    setUserPassword,
    setApiKeys,
    setShowApiKeySetup,
    handleAuth: handleAuthHook,
    handleApiKeySetup,
    saveApiKeys: saveApiKeysHook,
    closeAuthModal,
    getApiKeyForModel,
  } = useAuthState();

  // Template marketplace integration
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [selectedDemoPromptId, setSelectedDemoPromptId] = useState<string>('');
  const [workspaceId, setWorkspaceId] = useState('lovable-demo');
  const [ragEnabled, setRagEnabled] = useState(true);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [deviceView, setDeviceView] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [activeTab, setActiveTab] = useState("preview");
  const [selectedModel, setSelectedModel] = useState<string>("ai/smollm2:360M-Q4_K_M"); // Default to local model
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [showModelConfig, setShowModelConfig] = useState(false);
  const [showMCPConfig, setShowMCPConfig] = useState(false);
  const [totalTokens, setTotalTokens] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  
  // Voice recognition state
  const [isListening, setIsListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [voiceLevel, setVoiceLevel] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check for selected template from marketplace
  useEffect(() => {
    const templateData = sessionStorage.getItem('selectedTemplate');
    if (templateData) {
      try {
        const template = JSON.parse(templateData);
        setSelectedTemplate(template);
        sessionStorage.removeItem('selectedTemplate'); // Clean up after use
        
        // Pre-populate the input with template context
        setInput(`Generate a project using the "${template.name}" template. This template is described as: ${template.description}`);
      } catch (error) {
        console.error('Error loading selected template:', error);
      }
    }
  }, []);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setVoiceSupported(true);
      recognitionRef.current = new SpeechRecognition();
      
      if (recognitionRef.current) {
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';
        
        recognitionRef.current.onstart = () => {
          setIsListening(true);
        };
        
        recognitionRef.current.onend = () => {
          setIsListening(false);
          setInterimTranscript("");
        };
        
        recognitionRef.current.onresult = (event) => {
          let finalTranscript = '';
          let interim = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interim += transcript;
            }
          }
          
          if (finalTranscript) {
            setInput(prev => prev + finalTranscript + ' ');
          }
          setInterimTranscript(interim);
        };
        
        recognitionRef.current.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          setInterimTranscript("");
        };
      }
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Calculate total tokens and cost from all messages
  useEffect(() => {
    const tokens = messages.reduce((sum, msg) => sum + (msg.metadata?.tokens || 0), 0);
    const cost = messages.reduce((sum, msg) => sum + (msg.metadata?.cost || 0), 0);
    setTotalTokens(tokens);
    setTotalCost(cost);
  }, [messages]);

  const currentModel = MODELS.find(m => m.id === selectedModel);

  const estimateTokens = (text: string): number => {
    return Math.ceil(text.length / 4); // Rough estimate: 4 chars = 1 token
  };

  const estimateCost = (tokens: number, model: ModelConfig): number => {
    return (tokens * model.inputCostPer1k) / 1000;
  };

  const handleDemoPromptChange = (value: string) => {
    setSelectedDemoPromptId(value);
    if (!value) {
      return;
    }
    const prompt = DEMO_PROMPTS.find(item => item.id === value);
    if (prompt) {
      setInput(prompt.prompt);
    }
  };

  const selectedDemoPrompt = useMemo(() => DEMO_PROMPTS.find(item => item.id === selectedDemoPromptId) || null, [selectedDemoPromptId]);

  // Voice input controls
  const startVoiceRecognition = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start();
    }
  }, [isListening]);

  const stopVoiceRecognition = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  // Audio recording for upload with transcription (simplified without Docker)
  const startAudioRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Set up audio context for visualization
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      // Visualize audio level
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      const updateLevel = () => {
        if (analyserRef.current && isRecording) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setVoiceLevel(average / 255 * 100);
          requestAnimationFrame(updateLevel);
        }
      };
      updateLevel();

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // For now, just add the audio file without transcription
        // When Docker services are working, we'll re-enable transcription
        const attachment: FileAttachment = {
          id: Date.now().toString(),
          name: `voice-recording-${Date.now()}.wav`,
          type: 'audio',
          size: audioBlob.size,
          url: audioUrl,
          mimeType: 'audio/wav'
        };
        
        setAttachments(prev => [...prev, attachment]);
        
        // Mock transcription for testing (replace with real service when Docker works)
        const mockTranscription = "This is a mock transcription. Audio file recorded successfully!";
        setInput(prev => prev + ' ' + mockTranscription);
        
        // Clean up
        stream.getTracks().forEach(track => track.stop());
        setVoiceLevel(0);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting audio recording:', error);
    }
  }, [isRecording]);

  const stopAudioRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const attachment: FileAttachment = {
        id: Date.now().toString() + Math.random(),
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' : 
              file.type.startsWith('audio/') ? 'audio' :
              file.type.includes('text/') || file.name.endsWith('.md') ? 'document' : 'code',
        size: file.size,
        mimeType: file.type,
        url: URL.createObjectURL(file)
      };

      // Read file content for text files
      if (file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          attachment.content = e.target?.result as string;
          setAttachments(prev => [...prev, attachment]);
        };
        reader.readAsText(file);
      } else {
        setAttachments(prev => [...prev, attachment]);
      }
    });
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  const enhancePrompt = async () => {
    if (!input.trim()) return;

    setIsTyping(true);
    // Simulate prompt enhancement
    setTimeout(() => {
      const enhanced = `${input}\n\n**Enhanced details:**\n- Use modern React with TypeScript\n- Implement responsive design with Tailwind CSS\n- Add proper error handling and loading states\n- Include accessibility features (ARIA labels, keyboard navigation)\n- Follow best practices for performance optimization`;
      setInput(enhanced);
      setIsTyping(false);
    }, 1000);
  };

  const handleSend = async () => {
    if (!input.trim() && attachments.length === 0) return;

    // Require authentication for all interactions
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    // Normal authenticated flow with BYOK
    await sendMessage();
  };

  const sendMessage = async () => {
    const estimatedTokens = estimateTokens(input) + attachments.reduce((sum, att) => 
      sum + (att.content ? estimateTokens(att.content) : 100), 0
    );
    const estimatedCost = currentModel ? estimateCost(estimatedTokens, currentModel) : 0;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: input || "Voice message",
      timestamp: new Date(),
      attachments: [...attachments],
      metadata: {
        tokens: estimatedTokens,
        cost: estimatedCost,
        model: selectedModel,
        audioInputMethod: attachments.some(a => a.type === 'audio') ? 'microphone' : undefined
      }
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setAttachments([]);
    setIsTyping(true);

    // Simulate AI response delay
    setTimeout(() => {
      const response = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: response.content,
        timestamp: new Date(),
        metadata: response
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
      setTotalTokens(prev => prev + estimatedTokens + (response.tokens || 0));
      setTotalCost(prev => prev + estimatedCost + (response.cost || 0));
    }, Math.random() * 2000 + 1000);
  };

  // Wrapper functions for authentication (delegate to hook)
  const handleAuth = async (e: React.FormEvent) => {
    await handleAuthHook(e, selectedModel, setMessages, setIsTyping);

    // Post-auth logic: Check if using cloud models without API keys
    const cloudModel = MODELS.find(m => m.id === selectedModel);
    const needsApiKey = cloudModel && cloudModel.provider !== 'Docker Model Runner' &&
                       !getApiKeyForModel(cloudModel.provider);

    if (needsApiKey && isAuthenticated) {
      setMessages(prev => [...prev, {
        id: "api-key-prompt",
        type: "assistant",
        content: `🔑 **API Key Setup Required**

You've selected **${cloudModel.name}** which requires an API key.

**Option 1:** Use our free local models (SmolLM2, Llama 3.2, Qwen2.5)
**Option 2:** Add your ${cloudModel.provider} API key for premium features

Would you like to set up your API keys now?`,
        timestamp: new Date(),
        metadata: {
          tokens: 80,
          cost: 0,
          model: selectedModel,
        }
      }]);
      setShowApiKeySetup(true);
    }
  };

  const saveApiKeys = () => {
    saveApiKeysHook(setMessages, selectedModel);
  };

  const getDeviceClasses = () => {
    switch (deviceView) {
      case "mobile":
        return "w-[375px] h-[667px]";
      case "tablet":
        return "w-[768px] h-[1024px]";
      default:
        return "w-full h-full";
    }
  };

  const mockCode = `import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <nav className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg"></div>
            <span className="text-xl font-bold">VibeCode</span>
          </div>
          <Button className="bg-gradient-to-r from-purple-500 to-blue-600">Get Started</Button>
        </nav>
      </header>
      
      <main className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-purple-500 to-blue-600 bg-clip-text text-transparent">
            Build Amazing Apps with AI
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Transform your ideas into production-ready applications using the power of artificial intelligence.
          </p>
          <Button size="lg" className="bg-gradient-to-r from-purple-500 to-blue-600">Start Building Now</Button>
        </div>
      </main>
    </div>
  );
}`;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Enhanced Header with Model Selection and Stats */}
      <div className="border-b border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map(model => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex items-center gap-2">
                      <span>{model.name}</span>
                      {model.supportsImages && <Image className="w-3 h-3 text-blue-500" />}
                      {model.supportsFiles && <FileText className="w-3 h-3 text-green-500" />}
                      {model.supportsAudio && <Headphones className="w-3 h-3 text-purple-500" />}
                      {model.inputCostPer1k === 0 && <Badge variant="secondary" className="text-xs">Free</Badge>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMCPConfig(!showMCPConfig)}
              className="flex items-center gap-2"
            >
              <Database className="w-4 h-4" />
              MCP Servers
            </Button>

            {voiceSupported && (
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <Mic className="w-3 h-3" />
                Voice Ready
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{totalTokens.toLocaleString()} tokens</span>
              </div>
              <div className="flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                <span>${totalCost.toFixed(4)}</span>
              </div>
            </div>
            
            <Button variant="ghost" size="sm" onClick={() => setShowModelConfig(!showModelConfig)}>
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* MCP Servers Status */}
        {showMCPConfig && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Database className="w-4 h-4" />
              MCP Servers
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              {MCP_SERVERS.map(server => (
                <div key={server.id} className="flex items-center justify-between p-2 bg-background rounded border">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      server.status === 'connected' ? 'bg-green-500' :
                      server.status === 'disconnected' ? 'bg-yellow-500' : 'bg-red-500'
                    )} />
                    <span className="text-sm font-medium">{server.name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {server.tools.length} tools
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Model Configuration */}
        {showModelConfig && currentModel && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              Model Configuration
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Context Window:</span>
                <div className="font-medium">{currentModel.contextWindow.toLocaleString()} tokens</div>
              </div>
              <div>
                <span className="text-muted-foreground">Max Output:</span>
                <div className="font-medium">{currentModel.maxTokens.toLocaleString()} tokens</div>
              </div>
              <div>
                <span className="text-muted-foreground">Input Cost:</span>
                <div className="font-medium">${currentModel.inputCostPer1k}/1K tokens</div>
              </div>
              <div>
                <span className="text-muted-foreground">Output Cost:</span>
                <div className="font-medium">${currentModel.outputCostPer1k}/1K tokens</div>
              </div>
              <div>
                <span className="text-muted-foreground">Audio Support:</span>
                <div className="font-medium">{currentModel.supportsAudio ? '✓ Yes' : '✗ No'}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Enhanced Chat Interface Panel */}
        <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
          <div className="h-full border-r border-border/50 flex flex-col">
            <div className="p-4 border-b border-border/50">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Bot className="w-5 h-5 text-purple-500" />
                AI Assistant
                {voiceSupported && (
                  <Badge variant="outline" className="text-xs">
                    <Volume2 className="w-3 h-3 mr-1" />
                    Voice Enabled
                  </Badge>
                )}
              </h2>
              <p className="text-sm text-muted-foreground">
                Type, upload files, or speak to interact
                {selectedTemplate && (
                  <span className="block mt-1 text-blue-600 font-medium">
                    🎯 Using template: {selectedTemplate.name}
                  </span>
                )}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Workspace ID
                  </label>
                  <Input
                    value={workspaceId}
                    onChange={(event) => setWorkspaceId(event.target.value)}
                    placeholder="lovable-demo"
                    className="mt-1"
                  />
                </div>
                <div className="border border-border/50 rounded-lg p-3 bg-muted/40 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      RAG Context
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Toggle semantic retrieval for responses
                    </p>
                  </div>
                  <Switch
                    checked={ragEnabled}
                    onCheckedChange={(checked) => setRagEnabled(checked)}
                    aria-label="Toggle RAG context"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Demo Prompt
                  </label>
                  <Select value={selectedDemoPromptId} onValueChange={handleDemoPromptChange}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Choose a Lovable-style scenario" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {DEMO_PROMPTS.map(prompt => (
                        <SelectItem key={prompt.id} value={prompt.id}>
                          {prompt.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Preload conversational flows used in the conference demo.
                  </p>
                </div>
              </div>

              {selectedDemoPrompt && (
                <div className="mt-3 border border-border/50 rounded-lg bg-muted/40 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{selectedDemoPrompt.title}</p>
                      <p className="text-xs text-muted-foreground">{selectedDemoPrompt.useCase}</p>
                    </div>
                    <Badge variant="outline">Lovable.ai Flow</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{selectedDemoPrompt.description}</p>
                  {selectedDemoPrompt.contextExamples && selectedDemoPrompt.contextExamples.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Context Notes</p>
                      <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                        {selectedDemoPrompt.contextExamples.map((item, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="mt-[2px]">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex w-full",
                    message.type === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg p-4",
                      message.type === "user"
                        ? "bg-gradient-to-r from-purple-500 to-blue-600 text-white ml-12"
                        : "bg-card border mr-12"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {message.type === "assistant" && (
                        <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Sparkles className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-sm leading-relaxed">{message.content}</p>
                        
                        {/* Audio Message */}
                        {message.audioUrl && (
                          <div className="mt-3">
                            <audio controls className="w-full max-w-sm">
                              <source src={message.audioUrl} type="audio/wav" />
                              Your browser does not support audio playback.
                            </audio>
                            {message.transcription && (
                              <p className="text-xs text-muted-foreground mt-1 italic">
                                &quot;{message.transcription}&quot;
                              </p>
                            )}
                          </div>
                        )}
                        
                        {/* File Attachments */}
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {message.attachments.map((attachment) => (
                              <div key={attachment.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                                {attachment.type === 'image' && <Image className="w-4 h-4" />}
                                {attachment.type === 'code' && <FileCode className="w-4 h-4" />}
                                {attachment.type === 'document' && <FileText className="w-4 h-4" />}
                                {attachment.type === 'audio' && <Headphones className="w-4 h-4" />}
                                <span className="text-xs">{attachment.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({(attachment.size / 1024).toFixed(1)}KB)
                                </span>
                                {attachment.type === 'audio' && attachment.url && (
                                  <audio controls className="ml-2" style={{ height: '24px', fontSize: '12px' }}>
                                    <source src={attachment.url} type={attachment.mimeType || 'audio/wav'} />
                                  </audio>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Metadata */}
                        {message.metadata && (
                          <div className="mt-3 space-y-2">
                            <div className="flex flex-wrap gap-1">
                              {message.metadata.codeGenerated && (
                                <Badge variant="secondary" className="text-xs">
                                  <Code className="w-3 h-3 mr-1" />
                                  Code Generated
                                </Badge>
                              )}
                              {message.metadata.deploymentUrl && (
                                <Badge variant="secondary" className="text-xs">
                                  <Globe className="w-3 h-3 mr-1" />
                                  Deployed
                                </Badge>
                              )}
                              {message.metadata.audioInputMethod && (
                                <Badge variant="secondary" className="text-xs">
                                  <Mic className="w-3 h-3 mr-1" />
                                  Voice Input
                                </Badge>
                              )}
                              {message.metadata.framework && (
                                <Badge variant="outline" className="text-xs">
                                  {message.metadata.framework}
                                </Badge>
                              )}
                            </div>
                            
                            {/* Token and Cost Info */}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              {message.metadata.tokens && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {message.metadata.tokens} tokens
                                </span>
                              )}
                              {message.metadata.cost && (
                                <span className="flex items-center gap-1">
                                  <DollarSign className="w-3 h-3" />
                                  ${message.metadata.cost.toFixed(4)}
                                </span>
                              )}
                              {message.metadata.duration && (
                                <span>{(message.metadata.duration / 1000).toFixed(1)}s</span>
                              )}
                            </div>
                            
                            {/* Components */}
                            {message.metadata.components && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {message.metadata.components.map((comp, index) => (
                                  <Badge key={index} variant="outline" className="text-xs">
                                    {comp}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-card border rounded-lg p-4 mr-12">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
                        <Sparkles className="w-3 h-3 text-white" />
                      </div>
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse delay-75"></div>
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse delay-150"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Enhanced Input with Voice and Attachments */}
            <InputArea
              input={input}
              onInputChange={setInput}
              onSend={handleSend}
              onEnhancePrompt={enhancePrompt}
              isTyping={isTyping}
              attachments={attachments}
              onRemoveAttachment={removeAttachment}
              fileInputRef={fileInputRef}
              onFileUpload={handleFileUpload}
              currentModel={currentModel}
              voiceSupported={voiceSupported}
              isListening={isListening}
              isRecording={isRecording}
              interimTranscript={interimTranscript}
              voiceLevel={voiceLevel}
              onStartVoiceRecognition={startVoiceRecognition}
              onStopVoiceRecognition={stopVoiceRecognition}
              onStartAudioRecording={startAudioRecording}
              onStopAudioRecording={stopAudioRecording}
              estimateTokens={estimateTokens}
              estimateCost={estimateCost}
            />
          </div>
        </ResizablePanel>
        
        <ResizableHandle withHandle />
        
        {/* Code Preview Panel */}
        <ResizablePanel defaultSize={65} minSize={50}>
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <div className="flex items-center gap-4">
                <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Live Preview
                </Badge>
                <Badge variant="outline">React + TypeScript</Badge>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex items-center border rounded-lg p-1">
                  <Button
                    variant={deviceView === "desktop" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setDeviceView("desktop")}
                  >
                    <Monitor className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={deviceView === "tablet" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setDeviceView("tablet")}
                  >
                    <Tablet className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={deviceView === "mobile" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setDeviceView("mobile")}
                  >
                    <Smartphone className="w-4 h-4" />
                  </Button>
                </div>
                
                <Button variant="ghost" size="sm">
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <Globe className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <TabsList className="mx-4 mt-2 w-fit">
                <TabsTrigger value="preview" className="flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Preview
                </TabsTrigger>
                <TabsTrigger value="code" className="flex items-center gap-2">
                  <Code className="w-4 h-4" />
                  Code
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="preview" className="flex-1 p-4">
                <div className="w-full h-full flex items-center justify-center bg-muted/30 rounded-lg">
                  <div className={cn(
                    "bg-background border rounded-lg overflow-hidden shadow-lg transition-all duration-300 flex items-center justify-center",
                    getDeviceClasses(),
                    deviceView !== "desktop" && "max-h-[80vh]"
                  )}>
                    <div className="text-center p-8">
                      <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-600 rounded-lg mx-auto mb-4 flex items-center justify-center">
                        <Play className="w-8 h-8 text-white" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">Preview Coming Soon</h3>
                      <p className="text-sm text-muted-foreground">
                        Your generated app will appear here
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="code" className="flex-1 p-4">
                <Card className="h-full">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">Generated Code</CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Export
                      </Button>
                      <Button variant="outline" size="sm">
                        <Github className="w-4 h-4 mr-2" />
                        Push to GitHub
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <pre className="text-sm bg-muted/50 p-4 rounded-lg overflow-auto h-full font-mono">
                      <code>{mockCode}</code>
                    </pre>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".md,.txt,.js,.jsx,.ts,.tsx,.py,.html,.css,.json,.yml,.yaml,image/*,audio/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Authentication Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Sparkles className="w-6 h-6 text-purple-500" />
                VibeCode AI
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Open Source AI Development Platform
              </p>
            </CardHeader>
            <CardContent>
              <Tabs value={authMode} onValueChange={(value) => setAuthMode(value as 'login' | 'signup')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                  <TabsTrigger value="login">Log In</TabsTrigger>
                </TabsList>
                
                <TabsContent value="signup" className="space-y-4">
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                      <p className="font-medium text-blue-900">🌟 Open Source & Free</p>
                      <p className="text-blue-700">
                        Create an account to save your work and bring your own API keys for premium models.
                      </p>
                    </div>
                    
                    <form onSubmit={handleAuth} className="space-y-3">
                      <Input
                        type="email"
                        placeholder="Email address"
                        value={userEmail}
                        onChange={(e) => setUserEmail(e.target.value)}
                        required
                      />
                      <Input
                        type="password"
                        placeholder="Create password"
                        value={userPassword}
                        onChange={(e) => setUserPassword(e.target.value)}
                        required
                      />
                      <Button type="submit" className="w-full" disabled={isTyping}>
                        {isTyping ? 'Creating Account...' : 'Sign Up & Start Building'}
                      </Button>
                    </form>
                  </div>
                </TabsContent>
                
                <TabsContent value="login" className="space-y-4">
                  <form onSubmit={handleAuth} className="space-y-3">
                    <Input
                      type="email"
                      placeholder="Email address"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      required
                    />
                    <Input
                      type="password"
                      placeholder="Password"
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                      required
                    />
                    <Button type="submit" className="w-full" disabled={isTyping}>
                      {isTyping ? 'Signing In...' : 'Sign In'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
              
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-center text-muted-foreground">
                  ✅ Free local models included<br/>
                  🔑 Bring your own API keys for premium models<br/>
                  📊 Geographic analytics with Datadog
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* API Key Setup Modal */}
      {showApiKeySetup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                API Key Setup (BYOK)
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Bring Your Own Keys - Enter your API keys to unlock premium models
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">OpenAI API Key (Optional)</label>
                  <Input
                    type="password"
                    placeholder="sk-..."
                    value={apiKeys.openai}
                    onChange={(e) => setApiKeys(prev => ({ ...prev, openai: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    For GPT-4, GPT-4 Vision models
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Anthropic API Key (Optional)</label>
                  <Input
                    type="password"
                    placeholder="sk-ant-..."
                    value={apiKeys.anthropic}
                    onChange={(e) => setApiKeys(prev => ({ ...prev, anthropic: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    For Claude 3.5 Sonnet models
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Google AI API Key (Optional)</label>
                  <Input
                    type="password"
                    placeholder="AI..."
                    value={apiKeys.google}
                    onChange={(e) => setApiKeys(prev => ({ ...prev, google: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    For Gemini 2.0 Flash models
                  </p>
                </div>
              </div>
              
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
                <p className="font-medium text-green-900">🔒 Security Note</p>
                <p className="text-green-700">
                  API keys are stored locally in your browser and never sent to our servers.
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button onClick={() => setShowApiKeySetup(false)} variant="outline" className="flex-1">
                  Skip for Now
                </Button>
                <Button onClick={saveApiKeys} className="flex-1">
                  Save Keys
                </Button>
              </div>
              
              <div className="pt-2 border-t">
                <p className="text-xs text-center text-muted-foreground">
                  💡 <strong>Pro Tip:</strong> You can always use our free local models (SmolLM2, Llama 3.2, Qwen2.5 Coder) without any API keys!
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
} 
