import { useEffect, useRef, useState, useCallback } from 'react'
import { Box, Typography, IconButton, TextField, Tooltip, Divider, Grow } from '@mui/material'
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import ZoomInIcon          from '@mui/icons-material/ZoomIn'
import ZoomOutIcon         from '@mui/icons-material/ZoomOut'
import RestartAltIcon      from '@mui/icons-material/RestartAlt'
import FullscreenIcon      from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon  from '@mui/icons-material/FullscreenExit'
import DownloadIcon        from '@mui/icons-material/Download'
import MenuBookIcon        from '@mui/icons-material/MenuBook'
import ErrorOutlineIcon    from '@mui/icons-material/ErrorOutline'
// @ts-ignore – react-pageflip ships loose/incomplete TS defs
import HTMLFlipBook from 'react-pageflip'
import api from '../../api/axios'
import pdfjsLib from '../../utils/pdfWorker'

const FlipBook = HTMLFlipBook as any

interface PdfFlipBookProps {
  fileUrl: string
  title: string
}

const PAGE_W = 500
const PAGE_H = 706 // ~A4 ratio
const ZOOM_MIN = 0.5
const ZOOM_MAX = 2.2
const ZOOM_STEP = 0.15

const ACCENT = '#1565C0'
const INK    = '#1E293B'

// Frosted-glass circular icon button used across the toolbar and nav arrows.
function GlassButton({
  onClick, disabled, title, children, size = 40,
}: {
  onClick: () => void
  disabled?: boolean
  title: string
  children: React.ReactNode
  size?: number
}) {
  return (
    <Tooltip title={title}>
      <span>
        <IconButton
          onClick={onClick}
          disabled={disabled}
          sx={{
            width: size, height: size,
            color: ACCENT,
            bgcolor: 'rgba(255,255,255,0.7)',
            border: '1px solid rgba(21,101,192,0.14)',
            backdropFilter: 'blur(6px)',
            boxShadow: '0 2px 10px rgba(21,101,192,0.08)',
            transition: 'all 0.2s cubic-bezier(.34,1.56,.64,1)',
            '&:hover': {
              bgcolor: 'rgba(21,101,192,0.12)',
              borderColor: 'rgba(21,101,192,0.35)',
              transform: 'scale(1.08)',
            },
            '&.Mui-disabled': { color: 'rgba(30,41,59,0.2)', bgcolor: 'rgba(255,255,255,0.4)' },
          }}>
          {children}
        </IconButton>
      </span>
    </Tooltip>
  )
}

export default function PdfFlipBook({ fileUrl, title }: PdfFlipBookProps) {
  const [pages, setPages]       = useState<string[]>([])
  const [pdfBlob, setPdfBlob]   = useState<Blob | null>(null)
  const [loading, setLoading]   = useState(true)
  const [progress, setProgress] = useState(0)
  const [error, setError]       = useState<string | null>(null)
  const [current, setCurrent]   = useState(0)
  const [zoom, setZoom]         = useState(1)
  const [fullscreen, setFullscreen] = useState(false)
  const [pageInput, setPageInput]   = useState('1')
  const [ready, setReady]       = useState(false)

  const bookRef      = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      setReady(false)
      try {
        const res = await api.get(fileUrl, { responseType: 'arraybuffer' })
        const bytes = res.data as ArrayBuffer
        if (!cancelled) setPdfBlob(new Blob([bytes], { type: 'application/pdf' }))

        const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise
        const images: string[] = []

        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return
          const page = await pdf.getPage(i)
          const viewport = page.getViewport({ scale: 1 })
          const scale = PAGE_W / viewport.width
          const scaledViewport = page.getViewport({ scale })

          const canvas = document.createElement('canvas')
          canvas.width  = scaledViewport.width
          canvas.height = scaledViewport.height
          const ctx = canvas.getContext('2d')
          if (!ctx) continue

          await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise
          images.push(canvas.toDataURL('image/jpeg', 0.85))
          if (!cancelled) setProgress(Math.round((i / pdf.numPages) * 100))
        }

        if (!cancelled) {
          setPages(images)
          requestAnimationFrame(() => setReady(true))
        }
      } catch {
        if (!cancelled) setError("Impossible de charger ce document PDF.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [fileUrl])

  // ── Navigation ────────────────────────────────────────────────────────────
  const goPrev = useCallback(() => bookRef.current?.pageFlip()?.flipPrev(), [])
  const goNext = useCallback(() => bookRef.current?.pageFlip()?.flipNext(), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goPrev, goNext])

  useEffect(() => { setPageInput(String(current + 1)) }, [current])

  const goToPage = () => {
    const n = parseInt(pageInput, 10)
    if (!Number.isFinite(n) || n < 1 || n > pages.length) { setPageInput(String(current + 1)); return }
    bookRef.current?.pageFlip()?.flip(n - 1)
  }

  // ── Zoom ─────────────────────────────────────────────────────────────────
  const zoomIn    = () => setZoom(z => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))
  const zoomOut   = () => setZoom(z => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))
  const zoomReset = () => setZoom(1)

  // ── Fullscreen ───────────────────────────────────────────────────────────
  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      containerRef.current?.requestFullscreen?.()
    }
  }

  // ── Download ─────────────────────────────────────────────────────────────
  const handleDownload = () => {
    if (!pdfBlob) return
    const url = URL.createObjectURL(pdfBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/\s+/g, '_')}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const shellSx = {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 2.5,
    borderRadius: fullscreen ? 0 : 4,
    width: '100%',
    minHeight: fullscreen ? '100vh' : 680,
    height: fullscreen ? '100vh' : 'auto',
    py: 3, px: 2,
    position: 'relative',
    overflow: 'hidden',
    background: 'radial-gradient(circle at 50% 0%, #EEF5FF 0%, #F7FAFD 55%, #FFFFFF 100%)',
    '@keyframes glow': {
      '0%, 100%': { opacity: 0.4, transform: 'scale(1)' },
      '50%':      { opacity: 0.7, transform: 'scale(1.08)' },
    },
    '@keyframes spin': {
      '0%':   { transform: 'rotate(0deg)' },
      '100%': { transform: 'rotate(360deg)' },
    },
  } as const

  if (loading) {
    return (
      <Box sx={shellSx}>
        <Box sx={{
          position: 'absolute', width: 260, height: 260, borderRadius: '50%',
          background: `radial-gradient(circle, ${ACCENT}22 0%, transparent 70%)`,
          animation: 'glow 2.4s ease-in-out infinite',
        }} />
        <Box sx={{ position: 'relative', width: 78, height: 78 }}>
          <Box sx={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: '3px solid rgba(21,101,192,0.12)',
          }} />
          <Box sx={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: `3px solid transparent`,
            borderTopColor: ACCENT, borderRightColor: ACCENT,
            animation: 'spin 1.1s linear infinite',
          }} />
          <Box sx={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: 46, height: 46, borderRadius: '50%',
            background: `linear-gradient(135deg, ${ACCENT}, #0D47A1)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(21,101,192,0.35)',
          }}>
            <MenuBookIcon sx={{ color: 'white', fontSize: 22 }} />
          </Box>
        </Box>
        <Typography color={INK} sx={{ opacity: 0.75 }} fontWeight={600} fontSize={14}>
          Préparation du livre… {progress}%
        </Typography>
        <Box sx={{ width: 240, height: 6, borderRadius: 3, bgcolor: 'rgba(21,101,192,0.1)', overflow: 'hidden' }}>
          <Box sx={{
            width: `${progress}%`, height: '100%', borderRadius: 3,
            background: `linear-gradient(90deg, ${ACCENT}, #42A5F5)`,
            transition: 'width 0.25s ease',
          }} />
        </Box>
      </Box>
    )
  }

  if (error || pages.length === 0) {
    return (
      <Box sx={shellSx}>
        <ErrorOutlineIcon sx={{ color: 'rgba(30,41,59,0.35)', fontSize: 44 }} />
        <Typography color={INK} sx={{ opacity: 0.75 }} fontSize={14}>{error ?? 'Aucune page à afficher.'}</Typography>
      </Box>
    )
  }

  return (
    <Box ref={containerRef} sx={shellSx}>
      {/* Ambient glow behind the book */}
      <Box sx={{
        position: 'absolute', width: 480, height: 480, borderRadius: '50%',
        background: `radial-gradient(circle, ${ACCENT}18 0%, transparent 68%)`,
        animation: 'glow 5s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      {/* Toolbar */}
      <Grow in={ready} timeout={400}>
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center',
          bgcolor: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(14px)',
          border: '1px solid rgba(21,101,192,0.12)',
          borderRadius: 20, px: 1.5, py: 0.7,
          boxShadow: '0 8px 28px rgba(21,101,192,0.1)',
          position: 'relative', zIndex: 1,
        }}>
          <GlassButton title="Zoom arrière" onClick={zoomOut} disabled={zoom <= ZOOM_MIN} size={34}>
            <ZoomOutIcon fontSize="small" />
          </GlassButton>
          <Typography fontSize={12} fontWeight={600} color={INK} sx={{ minWidth: 42, textAlign: 'center', opacity: 0.7 }}>
            {Math.round(zoom * 100)}%
          </Typography>
          <GlassButton title="Zoom avant" onClick={zoomIn} disabled={zoom >= ZOOM_MAX} size={34}>
            <ZoomInIcon fontSize="small" />
          </GlassButton>
          <GlassButton title="Réinitialiser le zoom" onClick={zoomReset} size={34}>
            <RestartAltIcon fontSize="small" />
          </GlassButton>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5, borderColor: 'rgba(21,101,192,0.14)' }} />

          <TextField
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') goToPage() }}
            onBlur={goToPage}
            size="small"
            sx={{
              width: 52,
              '& .MuiOutlinedInput-root': {
                color: INK, bgcolor: 'rgba(255,255,255,0.7)', borderRadius: 2,
                '& fieldset': { borderColor: 'rgba(21,101,192,0.2)' },
                '&:hover fieldset': { borderColor: 'rgba(21,101,192,0.4)' },
                '&.Mui-focused fieldset': { borderColor: ACCENT },
              },
              '& input': { textAlign: 'center', py: 0.6, fontSize: 12.5 },
            }}
          />
          <Typography fontSize={12} color={INK} sx={{ opacity: 0.55 }}>/ {pages.length}</Typography>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5, borderColor: 'rgba(21,101,192,0.14)' }} />

          <GlassButton title="Télécharger le PDF" onClick={handleDownload} size={34}>
            <DownloadIcon fontSize="small" />
          </GlassButton>
          <GlassButton title={fullscreen ? 'Quitter le plein écran' : 'Plein écran'} onClick={toggleFullscreen} size={34}>
            {fullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
          </GlassButton>
        </Box>
      </Grow>

      {/* Book */}
      <Grow in={ready} timeout={600} style={{ transformOrigin: 'center center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2.5 }, width: '100%', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
          <GlassButton title="Page précédente" onClick={goPrev} disabled={current <= 0} size={48}>
            <ArrowBackIosNewIcon fontSize="small" />
          </GlassButton>

          <Box sx={{
            overflow: 'auto', maxWidth: '100%',
            maxHeight: fullscreen ? '82vh' : 680,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            py: 1,
          }}>
            <Box sx={{
              transform: `scale(${zoom})`, transformOrigin: 'center center',
              transition: 'transform 0.2s cubic-bezier(.34,1.56,.64,1)',
              filter: 'drop-shadow(0 24px 46px rgba(21,101,192,0.22))',
            }}>
              <FlipBook
                ref={bookRef}
                width={PAGE_W}
                height={PAGE_H}
                size="fixed"
                minWidth={320}
                maxWidth={PAGE_W}
                minHeight={452}
                maxHeight={PAGE_H}
                showCover
                usePortrait={false}
                drawShadow
                flippingTime={700}
                maxShadowOpacity={0.4}
                className="pdf-flip-book"
                style={{}}
                onFlip={(e: { data: number }) => setCurrent(e.data)}
              >
                {pages.map((src, i) => (
                  <Box key={i} sx={{
                    width: '100%', height: '100%', bgcolor: 'white',
                    borderRadius: 1.5, overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative',
                    '&::after': {
                      // faint spine shadow toward the book's inner edge
                      content: '""', position: 'absolute', top: 0, bottom: 0,
                      width: 24,
                      [i % 2 === 0 ? 'right' : 'left']: 0,
                      background: i % 2 === 0
                        ? 'linear-gradient(to left, rgba(0,0,0,0.08), transparent)'
                        : 'linear-gradient(to right, rgba(0,0,0,0.08), transparent)',
                      pointerEvents: 'none',
                    },
                  }}>
                    <Box component="img" src={src} alt={`${title} — page ${i + 1}`}
                      sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </Box>
                ))}
              </FlipBook>
            </Box>
          </Box>

          <GlassButton title="Page suivante" onClick={goNext} disabled={current >= pages.length - 1} size={48}>
            <ArrowForwardIosIcon fontSize="small" />
          </GlassButton>
        </Box>
      </Grow>

      <Grow in={ready} timeout={800}>
        <Typography fontSize={12} color={INK} sx={{ opacity: 0.5, position: 'relative', zIndex: 1 }}>
          Page {current + 1} / {pages.length} · flèches ⇦ ⇨ pour naviguer
        </Typography>
      </Grow>
    </Box>
  )
}
