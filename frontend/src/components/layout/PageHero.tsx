import { useNavigate } from 'react-router-dom'
import { Box, ButtonBase, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

export const HEADER_H = 80

export interface Crumb { label: string; path?: string }

interface Props {
  title: React.ReactNode
  subtitle?: React.ReactNode
  eyebrow?: string
  icon?: React.ReactNode
  accent?: string
  crumbs?: Crumb[]
  /** Extra content under the title (search field, stats, buttons…). */
  children?: React.ReactNode
  /** Visual on the right side (desktop only). */
  aside?: React.ReactNode
  size?: 'md' | 'lg'
}

/** Full-width dark banner that sits under the transparent header, ending with a soft wave. */
export default function PageHero({ title, subtitle, eyebrow, icon, accent = '#3B82F6', crumbs, children, aside, size = 'md' }: Props) {
  const navigate = useNavigate()
  const theme = useTheme()
  const big = size === 'lg'

  return (
    <Box component="section" sx={{
      position: 'relative', overflow: 'hidden', color: 'white',
      pt: { xs: `${HEADER_H + 28}px`, md: `${HEADER_H + (big ? 64 : 44)}px` },
      pb: { xs: big ? 9 : 7, md: big ? 13 : 10 },
      background: `linear-gradient(135deg, #060E1E 0%, #0A1F44 45%, ${alpha(accent, 0.9)} 130%)`,
    }}>
      {/* Grid pattern fading out from the top */}
      <Box aria-hidden sx={{
        position: 'absolute', inset: 0, opacity: 0.5,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
        maskImage: 'radial-gradient(ellipse 80% 70% at 70% 20%, black 20%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 70% 20%, black 20%, transparent 75%)',
      }} />
      {/* Glow blobs */}
      <Box aria-hidden className="drift-blob" sx={{
        position: 'absolute', width: 520, height: 520, right: -140, top: -180, borderRadius: '50%',
        background: `radial-gradient(circle, ${alpha(accent, 0.55)} 0%, transparent 65%)`, filter: 'blur(10px)',
      }} />
      <Box aria-hidden className="drift-blob" sx={{
        position: 'absolute', width: 380, height: 380, left: -120, bottom: -200, borderRadius: '50%', animationDelay: '-4s',
        background: 'radial-gradient(circle, rgba(167,139,250,0.35) 0%, transparent 65%)',
      }} />
      {/* Big faded icon */}
      {icon && (
        <Box aria-hidden sx={{
          position: 'absolute', right: { xs: -30, md: '8%' }, bottom: { xs: 10, md: 30 },
          color: 'rgba(255,255,255,0.06)', transform: 'rotate(-10deg)',
          display: aside ? { xs: 'block', md: 'none' } : 'block',
          '& svg': { fontSize: { xs: 150, md: 240 } },
        }}>{icon}</Box>
      )}

      <Box sx={{
        position: 'relative', maxWidth: 1320, mx: 'auto', px: { xs: 2, md: 3 },
        display: 'grid', alignItems: 'center', gap: 4,
        gridTemplateColumns: { xs: '1fr', md: aside ? '1.15fr 1fr' : '1fr' },
      }}>
        <Box sx={{ maxWidth: 760 }}>
          {crumbs && crumbs.length > 0 && (
            <Box className="hero-rise" component="nav" aria-label="Fil d'Ariane"
              sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.3, mb: 2.5 }}>
              {crumbs.map((c, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                  {i > 0 && <ChevronRightIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.35)' }} />}
                  {c.path ? (
                    <ButtonBase onClick={() => navigate(c.path!)} disableRipple sx={{
                      fontFamily: 'inherit', fontSize: 13, color: 'rgba(255,255,255,0.6)', '&:hover': { color: 'white' },
                    }}>{c.label}</ButtonBase>
                  ) : (
                    <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{c.label}</Typography>
                  )}
                </Box>
              ))}
            </Box>
          )}

          {eyebrow && (
            <Box className="hero-rise" sx={{
              display: 'inline-flex', alignItems: 'center', gap: 1, mb: 2, px: 1.5, py: 0.6, borderRadius: 99,
              bgcolor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', backdropFilter: 'blur(8px)',
              animationDelay: '60ms',
            }}>
              <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: accent, boxShadow: `0 0 0 4px ${alpha(accent, 0.3)}` }} />
              <Typography sx={{ fontSize: 12.5, fontWeight: 600, letterSpacing: '0.04em' }}>{eyebrow}</Typography>
            </Box>
          )}

          <Typography component="h1" className="hero-rise" sx={{
            fontSize: big ? { xs: 32, sm: 40, md: 54 } : { xs: 28, sm: 34, md: 44 },
            fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.08, animationDelay: '120ms',
          }}>
            {title}
          </Typography>

          {subtitle && (
            <Typography className="hero-rise" sx={{
              mt: 2, fontSize: { xs: 15.5, md: 18 }, lineHeight: 1.6, color: 'rgba(255,255,255,0.72)', maxWidth: 620,
              animationDelay: '200ms',
            }}>
              {subtitle}
            </Typography>
          )}

          {children && <Box className="hero-rise" sx={{ mt: 4, animationDelay: '280ms' }}>{children}</Box>}
        </Box>

        {aside && <Box className="hero-rise" sx={{ display: { xs: 'none', md: 'block' }, animationDelay: '300ms' }}>{aside}</Box>}
      </Box>

      {/* Wave into the page background */}
      <Box aria-hidden component="svg" viewBox="0 0 1440 80" preserveAspectRatio="none" sx={{
        position: 'absolute', left: 0, right: 0, bottom: -1, width: '100%', height: { xs: 36, md: 64 }, display: 'block',
      }}>
        <path d="M0,48 C240,88 480,8 720,32 C960,56 1200,80 1440,40 L1440,80 L0,80 Z" fill={theme.palette.background.default} />
      </Box>
    </Box>
  )
}
