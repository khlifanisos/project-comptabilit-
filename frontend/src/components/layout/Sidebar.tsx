import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Box, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, Avatar, Divider, Drawer, useMediaQuery, useTheme, Chip,
} from '@mui/material'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import ReceiptIcon        from '@mui/icons-material/Receipt'
import ShoppingCartIcon   from '@mui/icons-material/ShoppingCart'
import GavelIcon          from '@mui/icons-material/Gavel'
import GroupsIcon         from '@mui/icons-material/Groups'
import CalendarTodayIcon  from '@mui/icons-material/CalendarToday'
import SettingsIcon       from '@mui/icons-material/Settings'
import PeopleIcon         from '@mui/icons-material/People'
import FolderIcon         from '@mui/icons-material/Folder'
import BarChartIcon       from '@mui/icons-material/BarChart'
import SecurityIcon       from '@mui/icons-material/Security'
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter'
import MenuBookIcon       from '@mui/icons-material/MenuBook'
import ForumIcon          from '@mui/icons-material/Forum'
import { useAuth }          from '../../contexts/AuthContext'
import { useProfilePhoto }  from '../../utils/useProfilePhoto'
import api                  from '../../api/axios'
import { onNotifyRefresh }  from '../../utils/notifyRefresh'

// Tentative 4-axes admin nav — flip to false to instantly revert to the old flat adminLinks list.
const USE_ADMIN_AXES = true

const SIDEBAR_W = 248
const NAV_BG         = '#0A1628'
const ITEM_ACTIVE_BG = 'rgba(96,165,250,0.12)'
const ITEM_HOVER_BG  = 'rgba(255,255,255,0.05)'
const ACCENT         = '#60A5FA'
const TEXT_MAIN      = 'rgba(255,255,255,0.90)'
const TEXT_MUTED     = 'rgba(255,255,255,0.45)'

const clientLinks = [
  // Tableau de bord hidden for now — route still exists at /dashboard, just not linked in nav.
  { label: 'Messagerie',            icon: <ForumIcon />,          path: '/messages' },
  { label: 'Relevés bancaires',     icon: <AccountBalanceIcon />, path: '/releves' },
  { label: 'Déclarations fiscales', icon: <GavelIcon />,          path: '/fiscales' },
  { label: "Factures d'achats",     icon: <ShoppingCartIcon />,   path: '/achats' },
  { label: 'Factures de ventes',    icon: <ReceiptIcon />,        path: '/ventes' },
  { label: 'Déclarations sociales', icon: <GroupsIcon />,         path: '/sociales' },
  { label: 'Échéancier leasing',    icon: <CalendarTodayIcon />,  path: '/leasing' },
  { label: 'Audit intelligent',     icon: <SecurityIcon />,       path: '/audit' },
]

const clientBottomLinks = [
  { label: 'Paramètres', icon: <SettingsIcon />, path: '/profil' },
]

const adminLinks = [
  // Tableau de bord hidden for now — route still exists at /admin, just not linked in nav.
  { label: 'Messagerie',      icon: <ForumIcon />,     path: '/admin/messages' },
  { label: 'Clients',         icon: <PeopleIcon />,    path: '/admin/clients' },
  { label: 'Documents',       icon: <FolderIcon />,    path: '/admin/documents' },
  { label: 'Audit intelligent', icon: <SecurityIcon />,  path: '/audit' },
  { label: 'Rapports',        icon: <BarChartIcon />,  path: '/admin/rapports' },
]

// Tentative 4-axes admin nav — toggle USE_ADMIN_AXES below to revert to the flat adminLinks above.
const adminAxes = [
  {
    key: 'cabinet',
    label: 'Gestion de cabinet',
    icon: <BusinessCenterIcon />,
    items: [
      { label: 'Messagerie', icon: <ForumIcon />,    path: '/admin/messages' },
      { label: 'Rapports',   icon: <BarChartIcon />, path: '/admin/rapports' },
    ],
  },
  {
    key: 'comptabilite',
    label: 'Comptabilité',
    icon: <AccountBalanceIcon />,
    items: [
      { label: 'Clients',   icon: <PeopleIcon />, path: '/admin/clients' },
      { label: 'Documents', icon: <FolderIcon />, path: '/admin/documents' },
    ],
  },
  {
    key: 'audit',
    label: 'Audit',
    icon: <SecurityIcon />,
    items: [
      { label: 'Audit intelligent', icon: <SecurityIcon />, path: '/audit' },
    ],
  },
  {
    key: 'textes',
    label: 'Textes et lois',
    icon: <GavelIcon />,
    items: [
      { label: 'Textes et lois', icon: <MenuBookIcon />, path: '/admin/textes-lois' },
    ],
  },
]

const adminBottomLinks = [
  { label: 'Paramètres', icon: <SettingsIcon />, path: '/admin/settings' },
]

function NavItem({
  link, active, onClick, badge,
}: {
  link: { label: string; icon: React.ReactNode; path: string }
  active: boolean
  onClick: () => void
  badge?: number
}) {
  return (
    <ListItemButton
      onClick={onClick}
      sx={{
        borderRadius: '8px',
        mb: 0.5, py: 1, px: 1.5,
        bgcolor: active ? ITEM_ACTIVE_BG : 'transparent',
        borderLeft: active ? `2px solid ${ACCENT}` : '2px solid transparent',
        '&:hover': { bgcolor: active ? ITEM_ACTIVE_BG : ITEM_HOVER_BG },
        transition: 'all 0.15s ease',
      }}>
      <ListItemIcon sx={{
        minWidth: 36,
        color: active ? ACCENT : TEXT_MUTED,
        '& svg': { fontSize: 19 },
        transition: 'color 0.15s',
      }}>
        {link.icon}
      </ListItemIcon>
      <ListItemText
        primary={link.label}
        primaryTypographyProps={{
          fontSize: 13,
          fontWeight: active ? 600 : 400,
          color: active ? TEXT_MAIN : 'rgba(255,255,255,0.65)',
          letterSpacing: 0.1,
        }}
      />
      {!!badge && (
        <Chip label={badge > 99 ? '99+' : badge} size="small"
          sx={{ height: 18, minWidth: 18, fontSize: 10, fontWeight: 800, bgcolor: '#EF4444', color: 'white' }} />
      )}
    </ListItemButton>
  )
}

interface SidebarProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user }  = useAuth()
  const photo     = useProfilePhoto(user?.email ?? '', user?.avatar)
  const isAdmin   = user?.role === 'admin'
  const mainLinks = isAdmin ? adminLinks : clientLinks
  const botLinks  = isAdmin ? adminBottomLinks : clientBottomLinks
  const messagesPath = isAdmin ? '/admin/messages' : '/messages'

  const [unreadMessages, setUnreadMessages] = useState(0)
  const fetchUnread = useCallback(() => {
    api.get('/messages/unread-count')
      .then((r: { data: { count: number } }) => setUnreadMessages(r.data.count))
      .catch(() => {})
  }, [])
  useEffect(() => {
    fetchUnread()
    const interval = setInterval(fetchUnread, 15000)
    const unsub = onNotifyRefresh(fetchUnread)
    return () => { clearInterval(interval); unsub() }
  }, [fetchUnread])

  const go = (path: string) => {
    navigate(path)
    onClose?.()
  }

  return (
    <Box sx={{
      width: SIDEBAR_W,
      height: '100%',
      bgcolor: NAV_BG,
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid rgba(255,255,255,0.07)',
    }}>
      {/* Logo */}
      <Box sx={{ px: 2.5, pt: 3, pb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 38, height: 38, borderRadius: '10px',
            background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(59,130,246,0.4)',
          }}>
            <BarChartIcon sx={{ color: 'white', fontSize: 20 }} />
          </Box>
          <Box>
            <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>
              Intelligence
            </Typography>
            <Typography sx={{ color: TEXT_MUTED, fontSize: 11 }}>
              Comptabilité
            </Typography>
          </Box>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)' }} />

      {/* User card */}
      <Box sx={{ px: 2, py: 2 }}>
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          px: 1.5, py: 1.2, borderRadius: '10px',
          bgcolor: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <Avatar
            src={photo ?? undefined}
            sx={{
              width: 32, height: 32,
              background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)',
              fontSize: 13, fontWeight: 700,
            }}>
            {!photo && user?.nom?.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ overflow: 'hidden', flex: 1 }}>
            <Typography sx={{
              color: TEXT_MAIN, fontWeight: 600, fontSize: 12.5,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {user?.nom}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#4ADE80' }} />
              <Typography sx={{ color: TEXT_MUTED, fontSize: 10.5 }}>
                {isAdmin ? 'Administrateur' : 'Client'}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)', mx: 2 }} />

      {isAdmin && USE_ADMIN_AXES ? (
        /* Main links — grouped into 4 axes (tentative) */
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {adminAxes.map((axis) => (
            <Box key={axis.key}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, px: 2.5, mt: 2, mb: 0.5 }}>
                <Box sx={{ color: TEXT_MUTED, '& svg': { fontSize: 14 }, display: 'flex' }}>
                  {axis.icon}
                </Box>
                <Typography sx={{
                  color: TEXT_MUTED, fontSize: 10, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: 1.4,
                }}>
                  {axis.label}
                </Typography>
              </Box>
              <List sx={{ px: 1.5, pt: 0 }}>
                {axis.items.map((link) => (
                  <NavItem
                    key={link.path}
                    link={link}
                    active={location.pathname === link.path}
                    onClick={() => go(link.path)}
                    badge={link.path === messagesPath ? unreadMessages : undefined}
                  />
                ))}
              </List>
            </Box>
          ))}
        </Box>
      ) : (
        <>
          {/* Section label */}
          <Typography sx={{
            color: TEXT_MUTED, fontSize: 10, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: 1.8,
            px: 2.5, mt: 2, mb: 0.5,
          }}>
            {isAdmin ? 'Administration' : 'Menu principal'}
          </Typography>

          {/* Main links */}
          <List sx={{ flex: 1, px: 1.5, pt: 0.5, overflowY: 'auto' }}>
            {mainLinks.map((link) => (
              <NavItem
                key={link.path}
                link={link}
                active={location.pathname === link.path}
                onClick={() => go(link.path)}
                badge={link.path === messagesPath ? unreadMessages : undefined}
              />
            ))}
          </List>
        </>
      )}

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)', mx: 2 }} />

      {/* Bottom settings */}
      <List sx={{ px: 1.5, py: 1 }}>
        {botLinks.map((link) => (
          <NavItem
            key={link.path}
            link={link}
            active={location.pathname === link.path}
            onClick={() => go(link.path)}
          />
        ))}
      </List>

      {/* Footer */}
      <Box sx={{ px: 2.5, pb: 2 }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, textAlign: 'center' }}>
          © 2026 Intelligence Comptabilité
        </Typography>
      </Box>
    </Box>
  )
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const theme    = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  if (isMobile) {
    return (
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          '& .MuiDrawer-paper': {
            width: SIDEBAR_W,
            boxSizing: 'border-box',
            border: 'none',
          },
        }}>
        <SidebarContent onClose={onMobileClose} />
      </Drawer>
    )
  }

  return (
    <Box sx={{
      width: SIDEBAR_W,
      flexShrink: 0,
      position: 'fixed',
      left: 0, top: 0,
      height: '100vh',
      zIndex: 100,
    }}>
      <SidebarContent />
    </Box>
  )
}
