import type { HTMLAttributes } from 'react'

type GlassElement = 'aside' | 'div' | 'footer' | 'header' | 'section'

interface GlassSurfaceProps extends HTMLAttributes<HTMLElement> {
  as?: GlassElement
  level?: 1 | 2 | 3
}

export function GlassSurface({
  as: Element = 'div',
  level = 1,
  className = '',
  children,
  ...props
}: GlassSurfaceProps) {
  const classes = `glass-surface glass-surface--${level} ${className}`.trim()

  return (
    <Element className={classes} {...props}>
      {children}
    </Element>
  )
}
