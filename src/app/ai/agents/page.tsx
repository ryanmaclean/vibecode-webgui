/**
 * AI Agents Page
 *
 * Multi-agent workspace for managing concurrent AI agent conversations.
 * Supports selecting agents, sending messages, and viewing threaded replies.
 */

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Bot,
  Code,
  Bug,
  Building2,
  Eye,
  FlaskConical,
  Server,
  Send,
  X,
  ChevronDown,
  User,
  Clock,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface Agent {
  id: string;
  name: string;
  role: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
  status: 'active' | 'idle' | 'busy';
  description: string;
}

interface Message {
  id: string;
  agentId: string;
  agentName: string;
  agentColor: string;
  content: string;
  timestamp: Date;
  role: 'user' | 'assistant';
  status: 'sent' | 'delivered';
}

// ============================================================================
// Mock Data
// ============================================================================

const AGENTS: Agent[] = [
  {
    id: 'code-assistant',
    name: 'Code Assistant',
    role: 'Full-Stack Developer',
    color: '#3b82f6',
    bgColor: '#dbeafe',
    icon: <Code size={20} className="text-blue-600" />,
    status: 'active',
    description: 'Generates, refactors, and explains code across languages.',
  },
  {
    id: 'debug-helper',
    name: 'Debug Helper',
    role: 'Bug Hunter',
    color: '#ef4444',
    bgColor: '#fee2e2',
    icon: <Bug size={20} className="text-red-500" />,
    status: 'active',
    description: 'Analyzes stack traces, identifies root causes, and suggests fixes.',
  },
  {
    id: 'architect',
    name: 'Architect',
    role: 'System Designer',
    color: '#8b5cf6',
    bgColor: '#ede9fe',
    icon: <Building2 size={20} className="text-violet-600" />,
    status: 'idle',
    description: 'Designs system architecture, APIs, and database schemas.',
  },
  {
    id: 'reviewer',
    name: 'Reviewer',
    role: 'Code Reviewer',
    color: '#f59e0b',
    bgColor: '#fef3c7',
    icon: <Eye size={20} className="text-amber-500" />,
    status: 'active',
    description: 'Reviews code for quality, security, and best practices.',
  },
  {
    id: 'tester',
    name: 'Tester',
    role: 'QA Engineer',
    color: '#10b981',
    bgColor: '#d1fae5',
    icon: <FlaskConical size={20} className="text-emerald-600" />,
    status: 'idle',
    description: 'Writes unit tests, integration tests, and test strategies.',
  },
  {
    id: 'devops',
    name: 'DevOps',
    role: 'Infrastructure Engineer',
    color: '#06b6d4',
    bgColor: '#cffafe',
    icon: <Server size={20} className="text-cyan-500" />,
    status: 'busy',
    description: 'Manages CI/CD pipelines, Docker, Kubernetes, and cloud infra.',
  },
];

function createInitialConversations(): Map<string, Message[]> {
  const conversations = new Map<string, Message[]>();

  conversations.set('code-assistant', [
    {
      id: 'ca-1',
      agentId: 'code-assistant',
      agentName: 'Code Assistant',
      agentColor: '#3b82f6',
      content: 'Hello! I can help you write, refactor, or explain code. What are you working on today?',
      timestamp: new Date(Date.now() - 300000),
      role: 'assistant',
      status: 'delivered',
    },
  ]);

  conversations.set('debug-helper', [
    {
      id: 'dh-1',
      agentId: 'debug-helper',
      agentName: 'Debug Helper',
      agentColor: '#ef4444',
      content: 'Ready to squash some bugs! Paste an error message or describe the issue you are seeing.',
      timestamp: new Date(Date.now() - 600000),
      role: 'assistant',
      status: 'delivered',
    },
  ]);

  conversations.set('architect', [
    {
      id: 'ar-1',
      agentId: 'architect',
      agentName: 'Architect',
      agentColor: '#8b5cf6',
      content: 'I can help design your system architecture. Tell me about your project requirements and constraints.',
      timestamp: new Date(Date.now() - 120000),
      role: 'assistant',
      status: 'delivered',
    },
  ]);

  conversations.set('reviewer', [
    {
      id: 'rv-1',
      agentId: 'reviewer',
      agentName: 'Reviewer',
      agentColor: '#f59e0b',
      content: 'Share your code and I will review it for quality, security vulnerabilities, and adherence to best practices.',
      timestamp: new Date(Date.now() - 180000),
      role: 'assistant',
      status: 'delivered',
    },
  ]);

  conversations.set('tester', [
    {
      id: 'ts-1',
      agentId: 'tester',
      agentName: 'Tester',
      agentColor: '#10b981',
      content: 'Need tests? I can generate unit tests, integration tests, or help you build a comprehensive test strategy.',
      timestamp: new Date(Date.now() - 240000),
      role: 'assistant',
      status: 'delivered',
    },
  ]);

  conversations.set('devops', [
    {
      id: 'do-1',
      agentId: 'devops',
      agentName: 'DevOps',
      agentColor: '#06b6d4',
      content: 'I can help with CI/CD pipelines, Docker configurations, Kubernetes manifests, and cloud infrastructure setup.',
      timestamp: new Date(Date.now() - 360000),
      role: 'assistant',
      status: 'delivered',
    },
  ]);

  return conversations;
}

// ============================================================================
// Sub-components
// ============================================================================

function StatusDot({ status }: { status: Agent['status'] }) {
  const colors = {
    active: 'bg-green-500',
    idle: 'bg-gray-400',
    busy: 'bg-orange-500 animate-pulse',
  };
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status]}`}
      title={status}
    />
  );
}

function AgentCard({
  agent,
  isSelected,
  messageCount,
  onClick,
}: {
  agent: Agent;
  isSelected: boolean;
  messageCount: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-150 text-left
        ${isSelected
          ? 'bg-blue-50 border-2 border-blue-300 shadow-sm'
          : 'bg-white border-2 border-gray-100 hover:border-gray-200 hover:bg-gray-50'
        }`}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: agent.bgColor }}
      >
        {agent.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-gray-900 truncate">{agent.name}</span>
          <StatusDot status={agent.status} />
        </div>
        <p className="text-xs text-gray-500 truncate">{agent.role}</p>
      </div>
      {messageCount > 0 && (
        <span className="text-xs text-gray-400 flex-shrink-0">{messageCount} msgs</span>
      )}
    </button>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ring-2 ring-white"
        style={{ backgroundColor: isUser ? '#6366f1' : message.agentColor }}
      >
        {isUser ? (
          <User size={16} className="text-white" />
        ) : (
          <Bot size={16} className="text-white" />
        )}
      </div>
      <div className={`flex flex-col gap-1 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`flex items-center gap-2 text-xs text-gray-500 ${isUser ? 'flex-row-reverse' : ''}`}>
          <span className="font-medium">{isUser ? 'You' : message.agentName}</span>
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric' }).format(message.timestamp)}
          </span>
        </div>
        <div
          className={`px-4 py-3 rounded-lg text-sm whitespace-pre-wrap break-words ${
            isUser
              ? 'bg-indigo-500 text-white rounded-tr-none'
              : 'bg-gray-100 text-gray-900 rounded-tl-none'
          }`}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}

function ConversationPanel({
  agent,
  messages,
  onSendMessage,
}: {
  agent: Agent;
  messages: Message[];
  onSendMessage: (content: string) => void;
}) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Conversation header */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white"
        style={{ borderTopColor: agent.color, borderTopWidth: 3 }}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ backgroundColor: agent.bgColor }}
        >
          {agent.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-gray-900">{agent.name}</h3>
            <StatusDot status={agent.status} />
          </div>
          <p className="text-xs text-gray-500 truncate">{agent.description}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-200 bg-white">
        <div className="flex gap-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Message ${agent.name}...`}
            className="flex-1 px-3 py-2 rounded-lg resize-none text-sm border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 text-sm"
          >
            <Send size={14} />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Agent response simulation
// ============================================================================

const AGENT_RESPONSES: Record<string, string[]> = {
  'code-assistant': [
    'I can help with that! Let me analyze your requirements and draft some code.',
    'Here is an approach: I would structure this with a clean separation of concerns using a service layer pattern.',
    'Good question. The key consideration here is performance -- we should use memoization to avoid redundant computations.',
    'I have refactored the implementation. The new version uses TypeScript generics for better type safety.',
  ],
  'debug-helper': [
    'I see the issue. The error trace points to a null reference on line 42. Let me trace the data flow.',
    'This looks like a race condition. The async operation completes before the state is initialized.',
    'Try adding a null check before accessing the property. The root cause is likely an unhandled edge case in the API response.',
    'I have identified the bug: the array index is off by one in the loop boundary condition.',
  ],
  'architect': [
    'For this scale, I recommend a microservices architecture with event-driven communication.',
    'The database schema should use a normalized design with proper indexes on the foreign keys.',
    'Consider using the CQRS pattern here -- separate your read and write models for better scalability.',
    'I would add a caching layer using Redis between the API gateway and your services.',
  ],
  'reviewer': [
    'The code looks clean overall. A few observations: consider extracting the validation logic into a separate utility.',
    'Security concern: user input is not sanitized before being used in the SQL query. This is vulnerable to injection.',
    'Good use of TypeScript types. I would suggest making the return type more specific instead of using `any`.',
    'The error handling could be improved. Currently, the catch block swallows errors silently.',
  ],
  'tester': [
    'I recommend starting with unit tests for the core business logic, then adding integration tests for the API layer.',
    'Here is a test strategy: cover the happy path first, then edge cases, then error scenarios.',
    'You should mock the external API calls in your tests. Here is how to set up the mock with Jest.',
    'The current test coverage is good but missing negative test cases. Let me generate those.',
  ],
  'devops': [
    'I will set up a multi-stage Docker build to optimize the image size. The final image should be under 100MB.',
    'For CI/CD, I recommend GitHub Actions with separate workflows for testing, building, and deployment.',
    'The Kubernetes manifest needs resource limits. Without them, a single pod could consume all cluster resources.',
    'Consider adding health check endpoints and readiness probes for better orchestration.',
  ],
};

function getAgentResponse(agentId: string): string {
  const responses = AGENT_RESPONSES[agentId] || ['I understand. Let me help you with that.'];
  return responses[Math.floor(Math.random() * responses.length)];
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function AIAgentsPage() {
  const [selectedAgentId, setSelectedAgentId] = useState<string>(AGENTS[0].id);
  const [conversations, setConversations] = useState<Map<string, Message[]>>(createInitialConversations);
  const [mobileAgentListOpen, setMobileAgentListOpen] = useState(false);
  const msgCounter = useRef(0);

  const selectedAgent = AGENTS.find((a) => a.id === selectedAgentId) || AGENTS[0];
  const currentMessages = conversations.get(selectedAgentId) || [];

  const handleSendMessage = useCallback((agentId: string, content: string) => {
    const agent = AGENTS.find((a) => a.id === agentId);
    if (!agent) return;

    msgCounter.current += 1;
    const userMsg: Message = {
      id: `user-${msgCounter.current}`,
      agentId,
      agentName: 'You',
      agentColor: '#6366f1',
      content,
      timestamp: new Date(),
      role: 'user',
      status: 'sent',
    };

    setConversations((prev) => {
      const next = new Map(prev);
      const existing = next.get(agentId) || [];
      next.set(agentId, [...existing, userMsg]);
      return next;
    });

    // Simulate agent response after a brief delay
    setTimeout(() => {
      msgCounter.current += 1;
      const agentMsg: Message = {
        id: `agent-${msgCounter.current}`,
        agentId,
        agentName: agent.name,
        agentColor: agent.color,
        content: getAgentResponse(agentId),
        timestamp: new Date(),
        role: 'assistant',
        status: 'delivered',
      };

      setConversations((prev) => {
        const next = new Map(prev);
        const existing = next.get(agentId) || [];
        next.set(agentId, [...existing, agentMsg]);
        return next;
      });
    }, 800 + Math.random() * 1200);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Bot className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">AI Agents</h1>
          </div>
          <p className="text-gray-600">
            Manage concurrent conversations with specialized AI agents. Select an agent to start a conversation.
          </p>
        </div>

        {/* Mobile agent selector toggle */}
        <div className="md:hidden mb-4">
          <button
            onClick={() => setMobileAgentListOpen(!mobileAgentListOpen)}
            className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: selectedAgent.bgColor }}
              >
                {selectedAgent.icon}
              </div>
              <div className="text-left">
                <div className="font-medium text-sm text-gray-900">{selectedAgent.name}</div>
                <div className="text-xs text-gray-500">{selectedAgent.role}</div>
              </div>
            </div>
            <ChevronDown
              size={20}
              className={`text-gray-400 transition-transform ${mobileAgentListOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {mobileAgentListOpen && (
            <div className="mt-2 bg-white rounded-lg border border-gray-200 shadow-lg p-2 space-y-1">
              {AGENTS.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  isSelected={agent.id === selectedAgentId}
                  messageCount={(conversations.get(agent.id) || []).length}
                  onClick={() => {
                    setSelectedAgentId(agent.id);
                    setMobileAgentListOpen(false);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Main workspace */}
        <div className="flex flex-col md:flex-row gap-4" style={{ minHeight: 'calc(100vh - 220px)' }}>
          {/* Agent sidebar - desktop */}
          <div className="hidden md:block w-72 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 space-y-2 sticky top-6">
              <h2 className="text-sm font-semibold text-gray-700 px-1 mb-3">Available Agents</h2>
              {AGENTS.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  isSelected={agent.id === selectedAgentId}
                  messageCount={(conversations.get(agent.id) || []).length}
                  onClick={() => setSelectedAgentId(agent.id)}
                />
              ))}
            </div>
          </div>

          {/* Conversation panel */}
          <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden" style={{ minHeight: 500 }}>
            <ConversationPanel
              agent={selectedAgent}
              messages={currentMessages}
              onSendMessage={(content) => handleSendMessage(selectedAgentId, content)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
