import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
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
  User
} from 'lucide-react';
import { cn } from '../lib/utils';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    codeGenerated?: boolean;
    deploymentUrl?: string;
    components?: string[];
    framework?: string;
  };
}

const MOCK_RESPONSES = [
  {
    content: "I'll help you build that! Let me start by creating a modern React application with the components you described.",
    codeGenerated: true,
    components: ["Header", "Hero Section", "Feature Cards"],
    framework: "React + TypeScript"
  },
  {
    content: "Perfect! I've generated the landing page with a responsive design using Tailwind CSS and shadcn/ui components.",
    deploymentUrl: "https://your-app-preview.vercel.app",
    components: ["Navigation", "Hero", "Features", "CTA"]
  },
  {
    content: "Great! Now I'll add the contact form with validation and integrate it with your backend API using React Hook Form.",
    codeGenerated: true,
    components: ["Contact Form", "Form Validation", "API Integration"],
    framework: "React + TypeScript"
  }
];

export default function PromptInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "assistant",
      content: "Hi! I'm your AI development assistant. Describe the app you'd like to build and I'll help you create it step by step with modern React components.",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [deviceView, setDeviceView] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [activeTab, setActiveTab] = useState("preview");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    // Simulate AI response delay
    setTimeout(() => {
      const response = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: response.content,
        timestamp: new Date(),
        metadata: {
          codeGenerated: response.codeGenerated,
          deploymentUrl: response.deploymentUrl,
          components: response.components,
          framework: response.framework
        }
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 1500 + Math.random() * 1000);
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
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Chat Interface Panel */}
        <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
          <div className="h-full border-r border-border/50 flex flex-col">
            <div className="p-4 border-b border-border/50">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Bot className="w-5 h-5 text-purple-500" />
                AI Assistant
              </h2>
              <p className="text-sm text-muted-foreground">
                Describe your app and I'll help you build it
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
                        
                        {message.metadata && (
                          <div className="mt-3 space-y-2">
                            {message.metadata.codeGenerated && (
                              <Badge variant="secondary" className="mr-2">
                                <Code className="w-3 h-3 mr-1" />
                                Code Generated
                              </Badge>
                            )}
                            {message.metadata.deploymentUrl && (
                              <Badge variant="secondary" className="mr-2">
                                <Globe className="w-3 h-3 mr-1" />
                                Deployed
                              </Badge>
                            )}
                            {message.metadata.framework && (
                              <Badge variant="outline" className="mr-2">
                                {message.metadata.framework}
                              </Badge>
                            )}
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
            
            {/* Input */}
            <div className="p-4 border-t border-border/50">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Describe the app you want to build..."
                  className="flex-1"
                  disabled={isTyping}
                />
                <Button 
                  onClick={handleSend} 
                  disabled={!input.trim() || isTyping}
                  className="bg-gradient-to-r from-purple-500 to-blue-600 hover:opacity-90"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Press Enter to send, Shift+Enter for new line
              </p>
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
    </div>
  );
} 