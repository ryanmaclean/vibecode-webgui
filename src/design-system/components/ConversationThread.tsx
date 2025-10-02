/**
 * Conversation Thread Component
 * Nested conversation threading for multi-agent interactions
 * WCAG 2.1 AA compliant with keyboard navigation
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, User, ChevronRight, Clock, Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { designTokens } from '../tokens';

export interface Message {
  id: string;
  agentId: string;
  agentName: string;
  agentColor: string;
  content: string;
  timestamp: Date;
  role: 'user' | 'assistant';
  status?: 'sending' | 'sent' | 'delivered' | 'error';
  replies?: Message[];
  parentId?: string;
}

export interface ConversationThreadProps {
  messages: Message[];
  currentUserId: string;
  onReply?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
  className?: string;
  maxNestingLevel?: number;
}

/**
 * Individual message bubble component
 */
function MessageBubble({
  message,
  isCurrentUser,
  nestingLevel = 0,
  maxNestingLevel = 3,
  onReply,
  onDelete,
}: {
  message: Message;
  isCurrentUser: boolean;
  nestingLevel?: number;
  maxNestingLevel?: number;
  onReply?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
}) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);

  const hasReplies = message.replies && message.replies.length > 0;
  const canNest = nestingLevel < maxNestingLevel;

  // Focus reply input when opened
  useEffect(() => {
    if (showReplyInput && replyInputRef.current) {
      replyInputRef.current.focus();
    }
  }, [showReplyInput]);

  const handleSubmitReply = () => {
    if (replyContent.trim() && onReply) {
      onReply(message.id, replyContent);
      setReplyContent('');
      setShowReplyInput(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmitReply();
    } else if (e.key === 'Escape') {
      setShowReplyInput(false);
    }
  };

  const statusIcon = {
    sending: <Clock size={12} className="text-neutral-400" />,
    sent: <Check size={12} className="text-neutral-400" />,
    delivered: <CheckCheck size={12} className="text-green-500" />,
    error: <span className="text-red-500 text-xs">!</span>,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        'group relative',
        nestingLevel > 0 && 'ml-8 border-l-2 pl-4',
      )}
      style={{
        borderLeftColor: nestingLevel > 0 ? message.agentColor : 'transparent',
      }}
    >
      {/* Message Container */}
      <div
        className={cn(
          'flex gap-3 mb-2',
          isCurrentUser ? 'flex-row-reverse' : 'flex-row'
        )}
      >
        {/* Avatar */}
        <div
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
            'ring-2 ring-white dark:ring-neutral-900'
          )}
          style={{ backgroundColor: message.agentColor }}
          aria-label={`${message.role === 'user' ? 'User' : message.agentName} avatar`}
        >
          {message.role === 'user' ? (
            <User size={16} className="text-white" />
          ) : (
            <Bot size={16} className="text-white" />
          )}
        </div>

        {/* Message Bubble */}
        <div
          className={cn(
            'flex flex-col gap-1 max-w-[85%] md:max-w-[70%]',
            isCurrentUser && 'items-end'
          )}
        >
          {/* Header */}
          <div
            className={cn(
              'flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400',
              isCurrentUser && 'flex-row-reverse'
            )}
          >
            <span className="font-medium">{message.agentName}</span>
            <span>
              {new Intl.DateTimeFormat('en-US', {
                hour: 'numeric',
                minute: 'numeric',
              }).format(message.timestamp)}
            </span>
            {message.status && statusIcon[message.status]}
          </div>

          {/* Content */}
          <div
            className={cn(
              'px-4 py-3 rounded-lg',
              'break-words whitespace-pre-wrap',
              isCurrentUser
                ? 'bg-primary-500 text-white rounded-tr-none'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-tl-none'
            )}
            role="article"
            aria-label={`Message from ${message.agentName}`}
          >
            {message.content}
          </div>

          {/* Actions */}
          <div
            className={cn(
              'flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity',
              isCurrentUser && 'flex-row-reverse'
            )}
          >
            {canNest && onReply && (
              <button
                onClick={() => setShowReplyInput(!showReplyInput)}
                className={cn(
                  'text-xs text-neutral-500 hover:text-primary-500',
                  'focus:outline-none focus:text-primary-500',
                  'px-2 py-1 rounded',
                  'min-h-[32px]' // Smaller than 44px but acceptable for secondary actions
                )}
                aria-label="Reply to this message"
              >
                Reply
              </button>
            )}
            {hasReplies && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={cn(
                  'text-xs text-neutral-500 hover:text-primary-500',
                  'focus:outline-none focus:text-primary-500',
                  'px-2 py-1 rounded flex items-center gap-1',
                  'min-h-[32px]'
                )}
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${message.replies?.length} replies`}
              >
                <ChevronRight
                  size={12}
                  className={cn(
                    'transition-transform',
                    isExpanded && 'rotate-90'
                  )}
                />
                {message.replies?.length} {message.replies?.length === 1 ? 'reply' : 'replies'}
              </button>
            )}
          </div>

          {/* Reply Input */}
          <AnimatePresence>
            {showReplyInput && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="w-full"
              >
                <div className="flex flex-col gap-2 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                  <textarea
                    ref={replyInputRef}
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your reply... (Ctrl+Enter to send)"
                    className={cn(
                      'w-full px-3 py-2 rounded-lg resize-none',
                      'bg-white dark:bg-neutral-900',
                      'border border-neutral-200 dark:border-neutral-700',
                      'focus:outline-none focus:ring-2 focus:ring-primary-500',
                      'text-sm'
                    )}
                    rows={2}
                    aria-label="Reply message input"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setShowReplyInput(false)}
                      className={cn(
                        'px-3 py-1.5 rounded text-sm',
                        'text-neutral-600 dark:text-neutral-400',
                        'hover:bg-neutral-200 dark:hover:bg-neutral-700',
                        'focus:outline-none focus:ring-2 focus:ring-primary-500',
                        'min-h-[36px]'
                      )}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitReply}
                      disabled={!replyContent.trim()}
                      className={cn(
                        'px-3 py-1.5 rounded text-sm',
                        'bg-primary-500 text-white',
                        'hover:bg-primary-600',
                        'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'min-h-[36px]'
                      )}
                    >
                      Send
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Nested Replies */}
      <AnimatePresence>
        {isExpanded && hasReplies && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2"
          >
            {message.replies?.map((reply) => (
              <MessageBubble
                key={reply.id}
                message={reply}
                isCurrentUser={reply.role === 'user'}
                nestingLevel={nestingLevel + 1}
                maxNestingLevel={maxNestingLevel}
                onReply={onReply}
                onDelete={onDelete}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Main ConversationThread component
 */
export function ConversationThread({
  messages,
  currentUserId,
  onReply,
  onDelete,
  className,
  maxNestingLevel = 3,
}: ConversationThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // Detect manual scrolling
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const isAtBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight < 100;
    setAutoScroll(isAtBottom);
  };

  // Build tree structure from flat message list
  const messageTree = React.useMemo(() => {
    const tree: Message[] = [];
    const messageMap = new Map<string, Message>();

    // First pass: create map
    messages.forEach((msg) => {
      messageMap.set(msg.id, { ...msg, replies: [] });
    });

    // Second pass: build tree
    messages.forEach((msg) => {
      const message = messageMap.get(msg.id)!;
      if (msg.parentId) {
        const parent = messageMap.get(msg.parentId);
        if (parent) {
          parent.replies = parent.replies || [];
          parent.replies.push(message);
        } else {
          tree.push(message);
        }
      } else {
        tree.push(message);
      }
    });

    return tree;
  }, [messages]);

  return (
    <div
      className={cn(
        'flex flex-col h-full overflow-y-auto',
        'scroll-smooth',
        className
      )}
      onScroll={handleScroll}
      role="log"
      aria-live="polite"
      aria-label="Conversation thread"
    >
      <div className="flex-1 p-4 space-y-4">
        <AnimatePresence initial={false}>
          {messageTree.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isCurrentUser={message.role === 'user'}
              nestingLevel={0}
              maxNestingLevel={maxNestingLevel}
              onReply={onReply}
              onDelete={onDelete}
            />
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom hint */}
      {!autoScroll && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          onClick={() => {
            setAutoScroll(true);
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
          className={cn(
            'fixed bottom-24 right-8',
            'px-4 py-2 rounded-full',
            'bg-primary-500 text-white',
            'shadow-lg hover:shadow-xl',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
            'transition-all duration-200',
            'min-h-[44px]'
          )}
          aria-label="Scroll to bottom of conversation"
        >
          New messages ↓
        </motion.button>
      )}
    </div>
  );
}
