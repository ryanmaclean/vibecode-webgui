/**
 * Mock AIChatInterface component for testing
 */

import React from 'react'

export interface AIChatInterfaceProps {
  workspaceId?: string
  projectId?: string
  onMessage?: (message: string) => void
  className?: string
}

const AIChatInterface: React.FC<AIChatInterfaceProps> = ({ 
  workspaceId, 
  projectId, 
  onMessage,
  className 
}) => {
  return (
    <div 
      className={className}
      data-testid="ai-chat-interface"
      data-workspace-id={workspaceId}
      data-project-id={projectId}
    >
      <div data-testid="chat-messages">Mock Chat Messages</div>
      <input 
        data-testid="chat-input"
        placeholder="Type your message..."
        onChange={(e) => onMessage?.(e.target.value)}
      />
      <button data-testid="send-button">Send</button>
    </div>
  )
}

export default AIChatInterface