import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Avatar, Badge, Box, ButtonBase, Collapse, Divider, Drawer, IconButton, List, ListItemButton,
  ListItemIcon, ListItemText, Menu, MenuItem, Tooltip, Typography, useMediaQuery, useTheme,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import BarChartIcon      from '@mui/icons-material/BarChart'
import MenuIcon          from '@mui/icons-material/Menu'
import CloseIcon         from '@mui/icons-material/Close'
import ExpandMoreIcon    from '@mui/icons-material/ExpandMore'
import ArrowForwardIcon  from '@mui/icons-material/ArrowForward'
import LogoutIcon        from '@mui/icons-material/Logout'
import PersonIcon        from '@mui/icons-material/Person'
import SettingsIcon      from '@mui/icons-material/Settings'
import DarkModeIcon      from '@mui/icons-material/DarkModeRounded'
import LightModeIcon     from '@mui/icons-material/LightModeRounded'
import NotificationBell  from './NotificationBell'
import RoleSwitcherModal from './RoleSwitcherModal'
import CurrencyBadge     from './CurrencyBadge'
import { HEADER_H } from './PageHero'
import { NavEntry, NavLink, adminNav, clientNav, entryIsActive, isActivePath } from './navigation'
import { useAuth }         from '../../contexts/AuthContext'
import { useThemeMode }    from '../../contexts/ThemeModeContext'
import { useProfilePhoto } from '../../utils/useProfilePhoto'
import api                 from '../../api/axios'
import { onNotifyRefresh } from '../../utils/notifyRefresh'

const GLASS = 'rgba(7, 15, 32, 0.78)'
const LINK  = 'rgba(255,255,255,0.74)'

/** Unread messages counter shown next to "Messagerie" (polled + refreshed on demand). */
function useUnreadMessages() {
  const [count, setCount] = useState(0)
  const fetch = useCallback(() => {
    api.get('/messages/unread-count')
      .then((r: { data: { count: number } }) => setCount(r.data.count))
      .catch(() => {})
  }, [])
  useEffect(() => {
    fetch()
    const interval = setInterval(fetch, 15000)
    const unsub = onNotifyRefresh(fetch)
    return () => { clearInterval(interval); unsub() }
  }, [fetch])
  return count
}

/** Scroll position as a 0–1 ratio plus a "scrolled past the top" flag. */
function useScroll() {
  const [state, setState] = useState({ scrolled: false, progress: 0 })
  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight
        setState({ scrolled: window.scrollY > 24, progress: max > 0 ? Math.min(1, window.scrollY / max) : 0 })
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf) }
  }, [])
  return state
}

export function Logo({ onClick, light = false }: { onClick?: () => void; light?: boolean }) {
  return (
    <ButtonBase onClick={onClick} disabled={!onClick} disableRipple
      sx={{ display: 'flex', alignItems: 'center', gap: 1.3, borderRadius: 2, textAlign: 'left', flexShrink: 0,
        '&:hover .logo-mark': { transform: 'rotate(-8deg) scale(1.06)' } }}>
      <Box className="logo-mark" sx={{
        width: 40, height: 40, borderRadius: '12px', flexShrink: 0,
        background: 'linear-gradient(135deg,#60A5FA 0%,#3B82F6 40%,#7C3AED 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 8px 24px rgba(59,130,246,0.45), inset 0 1px 0 rgba(255,255,255,0.35)',
        transition: 'transform .35s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <BarChartIcon sx={{ color: 'white', fontSize: 22 }} />
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 800, fontSize: 16.5, lineHeight: 1.1, letterSpacing: '-0.02em',
          color: light ? 'white' : 'text.primary' }}>
          Intelligence
        </Typography>
        <Typography sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
          color: light ? 'rgba(255,255,255,0.5)' : 'primary.main' }}>
          Comptabilité
        </Typography>
      </Box>
    </ButtonBase>
  )
}

/* ─────────────────────────── Desktop menu ─────────────────────────── */

function DesktopNav({ entries, current, go, badgeFor }: {
  entries: NavEntry[]; current: string; go: (p: string) => void; badgeFor: (p: string) => number
}) {
  const [open, setOpen] = useState<{ label: string; el: HTMLElement } | null>(null)
  const openLinks = open ? entries.find(x => x.label === open.label)?.children ?? [] : []

  return (
    <Box component="nav" sx={{
      display: 'flex', alignItems: 'center', gap: 0.3, p: 0.5, borderRadius: 99,
      bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
    }}>
      {entries.map(e => {
        const active = entryIsActive(current, e)
        const isOpen = open?.label === e.label
        const badge = e.children ? e.children.reduce((n, c) => n + badgeFor(c.path), 0) : badgeFor(e.path)
        return (
          <ButtonBase key={e.label}
            onClick={(ev) => e.children ? setOpen({ label: e.label, el: ev.currentTarget }) : go(e.path)}
            aria-haspopup={e.children ? 'menu' : undefined}
            aria-expanded={isOpen || undefined}
            sx={{
              px: 1.8, height: 38, borderRadius: 99, gap: 0.3, fontFamily: 'inherit',
              fontSize: 14, fontWeight: active ? 700 : 500, whiteSpace: 'nowrap',
              color: active ? 'white' : LINK,
              background: active ? 'linear-gradient(135deg, rgba(96,165,250,0.32), rgba(124,58,237,0.26))' : 'transparent',
              boxShadow: active ? 'inset 0 0 0 1px rgba(255,255,255,0.14), 0 4px 18px rgba(59,130,246,0.25)' : 'none',
              transition: 'color .15s, background-color .15s',
              '&:hover': { color: 'white', bgcolor: active ? undefined : 'rgba(255,255,255,0.07)' },
            }}>
            <Badge color="error" variant="dot" invisible={!badge} sx={{ '& .MuiBadge-badge': { right: -6, top: 2 } }}>
              {e.short ?? e.label}
            </Badge>
            {e.children && (
              <ExpandMoreIcon sx={{ fontSize: 18, ml: 0.2, opacity: 0.8, transition: 'transform .2s', transform: isOpen ? 'rotate(180deg)' : 'none' }} />
            )}
          </ButtonBase>
        )
      })}

      <Menu anchorEl={open?.el} open={Boolean(open)} onClose={() => setOpen(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{ paper: { sx: {
          mt: 1.5, width: 360, borderRadius: 4, p: 1,
          boxShadow: '0 24px 60px rgba(2,8,23,0.28)', border: '1px solid', borderColor: 'divider',
        } } }}
        MenuListProps={{ sx: { p: 0 } }}>
        {openLinks.map((l: NavLink) => {
          const active = isActivePath(current, l.path)
          const color = l.color ?? '#3B82F6'
          return (
            <MenuItem key={l.path} onClick={() => { setOpen(null); go(l.path) }} selected={active}
              sx={{
                gap: 1.6, py: 1.3, px: 1.5, borderRadius: 3, alignItems: 'center',
                '&:hover .dd-arrow': { opacity: 1, transform: 'translateX(0)' },
                '&:hover .dd-icon': { transform: 'scale(1.08)', bgcolor: color, color: 'white' },
              }}>
              <Box className="dd-icon" sx={{
                width: 42, height: 42, borderRadius: 2.5, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: alpha(color, 0.12), color, '& svg': { fontSize: 21 },
                transition: 'all .2s ease',
              }}>
                {l.icon}
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography fontSize={14.5} fontWeight={700} display="flex" alignItems="center">
                  {l.label}
                  {badgeFor(l.path) > 0 && <Badge color="error" badgeContent={badgeFor(l.path)} max={99} sx={{ ml: 2.5 }} />}
                </Typography>
                {l.description && <Typography fontSize={12.5} color="text.secondary">{l.description}</Typography>}
              </Box>
              <ArrowForwardIcon className="dd-arrow" sx={{
                fontSize: 18, color: 'text.secondary', opacity: 0, transform: 'translateX(-6px)', transition: 'all .2s',
              }} />
            </MenuItem>
          )
        })}
      </Menu>
    </Box>
  )
}

/* ─────────────────────────── Mobile drawer ─────────────────────────── */

function MobileNav({ entries, current, go, badgeFor, open, onClose }: {
  entries: NavEntry[]; current: string; go: (p: string) => void; badgeFor: (p: string) => number
  open: boolean; onClose: () => void
}) {
  const [expanded, setExpanded] = useState<string | null>(
    () => entries.find(e => e.children && entryIsActive(current, e))?.label ?? null,
  )

  const linkItem = (l: NavLink, nested = false) => {
    const active = isActivePath(current, l.path)
    return (
      <ListItemButton key={l.path} onClick={() => go(l.path)}
        sx={{
          borderRadius: 3, mx: 1.5, mb: 0.3, pl: nested ? 3 : 2, py: 1.2, color: active ? 'white' : LINK,
          background: active ? 'linear-gradient(135deg, rgba(96,165,250,0.28), rgba(124,58,237,0.22))' : 'transparent',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
        }}>
        <ListItemIcon sx={{ minWidth: 38, color: active ? '#93C5FD' : 'rgba(255,255,255,0.5)', '& svg': { fontSize: 21 } }}>
          {l.icon}
        </ListItemIcon>
        <ListItemText primary={l.label} primaryTypographyProps={{ fontSize: 15, fontWeight: active ? 700 : 500 }} />
        {badgeFor(l.path) > 0 && <Badge color="error" badgeContent={badgeFor(l.path)} max={99} sx={{ mr: 1 }} />}
      </ListItemButton>
    )
  }

  return (
    <Drawer anchor="right" open={open} onClose={onClose}
      PaperProps={{ sx: {
        width: 'min(360px, 90vw)', color: 'white', border: 'none',
        background: 'linear-gradient(180deg, #071228 0%, #0A1F44 100%)',
      } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, height: HEADER_H }}>
        <Logo light />
        <IconButton onClick={onClose} aria-label="Fermer le menu" sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.06)' }}>
          <CloseIcon />
        </IconButton>
      </Box>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
      <List sx={{ py: 1.5 }}>
        {entries.map(e => e.children ? (
          <Box key={e.label}>
            <ListItemButton onClick={() => setExpanded(x => x === e.label ? null : e.label)}
              sx={{ borderRadius: 3, mx: 1.5, py: 1.2, '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' } }}>
              <ListItemText primary={e.label} primaryTypographyProps={{
                fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: entryIsActive(current, e) ? '#93C5FD' : 'rgba(255,255,255,0.5)',
              }} />
              <ExpandMoreIcon sx={{ color: 'rgba(255,255,255,0.5)', transition: 'transform .2s', transform: expanded === e.label ? 'rotate(180deg)' : 'none' }} />
            </ListItemButton>
            <Collapse in={expanded === e.label} unmountOnExit>
              {e.children.map(c => linkItem(c, true))}
            </Collapse>
          </Box>
        ) : linkItem(e))}
      </List>
    </Drawer>
  )
}

/* ─────────────────────────── Header ─────────────────────────── */

export default function SiteHeader({ overHero }: { overHero: boolean }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const photo = useProfilePhoto(user?.email ?? '', user?.avatar)
  const { mode, toggleMode } = useThemeMode()
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'))
  const isWide    = useMediaQuery(theme.breakpoints.up('xl'))
  const { scrolled, progress } = useScroll()
  const [drawer, setDrawer] = useState(false)
  const [accountEl, setAccountEl] = useState<null | HTMLElement>(null)
  const unread = useUnreadMessages()

  const isAdmin = user?.role === 'admin'
  const entries = isAdmin ? adminNav : clientNav
  const messagesPath = isAdmin ? '/admin/messages' : '/messages'
  const settingsPath = isAdmin ? '/admin/settings' : '/profil'
  const badgeFor = (p: string) => (p === messagesPath ? unread : 0)
  const go = (p: string) => { navigate(p); setDrawer(false); setAccountEl(null) }

  const solid = scrolled || !overHero
  const iconBtn = {
    color: 'rgba(255,255,255,0.8)', width: 40, height: 40,
    bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
    '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.12)' },
  }

  return (
    <>
      <Box component="header" sx={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1100,
        bgcolor: solid ? GLASS : 'transparent',
        backdropFilter: solid ? 'saturate(180%) blur(18px)' : 'none',
        WebkitBackdropFilter: solid ? 'saturate(180%) blur(18px)' : 'none',
        borderBottom: '1px solid', borderColor: solid ? 'rgba(255,255,255,0.08)' : 'transparent',
        boxShadow: scrolled ? '0 10px 30px rgba(2,8,23,0.25)' : 'none',
        transition: 'background-color .3s ease, box-shadow .3s ease, border-color .3s ease',
      }}>
        <Box sx={{
          maxWidth: 1320, mx: 'auto', px: { xs: 1.5, md: 3 },
          height: scrolled ? HEADER_H - 14 : HEADER_H, transition: 'height .3s ease',
          display: 'flex', alignItems: 'center', gap: 2,
        }}>
          <Logo light onClick={() => navigate('/accueil')} />

          <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 }}>
            {isDesktop && <DesktopNav entries={entries} current={pathname} go={go} badgeFor={badgeFor} />}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, '& .MuiIconButton-root': { p: 0.8 } }}>
            {isWide && <CurrencyBadge />}
            {isWide && <RoleSwitcherModal />}
            <Tooltip title={mode === 'dark' ? 'Mode clair' : 'Mode sombre'}>
              <IconButton onClick={toggleMode} sx={{ ...iconBtn, display: { xs: 'none', sm: 'inline-flex' } }}>
                <Box sx={{ display: 'flex', transition: 'transform .5s cubic-bezier(0.34,1.56,0.64,1)', transform: mode === 'dark' ? 'rotate(0)' : 'rotate(-180deg)' }}>
                  {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
                </Box>
              </IconButton>
            </Tooltip>
            <Box sx={{ ...iconBtn, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              '& .MuiIconButton-root': { width: 40, height: 40 } }}>
              <NotificationBell />
            </Box>

            <Tooltip title="Mon compte">
              <ButtonBase onClick={(e) => setAccountEl(e.currentTarget)} sx={{ borderRadius: '50%', ml: 0.5 }}>
                <Box sx={{ p: '2px', borderRadius: '50%', background: 'linear-gradient(135deg,#60A5FA,#A78BFA,#22D3EE)' }}>
                  <Avatar src={photo ?? undefined} sx={{
                    width: 36, height: 36, fontSize: 14, fontWeight: 700, border: '2px solid #0A1628',
                    background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)',
                  }}>
                    {!photo && user?.nom?.charAt(0).toUpperCase()}
                  </Avatar>
                </Box>
              </ButtonBase>
            </Tooltip>

            {!isDesktop && (
              <IconButton onClick={() => setDrawer(true)} aria-label="Ouvrir le menu" sx={{ ...iconBtn, ml: 0.5 }}>
                <Badge color="error" variant="dot" invisible={!unread}><MenuIcon /></Badge>
              </IconButton>
            )}
          </Box>
        </Box>

        {/* Reading progress */}
        <Box aria-hidden sx={{
          position: 'absolute', left: 0, bottom: -1, height: 2, width: '100%',
          transformOrigin: 'left', transform: `scaleX(${progress})`,
          background: 'linear-gradient(90deg,#22D3EE,#3B82F6,#A78BFA)',
          opacity: scrolled ? 1 : 0, transition: 'opacity .3s',
        }} />
      </Box>

      {/* Account menu */}
      <Menu anchorEl={accountEl} open={Boolean(accountEl)} onClose={() => setAccountEl(null)}
        slotProps={{ paper: { sx: { mt: 1.5, width: 270, borderRadius: 4, overflow: 'hidden', boxShadow: '0 24px 60px rgba(2,8,23,0.28)' } } }}
        MenuListProps={{ sx: { pt: 0 } }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}>
        <Box sx={{ px: 2, py: 2, color: 'white', background: 'linear-gradient(135deg,#0A1F44,#1D4ED8 70%,#7C3AED)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar src={photo ?? undefined} sx={{ width: 44, height: 44, bgcolor: 'rgba(255,255,255,0.18)', fontWeight: 700 }}>
              {!photo && user?.nom?.charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography fontWeight={700} fontSize={14.5} noWrap>{user?.nom}</Typography>
              <Typography fontSize={12} sx={{ color: 'rgba(255,255,255,0.7)' }} noWrap>{user?.email}</Typography>
            </Box>
          </Box>
          {!isWide && (
            <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
              <CurrencyBadge /><RoleSwitcherModal />
            </Box>
          )}
        </Box>
        <MenuItem onClick={() => go(settingsPath)} sx={{ mt: 1 }}>
          <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>Mon profil
        </MenuItem>
        <MenuItem onClick={() => go(settingsPath)}>
          <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>Paramètres
        </MenuItem>
        <MenuItem onClick={toggleMode} sx={{ display: { sm: 'none' } }}>
          <ListItemIcon>{mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}</ListItemIcon>
          {mode === 'dark' ? 'Mode clair' : 'Mode sombre'}
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { logout(); navigate('/login') }} sx={{ color: 'error.main' }}>
          <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>Déconnexion
        </MenuItem>
      </Menu>

      {!isDesktop && (
        <MobileNav entries={entries} current={pathname} go={go} badgeFor={badgeFor}
          open={drawer} onClose={() => setDrawer(false)} />
      )}
    </>
  )
}
