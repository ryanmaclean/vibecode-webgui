/**
 * Agent Dashboard Example
 *
 * Complete example demonstrating all three stores working together
 * with SSE integration, optimistic updates, and responsive design.
 *
 * @module stores/examples/AgentDashboard
 */

'use client';

import React, { useEffect, useState } from 'react';
import {
  useAgentStore,
  useConversationStore,
  useUIStore,
  selectActiveAgent,
  selectStats,
  selectMessages,
  selectTheme,
  selectPanel,
  useBreakpointDetector,
} from '@/stores';
import { logger } from '@/lib/logger';

// ============================================================================
// Agent Dashboard
// ============================================================================

export function AgentDashboard() {
  useBreakpointDetector(); // Initialize breakpoint detection

  const theme = useUIStore(selectTheme);
  const isMobile = useUIStore((state) => state.breakpoint === 'xs' || state.breakpoint === 'sm');

  return (
    <div className={`dashboard ${theme}`}>
      <Header />
      <div className={isMobile ? 'layout-mobile' : 'layout-desktop'}>
        <Sidebar />
        <MainContent />
        <ChatPanel />
      </div>
    </div>
  );
}

// ============================================================================
// Header Component
// ============================================================================

function Header() {
  const stats = useAgentStore(selectStats);
  const toggleTheme = useUIStore((state) => state.toggleTheme);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const openCommandPalette = useUIStore((state) => state.openCommandPalette);

  return (
    <header className="header">
      <button onClick={toggleSidebar} aria-label="Toggle sidebar">
        Menu
      </button>

      <h1>Agent Dashboard</h1>

      <div className="stats">
        <span>Running: {stats.running}</span>
        <span>Completed: {stats.completed}</span>
        <span>Failed: {stats.failed}</span>
      </div>

      <div className="actions">
        <button onClick={openCommandPalette} aria-label="Open command palette">
          Ctrl+K
        </button>
        <button onClick={toggleTheme} aria-label="Toggle theme">
          Theme
        </button>
      </div>
    </header>
  );
}

// ============================================================================
// Sidebar Component
// ============================================================================

function Sidebar() {
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const sessions = useAgentStore((state) => Array.from(state.sessions.values()));
  const activeAgentId = useAgentStore((state) => state.activeAgentId);
  const setActiveAgent = useAgentStore((state) => state.setActiveAgent);

  if (sidebarCollapsed) {
    return null;
  }

  return (
    <aside className="sidebar">
      <h2>Agents</h2>

      <AgentControls />

      <div className="agent-list">
        {sessions.map((session) => (
          <button
            key={session.agent_id}
            className={`agent-item ${activeAgentId === session.agent_id ? 'active' : ''}`}
            onClick={() => setActiveAgent(session.agent_id)}
          >
            <span className={`status-indicator ${session.status}`} />
            <div className="agent-info">
              <div className="agent-name">{session.agent_type}</div>
              <div className="agent-task">{session.task}</div>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}

// ============================================================================
// Agent Controls
// ============================================================================

function AgentControls() {
  const startAgent = useAgentStore((state) => state.startAgent);
  const [isStarting, setIsStarting] = useState(false);

  const handleStartAgent = async () => {
    setIsStarting(true);
    try {
      await startAgent({
        agent_type: 'aider',
        workspace: '/home/coder/workspace',
        model: 'claude-3-5-sonnet-20241022',
        task: 'Implement new feature',
      });
    } catch (error) {
      logger.error('Failed to start agent:', error);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="agent-controls">
      <button onClick={handleStartAgent} disabled={isStarting}>
        {isStarting ? 'Starting...' : 'Start New Agent'}
      </button>
    </div>
  );
}

// ============================================================================
// Main Content
// ============================================================================

function MainContent() {
  const activeAgent = useAgentStore(selectActiveAgent);

  if (!activeAgent) {
    return (
      <main className="main-content">
        <div className="empty-state">
          <h2>No Active Agent</h2>
          <p>Start a new agent to begin</p>
        </div>
      </main>
    );
  }

  return (
    <main className="main-content">
      <AgentDetails agent={activeAgent} />
      <AgentTerminal agentId={activeAgent.agent_id} />
    </main>
  );
}

// ============================================================================
// Agent Details
// ============================================================================

function AgentDetails({ agent }: { agent: any }) {
  const stopAgent = useAgentStore((state) => state.stopAgent);
  const restartAgent = useAgentStore((state) => state.restartAgent);
  const [stopping, setStopping] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const handleStop = async () => {
    setStopping(true);
    try {
      await stopAgent(agent.agent_id);
    } catch (error) {
      logger.error('Failed to stop agent:', error);
    } finally {
      setStopping(false);
    }
  };

  const handleRestart = async () => {
    setRestarting(true);
    try {
      await restartAgent(agent.agent_id);
    } catch (error) {
      logger.error('Failed to restart agent:', error);
    } finally {
      setRestarting(false);
    }
  };

  return (
    <div className="agent-details">
      <div className="detail-header">
        <h2>{agent.agent_type}</h2>
        <span className={`status-badge ${agent.status}`}>{agent.status}</span>
      </div>

      <div className="detail-info">
        <div className="info-item">
          <label>Agent ID:</label>
          <span>{agent.agent_id}</span>
        </div>
        <div className="info-item">
          <label>Model:</label>
          <span>{agent.model}</span>
        </div>
        <div className="info-item">
          <label>Workspace:</label>
          <span>{agent.workspace}</span>
        </div>
        <div className="info-item">
          <label>Uptime:</label>
          <span>{agent.uptime_seconds}s</span>
        </div>
        {agent.progress !== undefined && (
          <div className="info-item">
            <label>Progress:</label>
            <progress value={agent.progress} max={1} />
          </div>
        )}
      </div>

      <div className="detail-actions">
        <button onClick={handleStop} disabled={stopping || agent.status !== 'running'}>
          {stopping ? 'Stopping...' : 'Stop'}
        </button>
        <button onClick={handleRestart} disabled={restarting}>
          {restarting ? 'Restarting...' : 'Restart'}
        </button>
      </div>

      {agent.sse_connected && (
        <div className="connection-status">
          <span className="connected-indicator">SSE Connected</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Agent Terminal (with SSE)
// ============================================================================

function AgentTerminal({ agentId }: { agentId: string }) {
  const handleSSEEvent = useAgentStore((state) => state.handleSSEEvent);
  const handleSSEConnect = useAgentStore((state) => state.handleSSEConnect);
  const handleSSEDisconnect = useAgentStore((state) => state.handleSSEDisconnect);
  const [output, setOutput] = useState<string[]>([]);

  useEffect(() => {
    const eventSource = new EventSource(`/api/agents/${agentId}/stream`);

    eventSource.onopen = () => {
      handleSSEConnect(agentId);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleSSEEvent(agentId, data);

        if (data.event === 'output') {
          setOutput((prev) => [...prev, data.data.line]);
        }
      } catch (error) {
        logger.error('Failed to parse SSE event:', error);
      }
    };

    eventSource.onerror = () => {
      handleSSEDisconnect(agentId);
    };

    return () => {
      eventSource.close();
    };
  }, [agentId, handleSSEEvent, handleSSEConnect, handleSSEDisconnect]);

  return (
    <div className="terminal">
      <div className="terminal-header">Terminal Output</div>
      <div className="terminal-content">
        {output.map((line, idx) => (
          <div key={idx} className="terminal-line">
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Chat Panel
// ============================================================================

function ChatPanel() {
  const chatPanel = useUIStore(selectPanel('chat'));
  const togglePanel = useUIStore((state) => state.togglePanel);
  const resizePanel = useUIStore((state) => state.resizePanel);
  const activeAgent = useAgentStore(selectActiveAgent);

  if (!chatPanel.visible || !activeAgent) {
    return null;
  }

  return (
    <aside
      className="chat-panel"
      style={{ width: chatPanel.width }}
      onMouseDown={(e) => {
        // Simple resize handler
        const startX = e.clientX;
        const startWidth = chatPanel.width || 400;

        const handleMouseMove = (e: MouseEvent) => {
          const deltaX = startX - e.clientX;
          resizePanel('chat', startWidth + deltaX);
        };

        const handleMouseUp = () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      }}
    >
      <div className="panel-header">
        <h3>Chat</h3>
        <button onClick={() => togglePanel('chat')}>Close</button>
      </div>

      <ChatMessages agentId={activeAgent.agent_id} />
      <ChatInput agentId={activeAgent.agent_id} />
    </aside>
  );
}

// ============================================================================
// Chat Messages
// ============================================================================

function ChatMessages({ agentId }: { agentId: string }) {
  const messages = useConversationStore(selectMessages(agentId));
  const pagination = useConversationStore((state) => state.pagination.get(agentId));
  const loadMore = useConversationStore((state) => state.loadMoreMessages);
  const loading = useConversationStore((state) => state.loading.fetching.has(agentId));

  return (
    <div className="chat-messages">
      {pagination?.hasMore && (
        <button onClick={() => loadMore(agentId)} disabled={loading}>
          {loading ? 'Loading...' : 'Load More'}
        </button>
      )}

      {messages.map((msg) => (
        <div key={msg.id} className={`message ${msg.role}`}>
          <div className="message-header">
            <span className="role">{msg.role}</span>
            <span className="timestamp">{new Date(msg.timestamp).toLocaleTimeString()}</span>
          </div>
          <div className="message-content">{msg.content}</div>
          {msg.status === 'error' && (
            <div className="message-error">{msg.error}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Chat Input
// ============================================================================

function ChatInput({ agentId }: { agentId: string }) {
  const [content, setContent] = useState('');
  const sendMessage = useConversationStore((state) => state.sendMessage);
  const sending = useConversationStore((state) => state.loading.sending.has(agentId));

  const handleSend = async () => {
    if (!content.trim()) return;

    try {
      await sendMessage(agentId, content);
      setContent('');
    } catch (error) {
      logger.error('Failed to send message:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-input">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        disabled={sending}
      />
      <button onClick={handleSend} disabled={sending || !content.trim()}>
        {sending ? 'Sending...' : 'Send'}
      </button>
    </div>
  );
}

// ============================================================================
// Export
// ============================================================================

export default AgentDashboard;
