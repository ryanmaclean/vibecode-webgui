import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Enhanced Input component with comprehensive ARIA support for WCAG 2.1 AA compliance.
 *
 * @example
 * // Basic input with label
 * <Label htmlFor="email">Email</Label>
 * <Input id="email" type="email" required aria-label="Email address" />
 *
 * @example
 * // Input with error state
 * <Input
 *   id="username"
 *   error="Username is required"
 *   required
 * />
 * {error && <span id="username-error" className="text-red-500">{error}</span>}
 *
 * @example
 * // Input with help text
 * <Input
 *   id="password"
 *   type="password"
 *   aria-describedby="password-help"
 * />
 * <span id="password-help">Must be at least 8 characters</span>
 *
 * @example
 * // Input with custom ARIA label
 * <Input
 *   aria-label="Search products"
 *   aria-labelledby="search-label"
 *   placeholder="Search..."
 * />
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Error message - automatically sets aria-invalid="true" and aria-describedby
   */
  error?: string
  /**
   * Custom error message element ID for aria-describedby
   */
  errorId?: string
  /**
   * Help text element ID for aria-describedby (combined with error if present)
   */
  helpTextId?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, errorId, helpTextId, required, ...props }, ref) => {
    // Generate error ID if error exists but no custom ID provided
    const generatedErrorId = errorId || (error ? `${props.id}-error` : undefined)

    // Combine aria-describedby values (help text + error + custom)
    const describedByValues = [
      helpTextId,
      error && generatedErrorId,
      props["aria-describedby"]
    ].filter(Boolean).join(" ") || undefined

    // Compute ARIA attributes
    const ariaProps = {
      "aria-invalid": error ? ("true" as const) : (props["aria-invalid"] as "true" | "false" | undefined) || ("false" as const),
      "aria-describedby": describedByValues,
      "aria-required": required ? ("true" as const) : props["aria-required"],
    }

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-red-500 focus-visible:ring-red-500",
          className
        )}
        required={required}
        ref={ref}
        {...ariaProps}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
