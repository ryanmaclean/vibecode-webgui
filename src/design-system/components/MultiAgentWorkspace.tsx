/**
 * Multi-Agent Workspace Component
 * Responsive layout for managing 6+ concurrent agent conversations
 * Mobile-first, accessible design
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Menu, X, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgentSelector, Agent } from './AgentSelector';
import { ConversationThread, Message } from './ConversationThread';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export interface MultiAgentWorkspaceProps {
  agents: Agent[];
  conversations: Map<string, Message[]>;
  onSendMessage: (agentId: string, content: string) => void;
  onReply: (agentId: string, messageId: string, content: string) => void;
  className?: string;
}

/**
 * Mobile Layout (< 768px)
 * Single conversation view with bottom sheet agent selector
 */
function MobileWorkspace({
  agents,
  selectedAgent,
  onSelectAgent,
  messages,
  onSendMessage,
  onReply,
}: {
  agents: Agent[];
  selectedAgent: Agent;
  onSelectAgent: (agent: Agent) => void;
  messages: Message[];
  onSendMessage: (content: string) => void;
  onReply: (messageId: string, content: string) => void;
}) {
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue);
      setInputValue('');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-neutral-900">
      {/* Header with agent selector trigger */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
        <button
          onClick={() => setShowAgentSelector(true)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg',
            'hover:bg-neutral-100 dark:hover:bg-neutral-800',
            'focus:outline-none focus:ring-2 focus:ring-primary-500',
            'min-h-[44px]'
          )}
          aria-label="Select agent"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: selectedAgent.bgColor }}
          >
            {selectedAgent.icon}
          </div>
          <div className="text-left">
            <div className="font-semibold text-sm">{selectedAgent.name}</div>
            <div className="text-xs text-neutral-500">{selectedAgent.role}</div>
          </div>
        </button>
      </header>

      {/* Conversation area */}
      <ConversationThread
        messages={messages}
        currentUserId="current-user"
        onReply={onReply}
        className="flex-1"
      />

      {/* Input area */}
      <div className="p-4 border-t border-neutral-200 dark:border-neutral-700">
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
            placeholder={`Message ${selectedAgent.name}...`}
            className={cn(
              'flex-1 px-4 py-3 rounded-lg resize-none',
              'border border-neutral-200 dark:border-neutral-700',
              'bg-white dark:bg-neutral-900',
              'focus:outline-none focus:ring-2 focus:ring-primary-500',
              'min-h-[44px]'
            )}
            rows={1}
            aria-label="Message input"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className={cn(
              'px-6 py-3 rounded-lg',
              'bg-primary-500 text-white',
              'hover:bg-primary-600',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'min-w-[44px] min-h-[44px]'
            )}
            aria-label="Send message"
          >
            Send
          </button>
        </div>
      </div>

      {/* Bottom sheet agent selector */}
      <AnimatePresence>
        {showAgentSelector && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAgentSelector(false)}
              className="fixed inset-0 bg-black/50 z-[1300]"
              aria-hidden="true"
            />

            {/* Bottom sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className={cn(
                'fixed bottom-0 left-0 right-0',
                'bg-white dark:bg-neutral-900',
                'rounded-t-2xl',
                'max-h-[70vh] overflow-y-auto',
                'z-[1400]',
                'shadow-xl'
              )}
              role="dialog"
              aria-label="Select agent"
              aria-modal="true"
            >
              <div className="sticky top-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 px-4 py-3 flex items-center justify-between">
                <h2 className="font-semibold text-lg">Select Agent</h2>
                <button
                  onClick={() => setShowAgentSelector(false)}
                  className={cn(
                    'p-2 rounded-lg',
                    'hover:bg-neutral-100 dark:hover:bg-neutral-800',
                    'focus:outline-none focus:ring-2 focus:ring-primary-500',
                    'min-w-[44px] min-h-[44px]'
                  )}
                  aria-label="Close agent selector"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-4 space-y-2">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => {
                      onSelectAgent(agent);
                      setShowAgentSelector(false);
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 p-4 rounded-lg',
                      'border-2',
                      'transition-all duration-200',
                      'focus:outline-none focus:ring-2 focus:ring-primary-500',
                      'min-h-[64px]',
                      selectedAgent.id === agent.id
                        ? 'border-current bg-neutral-50 dark:bg-neutral-800'
                        : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    )}
                    style={{
                      borderColor: selectedAgent.id === agent.id ? agent.color : undefined,
                    }}
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: agent.bgColor }}
                    >
                      {agent.icon}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-semibold">{agent.name}</div>
                      <div className="text-sm text-neutral-500 dark:text-neutral-400">
                        {agent.role}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Tablet Layout (768px - 1024px)
 * Side-by-side panels with agent sidebar
 */
function TabletWorkspace({
  agents,
  selectedAgent,
  onSelectAgent,
  messages,
  onSendMessage,
  onReply,
}: {
  agents: Agent[];
  selectedAgent: Agent;
  onSelectAgent: (agent: Agent) => void;
  messages: Message[];
  onSendMessage: (content: string) => void;
  onReply: (messageId: string, content: string) => void;
}) {
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue);
      setInputValue('');
    }
  };

  return (
    <PanelGroup direction="horizontal" className="h-screen">
      {/* Agent sidebar */}
      <Panel defaultSize={20} minSize={15} maxSize={30}>
        <div className="h-full bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-700">
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
            <h2 className="font-semibold text-lg">Agents</h2>
          </div>
          <nav className="p-2">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => onSelectAgent(agent)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-lg mb-2',
                  'transition-all duration-200',
                  'hover:bg-neutral-100 dark:hover:bg-neutral-800',
                  'focus:outline-none focus:ring-2 focus:ring-primary-500',
                  'min-h-[56px]',
                  selectedAgent.id === agent.id &&
                    'bg-neutral-100 dark:bg-neutral-800 ring-2 ring-inset'
                )}
                style={{
                  ringColor: selectedAgent.id === agent.id ? agent.color : undefined,
                }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: agent.bgColor }}
                >
                  {agent.icon}
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium text-sm">{agent.name}</div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    {agent.role}
                  </div>
                </div>
              </button>
            ))}
          </nav>
        </div>
      </Panel>

      <PanelResizeHandle className="w-1 bg-neutral-200 dark:bg-neutral-700 hover:bg-primary-500 transition-colors" />

      {/* Conversation panel */}
      <Panel defaultSize={80}>
        <div className="flex flex-col h-full">
          <ConversationThread
            messages={messages}
            currentUserId="current-user"
            onReply={onReply}
            className="flex-1"
          />

          <div className="p-4 border-t border-neutral-200 dark:border-neutral-700">
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
                placeholder={`Message ${selectedAgent.name}...`}
                className={cn(
                  'flex-1 px-4 py-3 rounded-lg resize-none',
                  'border border-neutral-200 dark:border-neutral-700',
                  'bg-white dark:bg-neutral-900',
                  'focus:outline-none focus:ring-2 focus:ring-primary-500',
                  'min-h-[44px]'
                )}
                rows={2}
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className={cn(
                  'px-6 py-3 rounded-lg',
                  'bg-primary-500 text-white',
                  'hover:bg-primary-600',
                  'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'min-w-[44px]'
                )}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </Panel>
    </PanelGroup>
  );
}

/**
 * Desktop Layout (>= 1024px)
 * Full multi-agent workspace with split panels
 */
function DesktopWorkspace({
  agents,
  conversations,
  onSendMessage,
  onReply,
}: {
  agents: Agent[];
  conversations: Map<string, Message[]>;
  onSendMessage: (agentId: string, content: string) => void;
  onReply: (agentId: string, messageId: string, content: string) => void;
}) {
  const [activeAgents, setActiveAgents] = useState<Agent[]>([agents[0]]);
  const [inputValues, setInputValues] = useState<Map<string, string>>(new Map());

  const addAgent = (agent: Agent) => {
    if (!activeAgents.find((a) => a.id === agent.id)) {
      setActiveAgents([...activeAgents, agent]);
    }
  };

  const removeAgent = (agentId: string) => {
    setActiveAgents(activeAgents.filter((a) => a.id !== agentId));
  };

  const handleSend = (agentId: string) => {
    const value = inputValues.get(agentId);
    if (value?.trim()) {
      onSendMessage(agentId, value);
      setInputValues(new Map(inputValues.set(agentId, '')));
    }
  };

  return (
    <div className="flex h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Agent selector sidebar */}
      <div className="w-20 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-700 flex flex-col items-center py-4 gap-2">
        {agents.map((agent) => {
          const isActive = activeAgents.find((a) => a.id === agent.id);
          return (
            <button
              key={agent.id}
              onClick={() => isActive ? removeAgent(agent.id) : addAgent(agent)}
              className={cn(
                'w-12 h-12 rounded-lg flex items-center justify-center',
                'transition-all duration-200',
                'hover:scale-110',
                'focus:outline-none focus:ring-2 focus:ring-primary-500',
                isActive && 'ring-2'
              )}
              style={{
                backgroundColor: agent.bgColor,
                ringColor: isActive ? agent.color : undefined,
              }}
              title={agent.name}
              aria-label={`${isActive ? 'Remove' : 'Add'} ${agent.name}`}
            >
              {agent.icon}
            </button>
          );
        })}
      </div>

      {/* Multi-panel workspace */}
      <div className="flex-1 p-4">
        <div
          className={cn(
            'grid gap-4 h-full',
            activeAgents.length === 1 && 'grid-cols-1',
            activeAgents.length === 2 && 'grid-cols-2',
            activeAgents.length >= 3 && 'grid-cols-2 grid-rows-2'
          )}
        >
          {activeAgents.map((agent) => (
            <div
              key={agent.id}
              className="flex flex-col bg-white dark:bg-neutral-900 rounded-lg shadow-lg overflow-hidden"
              style={{ borderTop: `3px solid ${agent.color}` }}
            >
              {/* Agent header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: agent.bgColor }}
                  >
                    {agent.icon}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{agent.name}</div>
                    <div className="text-xs text-neutral-500">{agent.role}</div>
                  </div>
                </div>
                {activeAgents.length > 1 && (
                  <button
                    onClick={() => removeAgent(agent.id)}
                    className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded"
                    aria-label={`Close ${agent.name} conversation`}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Conversation */}
              <ConversationThread
                messages={conversations.get(agent.id) || []}
                currentUserId="current-user"
                onReply={(messageId, content) => onReply(agent.id, messageId, content)}
                className="flex-1"
              />

              {/* Input */}
              <div className="p-3 border-t border-neutral-200 dark:border-neutral-700">
                <div className="flex gap-2">
                  <textarea
                    value={inputValues.get(agent.id) || ''}
                    onChange={(e) =>
                      setInputValues(new Map(inputValues.set(agent.id, e.target.value)))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend(agent.id);
                      }
                    }}
                    placeholder={`Message ${agent.name}...`}
                    className={cn(
                      'flex-1 px-3 py-2 rounded-lg resize-none text-sm',
                      'border border-neutral-200 dark:border-neutral-700',
                      'focus:outline-none focus:ring-2 focus:ring-primary-500'
                    )}
                    rows={1}
                  />
                  <button
                    onClick={() => handleSend(agent.id)}
                    disabled={!(inputValues.get(agent.id)?.trim())}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm',
                      'bg-primary-500 text-white',
                      'hover:bg-primary-600',
                      'focus:outline-none focus:ring-2 focus:ring-primary-500',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Main MultiAgentWorkspace component
 * Automatically selects layout based on viewport size
 */
export function MultiAgentWorkspace({
  agents,
  conversations,
  onSendMessage,
  onReply,
  className,
}: MultiAgentWorkspaceProps) {
  const [selectedAgent, setSelectedAgent] = useState<Agent>(agents[0]);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const currentMessages = conversations.get(selectedAgent.id) || [];

  if (isMobile) {
    return (
      <MobileWorkspace
        agents={agents}
        selectedAgent={selectedAgent}
        onSelectAgent={setSelectedAgent}
        messages={currentMessages}
        onSendMessage={(content) => onSendMessage(selectedAgent.id, content)}
        onReply={(messageId, content) => onReply(selectedAgent.id, messageId, content)}
      />
    );
  }

  if (isTablet) {
    return (
      <TabletWorkspace
        agents={agents}
        selectedAgent={selectedAgent}
        onSelectAgent={setSelectedAgent}
        messages={currentMessages}
        onSendMessage={(content) => onSendMessage(selectedAgent.id, content)}
        onReply={(messageId, content) => onReply(selectedAgent.id, messageId, content)}
      />
    );
  }

  return (
    <DesktopWorkspace
      agents={agents}
      conversations={conversations}
      onSendMessage={onSendMessage}
      onReply={onReply}
    />
  );
}
