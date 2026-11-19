import { useNavigate } from 'react-router-dom'
import { Box, ButtonBase, Typography } from '@mui/material'
import { useAuth } from '../../contexts/AuthContext'
import { useThemeMode } from '../../contexts/ThemeModeContext'
import { NavLink, adminNav, clientNav } from './navigation'
import { Logo } from './SiteHeader'

/** Site-style footer: brand + one column per menu group. */
export default function SiteFooter() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { mode } = useThemeMode()
  const isAdmin = user?.role === 'admin'
  const entries = isAdmin ? adminNav : clientNav

  // Direct links go into an "Accès rapide" column, dropdowns keep their own column
  const quick: NavLink[] = entries.flatMap(e => (e.children ? [] : [e]))
  const columns = [
    ...(quick.length ? [{ label: 'Accès rapide', links: quick }] : []),
    ...entries.flatMap(e => (e.children ? [{ label: e.label, links: e.children }] : [])),
  ]

  return (
    <Box component="footer" sx={{ bgcolor: mode === 'dark' ? '#070C16' : '#0A1628', color: 'white', mt: { xs: 4, md: 6 } }}>
      <Box sx={{
        maxWidth: 1320, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 4, md: 6 },
        display: 'grid', gap: { xs: 3.5, md: 4 },
        gridTemplateColumns: { xs: '1fr 1fr', md: `1.4fr repeat(${columns.length}, 1fr)` },
      }}>
        <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' }, maxWidth: 320 }}>
          <Logo light />
          <Typography sx={{ mt: 2, fontSize: 13.5, lineHeight: 1.7, color: 'rgba(255,255,255,0.6)' }}>
            Votre cabinet comptable en ligne : comptabilité, déclarations, audit et documentation fiscale au même endroit.
          </Typography>
        </Box>

        {columns.map(col => (
          <Box key={col.label}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', mb: 1.5 }}>
              {col.label}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start' }}>
              {col.links.map(l => (
                <ButtonBase key={l.path} onClick={() => navigate(l.path)} disableRipple
                  sx={{ fontFamily: 'inherit', fontSize: 14, color: 'rgba(255,255,255,0.78)', textAlign: 'left',
                    '&:hover': { color: 'white', textDecoration: 'underline' } }}>
                  {l.label}
                </ButtonBase>
              ))}
            </Box>
          </Box>
        ))}
      </Box>

      <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <Box sx={{
          maxWidth: 1320, mx: 'auto', px: { xs: 2, md: 3 }, py: 2.5,
          display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'space-between',
        }}>
          <Typography sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.45)' }}>
            © {new Date().getFullYear()} Intelligence Comptabilité. Tous droits réservés.
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.45)' }}>
            Données hébergées en toute sécurité
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
