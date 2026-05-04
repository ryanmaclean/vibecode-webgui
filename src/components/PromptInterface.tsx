'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

/**
 * AI Prompt Interface - Main workspace chat component
 */
export default function PromptInterface() {
  const t = useTranslations()
  const [input, setInput] = useState('')

  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex-1 overflow-y-auto space-y-4">
        <div className="text-center text-muted-foreground py-12">
          <p className="text-lg font-medium">{t('chat.aiWorkspaceTitle')}</p>
          <p className="text-sm mt-2">{t('chat.aiWorkspaceSubtitle')}</p>
        </div>
      </div>
      <div className="mt-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('chat.promptPlaceholder')}
            className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            disabled={!input.trim()}
          >
            {t('chat.sendButton')}
          </button>
        </div>
      </div>
    </div>
  )
}
