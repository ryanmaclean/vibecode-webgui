'use client';

// LiteLLM Interface Component for VibeCode
// =======================================

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  DollarSign, 
  Zap, 
  Settings, 
  BarChart3, 
  MessageSquare,
  Brain,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp
} from 'lucide-react';

// Types
interface ModelInfo {
  id: string;
  provider: string;
  mode: string;
  supports_function_calling: boolean;
  supports_vision: boolean;
  input_cost_per_token?: number;
  output_cost_per_token?: number;
}

interface UsageStats {
  requests_total: number;
  tokens_total: number;
  cost_total: number;
  errors_total: number;
  latency_avg: number;
  cache_hit_ratio: number;
  top_models: Array<{
    model: string;
    requests: number;
    cost: number;
  }>;
}

interface BudgetInfo {
  remaining_budget: number;
  budget_limit: number;
  spend_today: number;
}

interface HealthStatus {
  status: string;
  models: number;
  uptime: number;
}

// Main LiteLLM Interface Component
export default function LiteLLMInterface() {
  // State management
  const [activeTab, setActiveTab] = useState('overview');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [budget, setBudget] = useState<BudgetInfo | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chat testing state
  const [chatMessages, setChatMessages] = useState<Array<{role: string; content: string}>>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');
  const [isGenerating, setIsGenerating] = useState(false);

  // Auto-refresh interval
  const intervalRef = useRef<NodeJS.Timeout>();

  // Load data on component mount
  useEffect(() => {
    loadAllData();
    
    // Set up auto-refresh every 30 seconds
    intervalRef.current = setInterval(loadAllData, 30000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Data loading functions
  const loadAllData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await Promise.all([
        loadModels(),
        loadStats(),
        loadBudget(),
        loadHealth()
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadModels = async () => {
    try {
      const response = await fetch('/api/ai/litellm?action=models');
      if (!response.ok) throw new Error('Failed to load models');
      const data = await response.json();
      setModels(data.data || []);
    } catch (err) {
      console.error('Error loading models:', err);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/ai/litellm?action=stats');
      if (!response.ok) throw new Error('Failed to load stats');
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const loadBudget = async () => {
    try {
      const response = await fetch('/api/ai/litellm?action=budget');
      if (!response.ok) throw new Error('Failed to load budget');
      const data = await response.json();
      setBudget(data);
    } catch (err) {
      console.error('Error loading budget:', err);
    }
  };

  const loadHealth = async () => {
    try {
      const response = await fetch('/api/ai/litellm?action=health');
      if (!response.ok) throw new Error('Failed to load health');
      const data = await response.json();
      setHealth(data.litellm);
    } catch (err) {
      console.error('Error loading health:', err);
    }
  };

  // Chat testing functions
  const sendChatMessage = async () => {
    if (!currentMessage.trim() || isGenerating) return;

    const newMessage = { role: 'user', content: currentMessage };
    setChatMessages(prev => [...prev, newMessage]);
    setCurrentMessage('');
    setIsGenerating(true);

    try {
      const response = await fetch('/api/ai/litellm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          model: selectedModel,
          messages: [...chatMessages, newMessage],
          temperature: 0.7,
          max_tokens: 1000
        })
      });

      if (!response.ok) throw new Error('Chat request failed');
      
      const data = await response.json();
      const assistantMessage = data.choices[0]?.message;
      
      if (assistantMessage) {
        setChatMessages(prev => [...prev, assistantMessage]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const clearChat = () => {
    setChatMessages([]);
  };

  // Render functions
  const renderOverview = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Status</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            {health?.status === 'healthy' ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
            <span className="text-2xl font-bold">
              {health?.status || 'Unknown'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {health?.models || 0} models available
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats?.requests_total?.toLocaleString() || '0'}
          </div>
          <p className="text-xs text-muted-foreground">
            {stats?.errors_total || 0} errors
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${stats?.cost_total?.toFixed(2) || '0.00'}
          </div>
          <p className="text-xs text-muted-foreground">
            {stats?.tokens_total?.toLocaleString() || 0} tokens
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
          <Zap className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {(stats?.cache_hit_ratio * 100)?.toFixed(1) || '0.0'}%
          </div>
          <p className="text-xs text-muted-foreground">
            Avg latency: {stats?.latency_avg?.toFixed(0) || 0}ms
          </p>
        </CardContent>
      </Card>
    </div>
  );

  const renderModels = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Available Models</h3>
        <Button onClick={loadModels} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {models.map((model) => (
          <Card key={model.id}>
            <CardHeader>
              <CardTitle className="text-sm">{model.id}</CardTitle>
              <CardDescription>{model.provider}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary">{model.mode}</Badge>
                  {model.supports_function_calling && (
                    <Badge variant="outline">Functions</Badge>
                  )}
                  {model.supports_vision && (
                    <Badge variant="outline">Vision</Badge>
                  )}
                </div>
                
                {model.input_cost_per_token && (
                  <div className="text-xs text-muted-foreground">
                    Input: ${(model.input_cost_per_token * 1000).toFixed(4)}/1K tokens
                  </div>
                )}
                
                {model.output_cost_per_token && (
                  <div className="text-xs text-muted-foreground">
                    Output: ${(model.output_cost_per_token * 1000).toFixed(4)}/1K tokens
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-6">
      {/* Budget Information */}
      {budget && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Budget Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Budget Used</span>
                  <span>
                    ${budget.spend_today?.toFixed(2)} / ${budget.budget_limit?.toFixed(2)}
                  </span>
                </div>
                <Progress 
                  value={(budget.spend_today / budget.budget_limit) * 100} 
                  className="h-2"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    ${budget.remaining_budget?.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">Remaining</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    ${budget.spend_today?.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">Spent Today</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    ${budget.budget_limit?.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">Total Budget</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Models */}
      {stats?.top_models && stats.top_models.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top Models by Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.top_models.slice(0, 5).map((model, index) => (
                <div key={model.model} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">#{index + 1}</Badge>
                    <span className="font-medium">{model.model}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{model.requests} requests</div>
                    <div className="text-sm text-muted-foreground">
                      ${model.cost?.toFixed(4)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderTesting = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Model Testing
          </CardTitle>
          <CardDescription>
            Test different models and compare their responses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Model selection */}
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">Model:</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="px-3 py-1 border rounded-md"
              >
                {models.filter(m => m.mode === 'chat').map(model => (
                  <option key={model.id} value={model.id}>
                    {model.id} ({model.provider})
                  </option>
                ))}
              </select>
              
              <Button onClick={clearChat} variant="outline" size="sm">
                Clear Chat
              </Button>
            </div>

            {/* Chat messages */}
            <div className="border rounded-lg p-4 h-64 overflow-y-auto bg-gray-50">
              {chatMessages.length === 0 ? (
                <div className="text-center text-muted-foreground mt-8">
                  Start a conversation to test the model
                </div>
              ) : (
                <div className="space-y-3">
                  {chatMessages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs px-3 py-2 rounded-lg ${
                          message.role === 'user'
                            ? 'bg-blue-500 text-white'
                            : 'bg-white border'
                        }`}
                      >
                        <div className="text-sm">{message.content}</div>
                      </div>
                    </div>
                  ))}
                  
                  {isGenerating && (
                    <div className="flex justify-start">
                      <div className="bg-white border px-3 py-2 rounded-lg">
                        <div className="text-sm text-muted-foreground">
                          Generating response...
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Message input */}
            <div className="flex gap-2">
              <Input
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                placeholder="Type your message..."
                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                disabled={isGenerating}
              />
              <Button 
                onClick={sendChatMessage} 
                disabled={!currentMessage.trim() || isGenerating}
              >
                {isGenerating ? (
                  <Clock className="h-4 w-4" />
                ) : (
                  'Send'
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Main render
  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">LiteLLM Management</h1>
          <p className="text-muted-foreground">
            Unified AI model management and monitoring
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button onClick={loadAllData} variant="outline" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="testing">Testing</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          {renderOverview()}
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center text-muted-foreground py-8">
                  Activity monitoring coming soon
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => setActiveTab('testing')}
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    Test Models
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => setActiveTab('analytics')}
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    View Analytics
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => setActiveTab('models')}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Manage Models
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="models" className="mt-6">
          {renderModels()}
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          {renderAnalytics()}
        </TabsContent>

        <TabsContent value="testing" className="mt-6">
          {renderTesting()}
        </TabsContent>
      </Tabs>
    </div>
  );
} 