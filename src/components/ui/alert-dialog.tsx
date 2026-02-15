/**
 * AlertDialog Component
 * Simple confirmation dialog component
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// ============================================================================
// AlertDialog Context
// ============================================================================

interface AlertDialogContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const AlertDialogContext = React.createContext<AlertDialogContextValue | undefined>(undefined)

function useAlertDialog() {
  const context = React.useContext(AlertDialogContext)
  if (!context) {
    throw new Error('AlertDialog components must be used within AlertDialog')
  }
  return context
}

// ============================================================================
// AlertDialog Root
// ============================================================================

export interface AlertDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

export function AlertDialog({ open = false, onOpenChange, children }: AlertDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(open)

  const isOpen = onOpenChange !== undefined ? open : internalOpen
  const setOpen = onOpenChange !== undefined ? onOpenChange : setInternalOpen

  React.useEffect(() => {
    if (onOpenChange === undefined) {
      setInternalOpen(open)
    }
  }, [open, onOpenChange])

  return (
    <AlertDialogContext.Provider value={{ open: isOpen, onOpenChange: setOpen }}>
      {children}
    </AlertDialogContext.Provider>
  )
}

// ============================================================================
// AlertDialog Content
// ============================================================================

export interface AlertDialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export const AlertDialogContent = React.forwardRef<HTMLDivElement, AlertDialogContentProps>(
  ({ className, children, ...props }, ref) => {
    const { open, onOpenChange } = useAlertDialog()

    React.useEffect(() => {
      if (open) {
        document.body.style.overflow = 'hidden'
      } else {
        document.body.style.overflow = ''
      }

      return () => {
        document.body.style.overflow = ''
      }
    }, [open])

    if (!open) return null

    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-50 bg-black/80"
          onClick={() => onOpenChange(false)}
          aria-hidden="true"
        />

        {/* Dialog */}
        <div
          ref={ref}
          role="alertdialog"
          aria-modal="true"
          className={cn(
            'fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%]',
            'bg-background p-6 shadow-lg duration-200',
            'border rounded-lg',
            'sm:max-w-md',
            className
          )}
          {...props}
        >
          {children}
        </div>
      </>
    )
  }
)
AlertDialogContent.displayName = 'AlertDialogContent'

// ============================================================================
// AlertDialog Header
// ============================================================================

export const AlertDialogHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-2 text-center sm:text-left', className)}
    {...props}
  />
))
AlertDialogHeader.displayName = 'AlertDialogHeader'

// ============================================================================
// AlertDialog Footer
// ============================================================================

export const AlertDialogFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
    {...props}
  />
))
AlertDialogFooter.displayName = 'AlertDialogFooter'

// ============================================================================
// AlertDialog Title
// ============================================================================

export const AlertDialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn('text-lg font-semibold', className)}
    {...props}
  />
))
AlertDialogTitle.displayName = 'AlertDialogTitle'

// ============================================================================
// AlertDialog Description
// ============================================================================

export const AlertDialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))
AlertDialogDescription.displayName = 'AlertDialogDescription'

// ============================================================================
// AlertDialog Action
// ============================================================================

export interface AlertDialogActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const AlertDialogAction = React.forwardRef<HTMLButtonElement, AlertDialogActionProps>(
  ({ className, onClick, ...props }, ref) => {
    const { onOpenChange } = useAlertDialog()

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e)
      if (!e.defaultPrevented) {
        onOpenChange(false)
      }
    }

    return (
      <Button
        ref={ref}
        className={cn(className)}
        onClick={handleClick}
        {...props}
      />
    )
  }
)
AlertDialogAction.displayName = 'AlertDialogAction'

// ============================================================================
// AlertDialog Cancel
// ============================================================================

export interface AlertDialogCancelProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const AlertDialogCancel = React.forwardRef<HTMLButtonElement, AlertDialogCancelProps>(
  ({ className, onClick, ...props }, ref) => {
    const { onOpenChange } = useAlertDialog()

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e)
      if (!e.defaultPrevented) {
        onOpenChange(false)
      }
    }

    return (
      <Button
        ref={ref}
        variant="outline"
        className={cn('mt-2 sm:mt-0', className)}
        onClick={handleClick}
        {...props}
      />
    )
  }
)
AlertDialogCancel.displayName = 'AlertDialogCancel'
