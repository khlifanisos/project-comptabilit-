import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Box, Typography, Card, TextField, IconButton, Avatar,
  CircularProgress, Chip, InputAdornment, useMediaQuery, useTheme,
} from '@mui/material'
import ForumIcon     from '@mui/icons-material/Forum'
import SearchIcon    from '@mui/icons-material/Search'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SmartToyIcon  from '@mui/icons-material/SmartToy'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import { notifyRefresh } from '../../utils/notifyRefresh'
import ChatComposer from '../../components/common/ChatComposer'
import AttachmentMedia, { AttachmentType } from '../../components/common/AttachmentMedia'

interface Conversation {
  client_id: number
  nom: string
  email: string
  avatar: string | null
  is_connected: boolean
  last_message: string | null
  last_sender: 'client' | 'admin' | null
  last_is_bot: boolean
  last_at: string | null
  unread_count: number
}

interface Msg {
  id: number
  client_id: number
  sender_type: 'client' | 'admin'
  sender_admin_id: number | null
  is_bot: boolean
  body: string
  attachment_path: string | null
  attachment_type: AttachmentType | null
  attachment_name: string | null
  attachment_size: number | null
  read_at: string | null
  created_at: string
  sender_admin?: { nom: string } | null
}

function timeLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  return sameDay
    ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' ' +
      d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function relTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return 'à l\'instant'
  if (diff < 3600) return `${Math.floor(diff / 60)} min`
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

export default function AdminMessagerie() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadingConvos, setLoadingConvos] = useState(true)
  const [search, setSearch] = useState('')
  const [activeId, setActiveId] = useState<number | null>(null)

  const [messages, setMessages] = useState<Msg[]>([])
  const [threadOnline, setThreadOnline] = useState(false)
  const [loadingThread, setLoadingThread] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadConversations = useCallback(async (silent = false) => {
    if (!silent) setLoadingConvos(true)
    try {
      const { data } = await api.get('/messages/conversations')
      setConversations(data)
    } catch {
      if (!silent) toast.error('Impossible de charger les conversations.')
    } finally {
      if (!silent) setLoadingConvos(false)
    }
  }, [])

  useEffect(() => {
    loadConversations()
    const interval = setInterval(() => loadConversations(true), 8000)
    return () => clearInterval(interval)
  }, [loadConversations])

  const loadThread = useCallback(async (clientId: number, silent = false) => {
    if (!silent) setLoadingThread(true)
    try {
      const { data } = await api.get(`/messages/${clientId}`)
      setMessages(data.messages)
      setThreadOnline(!!data.counterpart_online)
    } catch {
      if (!silent) toast.error('Impossible de charger la conversation.')
    } finally {
      if (!silent) setLoadingThread(false)
    }
  }, [])

  useEffect(() => {
    if (activeId == null) return
    loadThread(activeId)
    const interval = setInterval(() => loadThread(activeId, true), 4000)
    return () => clearInterval(interval)
  }, [activeId, loadThread])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const openConversation = (clientId: number) => {
    setActiveId(clientId)
    setConversations(prev => prev.map(c => c.client_id === clientId ? { ...c, unread_count: 0 } : c))
  }

  const handleSend = async (body: string, file: File | null, isVoiceNote?: boolean) => {
    if (activeId == null) return
    try {
      let data
      if (file) {
        const fd = new FormData()
        if (body) fd.append('body', body)
        fd.append('fichier', file)
        if (isVoiceNote) fd.append('attachment_kind', 'voice')
        ;({ data } = await api.post(`/messages/${activeId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }))
      } else {
        ;({ data } = await api.post(`/messages/${activeId}`, { body }))
      }
      setMessages(prev => [...prev, data])
      notifyRefresh()
      loadConversations(true)
    } catch {
      toast.error("Erreur lors de l'envoi du message.")
      throw new Error('send-failed')
    }
  }

  const filtered = conversations.filter(c =>
    c.nom.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  )
  const active = conversations.find(c => c.client_id === activeId)

  const showList = !isMobile || activeId == null
  const showThread = !isMobile || activeId != null

  return (
    <Box className="fade-in" sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Box sx={{
          width: 48, height: 48, borderRadius: 2.5,
          background: 'linear-gradient(135deg,#1565C0,#0D47A1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ForumIcon sx={{ color: 'white', fontSize: 26 }} />
        </Box>
        <Box>
          <Typography variant="h5" fontWeight={800} color="#1a1a2e" fontSize={{ xs: 17, md: 22 }}>
            Messagerie
          </Typography>
          <Typography color="text.secondary" fontSize={14}>
            Conversations avec vos clients
          </Typography>
        </Box>
      </Box>

      <Card sx={{ borderRadius: 3, flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Conversation list */}
        {showList && (
          <Box sx={{
            width: isMobile ? '100%' : 320, flexShrink: 0,
            borderRight: isMobile ? 'none' : '1px solid #EEF1F6',
            display: 'flex', flexDirection: 'column',
          }}>
            <Box sx={{ p: 1.5, borderBottom: '1px solid #EEF1F6' }}>
              <TextField
                placeholder="Rechercher un client…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                size="small"
                fullWidth
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Box>
            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              {loadingConvos ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
              ) : filtered.length === 0 ? (
                <Typography color="text.secondary" textAlign="center" py={4} fontSize={13}>
                  Aucune conversation.
                </Typography>
              ) : (
                filtered.map(c => (
                  <Box key={c.client_id}
                    onClick={() => openConversation(c.client_id)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.2,
                      px: 1.5, py: 1.2, cursor: 'pointer',
                      bgcolor: activeId === c.client_id ? '#E3F0FF' : 'transparent',
                      borderBottom: '1px solid #F5F7FA',
                      '&:hover': { bgcolor: activeId === c.client_id ? '#E3F0FF' : '#F7F9FC' },
                    }}>
                    <Box sx={{ position: 'relative', flexShrink: 0 }}>
                      <Avatar src={c.avatar ?? undefined} sx={{ width: 38, height: 38, bgcolor: '#1565C0', fontSize: 14, fontWeight: 700 }}>
                        {!c.avatar && c.nom.charAt(0).toUpperCase()}
                      </Avatar>
                      {c.is_connected && (
                        <Box sx={{
                          position: 'absolute', bottom: -1, right: -1,
                          width: 11, height: 11, borderRadius: '50%',
                          bgcolor: '#4ADE80', border: '2px solid white',
                        }} />
                      )}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                        <Typography fontWeight={700} fontSize={13} noWrap>{c.nom}</Typography>
                        <Typography fontSize={10.5} color="text.secondary" flexShrink={0}>{relTime(c.last_at)}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                        <Typography fontSize={11.5} color="text.secondary" noWrap sx={{ flex: 1 }}>
                          {c.last_is_bot ? 'Assistant : ' : c.last_sender === 'admin' ? 'Vous : ' : ''}{c.last_message ?? 'Aucun message'}
                        </Typography>
                        {c.unread_count > 0 && (
                          <Chip label={c.unread_count} size="small"
                            sx={{ height: 18, minWidth: 18, fontSize: 10, fontWeight: 700, bgcolor: '#1565C0', color: 'white' }} />
                        )}
                      </Box>
                    </Box>
                  </Box>
                ))
              )}
            </Box>
          </Box>
        )}

        {/* Thread */}
        {showThread && (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {activeId == null ? (
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <ForumIcon sx={{ fontSize: 52, color: '#ddd' }} />
                <Typography color="text.secondary" fontSize={14}>Sélectionnez une conversation</Typography>
              </Box>
            ) : (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, p: 1.5, borderBottom: '1px solid #EEF1F6' }}>
                  {isMobile && (
                    <IconButton size="small" onClick={() => setActiveId(null)}>
                      <ArrowBackIcon fontSize="small" />
                    </IconButton>
                  )}
                  <Box sx={{ position: 'relative', flexShrink: 0 }}>
                    <Avatar src={active?.avatar ?? undefined} sx={{ width: 34, height: 34, bgcolor: '#1565C0', fontSize: 13, fontWeight: 700 }}>
                      {!active?.avatar && active?.nom.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{
                      position: 'absolute', bottom: -1, right: -1,
                      width: 11, height: 11, borderRadius: '50%',
                      bgcolor: threadOnline ? '#4ADE80' : '#9CA3AF',
                      border: '2px solid white',
                    }} />
                  </Box>
                  <Box>
                    <Typography fontWeight={700} fontSize={13.5}>{active?.nom}</Typography>
                    <Typography fontSize={11} color={threadOnline ? '#2E7D32' : 'text.secondary'} fontWeight={threadOnline ? 700 : 400}>
                      {threadOnline ? 'En ligne' : active?.email}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ flex: 1, overflowY: 'auto', p: { xs: 1.5, md: 3 }, bgcolor: '#F7F9FC' }}>
                  {loadingThread ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
                  ) : messages.length === 0 ? (
                    <Typography color="text.secondary" textAlign="center" py={6} fontSize={14}>
                      Aucun message pour l'instant.
                    </Typography>
                  ) : (
                    messages.map((m) => {
                      if (m.is_bot) {
                        return (
                          <Box key={m.id} sx={{ display: 'flex', justifyContent: 'center', my: 1.5 }}>
                            <Box sx={{
                              display: 'flex', alignItems: 'center', gap: 1,
                              bgcolor: '#FFF3E0', color: '#8A5A00',
                              px: 2, py: 1, borderRadius: 3, fontSize: 12.5,
                              maxWidth: '85%', textAlign: 'center',
                            }}>
                              <SmartToyIcon sx={{ fontSize: 16, flexShrink: 0 }} />
                              {m.body}
                            </Box>
                          </Box>
                        )
                      }
                      const mine = m.sender_type === 'admin'
                      return (
                        <Box key={m.id} sx={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', mb: 1.5, gap: 1 }}>
                          {!mine && (
                            <Avatar src={active?.avatar ?? undefined} sx={{ width: 28, height: 28, bgcolor: '#7B1FA2', fontSize: 12, fontWeight: 700 }}>
                              {!active?.avatar && active?.nom.charAt(0).toUpperCase()}
                            </Avatar>
                          )}
                          <Box sx={{ maxWidth: '72%' }}>
                            <Box sx={{
                              px: m.attachment_path && m.attachment_type !== 'file' ? 0.6 : 1.8,
                              py: m.attachment_path && m.attachment_type !== 'file' ? 0.6 : 1.1,
                              borderRadius: 3,
                              bgcolor: mine ? '#1565C0' : 'white',
                              color: mine ? 'white' : '#1a1a2e',
                              boxShadow: mine ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
                              borderTopRightRadius: mine ? 4 : 12,
                              borderTopLeftRadius: mine ? 12 : 4,
                              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                              fontSize: 13.5,
                              display: 'flex', flexDirection: 'column', gap: 0.6,
                            }}>
                              {m.attachment_path && m.attachment_type && (
                                <AttachmentMedia
                                  src={`/messages/${m.client_id}/attachment/${m.id}`}
                                  type={m.attachment_type}
                                  name={m.attachment_name}
                                  size={m.attachment_size}
                                  mine={mine}
                                />
                              )}
                              {m.body && (
                                <Box sx={{ px: m.attachment_path && m.attachment_type !== 'file' ? 1 : 0 }}>{m.body}</Box>
                              )}
                            </Box>
                            <Typography fontSize={10.5} color="text.secondary" mt={0.4}
                              sx={{ textAlign: mine ? 'right' : 'left' }}>
                              {timeLabel(m.created_at)}
                            </Typography>
                          </Box>
                        </Box>
                      )
                    })
                  )}
                  <div ref={bottomRef} />
                </Box>

                <ChatComposer onSend={handleSend} />
              </>
            )}
          </Box>
        )}
      </Card>
    </Box>
  )
}
