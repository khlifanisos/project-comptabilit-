import { useEffect, useMemo, useRef, useState } from 'react'
import { Link as RouterLink, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Alert, Box, Breadcrumbs, Button, Chip, CircularProgress, Collapse, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, InputBase, Link, Skeleton, Tab, Tabs, Tooltip, Typography,
  useMediaQuery,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import ExpandMoreIcon        from '@mui/icons-material/ExpandMore'
import SearchIcon            from '@mui/icons-material/Search'
import CloseIcon             from '@mui/icons-material/Close'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import DownloadIcon          from '@mui/icons-material/Download'
import OpenInNewIcon         from '@mui/icons-material/OpenInNew'
import AddIcon               from '@mui/icons-material/Add'
import EditOutlinedIcon      from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon     from '@mui/icons-material/DeleteOutline'
import NavigateNextIcon      from '@mui/icons-material/NavigateNext'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import { useAuth } from '../../contexts/AuthContext'
import { CATEGORIES, DocumentFiscal, categorieBySlug, formatSize } from './categories'
import DocumentFiscalDialog from './DocumentFiscalDialog'

const AUTRES = 'Autres'

/** Tree group of a document: its year, else its sub-category (country, code…), else "Autres". */
const groupKey = (d: DocumentFiscal) => d.annee ? String(d.annee) : (d.sous_categorie?.trim() || AUTRES)
const isYear = (k: string) => /^\d{4}$/.test(k)
/** Lower-case, accent-free text for the local filter. */
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** One document type: document list (grouped, filterable) on the left, PDF viewer on the right. */
export default function DocumentationCategorie() {
  const { slug } = useParams()
  const cat = categorieBySlug(slug)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const viewerRef = useRef<HTMLDivElement>(null)

  const [docs, setDocs] = useState<DocumentFiscal[]>([])
  const [loading, setLoading] = useState(true)
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')

  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<DocumentFiscal | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DocumentFiscal | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Load the category's documents ──────────────────────────────────────
  useEffect(() => {
    if (!cat) return
    setLoading(true)
    setFilter('')
    setOpenGroups(new Set())
    api.get('/documents-fiscaux', { params: { categorie: cat.key } })
      .then((r: { data: DocumentFiscal[] }) => setDocs(r.data))
      .catch(() => toast.error('Impossible de charger les documents.'))
      .finally(() => setLoading(false))
  }, [cat?.key])

  // Local filter, then group: years first (most recent first), sub-categories A→Z, "Autres" last
  const filtering = filter.trim().length > 0
  const groups = useMemo(() => {
    const words = norm(filter).split(/\s+/).filter(Boolean)
    const visible = words.length
      ? docs.filter(d => { const t = norm(`${d.titre} ${d.sous_categorie ?? ''} ${d.annee ?? ''}`); return words.every(w => t.includes(w)) })
      : docs
    const map = new Map<string, DocumentFiscal[]>()
    for (const d of visible) {
      const k = groupKey(d)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(d)
    }
    const rank = (k: string) => k === AUTRES ? 2 : isYear(k) ? 0 : 1
    return [...map.entries()].sort(([a], [b]) =>
      rank(a) - rank(b) || (isYear(a) && isYear(b) ? Number(b) - Number(a) : a.localeCompare(b, 'fr')))
  }, [docs, filter])
  const visibleCount = groups.reduce((n, [, items]) => n + items.length, 0)

  const selectedId = Number(searchParams.get('doc')) || null
  const selected = docs.find(d => d.id === selectedId) ?? null

  // Default selection (desktop only — on mobile the list comes first): first document of the first group
  useEffect(() => {
    if (loading || selected || groups.length === 0 || filtering || !isDesktop) return
    setSearchParams({ doc: String(groups[0][1][0].id) }, { replace: true })
  }, [loading, selected, groups, filtering, isDesktop, setSearchParams])

  // Keep the selected document's group expanded
  useEffect(() => {
    if (!selected) return
    const k = groupKey(selected)
    setOpenGroups(prev => prev.has(k) ? prev : new Set(prev).add(k))
  }, [selected?.id])

  // ── Fetch the PDF (auth is a Bearer token, so an <iframe src> can't load it directly) ──
  useEffect(() => {
    if (!selected) { setPdfUrl(null); return }
    let objectUrl: string | null = null
    let cancelled = false
    setPdfLoading(true)
    setPdfError(false)
    setPdfUrl(null)
    api.get(`/documents-fiscaux/${selected.id}/fichier`, { responseType: 'blob', timeout: 120000 })
      .then((r: { data: Blob }) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }))
        setPdfUrl(objectUrl)
      })
      .catch(() => { if (!cancelled) setPdfError(true) })
      .finally(() => { if (!cancelled) setPdfLoading(false) })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [selected?.id])

  if (!cat) return <Navigate to="/documentation" replace />

  const toggleGroup = (k: string) => setOpenGroups(prev => {
    const next = new Set(prev)
    if (next.has(k)) next.delete(k); else next.add(k)
    return next
  })

  const select = (d: DocumentFiscal) => {
    setSearchParams({ doc: String(d.id) })
    if (!isDesktop) setTimeout(() => viewerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const download = () => {
    if (!pdfUrl || !selected) return
    const a = document.createElement('a')
    a.href = pdfUrl
    a.download = `${selected.titre.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 150)}.pdf`
    a.click()
  }

  const onSaved = (saved: DocumentFiscal) => {
    if (saved.categorie !== cat.key) {
      // Moved/added to another category: follow it there
      setDocs(prev => prev.filter(d => d.id !== saved.id))
      const target = CATEGORIES.find(c => c.key === saved.categorie)!
      navigate(`/documentation/${target.slug}?doc=${saved.id}`)
      return
    }
    setDocs(prev => prev.some(d => d.id === saved.id) ? prev.map(d => d.id === saved.id ? saved : d) : [saved, ...prev])
    setSearchParams({ doc: String(saved.id) })
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/documents-fiscaux/${deleteTarget.id}`)
      setDocs(prev => prev.filter(d => d.id !== deleteTarget.id))
      if (deleteTarget.id === selectedId) setSearchParams({}, { replace: true })
      toast.success('Document supprimé.')
      setDeleteTarget(null)
    } catch {
      toast.error('Erreur lors de la suppression.')
    } finally {
      setDeleting(false)
    }
  }

  const accent = cat.color
  const isDark = theme.palette.mode === 'dark'
  const card = { bgcolor: 'background.paper', borderRadius: 3, border: '1px solid', borderColor: 'divider' } as const

  return (
    <Box className="fade-in">
      {/* ── Header ── */}
      <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 1.5, fontSize: 13.5 }}>
        <Link component={RouterLink} to="/documentation" underline="hover" color="text.secondary">
          Documentation fiscale
        </Link>
        <Typography color="text.primary" fontSize={13.5} fontWeight={500}>{cat.short}</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5, flexWrap: 'wrap' }}>
        <Box sx={{
          width: 52, height: 52, borderRadius: 3, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `linear-gradient(135deg, ${accent} 0%, ${alpha(accent, 0.75)} 100%)`,
          boxShadow: `0 8px 20px ${alpha(accent, 0.3)}`, color: 'white',
        }}>
          <cat.Icon sx={{ fontSize: 28 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography component="h1" sx={{ fontSize: { xs: 20, md: 24 }, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
            {cat.label}
          </Typography>
          <Typography color="text.secondary" fontSize={14} mt={0.3}>
            {loading ? 'Chargement…' : `${docs.length} document${docs.length > 1 ? 's' : ''} · ${cat.description}`}
          </Typography>
        </Box>
        {isAdmin && (
          <Button variant="contained" startIcon={<AddIcon />}
            onClick={() => { setEditTarget(null); setDialogOpen(true) }}>
            Ajouter un document
          </Button>
        )}
      </Box>

      {/* ── Category tabs ── */}
      <Tabs value={cat.key} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile
        onChange={(_, key) => navigate(`/documentation/${CATEGORIES.find(c => c.key === key)!.slug}`)}
        TabIndicatorProps={{ sx: { display: 'none' } }}
        sx={{ mb: 3, minHeight: 0, '& .MuiTabs-flexContainer': { gap: 1 } }}>
        {CATEGORIES.map(c => (
          <Tab key={c.key} value={c.key} disableRipple
            icon={<c.Icon sx={{ fontSize: 18 }} />} iconPosition="start" label={c.short}
            sx={{
              minHeight: 0, py: 1, px: 2, borderRadius: 999, fontSize: 13.5, fontWeight: 600,
              textTransform: 'none', color: 'text.secondary',
              border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper',
              transition: 'all .15s ease',
              '&:hover': { borderColor: alpha(c.color, 0.5), color: c.color },
              '&.Mui-selected': {
                color: 'white', bgcolor: c.color, borderColor: c.color,
                boxShadow: `0 4px 12px ${alpha(c.color, 0.35)}`,
              },
            }} />
        ))}
      </Tabs>

      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '340px 1fr', xl: '380px 1fr' },
        gap: 3, alignItems: 'start',
      }}>
        {/* ── Document list ── */}
        <Box sx={{ ...card, overflow: 'hidden', position: { md: 'sticky' }, top: { md: 88 } }}>
          <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 1, px: 1.5, height: 40, borderRadius: 2,
              bgcolor: isDark ? 'rgba(255,255,255,0.04)' : '#F4F7FB',
              border: '1px solid transparent',
              '&:focus-within': { borderColor: alpha(accent, 0.5), bgcolor: 'background.paper' },
            }}>
              <SearchIcon sx={{ fontSize: 19, color: 'text.secondary' }} />
              <InputBase value={filter} onChange={e => setFilter(e.target.value)}
                placeholder={`Filtrer les ${cat.short.toLowerCase()}…`}
                inputProps={{ 'aria-label': 'Filtrer les documents' }}
                sx={{ flex: 1, fontSize: 14 }} />
              {filter && (
                <IconButton size="small" onClick={() => setFilter('')} aria-label="Effacer le filtre">
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              )}
            </Box>
            {filtering && (
              <Typography fontSize={12} color="text.secondary" sx={{ mt: 1, px: 0.5 }}>
                {visibleCount} résultat{visibleCount > 1 ? 's' : ''}
              </Typography>
            )}
          </Box>

          <Box sx={{ maxHeight: { md: 'calc(100vh - 300px)' }, minHeight: 160, overflowY: 'auto', py: 0.5 }}>
            {loading ? (
              <Box sx={{ p: 1.5 }}>
                {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} height={40} sx={{ borderRadius: 2 }} />)}
              </Box>
            ) : groups.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="text.secondary" fontSize={14}>
                  {filtering ? 'Aucun document ne correspond à ce filtre.' : 'Aucun document pour le moment.'}
                </Typography>
              </Box>
            ) : groups.map(([group, items]) => {
              const open = filtering || openGroups.has(group)
              return (
                <Box key={group}>
                  <Box component="button" type="button" onClick={() => toggleGroup(group)} aria-expanded={open}
                    sx={{
                      all: 'unset', boxSizing: 'border-box', cursor: 'pointer', width: '100%',
                      display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.1,
                      position: 'sticky', top: 0, zIndex: 1, bgcolor: 'background.paper',
                      '&:hover': { bgcolor: 'action.hover' },
                      '&:focus-visible': { outline: `2px solid ${accent}`, outlineOffset: -2 },
                    }}>
                    <ExpandMoreIcon sx={{
                      fontSize: 20, color: 'text.secondary',
                      transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .2s ease',
                    }} />
                    <Typography fontSize={14} fontWeight={600} color="text.primary" sx={{ flex: 1 }} noWrap>{group}</Typography>
                    <Box component="span" sx={{
                      fontSize: 11.5, fontWeight: 700, px: 1, py: 0.2, borderRadius: 999,
                      bgcolor: alpha(accent, 0.1), color: accent,
                    }}>
                      {items.length}
                    </Box>
                  </Box>
                  <Collapse in={open} unmountOnExit>
                    <Box sx={{ pb: 0.5 }}>
                      {items.map(d => {
                        const active = d.id === selectedId
                        return (
                          <Box key={d.id} component="button" type="button" onClick={() => select(d)}
                            aria-current={active ? 'true' : undefined}
                            sx={{
                              all: 'unset', boxSizing: 'border-box', cursor: 'pointer', width: 'calc(100% - 16px)',
                              display: 'flex', gap: 1.2, alignItems: 'flex-start',
                              mx: 1, px: 1.5, py: 1, borderRadius: 2,
                              bgcolor: active ? alpha(accent, isDark ? 0.2 : 0.09) : 'transparent',
                              transition: 'background-color .15s ease',
                              '&:hover': { bgcolor: active ? alpha(accent, isDark ? 0.24 : 0.12) : 'action.hover' },
                              '&:focus-visible': { outline: `2px solid ${accent}`, outlineOffset: -2 },
                            }}>
                            <PictureAsPdfOutlinedIcon sx={{ fontSize: 18, mt: 0.2, flexShrink: 0, color: active ? accent : 'text.secondary' }} />
                            <Typography fontSize={13.5} lineHeight={1.45}
                              sx={{
                                color: active ? accent : 'text.primary', fontWeight: active ? 600 : 400,
                                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                              }}>
                              {d.titre}
                            </Typography>
                          </Box>
                        )
                      })}
                    </Box>
                  </Collapse>
                </Box>
              )
            })}
          </Box>
        </Box>

        {/* ── Viewer ── */}
        <Box ref={viewerRef} sx={{ minWidth: 0, scrollMarginTop: 16 }}>
          {!selected ? (
            !loading && (
              <Box sx={{ ...card, borderStyle: 'dashed', p: { xs: 4, md: 8 }, textAlign: 'center' }}>
                <Box sx={{
                  width: 72, height: 72, borderRadius: '50%', mx: 'auto', mb: 2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  bgcolor: alpha(accent, 0.1), color: accent,
                }}>
                  <cat.Icon sx={{ fontSize: 36 }} />
                </Box>
                <Typography fontWeight={700} fontSize={17}>
                  {docs.length ? 'Sélectionnez un document' : cat.label}
                </Typography>
                <Typography color="text.secondary" fontSize={14} mt={0.5}>
                  {docs.length
                    ? 'Choisissez un texte dans la liste pour l’afficher ici.'
                    : isAdmin ? 'Ajoutez le premier document de cette catégorie.' : 'Les documents de cette catégorie seront bientôt disponibles.'}
                </Typography>
              </Box>
            )
          ) : (
            <Box sx={{ ...card, overflow: 'hidden' }}>
              {/* Toolbar */}
              <Box sx={{
                display: 'flex', alignItems: { xs: 'flex-start', lg: 'center' }, gap: 2, p: { xs: 2, md: 2.5 },
                flexDirection: { xs: 'column', lg: 'row' },
                borderBottom: '1px solid', borderColor: 'divider',
              }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography component="h2" fontWeight={700} fontSize={{ xs: 15.5, md: 17 }} lineHeight={1.35}>
                    {selected.titre}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.8, mt: 1, flexWrap: 'wrap' }}>
                    {selected.annee && <Chip size="small" label={selected.annee} sx={{ fontWeight: 600, bgcolor: alpha(accent, 0.1), color: accent }} />}
                    {selected.sous_categorie && <Chip size="small" label={selected.sous_categorie} variant="outlined" sx={{ maxWidth: 260 }} />}
                    {selected.taille ? <Chip size="small" icon={<PictureAsPdfOutlinedIcon />} label={`PDF · ${formatSize(selected.taille)}`} variant="outlined" /> : null}
                  </Box>
                  {selected.description && (
                    <Typography color="text.secondary" fontSize={13.5} mt={1}>{selected.description}</Typography>
                  )}
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                  <Button variant="contained" startIcon={<DownloadIcon />} onClick={download} disabled={!pdfUrl}>
                    Télécharger
                  </Button>
                  <Tooltip title="Ouvrir dans un nouvel onglet">
                    <span>
                      <IconButton onClick={() => pdfUrl && window.open(pdfUrl, '_blank', 'noopener')} disabled={!pdfUrl}
                        aria-label="Ouvrir dans un nouvel onglet"
                        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  {isAdmin && (
                    <>
                      <Tooltip title="Modifier">
                        <IconButton onClick={() => { setEditTarget(selected); setDialogOpen(true) }} aria-label="Modifier"
                          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Supprimer">
                        <IconButton color="error" onClick={() => setDeleteTarget(selected)} aria-label="Supprimer"
                          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                </Box>
              </Box>

              {/* PDF */}
              <Box sx={{
                height: { xs: '75vh', md: 'calc(100vh - 340px)' }, minHeight: 460,
                bgcolor: '#2B2F33', position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {pdfLoading && (
                  <Box sx={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>
                    <CircularProgress sx={{ color: 'white' }} />
                    <Typography fontSize={13} mt={1.5}>Chargement du document…</Typography>
                  </Box>
                )}
                {pdfError && <Alert severity="error">Impossible de charger le document.</Alert>}
                {pdfUrl && (
                  <Box component="iframe" src={pdfUrl} title={selected.titre}
                    sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} />
                )}
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {isAdmin && (
        <DocumentFiscalDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSaved={onSaved}
          doc={editTarget}
          defaultCategorie={cat.key}
        />
      )}

      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700} fontSize={16}>Supprimer ce document ?</DialogTitle>
        <DialogContent>
          <Alert severity="error">
            <strong>{deleteTarget?.titre}</strong> sera définitivement supprimé pour tous les utilisateurs.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting} color="inherit">Annuler</Button>
          <Button variant="contained" color="error" onClick={confirmDelete} disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <DeleteOutlineIcon />}>
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
