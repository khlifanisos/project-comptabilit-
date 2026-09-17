import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import {
  IconButton, Badge, Popover, Box, Typography, List, ListItem,
  ListItemText, Chip, Divider, CircularProgress, Tooltip,
} from '@mui/material'
import NotificationsIcon from '@mui/icons-material/Notifications'
import DoneAllIcon from '@mui/icons-material/DoneAll'
import CloseIcon from '@mui/icons-material/Close'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt'
import LockResetIcon from '@mui/icons-material/LockReset'
import api from '../../api/axios'
import { Notification } from '../../types'
import { onNotifyRefresh, onLocalNotification } from '../../utils/notifyRefresh'

const typeIcon: Record<string, React.ReactNode> = {
  facture:  <ReceiptLongIcon  fontSize="small" sx={{ color: '#1565C0' }} />,
  echeance: <WarningAmberIcon fontSize="small" sx={{ color: '#E65100' }} />,
  info:     <InfoOutlinedIcon fontSize="small" sx={{ color: '#00ACC1' }} />,
  alert:    <WarningAmberIcon fontSize="small" sx={{ color: '#C62828' }} />,
  warning:  <WarningAmberIcon fontSize="small" sx={{ color: '#E65100' }} />,
  success:  <CheckCircleIcon  fontSize="small" sx={{ color: '#2E7D32' }} />,
  delete:   <DeleteOutlineIcon fontSize="small" sx={{ color: '#B71C1C' }} />,
  edit:     <EditOutlinedIcon  fontSize="small" sx={{ color: '#6A1B9A' }} />,
  client:   <PersonAddAltIcon  fontSize="small" sx={{ color: '#1565C0' }} />,
  reset:    <LockResetIcon     fontSize="small" sx={{ color: '#E65100' }} />,
}

const typeColor: Record<string, string> = {
  facture:  '#e3f0ff',
  echeance: '#FFF3E0',
  info:     '#e0f7fa',
  alert:    '#ffebee',
  warning:  '#fff3e0',
  success:  '#e8f5e9',
  delete:   '#ffebee',
  edit:     '#f3e5f5',
  client:   '#e3f2fd',
  reset:    '#fff3e0',
}

const typeBorder: Record<string, string> = {
  facture:  '#1565C0',
  echeance: '#E65100',
  info:     '#00ACC1',
  alert:    '#C62828',
  warning:  '#E65100',
  success:  '#2E7D32',
  delete:   '#B71C1C',
  edit:     '#6A1B9A',
  client:   '#1565C0',
  reset:    '#E65100',
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60)   return 'À l\'instant'
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`
  return new Date(dateStr).toLocaleDateString('fr-FR')
}

export default function NotificationBell() {
  const [anchor, setAnchor]               = useState<HTMLButtonElement | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading]             = useState(false)
  const location                          = useLocation()
  const prevPath                          = useRef(location.pathname)

  const unread = notifications.filter((n) => !n.lu).length

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/notifications')
      const backend: Notification[] = Array.isArray(data) ? data : data.data ?? []
      // Keep local (temporary) notifications and put them on top
      setNotifications((prev) => {
        const locals = prev.filter((n) => (n as any).isLocal)
        return [...locals, ...backend]
      })
    } catch {
      // Silently fail — no fake data
    } finally {
      setLoading(false)
    }
  }, [])

  // Vider les notifications locales quand on change de page
  useEffect(() => {
    if (location.pathname !== prevPath.current) {
      prevPath.current = location.pathname
      setNotifications((prev) => prev.filter((n) => !(n as any).isLocal))
    }
  }, [location.pathname])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    const unsubRefresh = onNotifyRefresh(fetchNotifications)
    const unsubLocal = onLocalNotification((n) => {
      const local = {
        id: Date.now(),
        titre: n.titre,
        message: n.message,
        type: n.type,
        lu: false,
        created_at: new Date().toISOString(),
        isLocal: true,
      } as Notification & { isLocal: boolean }
      setNotifications((prev) => [local, ...prev])
    })
    return () => { clearInterval(interval); unsubRefresh(); unsubLocal() }
  }, [fetchNotifications])

  const markAllRead = async () => {
    try { await api.post('/notifications/mark-all-read') } catch {}
    setNotifications((prev) => prev.map((n) => ({ ...n, lu: true })))
  }

  const markRead = async (id: number) => {
    try { await api.patch(`/notifications/${id}/read`) } catch {}
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const dismiss = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    try { await api.delete(`/notifications/${id}`) } catch {}
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const dismissAll = async () => {
    try { await api.delete('/notifications/all') } catch {}
    setNotifications([])
  }

  const icon  = (type: string) => typeIcon[type]  ?? typeIcon.info
  const color = (type: string) => typeColor[type] ?? '#f5f5f5'
  const border = (type: string) => typeBorder[type] ?? '#1565C0'

  return (
    <>
      <IconButton
        onClick={(e) => { setAnchor(e.currentTarget); fetchNotifications() }}
        sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}>
        <Badge badgeContent={unread || undefined} color="error" max={99}>
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 400, maxHeight: 540, borderRadius: 3,
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)' } } }}>

        {/* Header */}
        <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg,#1565C0,#0D47A1)', color: 'white' }}>
          <Box display="flex" alignItems="center" gap={1}>
            <NotificationsIcon fontSize="small" />
            <Typography fontWeight={700} fontSize={15}>
              Notifications
              {unread > 0 && (
                <Chip label={unread} size="small" color="error"
                  sx={{ ml: 1, height: 20, fontSize: 11, fontWeight: 800 }} />
              )}
            </Typography>
          </Box>
          <Box display="flex" gap={0.5}>
            {unread > 0 && (
              <Tooltip title="Tout marquer comme lu">
                <IconButton size="small" onClick={markAllRead}
                  sx={{ color: 'rgba(255,255,255,0.85)', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}>
                  <DoneAllIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {notifications.length > 0 && (
              <Tooltip title="Tout supprimer">
                <IconButton size="small" onClick={dismissAll}
                  sx={{ color: 'rgba(255,160,160,0.9)', '&:hover': { bgcolor: 'rgba(255,100,100,0.2)' } }}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
        <Divider />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : notifications.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 5 }}>
            <NotificationsIcon sx={{ fontSize: 52, color: '#ddd' }} />
            <Typography color="text.secondary" mt={1} fontSize={14}>
              Aucune notification
            </Typography>
            <Typography color="text.disabled" fontSize={12}>
              Les actions sur la plateforme apparaîtront ici
            </Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ overflow: 'auto', maxHeight: 450 }}>
            {notifications.map((n, i) => (
              <Box key={n.id}>
                <ListItem
                  onClick={() => markRead(n.id)}
                  sx={{
                    cursor: 'pointer', py: 1.5, px: 2, alignItems: 'flex-start',
                    bgcolor: n.lu ? 'transparent' : color(n.type),
                    '&:hover': { bgcolor: '#f0f4ff', transition: 'background 0.2s',
                      '& .dismiss-btn': { opacity: 1 } },
                    borderLeft: `3px solid ${n.lu ? 'transparent' : border(n.type)}`,
                    transition: 'all 0.2s',
                  }}>
                  <Box sx={{ mr: 1.5, mt: 0.5, flexShrink: 0 }}>{icon(n.type)}</Box>
                  <ListItemText
                    primary={
                      <Typography fontWeight={n.lu ? 500 : 700} fontSize={13} lineHeight={1.3}>
                        {n.titre}
                      </Typography>
                    }
                    secondary={
                      <Box>
                        <Typography fontSize={12} color="text.secondary" mt={0.3} lineHeight={1.4}
                          sx={{ whiteSpace: 'pre-line' }}>
                          {n.message}
                        </Typography>
                        <Typography fontSize={11} color="text.disabled" mt={0.4}>
                          {timeAgo(n.created_at)}
                        </Typography>
                      </Box>
                    }
                  />
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: 0.5, flexShrink: 0, ml: 0.5 }}>
                    {!n.lu && (
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: border(n.type) }} />
                    )}
                    <IconButton
                      className="dismiss-btn"
                      size="small"
                      onClick={(e) => dismiss(e, n.id)}
                      sx={{
                        opacity: 0, transition: 'opacity 0.2s',
                        p: 0.3, color: 'text.disabled',
                        '&:hover': { color: 'error.main', bgcolor: '#ffebee' },
                      }}>
                      <CloseIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Box>
                </ListItem>
                {i < notifications.length - 1 && <Divider />}
              </Box>
            ))}
          </List>
        )}
      </Popover>
    </>
  )
}