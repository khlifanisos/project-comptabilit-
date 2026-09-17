import { useEffect, useState } from 'react'
import { Box, Typography, CircularProgress } from '@mui/material'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import api from '../../api/axios'

export type AttachmentType = 'image' | 'video' | 'audio' | 'file'

interface AttachmentMediaProps {
  src: string // API path, e.g. /messages/{clientId}/attachment/{messageId}
  type: AttachmentType
  name: string | null
  size: number | null
  mine?: boolean
}

function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

export default function AttachmentMedia({ src, type, name, size, mine }: AttachmentMediaProps) {
  const [url, setUrl]     = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    setLoading(true)
    setError(false)

    api.get(src, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(res.data as Blob)
        setUrl(objectUrl)
      })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 160, height: 90 }}>
        <CircularProgress size={20} />
      </Box>
    )
  }

  if (error || !url) {
    return <Typography fontSize={12} color="error">Pièce jointe indisponible</Typography>
  }

  if (type === 'image') {
    return (
      <Box component="img" src={url} alt={name ?? 'image'}
        onClick={() => window.open(url, '_blank')}
        sx={{ maxWidth: 240, maxHeight: 240, borderRadius: 2, display: 'block', cursor: 'pointer' }} />
    )
  }

  if (type === 'video') {
    return (
      <Box component="video" src={url} controls
        sx={{ maxWidth: 260, maxHeight: 260, borderRadius: 2, display: 'block' }} />
    )
  }

  if (type === 'audio') {
    return <Box component="audio" src={url} controls
      sx={{ width: 230, height: 36, bgcolor: 'transparent', display: 'block' }} />
  }

  return (
    <Box component="a" href={url} download={name ?? 'fichier'}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none',
        color: 'inherit', bgcolor: mine ? 'rgba(255,255,255,0.18)' : '#F0F4F8',
        px: 1.5, py: 1, borderRadius: 2, minWidth: 160,
      }}>
      <InsertDriveFileIcon fontSize="small" />
      <Box sx={{ minWidth: 0 }}>
        <Typography fontSize={12.5} fontWeight={700} noWrap sx={{ maxWidth: 160 }}>{name ?? 'Fichier'}</Typography>
        <Typography fontSize={10.5} sx={{ opacity: 0.7 }}>{formatSize(size)}</Typography>
      </Box>
    </Box>
  )
}
