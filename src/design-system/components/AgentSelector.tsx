/**
 * Agent Selector Component
 * Multi-agent switching interface with <3 clicks requirement
 * WCAG 2.1 AA compliant
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Bot, Check } from 'lucide-react';
import { designTokens, componentTokens } from '../tokens';
import { cn } from '@/lib/utils';

export interface Agent {
  id: string;
  name: string;
  role: string;
  color: string;
  bgColor: string;
  bgColorDark: string;
  icon?: React.ReactNode;
  status?: 'active' | 'idle' | 'busy';
}

export interface AgentSelectorProps {
  agents: Agent[];
  selectedAgent: Agent;
  onSelectAgent: (agent: Agent) => void;
  variant?: 'dropdown' | 'sidebar' | 'tabs';
  className?: string;
}

/**
 * Dropdown variant - Compact, accessible dropdown
 * Best for: Desktop, limited screen space
 */
export function AgentDropdown({
  agents,
  selectedAgent,
  onSelectAgent,
  className,
}: Omit<AgentSelectorProps, 'variant'>) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setIsOpen(!isOpen);
    }
  };

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex items-center gap-3 px-4 py-2 rounded-lg',
          'border-2 border-transparent',
          'transition-all duration-200',
          'hover:bg-neutral-100 dark:hover:bg-neutral-800',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
          'min-h-[44px]', // WCAG touch target
        )}
        style={{ borderColor: selectedAgent.color }}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Current agent: ${selectedAgent.name}. Click to switch agents.`}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: selectedAgent.bgColor }}
        >
          {selectedAgent.icon || <Bot size={20} style={{ color: selectedAgent.color }} />}
        </div>
        <div className="flex-1 text-left">
          <div className="font-semibold text-sm">{selectedAgent.name}</div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {selectedAgent.role}
          </div>
        </div>
        <ChevronDown
          size={20}
          className={cn(
            'transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute top-full left-0 right-0 mt-2',
              'bg-white dark:bg-neutral-900',
              'border border-neutral-200 dark:border-neutral-700',
              'rounded-lg shadow-lg',
              'z-dropdown',
              'overflow-hidden'
            )}
            role="listbox"
            aria-label="Select agent"
          >
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => {
                  onSelectAgent(agent);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3',
                  'hover:bg-neutral-50 dark:hover:bg-neutral-800',
                  'transition-colors duration-150',
                  'focus:outline-none focus:bg-neutral-100 dark:focus:bg-neutral-800',
                  'min-h-[44px]', // WCAG touch target
                  selectedAgent.id === agent.id && 'bg-neutral-50 dark:bg-neutral-800'
                )}
                role="option"
                aria-selected={selectedAgent.id === agent.id}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: agent.bgColor }}
                >
                  {agent.icon || <Bot size={20} style={{ color: agent.color }} />}
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-sm">{agent.name}</div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    {agent.role}
                  </div>
                </div>
                {selectedAgent.id === agent.id && (
                  <Check size={20} className="text-primary-500 flex-shrink-0" />
                )}
                {agent.status && (
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full flex-shrink-0',
                      agent.status === 'active' && 'bg-green-500',
                      agent.status === 'idle' && 'bg-neutral-400',
                      agent.status === 'busy' && 'bg-orange-500'
                    )}
                    aria-label={`Status: ${agent.status}`}
                  />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Tabs variant - Horizontal tab bar
 * Best for: Desktop, quick switching, visual scanning
 */
export function AgentTabs({
  agents,
  selectedAgent,
  onSelectAgent,
  className,
}: Omit<AgentSelectorProps, 'variant'>) {
  return (
    <div
      className={cn(
        'flex gap-2 overflow-x-auto',
        'border-b border-neutral-200 dark:border-neutral-700',
        className
      )}
      role="tablist"
      aria-label="Agent selection"
    >
      {agents.map((agent) => (
        <button
          key={agent.id}
          onClick={() => onSelectAgent(agent)}
          className={cn(
            'flex items-center gap-2 px-4 py-3',
            'border-b-2 border-transparent',
            'transition-all duration-200',
            'hover:bg-neutral-50 dark:hover:bg-neutral-800',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
            'min-h-[44px] whitespace-nowrap', // WCAG touch target
            selectedAgent.id === agent.id && 'border-b-2'
          )}
          style={{
            borderBottomColor: selectedAgent.id === agent.id ? agent.color : 'transparent',
          }}
          role="tab"
          aria-selected={selectedAgent.id === agent.id}
          aria-controls={`agent-panel-${agent.id}`}
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{ backgroundColor: agent.bgColor }}
          >
            {agent.icon || <Bot size={16} style={{ color: agent.color }} />}
          </div>
          <span className="font-medium text-sm">{agent.name}</span>
          {agent.status === 'busy' && (
            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * Sidebar variant - Vertical navigation
 * Best for: Desktop with space, detailed agent info
 */
export function AgentSidebar({
  agents,
  selectedAgent,
  onSelectAgent,
  className,
}: Omit<AgentSelectorProps, 'variant'>) {
  return (
    <nav
      className={cn(
        'flex flex-col gap-2 p-4',
        'bg-white dark:bg-neutral-900',
        'border-r border-neutral-200 dark:border-neutral-700',
        className
      )}
      role="navigation"
      aria-label="Agent selection"
    >
      {agents.map((agent) => (
        <button
          key={agent.id}
          onClick={() => onSelectAgent(agent)}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-lg',
            'transition-all duration-200',
            'hover:bg-neutral-50 dark:hover:bg-neutral-800',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
            'min-h-[44px]', // WCAG touch target
            selectedAgent.id === agent.id &&
              'bg-neutral-100 dark:bg-neutral-800 ring-2 ring-inset'
          )}
          style={{
            '--tw-ring-color': selectedAgent.id === agent.id ? agent.color : 'transparent',
          } as React.CSSProperties}
          aria-current={selectedAgent.id === agent.id ? 'page' : undefined}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: agent.bgColor }}
          >
            {agent.icon || <Bot size={24} style={{ color: agent.color }} />}
          </div>
          <div className="flex-1 text-left">
            <div className="font-semibold text-sm">{agent.name}</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              {agent.role}
            </div>
          </div>
          {agent.status && (
            <div
              className={cn(
                'w-3 h-3 rounded-full flex-shrink-0',
                agent.status === 'active' && 'bg-green-500',
                agent.status === 'idle' && 'bg-neutral-400',
                agent.status === 'busy' && 'bg-orange-500 animate-pulse'
              )}
              aria-label={`Status: ${agent.status}`}
            />
          )}
        </button>
      ))}
    </nav>
  );
}

/**
 * Main AgentSelector component
 * Auto-selects best variant based on viewport
 */
export function AgentSelector({
  agents,
  selectedAgent,
  onSelectAgent,
  variant = 'dropdown',
  className,
}: AgentSelectorProps) {
  const variants = {
    dropdown: AgentDropdown,
    tabs: AgentTabs,
    sidebar: AgentSidebar,
  };

  const Component = variants[variant];

  return (
    <Component
      agents={agents}
      selectedAgent={selectedAgent}
      onSelectAgent={onSelectAgent}
      className={className}
    />
  );
}
