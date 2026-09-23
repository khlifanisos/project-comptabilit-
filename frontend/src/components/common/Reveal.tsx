import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import { useReveal } from '../../hooks/useReveal'

interface Props {
  children: ReactNode
  delay?: number
  /** Set false to skip the IntersectionObserver and always render revealed
   *  (e.g. content that's already above the fold at mount). */
  observe?: boolean
}

/** Fades + slides an element up once it enters the viewport (or immediately
 *  on mount when `observe` is false), for consistent scroll/mount reveal
 *  animations across the landing page and the app dashboards. */
export default function Reveal({ children, delay = 0, observe = true }: Props) {
  const { ref, visible } = useReveal()
  const shown = observe ? visible : true

  return (
    <Box ref={ref} className={`reveal-up${shown ? ' is-visible' : ''}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </Box>
  )
}
