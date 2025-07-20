'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Mic, 
  Camera, 
  FileCode, 
  Bot, 
  Zap, 
  Eye, 
  Code, 
  Users,
  Cpu,
  Globe,
  Wand2,
  Play,
  Sparkles,
  Headphones,
  Upload,
  Settings,
  BarChart3,
  Shield
} from 'lucide-react';
import MultimodalPromptInterface from '@/components/MultimodalPromptInterface';
import { MultimodalAgent } from '@/lib/multimodal-agent';
import { MultimodalSampleGenerator } from '@/samples/multimodal-agent-samples';

export default function MultimodalDemoPage() {
  const [agent, setAgent] = useState<MultimodalAgent | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedDemo, setSelectedDemo] = useState<string>('overview');
  const [demoStats, setDemoStats] = useState({
    samplesRun: 0,
    messagesProcessed: 0,
    totalCost: 0,
    avgConfidence: 0
  });

  // Initialize the multimodal agent
  useEffect(() => {
    const initializeAgent = async () => {
      try {
        // Mock initialization - in production would use real API keys
        const mockAgent = new MultimodalAgent({
          openRouterKey: process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || 'mock-key',
          datadogConfig: {
            apiKey: process.env.DD_API_KEY,
            service: 'vibecode-multimodal-demo'
          }
        });
        
        setAgent(mockAgent);
        setIsInitialized(true);
        
        // Log demo session start
        console.log('🚀 VibeCode Multimodal Demo Session Started');
        
      } catch (error) {
        console.error('Failed to initialize agent:', error);
      }
    };

    initializeAgent();
  }, []);

  const handleSampleRun = (sampleId: string, result: any) => {
    setDemoStats(prev => ({
      ...prev,
      samplesRun: prev.samplesRun + 1,
      totalCost: prev.totalCost + (result.result?.metadata?.cost || 0),
      avgConfidence: (prev.avgConfidence + (result.result?.metadata?.confidence || 0)) / 2
    }));
  };

  const handleMessage = (message: any) => {
    setDemoStats(prev => ({
      ...prev,
      messagesProcessed: prev.messagesProcessed + 1
    }));
  };

  const capabilities = [
    {
      id: 'voice-to-code',
      title: 'Voice to Code',
      description: 'Speak naturally and watch your ideas become functional code',
      icon: <Mic className="w-6 h-6" />,
      color: 'bg-blue-500',
      examples: [
        'Create a responsive navbar component',
        'Build a todo app with TypeScript',
        'Add authentication to my API'
      ]
    },
    {
      id: 'vision-analysis',
      title: 'Vision to UI',
      description: 'Upload design mockups and get pixel-perfect React components',
      icon: <Eye className="w-6 h-6" />,
      color: 'bg-green-500',
      examples: [
        'Convert Figma designs to code',
        'Analyze UI screenshots',
        'Generate components from sketches'
      ]
    },
    {
      id: 'file-analysis',
      title: 'Codebase Intelligence',
      description: 'Upload entire projects for analysis, refactoring, and optimization',
      icon: <FileCode className="w-6 h-6" />,
      color: 'bg-purple-500',
      examples: [
        'Refactor legacy code',
        'Add TypeScript to JavaScript',
        'Generate comprehensive tests'
      ]
    },
    {
      id: 'collaboration',
      title: 'AI Pair Programming',
      description: 'Real-time coding assistance with context-aware suggestions',
      icon: <Users className="w-6 h-6" />,
      color: 'bg-orange-500',
      examples: [
        'Code reviews and feedback',
        'Bug detection and fixes',
        'Performance optimizations'
      ]
    },
    {
      id: 'automation',
      title: 'Task Automation',
      description: 'Automate testing, deployment, and development workflows',
      icon: <Cpu className="w-6 h-6" />,
      color: 'bg-red-500',
      examples: [
        'Generate test suites',
        'Create CI/CD pipelines',
        'Setup monitoring dashboards'
      ]
    },
    {
      id: 'monitoring',
      title: 'Analytics & Monitoring',
      description: 'Geographic analytics and real-time performance monitoring',
      icon: <Globe className="w-6 h-6" />,
      color: 'bg-indigo-500',
      examples: [
        'User geographic distribution',
        'Performance metrics tracking',
        'Security event monitoring'
      ]
    }
  ];

  const demoScenarios = [
    {
      id: 'voice-demo',
      title: '🎤 Voice-Driven Development',
      description: 'Experience hands-free coding with voice commands',
      script: [
        'Say: "Create a user authentication form with email and password"',
        'Watch as AI generates React component with TypeScript',
        'Add: "Make it responsive and add form validation"',
        'See real-time code updates and explanations'
      ]
    },
    {
      id: 'vision-demo',
      title: '👁️ Design to Code Magic',
      description: 'Transform visual designs into functional components',
      script: [
        'Upload a design mockup or UI screenshot',
        'AI analyzes layout, colors, and components',
        'Generates pixel-perfect React code with Tailwind CSS',
        'Includes responsive breakpoints and interactions'
      ]
    },
    {
      id: 'collaboration-demo',
      title: '👥 AI Pair Programming',
      description: 'Collaborate with AI for code reviews and improvements',
      script: [
        'Upload existing code files for analysis',
        'Get comprehensive code review with suggestions',
        'Implement AI-recommended improvements',
        'Generate automated tests and documentation'
      ]
    },
    {
      id: 'automation-demo',
      title: '🤖 Workflow Automation',
      description: 'Automate your entire development pipeline',
      script: [
        'Describe your deployment requirements',
        'AI generates Docker, Kubernetes, and CI/CD configs',
        'Includes monitoring and alerting setup',
        'One-click deployment to cloud platforms'
      ]
    }
  ];

  if (!isInitialized || !agent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-purple-600 animate-pulse" />
              Initializing VibeCode AI
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-purple-600 h-2 rounded-full animate-pulse" style={{ width: '75%' }}></div>
              </div>
              <p className="text-sm text-gray-600">
                Loading multimodal capabilities...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Hero Section */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Wand2 className="w-12 h-12 text-purple-600" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                VibeCode Multimodal AI
              </h1>
            </div>
            <p className="text-xl text-gray-600 mb-6 max-w-3xl mx-auto">
              Experience the future of development with voice, vision, and intelligent code generation. 
              Build applications faster with AI that understands your natural language, visual designs, and coding intent.
            </p>
            
            {/* Stats */}
            <div className="flex justify-center gap-8 mb-8">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{demoStats.samplesRun}</div>
                <div className="text-sm text-gray-500">Samples Run</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{demoStats.messagesProcessed}</div>
                <div className="text-sm text-gray-500">Messages Processed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {(demoStats.avgConfidence * 100).toFixed(0)}%
                </div>
                <div className="text-sm text-gray-500">Avg Confidence</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  ${demoStats.totalCost.toFixed(4)}
                </div>
                <div className="text-sm text-gray-500">Total Cost</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Tabs value={selectedDemo} onValueChange={setSelectedDemo} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">🎯 Overview</TabsTrigger>
            <TabsTrigger value="live-demo">💻 Live Demo</TabsTrigger>
            <TabsTrigger value="scenarios">🎬 Scenarios</TabsTrigger>
            <TabsTrigger value="analytics">📊 Analytics</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {capabilities.map((capability) => (
                <Card key={capability.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${capability.color} text-white`}>
                        {capability.icon}
                      </div>
                      <CardTitle className="text-lg">{capability.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 mb-4">{capability.description}</p>
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-800">Try saying:</h4>
                      {capability.examples.map((example, i) => (
                        <div key={i} className="text-xs bg-gray-100 p-2 rounded italic">
                          "{example}"
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Quick Start */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Quick Start Guide
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-blue-600 font-bold">1</span>
                    </div>
                    <h3 className="font-medium mb-1">Choose Input Method</h3>
                    <p className="text-sm text-gray-600">Voice, upload files, or type naturally</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-green-600 font-bold">2</span>
                    </div>
                    <h3 className="font-medium mb-1">Describe Your Goal</h3>
                    <p className="text-sm text-gray-600">What do you want to build or improve?</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-purple-600 font-bold">3</span>
                    </div>
                    <h3 className="font-medium mb-1">AI Processing</h3>
                    <p className="text-sm text-gray-600">Advanced models analyze and generate</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-orange-600 font-bold">4</span>
                    </div>
                    <h3 className="font-medium mb-1">Get Results</h3>
                    <p className="text-sm text-gray-600">Working code, tests, and deployment</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Live Demo Tab */}
          <TabsContent value="live-demo">
            <Card className="h-[600px]">
              <CardContent className="p-0 h-full">
                <MultimodalPromptInterface 
                  agent={agent}
                  onMessage={handleMessage}
                  onSampleRun={handleSampleRun}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Scenarios Tab */}
          <TabsContent value="scenarios" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {demoScenarios.map((scenario) => (
                <Card key={scenario.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg">{scenario.title}</CardTitle>
                    <p className="text-gray-600">{scenario.description}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {scenario.script.map((step, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-blue-600 text-xs font-bold">{i + 1}</span>
                          </div>
                          <p className="text-sm text-gray-700">{step}</p>
                        </div>
                      ))}
                    </div>
                    <Button className="w-full mt-4" onClick={() => setSelectedDemo('live-demo')}>
                      <Play className="w-4 h-4 mr-2" />
                      Try This Scenario
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BarChart3 className="w-5 h-5" />
                    Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Avg Response Time</span>
                      <span className="text-sm font-medium">1.2s</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Success Rate</span>
                      <span className="text-sm font-medium">98.5%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Avg Confidence</span>
                      <span className="text-sm font-medium">{(demoStats.avgConfidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Shield className="w-5 h-5" />
                    Security
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Bot Requests</span>
                      <span className="text-sm font-medium">0</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Rate Limited</span>
                      <span className="text-sm font-medium">0</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Security Score</span>
                      <span className="text-sm font-medium">A+</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Globe className="w-5 h-5" />
                    Geographic
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Regions</span>
                      <span className="text-sm font-medium">1</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Top Country</span>
                      <span className="text-sm font-medium">USA</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Users Online</span>
                      <span className="text-sm font-medium">1</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Cpu className="w-5 h-5" />
                    Resources
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">API Calls</span>
                      <span className="text-sm font-medium">{demoStats.messagesProcessed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Total Cost</span>
                      <span className="text-sm font-medium">${demoStats.totalCost.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Efficiency</span>
                      <span className="text-sm font-medium">95%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Geographic Map Placeholder */}
            <Card>
              <CardHeader>
                <CardTitle>🗺️ Real-time Geographic Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <Globe className="w-16 h-16 text-blue-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-700 mb-2">
                      Datadog Geomap Integration
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Real-time user activity and AI usage patterns worldwide
                    </p>
                    <Button variant="outline" onClick={() => window.open('/test-geomaps', '_blank')}>
                      View Live Geomap Data
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer */}
      <div className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <span className="text-gray-600">
                Powered by VibeCode AI • Open Source • BYOK
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline">
                🚀 Live Demo
              </Badge>
              <Badge variant="outline">
                📊 Datadog Monitoring
              </Badge>
              <Badge variant="outline">
                🌍 Geographic Analytics
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 