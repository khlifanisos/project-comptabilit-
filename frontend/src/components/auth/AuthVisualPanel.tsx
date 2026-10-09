import { Box, Typography } from '@mui/material'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import BarChartIcon from '@mui/icons-material/BarChart'
import FolderIcon from '@mui/icons-material/Folder'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'

const TILES = [
  { Icon: ReceiptLongIcon,       label: 'Factures & TVA',  color: '#3B82F6', float: 'float-y' },
  { Icon: AutoAwesomeIcon,       label: 'Audit IA',        color: '#8B5CF6', float: 'float-y-delay' },
  { Icon: ConfirmationNumberIcon,label: 'Tickets équipe',  color: '#F59E0B', float: 'float-y' },
  { Icon: AccountBalanceIcon,    label: 'Déclarations',    color: '#10B981', float: 'float-y-delay' },
  { Icon: BarChartIcon,          label: 'Rapports',        color: '#EF4444', float: 'float-y' },
  { Icon: FolderIcon,            label: 'Documents',       color: '#06B6D4', float: 'float-y-delay' },
]

interface Props {
  title?: string
  subtitle?: string
  /** CSS flex `order` — lets the page decide whether this panel sits before
   *  or after the form (e.g. form-first layouts pass `order={2}`). */
  order?: number
}

/** Shared visual panel for Login/Register — dark gradient backdrop, drifting
 *  glow blobs, and a staggered grid of floating feature tiles. Hidden below
 *  `md` so the form stays the whole story on phones. */
export default function AuthVisualPanel({
  title = 'Pilotez votre cabinet,\nsimplement.',
  subtitle = 'Factures, TVA, audit intelligent et équipe — tout au même endroit.',
  order,
}: Props) {
  return (
    <Box sx={{
      display: { xs: 'none', md: 'flex' },
      flexDirection: 'column',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      width: '46%',
      minWidth: 420,
      flexShrink: 0,
      order,
      px: 6,
      py: 6,
      background: 'linear-gradient(160deg,#0A1628 0%,#0F2847 55%,#153A63 100%)',
    }}>
      {/* Drifting glow blobs */}
      <Box className="drift-blob" sx={{
        position: 'absolute', top: -120, left: -100, width: 360, height: 360, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.22) 0%, transparent 70%)', pointerEvents: 'none',
      }} />
      <Box className="drift-blob" sx={{
        position: 'absolute', bottom: -140, right: -120, width: 420, height: 420, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.16) 0%, transparent 70%)', pointerEvents: 'none',
        animationDelay: '2.5s',
      }} />

      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Box className="reveal-up is-visible" sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 4 }}>
          <Box className="logo-pulse" sx={{
            width: 40, height: 40, borderRadius: '10px',
            background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <VerifiedUserIcon sx={{ color: 'white', fontSize: 20 }} />
          </Box>
          <Typography sx={{ color: 'white', fontWeight: 800, fontSize: 16, letterSpacing: '-0.01em' }}>
            Intelligence Comptabilité
          </Typography>
        </Box>

        <Typography className="reveal-up is-visible" style={{ animationDelay: '80ms' }} sx={{
          color: 'white', fontWeight: 800, fontSize: { md: 30, lg: 34 }, lineHeight: 1.2,
          letterSpacing: '-0.02em', mb: 2, whiteSpace: 'pre-line',
        }}>
          {title}
        </Typography>
        <Typography className="reveal-up is-visible" style={{ animationDelay: '160ms' }} sx={{
          color: 'rgba(255,255,255,0.55)', fontSize: 14.5, lineHeight: 1.6, maxWidth: 380, mb: 5,
        }}>
          {subtitle}
        </Typography>

        <Box className="reveal-up is-visible" style={{ animationDelay: '240ms' }}
          sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.6, maxWidth: 400 }}>
          {TILES.map((t, i) => (
            <Box key={t.label} className={t.float} style={{ animationDelay: `${i * 0.2}s` }} sx={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.8,
              py: 2.2, px: 1, borderRadius: '14px',
              bgcolor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(6px)',
              transition: 'transform 0.25s, background-color 0.25s',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.09)', transform: 'translateY(-3px)' },
            }}>
              <Box sx={{
                width: 34, height: 34, borderRadius: '9px',
                bgcolor: `${t.color}26`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <t.Icon sx={{ color: t.color, fontSize: 18 }} />
              </Box>
              <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: 10.5, fontWeight: 600, textAlign: 'center', lineHeight: 1.25 }}>
                {t.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}
