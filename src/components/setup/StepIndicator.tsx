'use client'

import { cn } from '@/lib/utils'

interface StepIndicatorProps<T extends string> {
  steps: readonly T[]
  currentStep: T
  stepLabels: Record<T, string>
  className?: string
}

export function StepIndicator<T extends string>({
  steps,
  currentStep,
  stepLabels,
  className,
}: StepIndicatorProps<T>) {
  const safeIndex = Math.max(0, steps.indexOf(currentStep))
  const denominator = steps.length - 1
  const progressPercent =
    denominator > 0
      ? Math.max(0, Math.min(100, (safeIndex / denominator) * 100))
      : 0

  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 mb-3 text-center">
        {steps.map((step) => {
          const stepIndex = steps.indexOf(step)
          const isActive = stepIndex <= safeIndex

          return (
            <span
              key={step}
              className={cn(
                'text-xs transition-colors',
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                  : 'text-gray-400'
              )}
            >
              {stepLabels[step]}
            </span>
          )
        })}
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  )
}
