'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
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
  Network,
} from 'lucide-react'

export default function AIPage(): React.JSX.Element {
  const t = useTranslations()
  const [recentActivity, setRecentActivity] = useState<Array<{ text: string; time: string }>>([])
  const [usageData, setUsageData] = useState({ requestsToday: '0', avgResponseTime: '0s', topModel: 'N/A' })

  useEffect(() => {
    fetch('/api/ai/dashboard')
      .then(res => res.ok ? res.json() : Promise.reject(res))
      .then(data => {
        if (data.recentActivity) setRecentActivity(data.recentActivity)
        if (data.usageStats) setUsageData(data.usageStats)
      })
      .catch(() => {})
  }, [])

  const overviewCards = [
    {
      title: t('ai.dashboard.cards.chat'),
      icon: MessageSquare,
      stat: t('ai.dashboard.cards.chatStat'),
      description: t('ai.dashboard.cards.chatDescription'),
      href: '/ai/chat',
      gradient: 'from-blue-500 to-blue-700',
    },
    {
      title: t('ai.dashboard.cards.agents'),
      icon: Bot,
      stat: t('ai.dashboard.cards.agentsStat'),
      description: t('ai.dashboard.cards.agentsDescription'),
      href: '/ai/agents',
      gradient: 'from-purple-500 to-purple-700',
    },
    {
      title: t('ai.dashboard.cards.models'),
      icon: Cpu,
      stat: t('ai.dashboard.cards.modelsStat'),
      description: t('ai.dashboard.cards.modelsDescription'),
      href: '/ai/models',
      gradient: 'from-indigo-500 to-indigo-700',
    },
    {
      title: t('ai.dashboard.cards.costs'),
      icon: DollarSign,
      stat: t('ai.dashboard.cards.costsStat'),
      description: t('ai.dashboard.cards.costsDescription'),
      href: '/ai/costs',
      gradient: 'from-green-500 to-green-700',
    },
    {
      title: t('ai.dashboard.cards.prompts'),
      icon: BookOpen,
      stat: t('ai.dashboard.cards.promptsStat'),
      description: t('ai.dashboard.cards.promptsDescription'),
      href: '/ai/prompts',
      gradient: 'from-amber-500 to-amber-700',
    },
    {
      title: t('ai.dashboard.cards.history'),
      icon: History,
      stat: t('ai.dashboard.cards.historyStat'),
      description: t('ai.dashboard.cards.historyDescription'),
      href: '/ai/conversations',
      gradient: 'from-rose-500 to-rose-700',
    },
    {
      title: t('ai.dashboard.cards.vectorExplorer'),
      icon: Network,
      stat: t('ai.dashboard.cards.vectorExplorerStat'),
      description: t('ai.dashboard.cards.vectorExplorerDescription'),
      href: '/ai/vector-explorer',
      gradient: 'from-teal-500 to-teal-700',
    },
  ]

  const usageStats = [
    { label: t('ai.dashboard.usageStats.requestsToday'), value: usageData.requestsToday, icon: Zap },
    { label: t('ai.dashboard.usageStats.avgResponseTime'), value: usageData.avgResponseTime, icon: Clock },
    { label: t('ai.dashboard.usageStats.topModel'), value: usageData.topModel, icon: TrendingUp },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-700 flex items-center justify-center">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('ai.dashboard.title')}</h1>
        </div>
        <p className="text-gray-600">
          {t('ai.dashboard.description')}
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
        <h2 className="text-sm font-semibold text-gray-900 mb-3">{t('ai.dashboard.quickActions')}</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/ai/chat"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            {t('ai.dashboard.newChat')}
          </Link>
          <Link
            href="/ai/models"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            <Cpu className="h-4 w-4" />
            {t('ai.dashboard.compareModels')}
          </Link>
          <Link
            href="/ai/prompts"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            <BookOpen className="h-4 w-4" />
            {t('ai.dashboard.browsePrompts')}
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
          <h2 className="text-sm font-semibold text-gray-900">{t('ai.dashboard.recentActivity')}</h2>
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
