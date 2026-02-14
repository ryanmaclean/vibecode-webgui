'use client'

import Link from 'next/link'
import {
  Brain,
  MessageSquare,
  Bot,
  Cpu,
  DollarSign,
  BookOpen,
  History,
  Plus,
  ArrowRight,
  Activity,
  Clock,
  Zap,
  TrendingUp,
} from 'lucide-react'

const overviewCards = [
  {
    title: 'Chat',
    icon: MessageSquare,
    stat: 'Active Conversations: 3',
    description: 'Start or continue AI conversations',
    href: '/ai/chat',
    gradient: 'from-blue-500 to-blue-700',
  },
  {
    title: 'Agents',
    icon: Bot,
    stat: '6 Agents Available',
    description: 'Multi-agent workspace',
    href: '/ai/agents',
    gradient: 'from-purple-500 to-purple-700',
  },
  {
    title: 'Models',
    icon: Cpu,
    stat: '340+ Models',
    description: 'Compare and select AI models',
    href: '/ai/models',
    gradient: 'from-indigo-500 to-indigo-700',
  },
  {
    title: 'Costs',
    icon: DollarSign,
    stat: 'Today: $2.47',
    description: 'Track AI usage costs',
    href: '/ai/costs',
    gradient: 'from-green-500 to-green-700',
  },
  {
    title: 'Prompts',
    icon: BookOpen,
    stat: '33 Templates',
    description: 'Browse prompt library',
    href: '/ai/prompts',
    gradient: 'from-amber-500 to-amber-700',
  },
  {
    title: 'History',
    icon: History,
    stat: '142 Conversations',
    description: 'View past conversations',
    href: '/ai/conversations',
    gradient: 'from-rose-500 to-rose-700',
  },
]

const recentActivity = [
  { text: 'Used Claude 3.5 Sonnet for code review', time: '2 min ago' },
  { text: 'Generated unit tests with GPT-4o', time: '15 min ago' },
  { text: 'Refactored auth module via multi-agent', time: '1 hour ago' },
  { text: 'Prompt template "API Design" saved', time: '3 hours ago' },
  { text: 'Cost alert: daily budget 60% used', time: '5 hours ago' },
]

const usageStats = [
  { label: 'Requests Today', value: '47', icon: Zap },
  { label: 'Avg Response Time', value: '1.2s', icon: Clock },
  { label: 'Top Model', value: 'Claude 3.5 Sonnet', icon: TrendingUp },
]

export default function AIPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-700 flex items-center justify-center">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">AI Dashboard</h1>
        </div>
        <p className="text-gray-600">
          Access 340+ AI models, manage agents, track costs, and browse prompt templates -- all from one place.
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {overviewCards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group bg-white rounded-lg border border-gray-200 p-5 shadow-sm transition-all hover:shadow-md hover:scale-[1.02]"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">{card.title}</h3>
              <p className="text-xs text-gray-500 mt-1">{card.description}</p>
              <p className="text-sm font-medium text-gray-700 mt-3">{card.stat}</p>
            </Link>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/ai/chat"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </Link>
          <Link
            href="/ai/models"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            <Cpu className="h-4 w-4" />
            Compare Models
          </Link>
          <Link
            href="/ai/prompts"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            <BookOpen className="h-4 w-4" />
            Browse Prompts
          </Link>
        </div>
      </div>

      {/* Usage Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {usageStats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4 text-gray-400" />
                <span className="text-xs text-gray-500">{stat.label}</span>
              </div>
              <p className="text-lg font-semibold text-gray-900">{stat.value}</p>
            </div>
          )
        })}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-4 w-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">Recent Activity</h2>
        </div>
        <div className="space-y-3">
          {recentActivity.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
            >
              <span className="text-sm text-gray-700">{item.text}</span>
              <span className="text-xs text-gray-400 whitespace-nowrap ml-4">{item.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
