import { useState, useEffect, useRef, useCallback } from 'react'
import { Box, Typography, Card, Avatar, CircularProgress } from '@mui/material'
import ForumIcon    from '@mui/icons-material/Forum'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import { useAuth } from '../../contexts/AuthContext'
import { notifyRefresh } from '../../utils/notifyRefresh'
import ChatComposer from '../../components/common/ChatComposer'
import AttachmentMedia, { AttachmentType } from '../../components/common/AttachmentMedia'

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

export default function Messagerie() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Msg[]>([])
  const [adminOnline, setAdminOnline] = useState(false)
  const [loading, setLoading]   = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async (silent = false) => {
    if (!user?.id) return
    if (!silent) setLoading(true)
    try {
      const { data } = await api.get(`/messages/${user.id}`)
      setMessages(data.messages)
      setAdminOnline(!!data.counterpart_online)
    } catch {
      if (!silent) toast.error('Impossible de charger la conversation.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    load()
    const interval = setInterval(() => load(true), 4000)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSend = async (body: string, file: File | null, isVoiceNote?: boolean) => {
    if (!user?.id) return
    try {
      let data
      if (file) {
        const fd = new FormData()
        if (body) fd.append('body', body)
        fd.append('fichier', file)
        if (isVoiceNote) fd.append('attachment_kind', 'voice')
        ;({ data } = await api.post(`/messages/${user.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }))
      } else {
        ;({ data } = await api.post(`/messages/${user.id}`, { body }))
      }
      setMessages(prev => [...prev, data])
      notifyRefresh()
    } catch {
      toast.error("Erreur lors de l'envoi du message.")
      throw new Error('send-failed')
    }
  }

  return (
    <Box className="fade-in" sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Box sx={{ position: 'relative', flexShrink: 0 }}>
          <Box sx={{
            width: 48, height: 48, borderRadius: 2.5,
            background: 'linear-gradient(135deg,#1565C0,#0D47A1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ForumIcon sx={{ color: 'white', fontSize: 26 }} />
          </Box>
          <Box sx={{
            position: 'absolute', bottom: -1, right: -1,
            width: 13, height: 13, borderRadius: '50%',
            bgcolor: adminOnline ? '#4ADE80' : '#9CA3AF',
            border: '2px solid white',
          }} />
        </Box>
        <Box>
          <Typography variant="h5" fontWeight={800} color="#1a1a2e" fontSize={{ xs: 17, md: 22 }}>
            Messagerie
          </Typography>
          <Typography color="text.secondary" fontSize={14}>
            {adminOnline ? 'Un administrateur est en ligne' : 'Discutez directement avec votre comptable'}
          </Typography>
        </Box>
      </Box>

      <Card sx={{ borderRadius: 3, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ flex: 1, overflowY: 'auto', p: { xs: 1.5, md: 3 }, bgcolor: '#F7F9FC' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
          ) : messages.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <ForumIcon sx={{ fontSize: 48, color: '#ddd' }} />
              <Typography color="text.secondary" mt={1} fontSize={14}>
                Aucun message pour l'instant — dites bonjour !
              </Typography>
            </Box>
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
              const mine = m.sender_type === 'client'
              return (
                <Box key={m.id} sx={{
                  display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start',
                  mb: 1.5, gap: 1,
                }}>
                  {!mine && (
                    <Avatar sx={{ width: 28, height: 28, bgcolor: '#1565C0', fontSize: 12, fontWeight: 700 }}>
                      {m.sender_admin?.nom?.charAt(0).toUpperCase() ?? 'A'}
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
      </Card>
    </Box>
  )
}
