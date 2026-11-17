import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, ButtonBase, Chip, Skeleton, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import ArrowForwardIcon   from '@mui/icons-material/ArrowForward'
import LibraryBooksIcon   from '@mui/icons-material/LibraryBooks'
import api from '../../api/axios'
import { CATEGORIES, DocumentFiscal } from './categories'
import DocumentSearch from './DocumentSearch'

/** Landing of the "Documentation fiscale" section: search and categories. */
export default function DocumentationHome() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Record<string, number> | null>(null)
  const [latestYear, setLatestYear] = useState<number | null>(null)

  useEffect(() => {
    api.get('/documents-fiscaux/stats')
      .then((r: { data: Record<string, number> | [] }) => setStats(Array.isArray(r.data) ? {} : r.data))
      .catch(() => setStats({}))
    // Most recent loi de finances (results are sorted by year, newest first)
    api.get('/documents-fiscaux', { params: { categorie: 'lois_finances', limit: 1 } })
      .then((r: { data: DocumentFiscal[] }) => setLatestYear(r.data[0]?.annee ?? null))
      .catch(() => {})
  }, [])

  const total = stats ? Object.values(stats).reduce((a, b) => a + Number(b), 0) : null

  return (
    <Box className="fade-in" sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 3, md: 4 } }}>
      {/* ── Hero ── */}
      <Box sx={{
        position: 'relative', overflow: 'hidden',
        borderRadius: 4, px: { xs: 2.5, sm: 4, md: 6 }, py: { xs: 4, md: 6 },
        color: 'white',
        background: 'linear-gradient(135deg, #0A1628 0%, #0D47A1 55%, #1565C0 100%)',
      }}>
        {/* Decorative shapes */}
        <Box aria-hidden sx={{
          position: 'absolute', right: -80, top: -80, width: 320, height: 320, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(96,165,250,0.35) 0%, rgba(96,165,250,0) 70%)',
        }} />
        <LibraryBooksIcon aria-hidden sx={{
          position: 'absolute', right: { xs: -20, md: 40 }, bottom: { xs: -20, md: -10 },
          fontSize: { xs: 140, md: 220 }, color: 'rgba(255,255,255,0.06)', transform: 'rotate(-12deg)',
        }} />

        <Box sx={{ position: 'relative', maxWidth: 720 }}>
          <Chip label="Bibliothèque fiscale" size="small" sx={{
            bgcolor: 'rgba(255,255,255,0.12)', color: 'white', fontWeight: 600, mb: 2,
            border: '1px solid rgba(255,255,255,0.18)',
          }} />
          <Typography component="h1" sx={{ fontSize: { xs: 26, md: 38 }, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            Documentation fiscale
          </Typography>
          <Typography sx={{ mt: 1.5, mb: 3.5, fontSize: { xs: 15, md: 17 }, color: 'rgba(255,255,255,0.78)', maxWidth: 560 }}>
            Lois de finances, notes communes, conventions et codes fiscaux, réunis au même endroit et consultables en un clic.
          </Typography>

          <DocumentSearch />

          <Box sx={{ display: 'flex', gap: { xs: 3, md: 5 }, mt: 4, flexWrap: 'wrap' }}>
            {[
              { value: total, label: 'documents' },
              { value: CATEGORIES.length, label: 'catégories' },
              { value: latestYear, label: 'dernière loi de finances' },
            ].map(s => (
              <Box key={s.label}>
                <Typography sx={{ fontSize: { xs: 22, md: 28 }, fontWeight: 800, lineHeight: 1 }}>
                  {s.value ?? <Skeleton width={48} sx={{ bgcolor: 'rgba(255,255,255,0.15)' }} />}
                </Typography>
                <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', mt: 0.5 }}>{s.label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* ── Categories (bento grid) ── */}
      <Box>
        <Typography component="h2" fontWeight={700} fontSize={18} mb={2}>Parcourir par type de document</Typography>
        <Box sx={{
          display: 'grid', gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
        }}>
          {CATEGORIES.map((cat, i) => {
            const count = stats?.[cat.key] ?? 0
            const featured = i === 0
            return (
              <ButtonBase key={cat.key}
                onClick={() => navigate(`/documentation/${cat.slug}`)}
                sx={{
                  gridColumn: featured ? { sm: 'span 2', lg: 'span 2' } : undefined,
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left',
                  p: { xs: 2.5, md: 3 }, gap: 1.5, minHeight: featured ? 190 : 170,
                  borderRadius: 3, bgcolor: 'background.paper',
                  border: '1px solid', borderColor: 'divider',
                  position: 'relative', overflow: 'hidden',
                  transition: 'transform .2s ease, box-shadow .2s ease, border-color .2s ease',
                  background: featured
                    ? (t) => `linear-gradient(135deg, ${alpha(cat.color, t.palette.mode === 'dark' ? 0.22 : 0.08)} 0%, ${t.palette.background.paper} 70%)`
                    : undefined,
                  '&:hover, &.Mui-focusVisible': {
                    transform: 'translateY(-3px)',
                    borderColor: alpha(cat.color, 0.45),
                    boxShadow: `0 14px 32px ${alpha(cat.color, 0.18)}`,
                  },
                  '&:hover .cat-arrow, &.Mui-focusVisible .cat-arrow': { transform: 'translateX(4px)', opacity: 1 },
                }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <Box sx={{
                    width: 48, height: 48, borderRadius: 2.5,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: alpha(cat.color, 0.12), color: cat.color,
                  }}>
                    <cat.Icon sx={{ fontSize: 26 }} />
                  </Box>
                  <Chip size="small"
                    label={stats === null ? '…' : count === 0 ? 'Bientôt' : `${count} doc${count > 1 ? 's' : ''}`}
                    sx={{ bgcolor: alpha(cat.color, 0.1), color: cat.color, fontWeight: 700 }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography fontWeight={700} fontSize={featured ? 20 : 16.5} color="text.primary" lineHeight={1.3}>
                    {cat.label}
                  </Typography>
                  <Typography fontSize={13.5} color="text.secondary" mt={0.7}>{cat.description}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: cat.color, fontWeight: 600, fontSize: 13.5 }}>
                  Consulter
                  <ArrowForwardIcon className="cat-arrow" sx={{ fontSize: 17, opacity: 0.7, transition: 'all .2s ease' }} />
                </Box>
              </ButtonBase>
            )
          })}
        </Box>
      </Box>
    </Box>
  )
}
