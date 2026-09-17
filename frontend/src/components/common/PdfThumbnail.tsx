import { useEffect, useState } from 'react'
import { Box, CircularProgress } from '@mui/material'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import pdfjsLib from '../../utils/pdfWorker'

interface PdfThumbnailProps {
  fileUrl: string // path relative to the API base, e.g. /textes-lois/3/fichier
  alt: string
}

const THUMB_W = 360

export default function PdfThumbnail({ fileUrl, alt }: PdfThumbnailProps) {
  const [src, setSrc]     = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSrc(null)
    setError(false)

    const render = async () => {
      try {
        const token = sessionStorage.getItem('token')
        const pdf = await pdfjsLib.getDocument({
          url: `/api${fileUrl}`,
          httpHeaders: token ? { Authorization: `Bearer ${token}` } : undefined,
        }).promise
        const page = await pdf.getPage(1)
        const viewport = page.getViewport({ scale: 1 })
        const scale = THUMB_W / viewport.width
        const scaledViewport = page.getViewport({ scale })

        const canvas = document.createElement('canvas')
        canvas.width  = scaledViewport.width
        canvas.height = scaledViewport.height
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('no canvas context')

        await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise
        if (!cancelled) setSrc(canvas.toDataURL('image/jpeg', 0.82))
      } catch {
        if (!cancelled) setError(true)
      }
    }

    render()
    return () => { cancelled = true }
  }, [fileUrl])

  if (error) {
    return (
      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#F5F7FB' }}>
        <PictureAsPdfIcon sx={{ color: '#C62828', fontSize: 44 }} />
      </Box>
    )
  }

  if (!src) {
    return (
      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#F5F7FB' }}>
        <CircularProgress size={22} thickness={4} />
      </Box>
    )
  }

  return (
    <Box component="img" src={src} alt={alt}
      sx={{ width: '100%', height: '100%', objectFit: 'contain', bgcolor: '#F5F7FB' }} />
  )
}
