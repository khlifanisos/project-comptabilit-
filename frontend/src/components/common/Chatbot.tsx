import { useState, useRef, useEffect, useMemo, ReactElement } from 'react'
import {
  Box, Paper, Typography, TextField, IconButton, Avatar, Tooltip, Grow, Zoom,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
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
import LibraryBooksOutlinedIcon from '@mui/icons-material/LibraryBooksOutlined'
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined'
import { useNavigate } from 'react-router-dom'
import { platformStore } from '../../utils/platformStore'
import { categorieByKey } from '../../pages/documentation/categories'
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
  // Documentation fiscale documents the answer was based on
  sources?: ChatSource[]
  // Web pages found by Gemini's Google Search (only when enabled on the server)
  webSources?: WebSource[]
}

interface WebSource { titre: string; url: string }

interface ChatSource { id: number; titre: string; categorie: string; annee: number | null; pages: number[] }

interface Suggestion { icon: ReactElement; label: string; question: string }

const GRADIENT = 'linear-gradient(135deg,#3B82F6 0%,#6366F1 55%,#7C3AED 100%)'
const HEADER_BG = 'linear-gradient(135deg,#060E1E 0%,#0A1F44 60%,#1E3A8A 130%)'
// Above the fixed site header (1100) but below MUI dialogs/menus (1300)
const Z = 1200
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
    { icon: <LibraryBooksOutlinedIcon />,   label: 'Loi de finances 2026',  question: 'Quelles sont les principales mesures de la loi de finances 2026 ?' },
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
async function askAssistant(question: string, history: Message[], devise: string, authenticated: boolean): Promise<{ reply: string; sources?: ChatSource[]; webSources?: WebSource[] }> {
  const turns = history
    .filter(m => !m.error)
    .slice(-HISTORY_SIZE)
    .map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', text: m.text.slice(0, 4000) }))

  if (!authenticated) {
    const res = await api.post('/chat/public', { question, history: turns })
    return { reply: res.data.reply, webSources: res.data.web_sources }
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
  return { reply: res.data.reply, sources: res.data.sources, webSources: res.data.web_sources }
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
    <Avatar sx={{
      width: size, height: size, background: GRADIENT, flexShrink: 0,
      boxShadow: '0 6px 16px rgba(99,102,241,0.35)',
    }}>
      <AutoAwesomeIcon sx={{ fontSize: size * 0.52, color: 'white' }} />
    </Avatar>
  )
}

const sourceLabel = {
  fontSize: 10.5, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em',
} as const

/** Documentation fiscale documents used for the answer; each opens the document in the viewer. */
function SourceList({ sources }: { sources: ChatSource[] }) {
  const navigate = useNavigate()
  return (
    <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.6 }}>
      <Typography sx={sourceLabel}>Sources consultées</Typography>
      {sources.map(s => {
        const cat = categorieByKey(s.categorie)
        const color = cat?.color ?? '#3B82F6'
        return (
          <Box key={s.id} component="button" type="button"
            onClick={() => navigate(`/documentation/${cat?.slug ?? 'autre'}?doc=${s.id}`)}
            sx={{
              all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1,
              px: 1.2, py: 0.8, borderRadius: 2.5, bgcolor: 'background.paper',
              border: '1px solid', borderColor: 'divider', transition: 'all .15s',
              '&:hover': { borderColor: alpha(color, 0.5), bgcolor: alpha(color, 0.06), transform: 'translateX(2px)' },
              '&:focus-visible': { outline: `2px solid ${color}` },
            }}>
            <Box sx={{
              width: 26, height: 26, borderRadius: 1.5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: alpha(color, 0.12), color,
            }}>
              <LibraryBooksOutlinedIcon sx={{ fontSize: 15 }} />
            </Box>
            <Typography sx={{ fontSize: 12, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {s.titre}
            </Typography>
            {s.pages.length > 0 && (
              <Typography sx={{ fontSize: 11, color: 'text.secondary', flexShrink: 0 }}>
                p. {s.pages.slice(0, 3).join(', ')}
              </Typography>
            )}
          </Box>
        )
      })}
    </Box>
  )
}

/** Web pages Gemini used for the answer (Google Search grounding). */
function WebSourceList({ sources }: { sources: WebSource[] }) {
  return (
    <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.4 }}>
      <Typography sx={sourceLabel}>Sources web</Typography>
      {sources.map(s => (
        <Box key={s.url} component="a" href={s.url} target="_blank" rel="noopener noreferrer"
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.8, fontSize: 12, color: 'primary.main', textDecoration: 'none',
            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
            '&:hover': { textDecoration: 'underline' },
          }}>
          <PublicOutlinedIcon sx={{ fontSize: 14, flexShrink: 0 }} />
          <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.titre}</Box>
        </Box>
      ))}
    </Box>
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
      const { reply, sources, webSources } = await askAssistant(raw, history, devise, isAuthenticated)
      bot = {
        id: Date.now() + 1, text: reply, sender: 'bot', time: Date.now(),
        sources: sources?.length ? sources : undefined,
        webSources: webSources?.length ? webSources : undefined,
      }
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
  const headerBtn = {
    color: 'rgba(255,255,255,0.8)', width: 32, height: 32,
    '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.1)' },
  }

  return (
    <>
      {/* Launcher: pill with label on desktop, round on phones */}
      <Zoom in={!open}>
        <Box component="button" type="button" onClick={() => setOpen(true)} aria-label="Ouvrir l'assistant IA"
          sx={{
            all: 'unset', boxSizing: 'border-box', cursor: 'pointer',
            position: 'fixed', zIndex: Z,
            bottom: { xs: 'calc(16px + env(safe-area-inset-bottom))', md: 24 },
            right:  { xs: 'calc(16px + env(safe-area-inset-right))', md: 24 },
            display: 'flex', alignItems: 'center', gap: 1.2,
            height: 56, minWidth: 56, px: { xs: 0, sm: 2.2 }, justifyContent: 'center', borderRadius: 99,
            background: GRADIENT, color: 'white',
            boxShadow: '0 14px 34px rgba(79,70,229,0.45), inset 0 1px 0 rgba(255,255,255,0.25)',
            transition: 'transform .2s ease, box-shadow .2s ease',
            '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 18px 40px rgba(79,70,229,0.55)' },
            '&:focus-visible': { outline: '3px solid rgba(99,102,241,0.5)', outlineOffset: 3 },
            // Soft pulsing ring to draw attention
            '&::before': {
              content: '""', position: 'absolute', inset: 0, borderRadius: 'inherit', zIndex: -1,
              background: GRADIENT, animation: 'chatPulse 2.6s ease-out infinite',
            },
            '@keyframes chatPulse': {
              '0%': { transform: 'scale(1)', opacity: 0.55 },
              '100%': { transform: 'scale(1.35)', opacity: 0 },
            },
            '@media (prefers-reduced-motion: reduce)': { '&::before': { animation: 'none' } },
          }}>
          <AutoAwesomeIcon sx={{ fontSize: 22 }} />
          <Typography component="span" sx={{ display: { xs: 'none', sm: 'block' }, fontWeight: 700, fontSize: 14.5, fontFamily: 'inherit' }}>
            Assistant IA
          </Typography>
        </Box>
      </Zoom>

      <Grow in={open} style={{ transformOrigin: 'bottom right' }} unmountOnExit>
        <Paper elevation={0} role="dialog" aria-label="Assistant IA" sx={{
          position: 'fixed',
          bottom: { xs: 0, sm: 24 },
          right:  { xs: 0, sm: 24 },
          left:   { xs: 0, sm: 'auto' },
          zIndex: Z,
          width:  { xs: '100%', sm: expanded ? 'min(760px, calc(100vw - 48px))' : 410 },
          // dvh = the visible height on mobile Safari/Chrome (vh ignores their toolbars)
          height: { xs: '92dvh', sm: expanded ? 'calc(100dvh - 48px)' : 640 },
          maxHeight: { sm: 'calc(100dvh - 48px)' },
          pb: { xs: 'env(safe-area-inset-bottom)', sm: 0 },
          borderRadius: { xs: '24px 24px 0 0', sm: '24px' },
          border: '1px solid', borderColor: 'divider',
          boxShadow: '0 30px 80px rgba(2,8,23,0.35)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          bgcolor: 'background.default',
          transition: 'width 0.25s ease, height 0.25s ease',
        }}>
          {/* Header */}
          <Box sx={{ position: 'relative', overflow: 'hidden', background: HEADER_BG, px: 2, py: 1.6, display: 'flex', alignItems: 'center', gap: 1.3 }}>
            <Box aria-hidden sx={{
              position: 'absolute', right: -60, top: -90, width: 220, height: 220, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(124,58,237,0.45) 0%, transparent 65%)',
            }} />
            <Box aria-hidden sx={{
              position: 'absolute', inset: 0, opacity: 0.35,
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
              maskImage: 'linear-gradient(90deg, transparent, black)', WebkitMaskImage: 'linear-gradient(90deg, transparent, black)',
            }} />
            <Box sx={{ position: 'relative', p: '2px', borderRadius: '50%', background: 'linear-gradient(135deg,#60A5FA,#A78BFA,#22D3EE)' }}>
              <Avatar sx={{ width: 38, height: 38, bgcolor: '#0A1F44', border: '2px solid #0A1F44' }}>
                <AutoAwesomeIcon sx={{ fontSize: 19, color: 'white' }} />
              </Avatar>
            </Box>
            <Box flex={1} minWidth={0} sx={{ position: 'relative' }}>
              <Typography sx={{ color: 'white', fontWeight: 800, fontSize: 15, lineHeight: 1.2, letterSpacing: '-0.01em' }}>
                Assistant IA
              </Typography>
              <Box display="flex" alignItems="center" gap={0.7}>
                <Box className="dot-pulse" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#4ADE80' }} />
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 11.5 }}>
                  {loading ? 'Rédige une réponse…' : 'En ligne · comptabilité, fiscalité, plateforme'}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ position: 'relative', display: 'flex', gap: 0.3 }}>
              {!isEmpty && (
                <Tooltip title="Nouvelle conversation">
                  <IconButton onClick={newConversation} size="small" aria-label="Nouvelle conversation" sx={headerBtn}>
                    <EditNoteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title={expanded ? 'Réduire' : 'Agrandir'}>
                <IconButton onClick={() => setExpanded(e => !e)} size="small" aria-label={expanded ? 'Réduire' : 'Agrandir'}
                  sx={{ ...headerBtn, display: { xs: 'none', sm: 'inline-flex' } }}>
                  {expanded ? <CloseFullscreenIcon sx={{ fontSize: 17 }} /> : <OpenInFullIcon sx={{ fontSize: 17 }} />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Fermer (Échap)">
                <IconButton onClick={() => setOpen(false)} size="small" aria-label="Fermer" sx={headerBtn}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Messages */}
          <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', px: 2, py: 2, scrollbarWidth: 'thin' }}>
            {isEmpty && (
              <Box sx={{ maxWidth: 560, mx: 'auto' }}>
                <Box sx={{
                  position: 'relative', overflow: 'hidden', borderRadius: 4, p: 2.5, mb: 2, color: 'white',
                  background: 'linear-gradient(135deg,#0A1F44 0%,#1D4ED8 70%,#7C3AED 130%)',
                }}>
                  <Box aria-hidden sx={{
                    position: 'absolute', right: -30, bottom: -40, width: 160, height: 160, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(34,211,238,0.35), transparent 65%)',
                  }} />
                  <Typography sx={{ position: 'relative', fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em' }}>
                    Bonjour{firstName ? ` ${firstName}` : ''} 👋
                  </Typography>
                  <Typography sx={{ position: 'relative', fontSize: 13, color: 'rgba(255,255,255,0.78)', mt: 0.6, lineHeight: 1.55 }}>
                    {audience === 'admin'
                      ? 'Posez-moi vos questions sur vos clients, vos tickets, la fiscalité tunisienne ou la plateforme.'
                      : audience === 'client'
                        ? 'Posez-moi vos questions sur vos factures, vos relevés, la fiscalité tunisienne ou la plateforme.'
                        : 'Posez-moi vos questions sur la comptabilité, la fiscalité ou la plateforme.'}
                  </Typography>
                </Box>
                <Typography sx={{ ...sourceLabel, mb: 1, px: 0.5 }}>Suggestions</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                  {SUGGESTIONS[audience].map(s => (
                    <Box key={s.label} component="button" type="button" onClick={() => send(s.question)}
                      sx={{
                        all: 'unset', boxSizing: 'border-box', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 1.1, p: 1.2, borderRadius: 3,
                        bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', textAlign: 'left',
                        transition: 'all 0.15s',
                        '&:hover': { borderColor: '#6366F1', boxShadow: '0 8px 20px rgba(99,102,241,0.15)', transform: 'translateY(-2px)' },
                        '&:hover .sg-icon': { background: GRADIENT, color: 'white' },
                        '&:focus-visible': { outline: '2px solid #6366F1', outlineOffset: 2 },
                      }}>
                      <Box className="sg-icon" sx={{
                        width: 32, height: 32, borderRadius: 2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        bgcolor: 'rgba(99,102,241,0.1)', color: '#6366F1', transition: 'all .15s', '& svg': { fontSize: 18 },
                      }}>
                        {s.icon}
                      </Box>
                      <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: 'text.primary', lineHeight: 1.3 }}>{s.label}</Typography>
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
                  boxShadow: '0 8px 20px rgba(79,70,229,0.25)',
                }}>
                  <Typography sx={{ fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.text}</Typography>
                </Box>
              </Box>
            ) : (
              <Box key={m.id} sx={{ display: 'flex', gap: 1.2, mb: 2.2, '&:hover .msg-actions': { opacity: 1 } }}>
                <BotAvatar size={30} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Box sx={{
                    display: 'inline-block', maxWidth: '100%', px: 1.8, py: 1.3, borderRadius: '4px 18px 18px 18px',
                    bgcolor: m.error ? (t) => alpha(t.palette.error.main, 0.08) : 'background.paper',
                    border: '1px solid', borderColor: m.error ? (t) => alpha(t.palette.error.main, 0.3) : 'divider',
                    color: m.error ? 'error.main' : 'text.primary',
                    boxShadow: m.error ? 'none' : '0 4px 14px rgba(15,23,42,0.05)',
                    wordBreak: 'break-word', fontSize: 13.5,
                  }}>
                    {m.error
                      ? <Typography sx={{ fontSize: 13 }}>{m.text}</Typography>
                      : <ChatMarkdown text={m.text} />}
                  </Box>
                  {m.sources && <SourceList sources={m.sources} />}
                  {m.webSources && <WebSourceList sources={m.webSources} />}
                  <Box className="msg-actions" sx={{
                    display: 'flex', alignItems: 'center', gap: 0.3, mt: 0.4,
                    opacity: m.error ? 1 : { xs: 1, sm: 0 }, transition: 'opacity 0.15s',
                  }}>
                    <Typography sx={{ fontSize: 10.5, color: 'text.disabled', mr: 0.5 }}>
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
                            ? <CheckIcon sx={{ fontSize: 14, color: 'success.main' }} />
                            : <ContentCopyIcon sx={{ fontSize: 14, color: 'text.disabled' }} />}
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>
              </Box>
            ))}

            {loading && (
              <Box display="flex" alignItems="center" gap={1.2} mb={2}>
                <BotAvatar size={30} />
                <Box sx={{
                  bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', px: 1.8, py: 1.4,
                  borderRadius: '4px 18px 18px 18px', display: 'flex', gap: 0.6, alignItems: 'center',
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
          <Box sx={{ px: 1.5, pt: 1, pb: 1.2, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }}>
            <Box sx={{
              display: 'flex', alignItems: 'flex-end', gap: 1,
              bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '20px', pl: 1.8, pr: 0.7, py: 0.7,
              transition: 'border-color 0.15s, box-shadow 0.15s',
              '&:focus-within': { borderColor: '#6366F1', boxShadow: '0 0 0 4px rgba(99,102,241,0.15)' },
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
                  width: 36, height: 36, flexShrink: 0, background: GRADIENT, color: 'white',
                  boxShadow: '0 6px 14px rgba(79,70,229,0.35)',
                  transition: 'transform 0.15s, opacity 0.15s',
                  '&:hover': { background: GRADIENT, transform: 'scale(1.08)' },
                  '&.Mui-disabled': { background: 'none', bgcolor: 'action.disabledBackground', color: 'text.disabled', boxShadow: 'none' },
                }}>
                <ArrowUpwardIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
            <Typography sx={{ fontSize: 10.5, color: 'text.disabled', textAlign: 'center', mt: 0.8 }}>
              L'IA peut se tromper — vérifiez les montants importants.
            </Typography>
          </Box>
        </Paper>
      </Grow>
    </>
  )
}
