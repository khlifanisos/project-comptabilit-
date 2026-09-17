import { useState, useRef, useEffect } from 'react'
import {
  Box, Fab, Paper, Typography, TextField, IconButton,
  Avatar, Divider, Chip
} from '@mui/material'
import ChatIcon from '@mui/icons-material/Chat'
import CloseIcon from '@mui/icons-material/Close'
import SendIcon from '@mui/icons-material/Send'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import { platformStore } from '../../utils/platformStore'
import api from '../../api/axios'
import { useCurrency } from '../../contexts/CurrencyContext'
import { setChatbotOpen } from '../../utils/chatbotState'

interface Message {
  id: number
  text: string
  sender: 'user' | 'bot'
  time: Date
}

const SUGGESTIONS = [
  'Solde actuel',
  'Factures non réglées',
  'Relevés bancaires',
  'Leasing',
  'Taux TVA',
  'Aide',
]


const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY as string

const GEMINI_MODELS = [
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro',
]

async function askGemini(question: string, devise: string): Promise<string> {
  const ventes  = platformStore.getVentes()
  const achats  = platformStore.getAchats()
  const releves = platformStore.getRelevesBancaires()
  const leasing = platformStore.getLeasing()
  const solde   = platformStore.getSoldeActuel()

  const prompt = `Tu es un assistant comptable et financier intelligent. Réponds TOUJOURS en français, de façon claire et concise.

Données comptables de l'entreprise :
- Solde bancaire : ${solde.toLocaleString('fr-FR')} ${devise}
- Factures ventes (${ventes.length}) : ${JSON.stringify(ventes.slice(0, 10))}
- Factures achats (${achats.length}) : ${JSON.stringify(achats.slice(0, 10))}
- Relevés bancaires (${releves.length}) : ${JSON.stringify(releves.slice(0, 10))}
- Leasing (${leasing.length}) : ${JSON.stringify(leasing)}

Question : ${question}`

  let lastError = ''
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        lastError = `${model} → ${res.status}: ${JSON.stringify(err)}`
        continue
      }
      const json = await res.json()
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text
      if (text) return text
    } catch (e) {
      lastError = `${model} → ${String(e)}`
    }
  }
  throw new Error(lastError)
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

export default function Chatbot() {
  const { devise } = useCurrency()
  const [open, setOpen]         = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: "Bonjour ! Je suis votre assistant comptable intelligent. Posez-moi vos questions sur la comptabilité ou la plateforme.", sender: 'bot', time: new Date() }
  ])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    setChatbotOpen(open)
    return () => setChatbotOpen(false)
  }, [open])

  const addBotMsg = (text: string) => {
    setMessages(p => [...p, { id: Date.now() + 1, text, sender: 'bot', time: new Date() }])
    setLoading(false)
  }

  const send = async (textOverride?: string) => {
    const raw = (textOverride ?? input).trim()
    if (!raw) return

    setMessages(p => [...p, { id: Date.now(), text: raw, sender: 'user', time: new Date() }])
    setInput('')
    setLoading(true)

    await tryRefreshFromBackend()

    try {
      const reply = await askGemini(raw, devise)
      addBotMsg(reply)
    } catch (err) {
      addBotMsg(`❌ Erreur de connexion à Gemini. Vérifiez votre connexion internet.\n\nDétail : ${String(err)}`)
      setLoading(false)
    }
  }

  return (
    <>
      {!open && (
        <Fab onClick={() => setOpen(true)} sx={{
          position: 'fixed',
          bottom: { xs: 16, md: 24 },
          right:  { xs: 16, md: 24 },
          zIndex: 200,
          background: 'linear-gradient(135deg,#1565C0,#0D47A1)',
          color: 'white', boxShadow: '0 8px 24px rgba(21,101,192,0.5)',
          '&:hover': { transform: 'scale(1.08)' }, transition: 'transform 0.2s',
        }}>
          <ChatIcon />
        </Fab>
      )}

      {open && (
        <Paper elevation={0} sx={{
          position: 'fixed',
          bottom: { xs: 0, sm: 24 },
          right:  { xs: 0, sm: 24 },
          left:   { xs: 0, sm: 'auto' },
          zIndex: 200,
          width:  { xs: '100%', sm: 370 },
          height: { xs: '90vh', sm: 560 },
          borderRadius: { xs: '16px 16px 0 0', sm: 4 },
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Header */}
          <Box sx={{
            background: 'linear-gradient(135deg,#1565C0,#0D47A1)',
            px: 2.5, py: 1.8,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <Box display="flex" alignItems="center" gap={1.2}>
              <Avatar sx={{ width: 34, height: 34, bgcolor: 'rgba(255,255,255,0.2)' }}>
                <SmartToyIcon sx={{ fontSize: 20, color: 'white' }} />
              </Avatar>
              <Box>
                <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>
                  Assistant Comptable
                </Typography>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#4caf50' }} />
                  <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>En ligne</Typography>
                </Box>
              </Box>
            </Box>
            <IconButton onClick={() => setOpen(false)} sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Messages */}
          <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 1.5, bgcolor: '#f8faff' }}>
            {messages.map((m) => (
              <Box key={m.id} sx={{
                display: 'flex',
                justifyContent: m.sender === 'user' ? 'flex-end' : 'flex-start',
                mb: 1.5,
              }}>
                {m.sender === 'bot' && (
                  <Avatar sx={{ width: 28, height: 28, mr: 1, bgcolor: '#1565C0', mt: 0.3, flexShrink: 0 }}>
                    <SmartToyIcon sx={{ fontSize: 16, color: 'white' }} />
                  </Avatar>
                )}
                <Box sx={{
                  maxWidth: '78%', px: 2, py: 1.2, borderRadius: 3,
                  bgcolor: m.sender === 'user' ? '#1565C0' : 'white',
                  color: m.sender === 'user' ? 'white' : '#1a1a2e',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  borderBottomRightRadius: m.sender === 'user' ? 4 : 16,
                  borderBottomLeftRadius: m.sender === 'bot' ? 4 : 16,
                }}>
                  <Typography fontSize={12.5} lineHeight={1.6} sx={{ whiteSpace: 'pre-line' }}>
                    {m.text}
                  </Typography>
                  <Typography fontSize={10} sx={{ opacity: 0.55, textAlign: 'right', mt: 0.3 }}>
                    {m.time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                </Box>
              </Box>
            ))}

            {loading && (
              <Box display="flex" alignItems="center" gap={1} mb={1.5}>
                <Avatar sx={{ width: 28, height: 28, bgcolor: '#1565C0', flexShrink: 0 }}>
                  <SmartToyIcon sx={{ fontSize: 16, color: 'white' }} />
                </Avatar>
                <Box sx={{ bgcolor: 'white', px: 2, py: 1.5, borderRadius: 3,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)', display: 'flex', gap: 0.6, alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <Box key={i} sx={{
                      width: 6, height: 6, borderRadius: '50%', bgcolor: '#1565C0',
                      animation: 'bounce 1.2s infinite',
                      animationDelay: `${i * 0.2}s`,
                      '@keyframes bounce': {
                        '0%,80%,100%': { transform: 'scale(0.6)', opacity: 0.4 },
                        '40%': { transform: 'scale(1)', opacity: 1 },
                      },
                    }} />
                  ))}
                </Box>
              </Box>
            )}
            <div ref={bottomRef} />
          </Box>

          {/* Suggestions */}
          <Box sx={{ px: 2, py: 1, bgcolor: '#f8faff', display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
            {SUGGESTIONS.map(s => (
              <Chip key={s} label={s} size="small" onClick={() => send(s)}
                sx={{
                  fontSize: 11, height: 24, cursor: 'pointer',
                  bgcolor: 'white', border: '1px solid #1565C020',
                  '&:hover': { bgcolor: '#e3f0ff', borderColor: '#1565C0' },
                }} />
            ))}
          </Box>

          <Divider />

          {/* Input */}
          <Box sx={{ px: 2, py: 1.5, bgcolor: 'white', display: 'flex', gap: 1 }}>
            <TextField
              size="small" fullWidth placeholder="Votre question…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 20, fontSize: 13 } }}
            />
            <IconButton onClick={() => send()}
              sx={{ bgcolor: '#1565C0', color: 'white', '&:hover': { bgcolor: '#0D47A1' } }}>
              <SendIcon fontSize="small" />
            </IconButton>
          </Box>
        </Paper>
      )}
    </>
  )
}