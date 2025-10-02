/**
 * AI Model Selector Component
 * Allows users to select AI providers and models for VibeCode
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle, Clock, DollarSign, Zap, Server, Cloud, Home } from 'lucide-react';
import { AIProvider, AIModelConfig } from '@/lib/ai/enhanced-model-client';

interface ProviderInfo {
  id: AIProvider;
  name: string;
  description: string;
  icon: React.ReactNode;
  tier: 'free' | 'paid' | 'enterprise';
  status: 'available' | 'unavailable' | 'checking';
  latency?: number;
  costPer1kTokens: number;
  features: string[];
  models: string[];
}

const PROVIDER_INFO: Record<AIProvider, ProviderInfo> = {
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Access to 150+ AI models through a unified API',
    icon: <Cloud className="h-5 w-5" />,
    tier: 'paid',
    status: 'checking',
    costPer1kTokens: 0.002,
    features: ['Multiple models', 'High availability', 'Competitive pricing'],
    models: [
      'anthropic/claude-3.5-sonnet',
      'anthropic/claude-3-haiku',
      'openai/gpt-4o',
      'openai/gpt-4-turbo',
      'meta-llama/llama-3.1-405b-instruct'
    ]
  },
  'azure-openai': {
    id: 'azure-openai',
    name: 'Azure OpenAI',
    description: 'Enterprise-grade OpenAI models on Microsoft Azure',
    icon: <Server className="h-5 w-5" />,
    tier: 'enterprise',
    status: 'checking',
    costPer1kTokens: 0.001,
    features: ['Enterprise security', 'SLA guarantee', 'Data residency'],
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-35-turbo', 'text-embedding-ada-002']
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Direct access to Claude models from Anthropic',
    icon: <Zap className="h-5 w-5" />,
    tier: 'paid',
    status: 'checking',
    costPer1kTokens: 0.003,
    features: ['Latest Claude models', 'High context window', 'Advanced reasoning'],
    models: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307', 'claude-3-opus-20240229']
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama',
    description: 'Local AI models running on your infrastructure',
    icon: <Home className="h-5 w-5" />,
    tier: 'free',
    status: 'checking',
    costPer1kTokens: 0.0,
    features: ['Zero cost', 'Privacy focused', 'Offline capable'],
    models: ['llama3.1:8b', 'llama3.1:70b', 'codellama:13b', 'mistral:7b']
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Google\'s advanced AI models with multimodal capabilities',
    icon: <Cloud className="h-5 w-5" />,
    tier: 'paid',
    status: 'checking',
    costPer1kTokens: 0.0015,
    features: ['Multimodal support', 'Long context', 'Code generation'],
    models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro']
  },
  bedrock: {
    id: 'bedrock',
    name: 'AWS Bedrock',
    description: 'Enterprise AI models on AWS infrastructure',
    icon: <Server className="h-5 w-5" />,
    tier: 'enterprise',
    status: 'checking',
    costPer1kTokens: 0.0025,
    features: ['Enterprise security', 'Multiple models', 'AWS integration'],
    models: ['anthropic.claude-3-sonnet-20240229-v1:0', 'meta.llama3-1-405b-instruct-v1:0']
  }
};

interface AIModelSelectorProps {
  onConfigChange: (config: AIModelConfig) => void;
  currentConfig: AIModelConfig;
  className?: string;
}

export default function AIModelSelector({ onConfigChange, currentConfig, className }: AIModelSelectorProps) {
  const [providers, setProviders] = useState<Record<AIProvider, ProviderInfo>>(PROVIDER_INFO);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(currentConfig.provider);
  const [selectedModel, setSelectedModel] = useState(currentConfig.model);
  const [maxTokens, setMaxTokens] = useState(currentConfig.maxTokens || 4000);
  const [temperature, setTemperature] = useState(currentConfig.temperature || 0.7);
  const [enableFallback, setEnableFallback] = useState(true);
  const [isChecking, setIsChecking] = useState(false);

  // Check provider health on mount
  useEffect(() => {
    checkAllProviders();
  }, []);

  // Update config when settings change
  useEffect(() => {
    onConfigChange({
      provider: selectedProvider,
      model: selectedModel,
      maxTokens,
      temperature
    });
  }, [selectedProvider, selectedModel, maxTokens, temperature, onConfigChange]);

  const checkAllProviders = async () => {
    setIsChecking(true);
    
    for (const providerId of Object.keys(providers) as AIProvider[]) {
      try {
        const response = await fetch('/api/ai/provider-health', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: providerId })
        });
        
        const health = await response.json();
        
        setProviders(prev => ({
          ...prev,
          [providerId]: {
            ...prev[providerId],
            status: health.available ? 'available' : 'unavailable',
            latency: health.latency
          }
        }));
      } catch (error) {
        setProviders(prev => ({
          ...prev,
          [providerId]: {
            ...prev[providerId],
            status: 'unavailable'
          }
        }));
      }
    }
    
    setIsChecking(false);
  };

  const getStatusIcon = (status: string, latency?: number) => {
    switch (status) {
      case 'available':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'unavailable':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'checking':
        return <Clock className="h-4 w-4 text-yellow-500 animate-spin" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'free':
        return 'bg-green-100 text-green-800';
      case 'paid':
        return 'bg-blue-100 text-blue-800';
      case 'enterprise':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const calculateEstimatedCost = (tokens: number, costPer1k: number) => {
    return ((tokens / 1000) * costPer1k).toFixed(4);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">AI Model Configuration</h2>
          <p className="text-gray-600">Choose your AI provider and configure model settings</p>
        </div>
        <Button 
          onClick={checkAllProviders} 
          disabled={isChecking}
          variant="outline"
          size="sm"
        >
          {isChecking ? 'Checking...' : 'Refresh Status'}
        </Button>
      </div>

      <Tabs defaultValue="providers" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.values(providers).map((provider) => (
              <Card 
                key={provider.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedProvider === provider.id ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => setSelectedProvider(provider.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {provider.icon}
                      <CardTitle className="text-lg">{provider.name}</CardTitle>
                    </div>
                    {getStatusIcon(provider.status, provider.latency)}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getTierColor(provider.tier)}>
                      {provider.tier}
                    </Badge>
                    {provider.latency && (
                      <Badge variant="outline">
                        {provider.latency}ms
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="mb-3">
                    {provider.description}
                  </CardDescription>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Cost per 1K tokens:</span>
                      <span className="font-medium">
                        {provider.costPer1kTokens === 0 ? 'Free' : `$${provider.costPer1kTokens}`}
                      </span>
                    </div>
                    
                    <div className="space-y-1">
                      <span className="text-sm text-gray-600">Features:</span>
                      <div className="flex flex-wrap gap-1">
                        {provider.features.map((feature, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Select Model</CardTitle>
              <CardDescription>
                Choose a specific model from {providers[selectedProvider].name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {providers[selectedProvider].models.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Estimated Cost</span>
                  <DollarSign className="h-4 w-4 text-gray-500" />
                </div>
                <div className="text-sm text-gray-600">
                  <div>Per request ({maxTokens} tokens): ${calculateEstimatedCost(maxTokens, providers[selectedProvider].costPer1kTokens)}</div>
                  <div>Per 100 requests: ${calculateEstimatedCost(maxTokens * 100, providers[selectedProvider].costPer1kTokens)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Generation Settings</CardTitle>
                <CardDescription>Configure model behavior and output</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="max-tokens">Max Tokens: {maxTokens}</Label>
                  <Slider
                    id="max-tokens"
                    min={100}
                    max={8000}
                    step={100}
                    value={[maxTokens]}
                    onValueChange={(value) => setMaxTokens(value[0])}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>100</span>
                    <span>8000</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="temperature">Temperature: {temperature}</Label>
                  <Slider
                    id="temperature"
                    min={0}
                    max={2}
                    step={0.1}
                    value={[temperature]}
                    onValueChange={(value) => setTemperature(value[0])}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0 (Focused)</span>
                    <span>2 (Creative)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Advanced Options</CardTitle>
                <CardDescription>Additional configuration options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="enable-fallback">Enable Fallback</Label>
                    <p className="text-sm text-gray-600">
                      Automatically retry with backup providers
                    </p>
                  </div>
                  <Switch
                    id="enable-fallback"
                    checked={enableFallback}
                    onCheckedChange={setEnableFallback}
                  />
                </div>

                <div className="p-3 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-1">Fallback Order</h4>
                  <p className="text-sm text-blue-700">
                    {selectedProvider === 'openrouter' && 'Azure OpenAI → Anthropic → Ollama'}
                    {selectedProvider === 'azure-openai' && 'OpenRouter → Anthropic'}
                    {selectedProvider === 'anthropic' && 'OpenRouter → Azure OpenAI'}
                    {selectedProvider === 'ollama' && 'OpenRouter → Azure OpenAI'}
                    {selectedProvider === 'gemini' && 'OpenRouter → Azure OpenAI'}
                    {selectedProvider === 'bedrock' && 'OpenRouter → Azure OpenAI'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Current Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Provider:</span>
              <p className="font-medium">{providers[selectedProvider].name}</p>
            </div>
            <div>
              <span className="text-gray-600">Model:</span>
              <p className="font-medium">{selectedModel}</p>
            </div>
            <div>
              <span className="text-gray-600">Max Tokens:</span>
              <p className="font-medium">{maxTokens}</p>
            </div>
            <div>
              <span className="text-gray-600">Temperature:</span>
              <p className="font-medium">{temperature}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 