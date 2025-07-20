// Mock utility functions
export function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ')
}