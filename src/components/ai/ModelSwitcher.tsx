/**
 * ModelSwitcher Component
 *
 * Quick access button and panel for switching between AI models.
 * Displays the current model in a button and opens a panel with all available models.
 * Supports keyboard shortcut (Cmd+M or Ctrl+M) for quick access.
 */

'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { ModelSwitcherPanel } from '@/components/ai/ModelSwitcherPanel'
import { useModelSwitcher } from '@/hooks/useModelSwitcher'
import { cn } from '@/lib/utils'
import { Sparkles, ChevronDown } from 'lucide-react'

interface ModelSwitcherProps {
  className?: string
}

const ModelSwitcher = React.memo(({ className }: ModelSwitcherProps) => {
  const {
    // Panel state
    isOpen,
    togglePanel,
    closePanel,

    // Model lists
    filteredModels,
    favoriteModels,
    recentModels,

    // Current selection
    selectedModel,

    // Search state
    searchQuery,
    setSearchQuery,

    // Model actions
    selectModel,
    toggleFavorite,
    isFavorite,
  } = useModelSwitcher({
    autoCloseOnSelect: true,
    enableKeyboardShortcuts: true,
  })

  // Get favorite and recent model IDs for the panel
  const favoriteModelIds = React.useMemo(
    () => favoriteModels.map((m) => m.id),
    [favoriteModels]
  )

  const recentModelIds = React.useMemo(
    () => recentModels.map((m) => m.id),
    [recentModels]
  )

  return (
    <div className={cn('flex items-center', className)} data-testid="model-switcher">
      {/* Trigger Button */}
      <Button
        variant="outline"
        size="default"
        onClick={togglePanel}
        className={cn(
          'gap-2 transition-all',
          isOpen && 'bg-accent'
        )}
        aria-label="Switch AI model"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Sparkles className="h-4 w-4" />
        <span className="font-medium truncate max-w-[200px]">
          {selectedModel?.name || 'Select Model'}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </Button>

      {/* Switcher Panel */}
      <ModelSwitcherPanel
        isOpen={isOpen}
        onClose={closePanel}
        selectedModelId={selectedModel?.id}
        onModelSelect={selectModel}
        models={filteredModels}
        favoriteModelIds={favoriteModelIds}
        recentModelIds={recentModelIds}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onFavoriteToggle={toggleFavorite}
      />
    </div>
  )
})

ModelSwitcher.displayName = 'ModelSwitcher'

export { ModelSwitcher }
