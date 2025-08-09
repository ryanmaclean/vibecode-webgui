import * as React from 'react'

export interface SeparatorProps extends React.HTMLAttributes<HTMLHRElement> {
  orientation?: 'horizontal' | 'vertical'
}

export const Separator = React.forwardRef<HTMLHRElement, SeparatorProps>(
  ({ className = '', orientation = 'horizontal', ...props }, ref) => {
    const isVertical = orientation === 'vertical'
    return (
      <hr
        ref={ref}
        aria-orientation={orientation}
        className={
          `${className} border-0 ${isVertical ? 'h-full w-px' : 'w-full h-px'} bg-neutral-200 dark:bg-neutral-800`
        }
        {...props}
      />
    )
  }
)
Separator.displayName = 'Separator'
