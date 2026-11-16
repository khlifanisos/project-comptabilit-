import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Alert, Box, Button, CircularProgress, Collapse, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Tooltip, Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import ChevronRightIcon      from '@mui/icons-material/ChevronRight'
import ExpandMoreIcon        from '@mui/icons-material/ExpandMore'
import ArrowBackIcon         from '@mui/icons-material/ArrowBack'
import ArticleOutlinedIcon   from '@mui/icons-material/ArticleOutlined'
import DownloadIcon          from '@mui/icons-material/Download'
import OpenInNewIcon         from '@mui/icons-material/OpenInNew'
import AddIcon               from '@mui/icons-material/Add'
import EditOutlinedIcon      from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon     from '@mui/icons-material/DeleteOutline'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import { useAuth } from '../../contexts/AuthContext'
import { CATEGORIES, DocumentFiscal, categorieBySlug, formatSize } from './categories'
import DocumentFiscalDialog from './DocumentFiscalDialog'

const AUTRES = 'Autres'

/** Tree group of a document: its year, else its sub-category (country, code…), else "Autres". */
const groupKey = (d: DocumentFiscal) => d.annee ? String(d.annee) : (d.sous_categorie?.trim() || AUTRES)
const isYear = (k: string) => /^\d{4}$/.test(k)

/** One document type: category menu + year tree on the left, PDF viewer on the right. */
export default function DocumentationCategorie() {
  const { slug } = useParams()
  const cat = categorieBySlug(slug)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const theme = useTheme()

  const [docs, setDocs] = useState<DocumentFiscal[]>([])
  const [loading, setLoading] = useState(true)
  const [openYears, setOpenYears] = useState<Set<string>>(new Set())

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
    api.get('/documents-fiscaux', { params: { categorie: cat.key } })
      .then((r: { data: DocumentFiscal[] }) => setDocs(r.data))
      .catch(() => toast.error('Impossible de charger les documents.'))
      .finally(() => setLoading(false))
  }, [cat?.key])

  // Years first (most recent first), then sub-categories A→Z, then "Autres"
  const groups = useMemo(() => {
    const map = new Map<string, DocumentFiscal[]>()
    for (const d of docs) {
      const k = groupKey(d)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(d)
    }
    const rank = (k: string) => k === AUTRES ? 2 : isYear(k) ? 0 : 1
    return [...map.entries()].sort(([a], [b]) =>
      rank(a) - rank(b) || (isYear(a) && isYear(b) ? Number(b) - Number(a) : a.localeCompare(b, 'fr')))
  }, [docs])

  const selectedId = Number(searchParams.get('doc')) || null
  const selected = docs.find(d => d.id === selectedId) ?? null

  // Default selection: first document of the most recent year
  useEffect(() => {
    if (loading || selected || groups.length === 0) return
    setSearchParams({ doc: String(groups[0][1][0].id) }, { replace: true })
  }, [loading, selected, groups, setSearchParams])

  // Keep the selected document's year expanded
  useEffect(() => {
    if (!selected) return
    const k = groupKey(selected)
    setOpenYears(prev => prev.has(k) ? prev : new Set(prev).add(k))
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

  const toggleYear = (k: string) => setOpenYears(prev => {
    const next = new Set(prev)
    if (next.has(k)) next.delete(k); else next.add(k)
    return next
  })

  const download = () => {
    if (!pdfUrl || !selected) return
    const a = document.createElement('a')
    a.href = pdfUrl
    a.download = `${selected.titre.replace(/[\\/:*?"<>|]+/g, '-')}.pdf`
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
    setDocs(prev => {
      const exists = prev.some(d => d.id === saved.id)
      return exists ? prev.map(d => d.id === saved.id ? saved : d) : [saved, ...prev]
    })
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

  const activeBg = alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.18 : 0.08)

  return (
    <Box className="fade-in">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/documentation')} color="inherit" size="small">
          Documentation fiscale
        </Button>
        <Box sx={{ flex: 1 }} />
        {isAdmin && (
          <Button variant="contained" startIcon={<AddIcon />} size="small"
            onClick={() => { setEditTarget(null); setDialogOpen(true) }}>
            Ajouter un document
          </Button>
        )}
      </Box>

      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '300px 1fr', lg: '340px 1fr' },
        gap: 3, alignItems: 'start',
      }}>
        {/* ── Left panel: categories + year tree ── */}
        <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
          <List disablePadding>
            {CATEGORIES.map(c => {
              const active = c.key === cat.key
              return (
                <ListItemButton key={c.key} selected={active}
                  onClick={() => !active && navigate(`/documentation/${c.slug}`)}
                  sx={{
                    py: 1.3,
                    borderRight: '3px solid', borderRightColor: active ? 'primary.main' : 'transparent',
                    '&.Mui-selected, &.Mui-selected:hover': { bgcolor: activeBg },
                  }}>
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <c.Icon sx={{ color: 'primary.main', opacity: active ? 1 : 0.6 }} />
                  </ListItemIcon>
                  <ListItemText primary={c.label}
                    primaryTypographyProps={{ fontSize: 14.5, color: active ? 'primary.main' : 'text.primary', fontWeight: active ? 600 : 400 }} />
                </ListItemButton>
              )
            })}
          </List>

          <Box sx={{ borderTop: '1px solid', borderColor: 'divider', py: 1, maxHeight: { md: 'calc(100vh - 420px)' }, minHeight: 120, overflowY: 'auto' }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
            ) : groups.length === 0 ? (
              <Typography color="text.secondary" fontSize={13.5} sx={{ px: 2.5, py: 2 }}>
                Aucun document pour le moment.
              </Typography>
            ) : (
              <List dense disablePadding>
                {groups.map(([year, items]) => {
                  const open = openYears.has(year)
                  return (
                    <Box key={year}>
                      <ListItemButton onClick={() => toggleYear(year)} sx={{ pl: 2.5 }}>
                        <ListItemIcon sx={{ minWidth: 28 }}>
                          {open ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                        </ListItemIcon>
                        <ListItemText primary={year} secondary={open ? null : `${items.length}`}
                          primaryTypographyProps={{ fontSize: 14, color: 'text.secondary' }}
                          secondaryTypographyProps={{ fontSize: 11, component: 'span', sx: { ml: 1 } }}
                          sx={{ display: 'flex', alignItems: 'baseline', my: 0.3 }} />
                      </ListItemButton>
                      <Collapse in={open} unmountOnExit>
                        <List dense disablePadding>
                          {items.map(d => {
                            const active = d.id === selectedId
                            return (
                              <ListItemButton key={d.id} selected={active}
                                onClick={() => setSearchParams({ doc: String(d.id) })}
                                sx={{ pl: 6, '&.Mui-selected, &.Mui-selected:hover': { bgcolor: activeBg } }}>
                                <ListItemIcon sx={{ minWidth: 26 }}>
                                  <ArticleOutlinedIcon sx={{ fontSize: 17, color: active ? 'primary.main' : 'text.secondary' }} />
                                </ListItemIcon>
                                <ListItemText primary={d.titre}
                                  primaryTypographyProps={{ fontSize: 13.5, color: active ? 'primary.main' : 'text.secondary', fontWeight: active ? 600 : 400 }} />
                              </ListItemButton>
                            )
                          })}
                        </List>
                      </Collapse>
                    </Box>
                  )
                })}
              </List>
            )}
          </Box>
        </Box>

        {/* ── Right panel: viewer ── */}
        <Box sx={{ minWidth: 0 }}>
          {!selected ? (
            !loading && (
              <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, border: '1px dashed', borderColor: 'divider', p: 5, textAlign: 'center' }}>
                <cat.Icon sx={{ fontSize: 48, color: 'primary.main', opacity: 0.5, mb: 1 }} />
                <Typography fontWeight={600}>{cat.label}</Typography>
                <Typography color="text.secondary" fontSize={14} mt={0.5}>
                  {isAdmin ? 'Ajoutez le premier document de cette catégorie.' : 'Les documents de cette catégorie seront bientôt disponibles.'}
                </Typography>
              </Box>
            )
          ) : (
            <>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1.5 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: { xs: 14, md: 15 }, color: 'text.secondary' }}>
                    {selected.titre}
                  </Typography>
                  {selected.description && (
                    <Typography color="text.secondary" fontSize={13} mt={0.5}>{selected.description}</Typography>
                  )}
                </Box>
                {isAdmin && (
                  <>
                    <Tooltip title="Modifier">
                      <IconButton size="small" onClick={() => { setEditTarget(selected); setDialogOpen(true) }}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Supprimer">
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(selected)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
              </Box>

              <Box sx={{
                height: { xs: '70vh', md: 'calc(100vh - 260px)' }, minHeight: 420,
                bgcolor: '#323639', borderRadius: 1, overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {pdfLoading && <CircularProgress sx={{ color: 'white' }} />}
                {pdfError && <Alert severity="error">Impossible de charger le document.</Alert>}
                {pdfUrl && (
                  <Box component="iframe" src={pdfUrl} title={selected.titre}
                    sx={{ width: '100%', height: '100%', border: 0, bgcolor: '#323639' }} />
                )}
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 2, flexWrap: 'wrap' }}>
                <Button variant="contained" size="large" startIcon={<DownloadIcon />}
                  onClick={download} disabled={!pdfUrl}
                  sx={{ px: 4, fontWeight: 700 }}>
                  Télécharger
                </Button>
                {/* Mobile browsers often can't display a PDF inside a page: offer a full-screen tab */}
                <Button variant="outlined" startIcon={<OpenInNewIcon />} disabled={!pdfUrl}
                  onClick={() => pdfUrl && window.open(pdfUrl, '_blank', 'noopener')}>
                  Ouvrir
                </Button>
                {selected.taille ? (
                  <Typography color="text.secondary" fontSize={13}>PDF · {formatSize(selected.taille)}</Typography>
                ) : null}
              </Box>
            </>
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
