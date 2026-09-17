import { useState, useRef, useEffect } from 'react'
import { Box, TextField, IconButton, Tooltip, CircularProgress, Typography } from '@mui/material'
import AttachFileIcon        from '@mui/icons-material/AttachFile'
import MicIcon                from '@mui/icons-material/Mic'
import SendIcon               from '@mui/icons-material/Send'
import CloseIcon              from '@mui/icons-material/Close'
import DeleteIcon             from '@mui/icons-material/Delete'
import StopCircleIcon         from '@mui/icons-material/StopCircle'
import FiberManualRecordIcon  from '@mui/icons-material/FiberManualRecord'
import InsertDriveFileIcon    from '@mui/icons-material/InsertDriveFile'
import toast from 'react-hot-toast'

interface ChatComposerProps {
  onSend: (body: string, file: File | null, isVoiceNote?: boolean) => Promise<void>
}

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 Mo

function fmtTime(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function ChatComposer({ onSend }: ChatComposerProps) {
  const [text, setText]       = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingIsVoice, setPendingIsVoice] = useState(false)
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const [recording, setRecording]         = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)

  const fileRef           = useRef<HTMLInputElement>(null)
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null)
  const chunksRef         = useRef<Blob[]>([])
  const streamRef         = useRef<MediaStream | null>(null)
  const timerRef          = useRef<number | null>(null)

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])
  useEffect(() => () => {
    // Clean up if the component unmounts mid-recording
    streamRef.current?.getTracks().forEach(t => t.stop())
    if (timerRef.current) window.clearInterval(timerRef.current)
  }, [])

  const clearPending = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPendingFile(null)
    setPendingIsVoice(false)
    setPreviewUrl(null)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > MAX_FILE_SIZE) { toast.error('Fichier trop volumineux (max 25 Mo).'); return }
    clearPending()
    setPendingFile(f)
    setPreviewUrl(URL.createObjectURL(f))
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        const file = new File([blob], `message-vocal-${Date.now()}.webm`, { type: blob.type })
        clearPending()
        setPendingFile(file)
        setPendingIsVoice(true)
        setPreviewUrl(URL.createObjectURL(file))
        stream.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      mediaRecorderRef.current = mr
      mr.start()
      setRecording(true)
      setRecordSeconds(0)
      timerRef.current = window.setInterval(() => setRecordSeconds(s => s + 1), 1000)
    } catch {
      toast.error("Impossible d'accéder au microphone.")
    }
  }

  const stopTimer = () => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
    stopTimer()
  }

  const cancelRecording = () => {
    if (mediaRecorderRef.current) mediaRecorderRef.current.onstop = null
    mediaRecorderRef.current?.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setRecording(false)
    stopTimer()
  }

  const handleSend = async () => {
    const body = text.trim()
    if (!body && !pendingFile) return
    setSending(true)
    try {
      await onSend(body, pendingFile, pendingIsVoice)
      setText('')
      clearPending()
    } catch {
      // the parent already shows an error toast
    } finally {
      setSending(false)
    }
  }

  return (
    <Box sx={{
      borderTop: '1px solid #EEF1F6', bgcolor: 'white',
      '@keyframes recPulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
    }}>
      <Box component="input" ref={fileRef} type="file" hidden onChange={handleFileChange} />

      {pendingFile && !recording && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, pt: 1.5 }}>
          {pendingFile.type.startsWith('image/') && previewUrl ? (
            <Box component="img" src={previewUrl} sx={{ width: 44, height: 44, borderRadius: 1.5, objectFit: 'cover' }} />
          ) : pendingFile.type.startsWith('audio/') && previewUrl ? (
            <Box component="audio" src={previewUrl} controls
              sx={{ height: 32, maxWidth: 200, bgcolor: 'transparent' }} />
          ) : pendingFile.type.startsWith('video/') && previewUrl ? (
            <Box component="video" src={previewUrl} sx={{ width: 60, height: 44, borderRadius: 1.5, objectFit: 'cover' }} />
          ) : (
            <InsertDriveFileIcon sx={{ color: '#1565C0' }} />
          )}
          <Typography fontSize={12} noWrap sx={{ flex: 1, minWidth: 0 }}>{pendingFile.name}</Typography>
          <IconButton size="small" onClick={clearPending}><CloseIcon fontSize="small" /></IconButton>
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, p: 1.5 }}>
        {recording ? (
          <Box sx={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 1.2,
            px: 1.5, py: 1, bgcolor: '#FFEBEE', borderRadius: 2,
          }}>
            <FiberManualRecordIcon sx={{ color: '#C62828', fontSize: 14, animation: 'recPulse 1.2s ease-in-out infinite' }} />
            <Typography fontSize={13} color="#C62828" fontWeight={700}>{fmtTime(recordSeconds)}</Typography>
            <Typography fontSize={12} color="text.secondary">Enregistrement…</Typography>
            <Box sx={{ flex: 1 }} />
            <Tooltip title="Annuler">
              <IconButton size="small" onClick={cancelRecording}><DeleteIcon fontSize="small" /></IconButton>
            </Tooltip>
            <Tooltip title="Arrêter et joindre">
              <IconButton size="small" onClick={stopRecording} sx={{ color: '#C62828' }}>
                <StopCircleIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ) : (
          <>
            <Tooltip title="Joindre un fichier">
              <IconButton onClick={() => fileRef.current?.click()}><AttachFileIcon fontSize="small" /></IconButton>
            </Tooltip>
            <TextField
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Écrire un message…"
              fullWidth
              multiline
              maxRows={4}
              size="small"
            />
            <Tooltip title="Message vocal">
              <IconButton onClick={startRecording}><MicIcon fontSize="small" /></IconButton>
            </Tooltip>
          </>
        )}

        {!recording && (
          <Tooltip title="Envoyer">
            <span>
              <IconButton
                onClick={handleSend}
                disabled={sending || (!text.trim() && !pendingFile)}
                sx={{ bgcolor: '#1565C0', color: 'white', '&:hover': { bgcolor: '#0D47A1' }, '&.Mui-disabled': { bgcolor: '#CFD8E3', color: 'white' } }}>
                {sending ? <CircularProgress size={18} color="inherit" /> : <SendIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Box>
    </Box>
  )
}
