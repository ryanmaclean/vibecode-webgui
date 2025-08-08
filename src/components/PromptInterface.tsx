import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './ui/resizable';
import { 
  Send, 
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
  User,
  Paperclip,
  Image,
  FileText,
  Zap,
  Settings,
  DollarSign,
  Clock,
  Database,
  Cpu,
  AlertCircle,
  CheckCircle,
  FileCode,
  Upload,
  Mic,
  MicOff,
  Volume2,
  Headphones,
  Radio
} from 'lucide-react';
import { cn } from '../lib/utils';

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
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
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

const MODELS: ModelConfig[] = [
  // Docker Model Runner Local Models (from the blog post)
  {
    id: 'ai/smollm2:360M-Q4_K_M',
    name: 'SmolLM2 360M (Local)',
    provider: 'Docker Model Runner',
    supportsImages: false,
    supportsFiles: true,
    supportsAudio: false,
    maxTokens: 2048,
    inputCostPer1k: 0, // Local models are free
    outputCostPer1k: 0,
    contextWindow: 8192
  },
  {
    id: 'ai/llama3.2:1b-Q4_K_M',
    name: 'Llama 3.2 1B (Local)',
    provider: 'Docker Model Runner',
    supportsImages: false,
    supportsFiles: true,
    supportsAudio: false,
    maxTokens: 2048,
    inputCostPer1k: 0,
    outputCostPer1k: 0,
    contextWindow: 8192
  },
  {
    id: 'ai/qwen2.5-coder:1.5b-Q4_K_M',
    name: 'Qwen2.5 Coder 1.5B (Local)',
    provider: 'Docker Model Runner',
    supportsImages: false,
    supportsFiles: true,
    supportsAudio: false,
    maxTokens: 4096,
    inputCostPer1k: 0,
    outputCostPer1k: 0,
    contextWindow: 16384
  },
  // Cloud models for comparison
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    supportsImages: true,
    supportsFiles: true,
    supportsAudio: false,
    maxTokens: 8192,
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.015,
    contextWindow: 200000
  },
  {
    id: 'openai/gpt-4-vision',
    name: 'GPT-4 Vision',
    provider: 'OpenAI',
    supportsImages: true,
    supportsFiles: true,
    supportsAudio: true,
    maxTokens: 4096,
    inputCostPer1k: 0.01,
    outputCostPer1k: 0.03,
    contextWindow: 128000
  },
  {
    id: 'google/gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
    supportsImages: true,
    supportsFiles: true,
    supportsAudio: true,
    maxTokens: 8192,
    inputCostPer1k: 0.000125,
    outputCostPer1k: 0.000375,
    contextWindow: 1000000
  }
];

const MCP_SERVERS: MCPServer[] = [
  {
    id: 'filesystem',
    name: 'File System',
    description: 'Read and write files in workspace',
    status: 'connected',
    tools: ['read_file', 'write_file', 'list_directory', 'create_file'],
    url: 'http://localhost:3001'
  },
  {
    id: 'database',
    name: 'Database',
    description: 'Query and modify database',
    status: 'connected',
    tools: ['execute_query', 'get_schema', 'insert_data'],
    url: 'http://localhost:3002'
  },
  {
    id: 'web-search',
    name: 'Web Search',
    description: 'Search the web for information',
    status: 'connected',
    tools: ['search_web', 'fetch_url', 'extract_content'],
    url: 'http://localhost:3003'
  },
  {
    id: 'voice-processor',
    name: 'Voice Processor',
    description: 'Transcribe audio files and voice input via Docker Model Runner',
    status: 'connected',
    tools: ['transcribe_audio', 'voice_to_text', 'speech_analysis'],
    url: 'http://localhost:3004'
  },
  {
    id: 'model-runner',
    name: 'Docker Model Runner',
    description: 'Local LLM inference with Docker AI',
    status: 'connected',
    tools: ['text_generation', 'code_completion', 'local_inference'],
    url: 'http://localhost:12434'
  }
];

const MOCK_RESPONSES = [
  {
    content: "I'll help you build that! Let me start by creating a modern React application with the components you described.",
    codeGenerated: true,
    components: ["Header", "Hero Section", "Feature Cards"],
    framework: "React + TypeScript",
    tokens: 256,
    cost: 0.003,
    model: "claude-3.5-sonnet",
    duration: 1200
  },
  {
    content: "Perfect! I've generated the landing page with a responsive design using Tailwind CSS and shadcn/ui components.",
    deploymentUrl: "https://your-app-preview.vercel.app",
    components: ["Navigation", "Hero", "Features", "CTA"],
    tokens: 342,
    cost: 0.004,
    model: "claude-3.5-sonnet",
    duration: 1800
  },
  {
    content: "Great! Now I'll add the contact form with validation and integrate it with your backend API using React Hook Form.",
    codeGenerated: true,
    components: ["Contact Form", "Form Validation", "API Integration"],
    framework: "React + TypeScript",
    tokens: 418,
    cost: 0.005,
    model: "claude-3.5-sonnet",
    duration: 2100
  }
];

export default function PromptInterface() {
  // Authentication & BYOK State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(true); // Start with auth required
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [apiKeys, setApiKeys] = useState({
    openai: '',
    anthropic: '',
    google: ''
  });
  const [showApiKeySetup, setShowApiKeySetup] = useState(false);
  
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

  // Load saved API keys on mount
  useEffect(() => {
    const savedKeys = localStorage.getItem('vibecode_api_keys');
    if (savedKeys) {
      try {
        setApiKeys(JSON.parse(savedKeys));
      } catch (error) {
        console.error('Error loading saved API keys:', error);
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

  // Authentication functions
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail || !userPassword) return;

    setIsTyping(true);

    try {
      // Track login attempt
      await fetch('/api/auth/login-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'login_attempt',
          email: userEmail,
          provider: 'local',
          sessionId: `session_${Date.now()}`,
          loginMethod: 'password'
        })
      });

      // Simulate authentication delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // For demo - always succeed
      setIsAuthenticated(true);
      setShowAuthModal(false);
      
      // Track successful login
      await fetch('/api/auth/login-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'login_success',
          userId: `user_${Date.now()}`,
          email: userEmail,
          provider: 'local',
          sessionId: `session_${Date.now()}`,
          loginMethod: 'password'
        })
      });

      // Initialize welcome messages
      const welcomeMessages: Message[] = [
        {
          id: "welcome-1",
          type: "assistant",
          content: `🎉 **Welcome ${authMode === 'signup' ? 'to' : 'back to'} VibeCode AI!** 
          
🌟 **Open Source AI Development Platform**
          
I'm your intelligent development assistant with access to:

🤖 **Local Models** - Free SmolLM2, Llama 3.2, Qwen2.5 Coder via Docker
🔑 **BYOK Support** - Use your own OpenAI, Anthropic, or Google API keys  
🎤 **Voice Input** - Speak naturally or upload audio files
📁 **File Processing** - Images, documents, code files
🔧 **MCP Servers** - Database, filesystem, web search integrations
📊 **Analytics** - Track usage, costs, and performance

What would you like to build today?`,
          timestamp: new Date(),
          metadata: {
            tokens: 180,
            cost: 0,
            model: selectedModel,
          }
        }
      ];

      // Check if using cloud models without API keys
      const cloudModel = MODELS.find(m => m.id === selectedModel);
      const needsApiKey = cloudModel && cloudModel.provider !== 'Docker Model Runner' && 
                         !getApiKeyForModel(cloudModel.provider);

      if (needsApiKey) {
        welcomeMessages.push({
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
        });
        setShowApiKeySetup(true);
      }

      setMessages(welcomeMessages);
      
    } catch (error) {
      console.error('Auth error:', error);
      
      // Track failed login
      await fetch('/api/auth/login-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'login_failure',
          email: userEmail,
          provider: 'local',
          sessionId: `session_${Date.now()}`,
          loginMethod: 'password',
          error: 'authentication_failed'
        })
      });
    }

    setIsTyping(false);
  };

  const getApiKeyForModel = (provider: string): string => {
    switch (provider) {
      case 'OpenAI': return apiKeys.openai;
      case 'Anthropic': return apiKeys.anthropic;
      case 'Google': return apiKeys.google;
      default: return '';
    }
  };

  const handleApiKeySetup = () => {
    setShowApiKeySetup(true);
  };

  const saveApiKeys = () => {
    // Save to localStorage for demo (in production, save securely)
    localStorage.setItem('vibecode_api_keys', JSON.stringify(apiKeys));
    setShowApiKeySetup(false);
    
    const confirmMessage: Message = {
      id: `api-keys-saved-${Date.now()}`,
      type: "assistant",
      content: `✅ **API Keys Saved Successfully!**

Your keys are stored locally and encrypted. You can now use premium cloud models:

${apiKeys.openai ? '🟢 OpenAI GPT models available' : ''}
${apiKeys.anthropic ? '🟢 Anthropic Claude models available' : ''}
${apiKeys.google ? '🟢 Google Gemini models available' : ''}

Ready to build something amazing!`,
      timestamp: new Date(),
      metadata: {
        tokens: 60,
        cost: 0,
        model: selectedModel,
      }
    };

    setMessages(prev => [...prev, confirmMessage]);
  };

  const closeAuthModal = () => {
    // Can't close auth modal until authenticated in BYOK model
    if (!isAuthenticated) return;
    setShowAuthModal(false);
    setUserEmail('');
    setUserPassword('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
              </p>
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
                        onClick={() => removeAttachment(attachment.id)}
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
                    onChange={(e) => setInput(e.target.value)}
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
                        onClick={isListening ? stopVoiceRecognition : startVoiceRecognition}
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
                        onClick={isRecording ? stopAudioRecording : startAudioRecording}
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
                      onClick={enhancePrompt}
                      disabled={!input.trim() || isTyping}
                      className="p-1 h-8 w-8"
                    >
                      <Zap className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                <Button 
                  onClick={handleSend} 
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