import { useState } from 'react'
import {
  AppBar, Toolbar, Box, Typography, InputBase, Avatar,
  Menu, MenuItem, Divider, ListItemIcon, Tooltip, IconButton,
  useMediaQuery, useTheme,
} from '@mui/material'
import SearchIcon    from '@mui/icons-material/Search'
import MenuIcon      from '@mui/icons-material/Menu'
import LogoutIcon    from '@mui/icons-material/Logout'
import PersonIcon    from '@mui/icons-material/Person'
import SettingsIcon  from '@mui/icons-material/Settings'
import NotificationBell  from './NotificationBell'
import RoleSwitcherModal from './RoleSwitcherModal'
import CurrencyBadge     from './CurrencyBadge'
import { useAuth }        from '../../contexts/AuthContext'
import { useNavigate }    from 'react-router-dom'
import { useProfilePhoto } from '../../utils/useProfilePhoto'

// Search bar hidden for now — flip back to true to restore it.
const SHOW_SEARCH = false

interface Props { onMenuClick?: () => void }

export default function Topbar({ onMenuClick }: Props) {
  const { user, logout } = useAuth()
  const photo    = useProfilePhoto(user?.email ?? '', user?.avatar)
  const navigate = useNavigate()
  const theme    = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const isPhone  = useMediaQuery(theme.breakpoints.down('sm'))

  const [anchorEl, setAnchorEl]       = useState<null | HTMLElement>(null)
  const [searchOpen, setSearchOpen]   = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const settingsPath = user?.role === 'admin' ? '/admin/settings' : '/profil'

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        left:  isMobile ? 0 : 248,
        width: isMobile ? '100%' : 'calc(100% - 248px)',
        bgcolor: '#0A1628',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        zIndex: 99,
      }}>
      <Toolbar sx={{ gap: 1, minHeight: { xs: 58, md: 64 }, px: { xs: 1.5, md: 2.5 } }}>

        {/* Hamburger — mobile only */}
        {isMobile && (
          <IconButton
            onClick={onMenuClick}
            sx={{ color: 'rgba(255,255,255,0.8)', mr: 0.5, p: 1 }}>
            <MenuIcon />
          </IconButton>
        )}

        {/* Logo text — mobile only */}
        {isMobile && (
          <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 15, flex: 1 }}>
            Intelligence
          </Typography>
        )}

        {/* Search bar — desktop & tablet, or expanded on phone */}
        {SHOW_SEARCH && (!isPhone || searchOpen) && (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 20,
            px: 2, py: 0.5,
            flex: isPhone ? 1 : undefined,
            width: isPhone ? 'auto' : undefined,
            maxWidth: { sm: 300, md: 400 },
            border: '1px solid rgba(255,255,255,0.12)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.13)' },
          }}>
            <SearchIcon sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 18, flexShrink: 0 }} />
            <InputBase
              autoFocus={isPhone && searchOpen}
              placeholder="Rechercher…"
              sx={{
                color: 'white', fontSize: 13.5, width: '100%',
                '& input::placeholder': { color: 'rgba(255,255,255,0.45)' },
              }}
              onBlur={() => isPhone && setSearchOpen(false)}
            />
          </Box>
        )}

        {/* Search icon — phone only, when bar is closed */}
        {SHOW_SEARCH && isPhone && !searchOpen && (
          <IconButton
            onClick={() => setSearchOpen(true)}
            sx={{ color: 'rgba(255,255,255,0.7)', p: 1 }}>
            <SearchIcon />
          </IconButton>
        )}

        {/* Spacer — desktop */}
        {!isMobile && <Box flex={1} />}

        {/* Currency badge — hide on phone */}
        {!isPhone && <CurrencyBadge />}

        {/* Role switcher — hide on phone */}
        {!isPhone && <RoleSwitcherModal />}

        {/* Notifications */}
        <NotificationBell />

        {/* Avatar + name — avatar only on phone */}
        <Tooltip title="Mon profil">
          <Box
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={{
              display: 'flex', alignItems: 'center',
              gap: { xs: 0, md: 1.2 },
              cursor: 'pointer', borderRadius: 20,
              px: { xs: 0.5, md: 1.5 }, py: 0.6,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
            }}>
            <Avatar
              src={photo ?? undefined}
              sx={{
                width: { xs: 32, md: 34 }, height: { xs: 32, md: 34 },
                background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)',
                fontSize: 14, fontWeight: 700,
              }}>
              {!photo && user?.nom?.charAt(0).toUpperCase()}
            </Avatar>
            {/* Name + email — desktop only */}
            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
              <Typography sx={{ color: 'white', fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>
                {user?.nom}
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
                {user?.email}
              </Typography>
            </Box>
          </Box>
        </Tooltip>

        {/* Dropdown menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          slotProps={{
            paper: {
              sx: {
                mt: 1, minWidth: 200, borderRadius: 3,
                boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
              },
            },
          }}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}>
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography fontWeight={700} fontSize={14}>{user?.nom}</Typography>
            <Typography fontSize={12} color="text.secondary">{user?.email}</Typography>
          </Box>
          <Divider />
          <MenuItem onClick={() => { navigate(settingsPath); setAnchorEl(null) }}>
            <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>Mon profil
          </MenuItem>
          <MenuItem onClick={() => { navigate(settingsPath); setAnchorEl(null) }}>
            <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>Paramètres
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
            <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>Déconnexion
          </MenuItem>
        </Menu>

      </Toolbar>
    </AppBar>
  )
}
