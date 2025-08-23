import * as React from 'react'

export type AvatarProps = React.HTMLAttributes<HTMLDivElement>

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className = '', ...props }, ref) => (
    <div
      ref={ref}
      className={`relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full ${className}`}
      {...props}
    />
  )
)
Avatar.displayName = 'Avatar'

export type AvatarImageProps = React.ImgHTMLAttributes<HTMLImageElement>

export const AvatarImage = React.forwardRef<HTMLImageElement, AvatarImageProps>(
  ({ className = '', alt = '', ...props }, ref) => (
    <img
      ref={ref}
      alt={alt}
      className={`aspect-square h-full w-full ${className}`}
      {...props}
    />
  )
)
AvatarImage.displayName = 'AvatarImage'

export type AvatarFallbackProps = React.HTMLAttributes<HTMLSpanElement>

export const AvatarFallback = React.forwardRef<
  HTMLSpanElement,
  AvatarFallbackProps
>(({ className = '', children, ...props }, ref) => (
  <span
    ref={ref}
    className={`flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium ${className}`}
    {...props}
  >
    {children}
  </span>
))
AvatarFallback.displayName = 'AvatarFallback'
