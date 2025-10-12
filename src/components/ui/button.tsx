import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * Enhanced Button component with comprehensive ARIA support for WCAG 2.1 AA compliance.
 *
 * @example
 * // Basic button
 * <Button>Click me</Button>
 *
 * @example
 * // Button with accessible label (for icon-only buttons)
 * <Button aria-label="Close dialog" size="icon">
 *   <X className="h-4 w-4" />
 * </Button>
 *
 * @example
 * // Toggle button (pressed state)
 * <Button aria-pressed={isActive} onClick={() => setIsActive(!isActive)}>
 *   {isActive ? 'Active' : 'Inactive'}
 * </Button>
 *
 * @example
 * // Loading button
 * <Button loading disabled>
 *   Processing...
 * </Button>
 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /**
   * Loading state - sets aria-busy="true" and adds disabled state
   */
  loading?: boolean
  /**
   * Pressed state for toggle buttons - sets aria-pressed attribute
   */
  pressed?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, pressed, disabled, type = "button", ...props }, ref) => {
    const Comp = asChild ? Slot : "button"

    // Compute ARIA attributes
    const ariaProps = {
      "aria-busy": loading ? ("true" as const) : undefined,
      "aria-pressed": pressed !== undefined ? pressed : undefined,
      "aria-disabled": disabled ? ("true" as const) : undefined,
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        type={type}
        disabled={disabled || loading}
        {...ariaProps}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
