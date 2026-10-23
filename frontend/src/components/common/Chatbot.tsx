import { useState, useRef, useEffect, useMemo, ReactElement } from 'react'
import {
  Box, Fab, Paper, Typography, TextField, IconButton, Avatar, Tooltip, Grow, Zoom,
} from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CloseIcon from '@mui/icons-material/Close'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'
import EditNoteIcon from '@mui/icons-material/EditNote'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon from '@mui/icons-material/Check'
import RefreshIcon from '@mui/icons-material/Refresh'
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined'
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined'
import PercentOutlinedIcon from '@mui/icons-material/PercentOutlined'
import DirectionsCarOutlinedIcon from '@mui/icons-material/DirectionsCarOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'
import { platformStore } from '../../utils/platformStore'
import api from '../../api/axios'
import { useCurrency } from '../../contexts/CurrencyContext'
import { useAuth } from '../../contexts/AuthContext'
import { setChatbotOpen } from '../../utils/chatbotState'
import ChatMarkdown from './ChatMarkdown'

interface Message {
  id: number
  text: string
  sender: 'user' | 'bot'
  time: number
  error?: boolean
  // For a failed answer: the question to resend with "Réessayer".
  retryOf?: string
}

interface Suggestion { icon: ReactElement; label: string; question: string }

const GRADIENT = 'linear-gradient(135deg,#1565C0 0%,#283593 100%)'
const HISTORY_SIZE = 10

const SUGGESTIONS: Record<'admin' | 'client' | 'public', Suggestion[]> = {
  admin: [
    { icon: <ConfirmationNumberOutlinedIcon />, label: 'Tickets non facturés',   question: 'Quels tickets ne sont pas encore facturés ?' },
    { icon: <EventBusyOutlinedIcon />,          label: 'Tickets en retard',      question: "Quels tickets ont dépassé leur date d'échéance ?" },
    { icon: <ReceiptLongOutlinedIcon />,        label: 'Factures non réglées',   question: 'Quelles factures ne sont pas encore réglées ?' },
    { icon: <AccountBalanceOutlinedIcon />,     label: 'Solde bancaire',         question: 'Quel est le solde bancaire actuel ?' },
  ],
  client: [
    { icon: <AccountBalanceOutlinedIcon />, label: 'Solde actuel',          question: 'Quel est mon solde bancaire actuel ?' },
    { icon: <ReceiptLongOutlinedIcon />,    label: 'Factures non réglées',  question: 'Quelles factures ne sont pas encore réglées ?' },
    { icon: <DirectionsCarOutlinedIcon />,  label: 'Échéances leasing',     question: 'Résume mes échéances de leasing à venir.' },
    { icon: <PercentOutlinedIcon />,        label: 'Taux de TVA',           question: 'Quels sont les taux de TVA en Tunisie ?' },
  ],
  public: [
    { icon: <InfoOutlinedIcon />,          label: 'La plateforme',        question: 'Que permet de faire Intelligence Comptabilité ?' },
    { icon: <PersonAddAltOutlinedIcon />,  label: 'Créer un compte',      question: 'Comment créer un compte sur la plateforme ?' },
    { icon: <FactCheckOutlinedIcon />,     label: 'Audit intelligent',    question: "Comment fonctionne l'audit intelligent ?" },
    { icon: <PercentOutlinedIcon />,       label: 'Taux de TVA',          question: 'Quels sont les taux de TVA en Tunisie ?' },
  ],
}

// The Gemini call happens in Laravel (/api/chat) so the API key never reaches the browser.
// Tickets are added server-side for admins; the public landing page gets no private data.
async function askAssistant(question: string, history: Message[], devise: string, authenticated: boolean): Promise<string> {
  const turns = history
    .filter(m => !m.error)
    .slice(-HISTORY_SIZE)
    .map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', text: m.text.slice(0, 4000) }))

  if (!authenticated) {
    const res = await api.post('/chat/public', { question, history: turns })
    return res.data.reply
  }

  const res = await api.post('/chat', {
    question,
    devise,
    history: turns,
    context: {
      solde_bancaire: platformStore.getSoldeActuel(),
      factures_ventes: platformStore.getVentes(),
      factures_achats: platformStore.getAchats(),
      releves_bancaires: platformStore.getRelevesBancaires().slice(0, 50),
      leasing: platformStore.getLeasing(),
    },
  })
  return res.data.reply
}


// Try to pull backend data only if it has MORE rows than the current store
// (components are source of truth via useEffect — never overwrite with fewer rows)
async function tryRefreshFromBackend() {
  try {
    const [achats, ventes] = await Promise.allSettled([
      api.get('/factures-achats'),
      api.get('/factures-ventes'),
    ])
    if (achats.status === 'fulfilled') {
      const data = achats.value.data?.data ?? achats.value.data
      if (Array.isArray(data) && data.length > platformStore.getAchats().length)
        platformStore.setAchats(data)
    }
    if (ventes.status === 'fulfilled') {
      const data = ventes.value.data?.data ?? ventes.value.data
      if (Array.isArray(data) && data.length > platformStore.getVentes().length)
        platformStore.setVentes(data)
    }
  } catch { /* backend not running — keep store as-is */ }
}

// Conversation survives page changes within the tab; storage can be unavailable (private mode), so never rely on it.
function loadConversation(key: string): Message[] {
  try {
    const raw = sessionStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

function saveConversation(key: string, messages: Message[]) {
  try { sessionStorage.setItem(key, JSON.stringify(messages.slice(-50))) } catch { /* ignore */ }
}

function BotAvatar({ size = 30 }: { size?: number }) {
  return (
    <Avatar sx={{ width: size, height: size, background: GRADIENT, flexShrink: 0 }}>
      <AutoAwesomeIcon sx={{ fontSize: size * 0.55, color: 'white' }} />
    </Avatar>
  )
}

// Remounted per account (login/logout/impersonation) so each one gets its own conversation
// and one account's messages can never be written under another's storage key.
export default function Chatbot() {
  const { user } = useAuth()
  const storageKey = `chatbot:${user?.id ?? 'public'}`
  return <ChatbotPanel key={storageKey} storageKey={storageKey} />
}

function ChatbotPanel({ storageKey }: { storageKey: string }) {
  const { devise } = useCurrency()
  const { user, isAuthenticated } = useAuth()
  const audience: 'admin' | 'client' | 'public' = !isAuthenticated ? 'public' : user?.role === 'admin' ? 'admin' : 'client'

  const [open, setOpen]         = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [messages, setMessages] = useState<Message[]>(() => loadConversation(storageKey))
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  const firstName = useMemo(() => user?.nom?.split(' ')[0] ?? '', [user])

  useEffect(() => { saveConversation(storageKey, messages) }, [storageKey, messages])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading, open])

  useEffect(() => {
    setChatbotOpen(open)
    if (open) setTimeout(() => inputRef.current?.focus(), 150)
    return () => setChatbotOpen(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const send = async (textOverride?: string, base: Message[] = messages) => {
    const raw = (textOverride ?? input).trim()
    if (!raw || loading) return

    const history = base
    setMessages(p => [...p, { id: Date.now(), text: raw, sender: 'user', time: Date.now() }])
    setInput('')
    setLoading(true)

    // Only when logged in: on the public landing page a 401 would make the axios interceptor redirect to /login.
    if (isAuthenticated) await tryRefreshFromBackend()

    let bot: Message
    try {
      const reply = await askAssistant(raw, history, devise, isAuthenticated)
      bot = { id: Date.now() + 1, text: reply, sender: 'bot', time: Date.now() }
    } catch (err: any) {
      const status = err?.response?.status
      bot = {
        id: Date.now() + 1, sender: 'bot', time: Date.now(), error: true, retryOf: raw,
        text: status === 429
          ? 'Trop de questions en peu de temps — réessayez dans une minute.'
          : err?.response?.data?.message ?? "L'assistant est indisponible pour le moment.",
      }
    }
    setMessages(p => [...p, bot])
    setLoading(false)
  }

  // Drop the failed answer and the question it belonged to, then ask again.
  const retry = (m: Message) => {
    if (!m.retryOf) return
    const idx = messages.findIndex(x => x.id === m.id)
    const trimmed = messages.filter((_, i) => i !== idx && !(i === idx - 1 && messages[i].sender === 'user'))
    setMessages(trimmed)
    send(m.retryOf, trimmed)
  }

  const copy = async (m: Message) => {
    try {
      await navigator.clipboard.writeText(m.text)
      setCopiedId(m.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch { /* clipboard blocked */ }
  }

  const newConversation = () => {
    setMessages([])
    setInput('')
    inputRef.current?.focus()
  }

  const isEmpty = messages.length === 0

  return (
    <>
      <Tooltip title="Assistant IA" placement="left">
        <Zoom in={!open}>
          <Fab onClick={() => setOpen(true)} aria-label="Ouvrir l'assistant IA" sx={{
            position: 'fixed',
            bottom: { xs: 16, md: 24 },
            right:  { xs: 16, md: 24 },
            zIndex: 200,
            background: GRADIENT,
            color: 'white', boxShadow: '0 10px 30px rgba(40,53,147,0.45)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            '&:hover': { transform: 'translateY(-2px) scale(1.05)', boxShadow: '0 14px 36px rgba(40,53,147,0.55)' },
          }}>
            <AutoAwesomeIcon />
          </Fab>
        </Zoom>
      </Tooltip>

      <Grow in={open} style={{ transformOrigin: 'bottom right' }} unmountOnExit>
        <Paper elevation={0} role="dialog" aria-label="Assistant IA" sx={{
          position: 'fixed',
          bottom: { xs: 0, sm: 24 },
          right:  { xs: 0, sm: 24 },
          left:   { xs: 0, sm: 'auto' },
          zIndex: 200,
          width:  { xs: '100%', sm: expanded ? 'min(720px, calc(100vw - 48px))' : 400 },
          height: { xs: '92vh', sm: expanded ? 'calc(100vh - 48px)' : 620 },
          maxHeight: { sm: 'calc(100vh - 48px)' },
          borderRadius: { xs: '20px 20px 0 0', sm: '20px' },
          border: '1px solid rgba(15,23,42,0.08)',
          boxShadow: '0 24px 70px rgba(15,23,42,0.22)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          bgcolor: '#F8FAFC',
          transition: 'width 0.25s ease, height 0.25s ease',
        }}>
          {/* Header */}
          <Box sx={{ background: GRADIENT, px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)' }}>
              <AutoAwesomeIcon sx={{ fontSize: 19, color: 'white' }} />
            </Avatar>
            <Box flex={1} minWidth={0}>
              <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 14.5, lineHeight: 1.2 }}>
                Assistant IA
              </Typography>
              <Box display="flex" alignItems="center" gap={0.6}>
                <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#4ADE80', boxShadow: '0 0 0 3px rgba(74,222,128,0.25)' }} />
                <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: 11.5 }}>
                  {loading ? 'Rédige une réponse…' : 'En ligne'}
                </Typography>
              </Box>
            </Box>
            {!isEmpty && (
              <Tooltip title="Nouvelle conversation">
                <IconButton onClick={newConversation} size="small" aria-label="Nouvelle conversation" sx={{ color: 'white' }}>
                  <EditNoteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title={expanded ? 'Réduire' : 'Agrandir'}>
              <IconButton onClick={() => setExpanded(e => !e)} size="small" aria-label={expanded ? 'Réduire' : 'Agrandir'}
                sx={{ color: 'white', display: { xs: 'none', sm: 'inline-flex' } }}>
                {expanded ? <CloseFullscreenIcon sx={{ fontSize: 17 }} /> : <OpenInFullIcon sx={{ fontSize: 17 }} />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Fermer (Échap)">
              <IconButton onClick={() => setOpen(false)} size="small" aria-label="Fermer" sx={{ color: 'white' }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Messages */}
          <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', px: 2, py: 2, scrollbarWidth: 'thin' }}>
            {isEmpty && (
              <Box sx={{ textAlign: 'center', pt: 2, pb: 1, maxWidth: 520, mx: 'auto' }}>
                <Box sx={{ display: 'inline-flex', mb: 1.5 }}><BotAvatar size={52} /></Box>
                <Typography sx={{ fontWeight: 700, fontSize: 18, color: '#0F172A' }}>
                  Bonjour{firstName ? ` ${firstName}` : ''} 👋
                </Typography>
                <Typography sx={{ fontSize: 13, color: '#64748B', mt: 0.5, mb: 2.5, px: 2 }}>
                  {audience === 'admin'
                    ? 'Je connais vos factures, relevés et tickets. Posez-moi une question ou choisissez un raccourci.'
                    : audience === 'client'
                      ? 'Je connais vos factures, relevés et leasings. Posez-moi une question ou choisissez un raccourci.'
                      : 'Posez-moi vos questions sur la comptabilité ou sur la plateforme.'}
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                  {SUGGESTIONS[audience].map(s => (
                    <Box key={s.label} component="button" type="button" onClick={() => send(s.question)}
                      sx={{
                        all: 'unset', boxSizing: 'border-box', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 1, p: 1.3, borderRadius: 3,
                        bgcolor: 'white', border: '1px solid #E2E8F0', textAlign: 'left',
                        transition: 'all 0.15s',
                        '&:hover': { borderColor: '#1565C0', boxShadow: '0 4px 14px rgba(21,101,192,0.12)', transform: 'translateY(-1px)' },
                        '&:focus-visible': { outline: '2px solid #1565C0', outlineOffset: 2 },
                        '& svg': { fontSize: 19, color: '#1565C0', flexShrink: 0 },
                      }}>
                      {s.icon}
                      <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: '#1E293B', lineHeight: 1.3 }}>{s.label}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {messages.map((m) => m.sender === 'user' ? (
              <Box key={m.id} sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Box sx={{
                  maxWidth: '82%', px: 1.8, py: 1.1, borderRadius: '18px 18px 4px 18px',
                  background: GRADIENT, color: 'white',
                  boxShadow: '0 4px 14px rgba(40,53,147,0.25)',
                }}>
                  <Typography sx={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.text}</Typography>
                </Box>
              </Box>
            ) : (
              <Box key={m.id} sx={{ display: 'flex', gap: 1.2, mb: 2, '&:hover .msg-actions': { opacity: 1 } }}>
                <BotAvatar size={28} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Box sx={{
                    display: 'inline-block', maxWidth: '100%', px: 1.8, py: 1.2, borderRadius: '4px 18px 18px 18px',
                    bgcolor: m.error ? '#FEF2F2' : 'white',
                    border: `1px solid ${m.error ? '#FECACA' : '#E2E8F0'}`,
                    color: m.error ? '#991B1B' : '#1E293B',
                    wordBreak: 'break-word',
                  }}>
                    {m.error
                      ? <Typography sx={{ fontSize: 13 }}>{m.text}</Typography>
                      : <ChatMarkdown text={m.text} />}
                  </Box>
                  <Box className="msg-actions" sx={{
                    display: 'flex', alignItems: 'center', gap: 0.3, mt: 0.4,
                    opacity: m.error ? 1 : { xs: 1, sm: 0 }, transition: 'opacity 0.15s',
                  }}>
                    <Typography sx={{ fontSize: 10.5, color: '#94A3B8', mr: 0.5 }}>
                      {new Date(m.time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                    {m.error ? (
                      <Tooltip title="Réessayer">
                        <IconButton size="small" onClick={() => retry(m)} disabled={loading} aria-label="Réessayer">
                          <RefreshIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Tooltip title={copiedId === m.id ? 'Copié !' : 'Copier'}>
                        <IconButton size="small" onClick={() => copy(m)} aria-label="Copier la réponse">
                          {copiedId === m.id
                            ? <CheckIcon sx={{ fontSize: 14, color: '#16A34A' }} />
                            : <ContentCopyIcon sx={{ fontSize: 14, color: '#94A3B8' }} />}
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>
              </Box>
            ))}

            {loading && (
              <Box display="flex" alignItems="center" gap={1.2} mb={2}>
                <BotAvatar size={28} />
                <Box sx={{
                  bgcolor: 'white', border: '1px solid #E2E8F0', px: 1.8, py: 1.3, borderRadius: '4px 18px 18px 18px',
                  display: 'flex', gap: 0.6, alignItems: 'center',
                }}>
                  {[0, 1, 2].map(i => (
                    <Box key={i} sx={{
                      width: 7, height: 7, borderRadius: '50%', background: GRADIENT,
                      animation: 'chatDot 1.2s infinite ease-in-out',
                      animationDelay: `${i * 0.18}s`,
                      '@keyframes chatDot': {
                        '0%,80%,100%': { transform: 'translateY(0)', opacity: 0.35 },
                        '40%': { transform: 'translateY(-4px)', opacity: 1 },
                      },
                    }} />
                  ))}
                </Box>
              </Box>
            )}
          </Box>

          {/* Composer */}
          <Box sx={{ px: 1.5, pt: 1, pb: 1.2, bgcolor: '#F8FAFC' }}>
            <Box sx={{
              display: 'flex', alignItems: 'flex-end', gap: 1,
              bgcolor: 'white', border: '1px solid #E2E8F0', borderRadius: '18px', pl: 1.8, pr: 0.7, py: 0.7,
              transition: 'border-color 0.15s, box-shadow 0.15s',
              '&:focus-within': { borderColor: '#1565C0', boxShadow: '0 0 0 3px rgba(21,101,192,0.12)' },
            }}>
              <TextField
                inputRef={inputRef}
                variant="standard" fullWidth multiline maxRows={5}
                placeholder="Posez votre question…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
                }}
                InputProps={{ disableUnderline: true, sx: { fontSize: 13.5, py: 0.6 } }}
                inputProps={{ maxLength: audience === 'public' ? 500 : 1000, 'aria-label': 'Votre question' }}
              />
              <IconButton onClick={() => send()} disabled={!input.trim() || loading} aria-label="Envoyer"
                sx={{
                  width: 34, height: 34, flexShrink: 0, background: GRADIENT, color: 'white',
                  transition: 'transform 0.15s, opacity 0.15s',
                  '&:hover': { background: GRADIENT, transform: 'scale(1.06)' },
                  '&.Mui-disabled': { background: '#E2E8F0', color: '#94A3B8' },
                }}>
                <ArrowUpwardIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
            <Typography sx={{ fontSize: 10.5, color: '#94A3B8', textAlign: 'center', mt: 0.8 }}>
              L'IA peut se tromper — vérifiez les montants importants.
            </Typography>
          </Box>
        </Paper>
      </Grow>
    </>
  )
}
