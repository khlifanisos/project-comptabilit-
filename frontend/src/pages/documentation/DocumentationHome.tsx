import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, ButtonBase } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import api from '../../api/axios'
import { CATEGORIES } from './categories'

/** Landing of the "Documentation fiscale" section: one card per document type. */
export default function DocumentationHome() {
  const navigate = useNavigate()
  const theme = useTheme()
  const [stats, setStats] = useState<Record<string, number>>({})

  useEffect(() => {
    api.get('/documents-fiscaux/stats')
      .then((r: { data: Record<string, number> | [] }) => setStats(Array.isArray(r.data) ? {} : r.data))
      .catch(() => {})
  }, [])

  const primary = theme.palette.primary.main

  return (
    <Box className="fade-in" sx={{ position: 'relative', py: { xs: 0, md: 4 } }}>
      {/* Tinted band behind the grid (desktop), like a library header */}
      <Box sx={{
        display: { xs: 'none', md: 'block' },
        position: 'absolute', left: 0, right: { md: 24 }, top: 140, bottom: 0,
        bgcolor: alpha(primary, theme.palette.mode === 'dark' ? 0.12 : 0.07),
        borderRadius: 3,
      }} />

      <Box sx={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1.4fr' },
        gap: { xs: 3, md: 4 },
        alignItems: 'center',
        px: { md: 6 },
        pb: { md: 6 },
      }}>
        <Box sx={{ pt: { md: 16 } }}>
          <Typography sx={{ color: 'primary.main', fontWeight: 600, letterSpacing: 0.5, fontSize: { xs: 15, md: 20 }, textTransform: 'uppercase' }}>
            Documentation fiscale
          </Typography>
          <Typography sx={{ color: 'text.primary', fontSize: { xs: 20, md: 26 }, lineHeight: 1.45, mt: 0.5 }}>
            Consultez notre bibliothèque de documents fiscaux
          </Typography>
        </Box>

        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
          gap: { xs: 1.5, md: 2.5 },
        }}>
          {CATEGORIES.map(cat => {
            const count = stats[cat.key] ?? 0
            return (
              <ButtonBase
                key={cat.key}
                onClick={() => navigate(`/documentation/${cat.slug}`)}
                sx={{
                  flexDirection: 'column', gap: 2, p: 2,
                  aspectRatio: { sm: '1 / 1' }, minHeight: { xs: 150 },
                  bgcolor: 'background.paper',
                  border: '1px solid', borderColor: 'divider',
                  borderRadius: 2,
                  transition: 'box-shadow .2s ease, transform .2s ease, border-color .2s ease',
                  '&:hover, &.Mui-focusVisible': {
                    boxShadow: `0 12px 28px ${alpha(primary, 0.18)}`,
                    transform: 'translateY(-3px)',
                    borderColor: alpha(primary, 0.4),
                  },
                }}>
                <cat.Icon sx={{ fontSize: 40, color: 'primary.main' }} />
                <Typography sx={{ color: 'primary.main', fontWeight: 600, fontSize: { xs: 14, md: 16 }, textAlign: 'center', lineHeight: 1.35 }}>
                  {cat.label}
                </Typography>
                <Typography sx={{ color: 'text.secondary', fontSize: 12 }}>
                  {count === 0 ? 'Bientôt disponible' : `${count} document${count > 1 ? 's' : ''}`}
                </Typography>
              </ButtonBase>
            )
          })}
        </Box>
      </Box>
    </Box>
  )
}
