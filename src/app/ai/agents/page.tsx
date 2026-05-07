/**
 * AI Agents Page
 *
 * Multi-agent workspace for managing concurrent AI agent conversations.
 * Supports selecting agents, sending messages, and viewing threaded replies.
 */

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { DemoBanner } from '@/components/ui/DemoBanner';
import {
  Bot,
  Send,
  ChevronDown,
  User,
  Clock,
  Loader2,
  AlertCircle,
  Inbox,
} from 'lucide-react';
import type { Agent as APIAgent, ListResponse } from '@/types/openai-agents';

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
// Agent Mapping — API response to UI model
// ============================================================================

/**
 * Deterministic colour palette assigned by index so each agent gets a
 * visually distinct colour without requiring colour data from the API.
 */
const AGENT_PALETTE: { color: string; bgColor: string }[] = [
  { color: '#3b82f6', bgColor: '#dbeafe' },
  { color: '#ef4444', bgColor: '#fee2e2' },
  { color: '#8b5cf6', bgColor: '#ede9fe' },
  { color: '#f59e0b', bgColor: '#fef3c7' },
  { color: '#10b981', bgColor: '#d1fae5' },
  { color: '#06b6d4', bgColor: '#cffafe' },
  { color: '#ec4899', bgColor: '#fce7f3' },
  { color: '#f97316', bgColor: '#ffedd5' },
];

function mapAPIAgentToUI(apiAgent: APIAgent, index: number): Agent {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const palette = AGENT_PALETTE[index % AGENT_PALETTE.length]!;
  return {
    id: apiAgent.id,
    name: apiAgent.name ?? 'Unnamed Agent',
    role: apiAgent.metadata?.role ?? apiAgent.model,
    color: palette.color,
    bgColor: palette.bgColor,
    icon: <Bot size={20} style={{ color: palette.color }} />,
    status: 'active',
    description:
      apiAgent.description ??
      apiAgent.instructions?.slice(0, 120) ??
      'No description provided.',
  };
}

// ============================================================================
// Simulated Agent Responses (presentation-only fallback text)
// ============================================================================

const FALLBACK_RESPONSES = [
  'I understand. Let me help you with that.',
  'Great question. Let me think about the best approach.',
  'I can assist with that. Here is what I would suggest.',
  'Let me analyze this and provide a thoughtful response.',
];

function getAgentResponse(_agentId: string): string {
  return (
    FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)] ??
    'I understand. Let me help you with that.'
  );
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
  t,
}: {
  agent: Agent;
  isSelected: boolean;
  messageCount: number;
  onClick: () => void;
  t: ReturnType<typeof useTranslations>;
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
        <span className="text-xs text-gray-400 flex-shrink-0">{t('ai.agents.messageCount', { count: messageCount })}</span>
      )}
    </button>
  );
}

function MessageBubble({ message, t }: { message: Message; t: ReturnType<typeof useTranslations> }) {
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
          <span className="font-medium">{isUser ? t('ai.agents.youLabel') : message.agentName}</span>
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
  t,
}: {
  agent: Agent;
  messages: Message[];
  onSendMessage: (content: string) => void;
  t: ReturnType<typeof useTranslations>;
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
          <MessageBubble key={msg.id} message={msg} t={t} />
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
            placeholder={t('ai.agents.messagePlaceholder', { agentName: agent.name })}
            className="flex-1 px-3 py-2 rounded-lg resize-none text-sm border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 text-sm"
          >
            <Send size={14} />
            {t('ai.agents.sendButton')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function AIAgentsPage() {
  const t = useTranslations();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Map<string, Message[]>>(() => new Map());
  const [mobileAgentListOpen, setMobileAgentListOpen] = useState(false);
  const msgCounter = useRef(0);

  // Fetch agents from the API on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchAgents() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/agents/list');
        if (!response.ok) {
          throw new Error(`Failed to load agents (${response.status})`);
        }
        const body = (await response.json()) as ListResponse<APIAgent>;
        if (cancelled) return;

        const mapped = (body.data ?? []).map(mapAPIAgentToUI);
        setAgents(mapped);

        // Select the first agent if available
        if (mapped.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          setSelectedAgentId(mapped[0]!.id);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load agents');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchAgents();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? null;
  const currentMessages = selectedAgentId ? (conversations.get(selectedAgentId) || []) : [];

  const handleSendMessage = useCallback((agentId: string, content: string) => {
    const agent = agents.find((a) => a.id === agentId);
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
  }, [agents]);

  // --- Loading state ---
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Loading agents...</p>
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-red-600 max-w-md text-center">
          <AlertCircle className="h-8 w-8" />
          <p className="text-sm font-medium">{error}</p>
          <button
            onClick={() => globalThis.location.reload()}
            className="mt-2 px-4 py-2 text-sm rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // --- Empty state (no agents created yet) ---
  if (agents.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <DemoBanner />
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <Bot className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">{t('ai.agents.pageTitle')}</h1>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center py-24 text-gray-500">
            <Inbox className="h-12 w-12 mb-4 text-gray-300" />
            <p className="text-lg font-medium text-gray-700">No agents yet</p>
            <p className="text-sm mt-1">Create an agent via the API to get started.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <DemoBanner />
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Bot className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">{t('ai.agents.pageTitle')}</h1>
          </div>
          <p className="text-gray-600">
            Manage concurrent conversations with specialized AI agents. Select an agent to start a conversation.
          </p>
        </div>

        {/* Mobile agent selector toggle */}
        {selectedAgent && (
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
                {agents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    isSelected={agent.id === selectedAgentId}
                    messageCount={(conversations.get(agent.id) || []).length}
                    onClick={() => {
                      setSelectedAgentId(agent.id);
                      setMobileAgentListOpen(false);
                    }}
                    t={t}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Main workspace */}
        <div className="flex flex-col md:flex-row gap-4" style={{ minHeight: 'calc(100vh - 220px)' }}>
          {/* Agent sidebar - desktop */}
          <div className="hidden md:block w-72 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 space-y-2 sticky top-6">
              <h2 className="text-sm font-semibold text-gray-700 px-1 mb-3">{t('ai.agents.agentsList')}</h2>
              {agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  isSelected={agent.id === selectedAgentId}
                  messageCount={(conversations.get(agent.id) || []).length}
                  onClick={() => setSelectedAgentId(agent.id)}
                  t={t}
                />
              ))}
            </div>
          </div>

          {/* Conversation panel */}
          <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden" style={{ minHeight: 500 }}>
            {selectedAgent && selectedAgentId ? (
              <ConversationPanel
                agent={selectedAgent}
                messages={currentMessages}
                onSendMessage={(content) => handleSendMessage(selectedAgentId, content)}
                t={t}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                Select an agent to start a conversation.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
