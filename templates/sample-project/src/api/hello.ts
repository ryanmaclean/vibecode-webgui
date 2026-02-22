/**
 * Greeting API Module
 *
 * This module demonstrates how to write clean, well-documented TypeScript
 * code that works excellently with AI code completion.
 *
 * AI TIPS:
 * - Clear function names help AI understand intent
 * - Type annotations enable better AI suggestions
 * - JSDoc comments provide context for AI assistance
 */

/**
 * Creates a personalized greeting message
 *
 * @param name - The name of the person to greet
 * @returns A friendly greeting message
 *
 * @example
 * ```typescript
 * const greeting = createGreeting('Alice')
 * // Returns: "Hello, Alice! Welcome to VibeCode."
 * ```
 */
export function createGreeting(name: string): string {
  // TODO: Add support for different languages
  // TODO: Add time-based greetings (Good morning, Good evening)
  // TODO: Add emoji support 🎉

  return `Hello, ${name}! Welcome to VibeCode.`
}

/**
 * Creates a farewell message
 *
 * @param name - The name of the person to bid farewell
 * @returns A friendly farewell message
 *
 * AI CHALLENGE: Ask the AI to implement this function!
 */
export function createFarewell(name: string): string {
  // TODO: Implement farewell logic
  return `Goodbye, ${name}! Thanks for using VibeCode.`
}

/**
 * Validates if a name is appropriate for greeting
 *
 * @param name - The name to validate
 * @returns True if name is valid, false otherwise
 *
 * AI CHALLENGE: Ask the AI to add proper validation rules!
 */
export function isValidName(name: string): boolean {
  // TODO: Add validation logic
  // - Check if name is not empty
  // - Check if name contains only letters and spaces
  // - Check if name length is reasonable (2-50 characters)

  return name.length > 0
}

/**
 * Interface for greeting options
 *
 * AI TIP: Try asking "add more options to this interface"
 */
export interface GreetingOptions {
  name: string
  language?: 'en' | 'es' | 'fr' | 'de'
  formal?: boolean
  includeEmoji?: boolean
}

/**
 * Creates an advanced greeting with customization options
 *
 * @param options - Greeting customization options
 * @returns A customized greeting message
 *
 * AI CHALLENGE: Ask the AI to implement this function with all options!
 */
export function createAdvancedGreeting(options: GreetingOptions): string {
  // TODO: Implement advanced greeting logic
  // - Support multiple languages
  // - Support formal/informal tone
  // - Add emoji based on preference

  return createGreeting(options.name)
}
