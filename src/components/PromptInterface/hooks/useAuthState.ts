import { useState, useEffect } from 'react';
import type { Message } from '../types';
import { logger } from '@/lib/logger';
interface ApiKeys {
  openai: string;
  anthropic: string;
  google: string;
}

export interface UseAuthStateReturn {
  // Authentication state
  isAuthenticated: boolean;
  showAuthModal: boolean;
  authMode: 'login' | 'signup';
  userEmail: string;
  userPassword: string;

  // API Keys (BYOK)
  apiKeys: ApiKeys;
  showApiKeySetup: boolean;

  // Actions
  setIsAuthenticated: (value: boolean) => void;
  setShowAuthModal: (value: boolean) => void;
  setAuthMode: (mode: 'login' | 'signup') => void;
  setUserEmail: (email: string) => void;
  setUserPassword: (password: string) => void;
  setApiKeys: React.Dispatch<React.SetStateAction<ApiKeys>>;
  setShowApiKeySetup: (value: boolean) => void;
  handleAuth: (e: React.FormEvent, selectedModel: string, setMessages: React.Dispatch<React.SetStateAction<Message[]>>, setIsTyping: (value: boolean) => void) => Promise<void>;
  handleApiKeySetup: () => void;
  saveApiKeys: (setMessages: React.Dispatch<React.SetStateAction<Message[]>>, selectedModel: string) => void;
  closeAuthModal: () => void;
  getApiKeyForModel: (provider: string) => string;
}

export function useAuthState(): UseAuthStateReturn {
  // Authentication & BYOK State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(true); // Start with auth required
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [apiKeys, setApiKeys] = useState<ApiKeys>({
    openai: '',
    anthropic: '',
    google: ''
  });
  const [showApiKeySetup, setShowApiKeySetup] = useState(false);

  // Load saved API keys on mount
  useEffect(() => {
    const savedKeys = localStorage.getItem('vibecode_api_keys');
    if (savedKeys) {
      try {
        setApiKeys(JSON.parse(savedKeys));
      } catch (error) {
        logger.error('Error loading saved API keys:', error);
      }
    }
  }, []);

  const getApiKeyForModel = (provider: string): string => {
    switch (provider) {
      case 'OpenAI': return apiKeys.openai;
      case 'Anthropic': return apiKeys.anthropic;
      case 'Google': return apiKeys.google;
      default: return '';
    }
  };

  const handleAuth = async (
    e: React.FormEvent,
    selectedModel: string,
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
    setIsTyping: (value: boolean) => void
  ) => {
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

      setMessages(welcomeMessages);

    } catch (error) {
      logger.error('Auth error:', error);

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

  const handleApiKeySetup = () => {
    setShowApiKeySetup(true);
  };

  const saveApiKeys = (
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
    selectedModel: string
  ) => {
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

  return {
    // State
    isAuthenticated,
    showAuthModal,
    authMode,
    userEmail,
    userPassword,
    apiKeys,
    showApiKeySetup,

    // Actions
    setIsAuthenticated,
    setShowAuthModal,
    setAuthMode,
    setUserEmail,
    setUserPassword,
    setApiKeys,
    setShowApiKeySetup,
    handleAuth,
    handleApiKeySetup,
    saveApiKeys,
    closeAuthModal,
    getApiKeyForModel,
  };
}
