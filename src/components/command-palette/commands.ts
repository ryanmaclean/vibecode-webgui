/**
 * Command Registry
 * Defines all available commands for the command palette
 */

'use client'

import {
  LayoutDashboard,
  Monitor,
  Camera,
  MessageSquare,
  Cpu,
  DollarSign,
  BookOpen,
  HeartPulse,
  Activity,
  Settings,
  Bot,
  FlaskConical,
  Layers,
  GraduationCap,
} from 'lucide-react'
import type { Command } from './CommandPaletteProvider'

/**
 * Navigation commands
 * Based on the main navigation structure from AppNavigation.tsx
 */
export function createNavigationCommands(navigate: (path: string) => void): Command[] {
  return [
    // Main Dashboard
    {
      id: 'nav-dashboard',
      label: 'Go to Dashboard',
      category: 'Navigation',
      keywords: ['home', 'overview', 'main'],
      icon: LayoutDashboard,
      shortcut: 'Cmd+Shift+H',
      action: () => navigate('/'),
    },

    // VM Section
    {
      id: 'nav-vm-dashboard',
      label: 'Go to VM Dashboard',
      category: 'Navigation',
      keywords: ['virtual', 'machine', 'vm', 'compute'],
      icon: Monitor,
      shortcut: 'Cmd+Shift+V',
      action: () => navigate('/vm'),
    },
    {
      id: 'nav-vm-snapshots',
      label: 'Go to VM Snapshots',
      category: 'Navigation',
      keywords: ['snapshot', 'backup', 'vm', 'virtual', 'machine'],
      icon: Camera,
      action: () => navigate('/vm/snapshots'),
    },

    // AI Section
    {
      id: 'nav-ai-chat',
      label: 'Go to AI Chat',
      category: 'Navigation',
      keywords: ['ai', 'chat', 'assistant', 'conversation', 'message'],
      icon: MessageSquare,
      shortcut: 'Cmd+Shift+C',
      action: () => navigate('/chat'),
    },
    {
      id: 'nav-ai-models',
      label: 'Go to AI Models',
      category: 'Navigation',
      keywords: ['ai', 'models', 'llm', 'language', 'ml'],
      icon: Cpu,
      action: () => navigate('/ai/models'),
    },
    {
      id: 'nav-ai-costs',
      label: 'Go to AI Costs',
      category: 'Navigation',
      keywords: ['ai', 'costs', 'pricing', 'billing', 'usage'],
      icon: DollarSign,
      action: () => navigate('/ai/costs'),
    },
    {
      id: 'nav-ai-prompts',
      label: 'Go to AI Prompts',
      category: 'Navigation',
      keywords: ['ai', 'prompts', 'templates', 'library'],
      icon: BookOpen,
      action: () => navigate('/ai/prompts'),
    },

    // Health
    {
      id: 'nav-health',
      label: 'Go to Health',
      category: 'Navigation',
      keywords: ['health', 'status', 'uptime', 'diagnostics'],
      icon: HeartPulse,
      action: () => navigate('/health'),
    },

    // Monitoring
    {
      id: 'nav-monitoring',
      label: 'Go to Monitoring',
      category: 'Navigation',
      keywords: ['monitoring', 'metrics', 'performance', 'stats', 'analytics'],
      icon: Activity,
      shortcut: 'Cmd+Shift+M',
      action: () => navigate('/monitoring'),
    },

    // Workspaces
    {
      id: 'nav-workspaces',
      label: 'Go to Workspaces',
      category: 'Navigation',
      keywords: ['workspaces', 'projects', 'environments'],
      icon: Layers,
      shortcut: 'Cmd+Shift+W',
      action: () => navigate('/workspaces'),
    },

    // Experiments
    {
      id: 'nav-experiments',
      label: 'Go to Experiments',
      category: 'Navigation',
      keywords: ['experiments', 'testing', 'features', 'beta'],
      icon: FlaskConical,
      action: () => navigate('/experiments'),
    },

    // Tutorials
    {
      id: 'nav-tutorials',
      label: 'Go to Tutorials',
      category: 'Navigation',
      keywords: ['tutorials', 'help', 'learning', 'guide', 'documentation'],
      icon: GraduationCap,
      action: () => navigate('/tutorials'),
    },

    // Settings
    {
      id: 'nav-settings',
      label: 'Go to Settings',
      category: 'Navigation',
      keywords: ['settings', 'preferences', 'config', 'configuration'],
      icon: Settings,
      shortcut: 'Cmd+,',
      action: () => navigate('/settings'),
    },
  ]
}

/**
 * Get all commands
 * This will be expanded in future subtasks to include AI tools, VM management, etc.
 */
export function getAllCommands(navigate: (path: string) => void): Command[] {
  return [
    ...createNavigationCommands(navigate),
    // More command categories will be added in subsequent subtasks
  ]
}
