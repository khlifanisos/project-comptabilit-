import { useState, useEffect, useRef } from 'react'
import {
  Box, Typography, Card, CardContent, Button, Table, TableBody,
  TableCell, TableHead, TableRow, Chip, TextField, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid,
  IconButton, Tooltip, CircularProgress, LinearProgress, Alert,
  Checkbox, FormControlLabel, Divider,
} from '@mui/material'
import SearchIcon      from '@mui/icons-material/Search'
// DownloadIcon removed (row-level Excel removed)
import DeleteIcon      from '@mui/icons-material/Delete'
import VisibilityIcon  from '@mui/icons-material/Visibility'
import UploadFileIcon  from '@mui/icons-material/UploadFile'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import TableChartIcon  from '@mui/icons-material/TableChart'
import CloseIcon       from '@mui/icons-material/Close'
import EditIcon        from '@mui/icons-material/Edit'
import SaveIcon        from '@mui/icons-material/Save'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import { useCurrency } from '../../contexts/CurrencyContext'

interface FactureAchat {
  id: number
  numero: string
  fournisseur: string
  date: string
  montant_ht: number
  tva: number
  montant_ttc: number
  statut: string
  fichier: string | null
  client?: { nom: string; email: string }
}

interface Ligne {
  numero: string
  designation: string
  qte: string
  prix_u: number
  total_ht: number
}

interface ResumeRow { label: string; valeur: string }

interface Extracted {
  fournisseur: string
  numero_facture: string
  date: string
  montant_ht: string
  tva: string
  montant_ttc: string
  lignes: Ligne[]
  resume: ResumeRow[]
}

const statusMap: Record<string, { label: string; color: string; bg: string }> = {
  validee:    { label: 'Validée',    color: '#2E7D32', bg: '#E8F5E9' },
  en_attente: { label: 'En attente', color: '#E65100', bg: '#FFF3E0' },
  rejetee:    { label: 'Rejetée',    color: '#C62828', bg: '#FFEBEE' },
  exportee:   { label: 'Exporté',    color: '#1565C0', bg: '#E3F2FD' },
}

const emptyForm: Extracted = {
  fournisseur: '', numero_facture: '', date: '', montant_ht: '', tva: '', montant_ttc: '', lignes: [], resume: [],
}

const fmt = (n: number) =>
  Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function FacturesAchats() {
  const { devise } = useCurrency()
  const isAdmin = sessionStorage.getItem('real_role') === 'admin'

  const [rows, setRows]             = useState<FactureAchat[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')

  // Import dialog
  const [importOpen, setImportOpen] = useState(false)
  const [imageFile, setImageFile]   = useState<File | null>(null)
  const [preview, setPreview]       = useState<string | null>(null)
  const [analyzing, setAnalyzing]   = useState(false)
  const [analyzed, setAnalyzed]     = useState(false)
  const [form, setForm]             = useState<Extracted>(emptyForm)
  const [formErrors, setFormErrors] = useState<Partial<Extracted>>({})
  const [saving, setSaving]         = useState(false)
  const fileRef                     = useRef<HTMLInputElement>(null)

  // Image preview dialog
  const [viewOpen, setViewOpen]       = useState(false)
  const [viewBlobUrl, setViewBlobUrl] = useState<string | null>(null)
  const [viewMime, setViewMime]       = useState<string>('')
  const [viewLoading, setViewLoading] = useState(false)

  // Export selection modal
  const [exportOpen, setExportOpen]       = useState(false)
  const [selectedIds, setSelectedIds]     = useState<Set<number>>(new Set())
  const [exporting, setExporting]         = useState(false)

  // Edit dialog
  const [editRow, setEditRow]         = useState<FactureAchat | null>(null)
  const [editForm, setEditForm]       = useState({ fournisseur: '', date: '', montant_ht: '', tva: '', montant_ttc: '' })
  const [editErrors, setEditErrors]   = useState<Record<string, string>>({})
  const [updating, setUpdating]       = useState(false)

  const load = () => {
    setLoading(true)
    api.get('/factures-achats')
      .then(r => setRows(r.data?.data ?? r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const filtered = rows.filter(r =>
    r.fournisseur?.toLowerCase().includes(search.toLowerCase()) ||
    r.numero?.toLowerCase().includes(search.toLowerCase())
  )

  /* ── Open export modal (pre-select all) ──── */
  const handleExportExcel = () => {
    setSelectedIds(new Set(rows.map(r => r.id)))
    setExportOpen(true)
  }

  const allSelected  = rows.length > 0 && selectedIds.size === rows.length
  const someSelected = selectedIds.size > 0 && !allSelected

  const toggleAll = () =>
    setSelectedIds(allSelected ? new Set() : new Set(rows.map(r => r.id)))

  const toggleOne = (id: number) =>
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  /* ── Confirm export (selected only) ─────── */
  const handleConfirmExport = async () => {
    if (selectedIds.size === 0) { toast.error('Sélectionnez au moins une facture.'); return }
    setExporting(true)
    const toastId = toast.loading(`Analyse IA des ${selectedIds.size} facture(s) en cours…`)
    try {
      const token      = sessionStorage.getItem('token')
      const ids        = [...selectedIds].join(',')
      const controller = new AbortController()
      const timer      = setTimeout(() => controller.abort(), 300_000) // 5 min
      const res = await fetch(
        `${api.defaults.baseURL}/factures-achats/export-excel-ai?ids=${ids}`,
        { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }
      )
      clearTimeout(timer)
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData?.message ?? `Erreur serveur HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `factures_achats_selection.xlsx`
      a.click()
      URL.revokeObjectURL(a.href)
      toast.success(`${selectedIds.size} facture(s) exportée(s) en Excel !`, { id: toastId })
      setExportOpen(false)
      load()
    } catch (e: any) {
      toast.error(e?.name === 'AbortError' ? 'Délai dépassé, réessayez.' : (e?.message ?? 'Erreur lors de l\'export Excel'), { id: toastId })
    } finally {
      setExporting(false)
    }
  }

  /* ── Open edit dialog ───────────────────── */
  const openEdit = (row: FactureAchat) => {
    setEditRow(row)
    setEditForm({
      fournisseur: row.fournisseur,
      date:        row.date?.slice(0, 10) ?? '',
      montant_ht:  String(row.montant_ht),
      tva:         String(row.tva),
      montant_ttc: String(row.montant_ttc),
    })
    setEditErrors({})
  }

  /* ── Save edit ───────────────────────────── */
  const handleUpdate = async () => {
    const e: Record<string, string> = {}
    if (!editForm.fournisseur.trim())                           e.fournisseur = 'Requis'
    if (!editForm.date)                                         e.date        = 'Requis'
    if (!editForm.montant_ht || isNaN(Number(editForm.montant_ht))) e.montant_ht  = 'Invalide'
    if (isNaN(Number(editForm.tva)))                            e.tva         = 'Invalide'
    if (!editForm.montant_ttc || isNaN(Number(editForm.montant_ttc))) e.montant_ttc = 'Invalide'
    if (Object.keys(e).length) { setEditErrors(e); return }

    setUpdating(true)
    try {
      const { data } = await api.put(`/factures-achats/${editRow!.id}`, {
        fournisseur: editForm.fournisseur.trim(),
        date:        editForm.date,
        montant_ht:  Number(editForm.montant_ht),
        tva:         Number(editForm.tva),
        montant_ttc: Number(editForm.montant_ttc),
      })
      setRows(p => p.map(r => r.id === editRow!.id ? { ...r, ...data } : r))
      toast.success('Facture modifiée avec succès !')
      setEditRow(null)
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erreur lors de la modification')
    } finally {
      setUpdating(false)
    }
  }

  /* ── Eye: preview invoice image ─────────── */
  const handleView = async (row: FactureAchat) => {
    if (!row.fichier) { toast.error('Aucune image disponible pour cette facture.'); return }
    setViewLoading(true)
    setViewOpen(true)
    setViewBlobUrl(null)
    try {
      const token = sessionStorage.getItem('token')
      const res = await fetch(`${api.defaults.baseURL}/factures-achats/${row.id}/image`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      setViewMime(blob.type)
      setViewBlobUrl(URL.createObjectURL(blob))
    } catch {
      toast.error('Impossible de charger l\'image.')
      setViewOpen(false)
    } finally {
      setViewLoading(false)
    }
  }

  const closeView = () => {
    setViewOpen(false)
    if (viewBlobUrl) URL.revokeObjectURL(viewBlobUrl)
    setViewBlobUrl(null)
  }

  /* ── Delete ─────────────────────────────── */
  const handleDelete = async (row: FactureAchat) => {
    if (!window.confirm(`Supprimer la facture ${row.numero} ?`)) return
    try {
      await api.delete(`/factures-achats/${row.id}`)
      setRows(p => p.filter(r => r.id !== row.id))
      toast.success('Facture supprimée')
    } catch {
      toast.error('Erreur lors de la suppression')
    }
  }

  /* ── File pick ──────────────────────────── */
  const pickFile = (file: File) => {
    setImageFile(file)
    setAnalyzed(false)
    setForm(emptyForm)
    setFormErrors({})
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  /* ── Backend AI analysis ────────────────── */
  const handleAnalyze = async () => {
    if (!imageFile) return
    setAnalyzing(true)
    try {
      const fd = new FormData()
      fd.append('file', imageFile)
      const { data } = await api.post('/factures-achats/analyze', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      })
      setForm({
        fournisseur:    String(data.fournisseur    ?? ''),
        numero_facture: String(data.numero_facture ?? ''),
        date:           String(data.date           ?? ''),
        montant_ht:     String(data.montant_ht     ?? ''),
        tva:            String(data.tva            ?? ''),
        montant_ttc:    String(data.montant_ttc    ?? ''),
        lignes:         Array.isArray(data.lignes)  ? data.lignes  : [],
        resume:         Array.isArray(data.resume)  ? data.resume  : [],
      })
      setAnalyzed(true)
      toast.success('Informations extraites avec succès !')
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Erreur lors de l\'analyse'
      toast.error(`Erreur IA : ${msg}`, { duration: 7000 })
    } finally {
      setAnalyzing(false)
    }
  }

  /* ── Download Excel from analyzed invoice ── */
  const handleDownloadExcel = async () => {
    try {
      const token = sessionStorage.getItem('token')
      const res = await fetch(`${api.defaults.baseURL}/factures-achats/excel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          fournisseur:    form.fournisseur,
          numero_facture: form.numero_facture,
          date:           form.date,
          montant_ht:     Number(form.montant_ht)  || 0,
          tva:            Number(form.tva)          || 0,
          montant_ttc:    Number(form.montant_ttc)  || 0,
          lignes:         form.lignes,
          resume:         form.resume,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.message ?? `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const disp  = res.headers.get('Content-Disposition') ?? ''
      const match = disp.match(/filename="?([^"]+)"?/)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = match?.[1] ?? 'facture.xlsx'
      a.click()
      URL.revokeObjectURL(a.href)
      toast.success('Fichier Excel téléchargé !')
    } catch (e: any) {
      toast.error(`Erreur Excel : ${e?.message ?? 'Réessayez'}`)
    }
  }

  /* ── Save to DB ─────────────────────────── */
  const handleSave = async () => {
    const e: Partial<Extracted> = {}
    if (!form.fournisseur.trim()) e.fournisseur = 'Requis'
    if (!form.date)               e.date        = 'Requis'
    if (!form.montant_ht || isNaN(Number(form.montant_ht))) e.montant_ht  = 'Invalide'
    if (!form.tva        || isNaN(Number(form.tva)))        e.tva         = 'Invalide'
    if (!form.montant_ttc|| isNaN(Number(form.montant_ttc)))e.montant_ttc = 'Invalide'
    if (Object.keys(e).length) { setFormErrors(e); return }

    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('fournisseur', form.fournisseur.trim())
      fd.append('date',        form.date)
      fd.append('montant_ht',  String(Number(form.montant_ht)))
      fd.append('tva',         String(Number(form.tva)))
      fd.append('montant_ttc', String(Number(form.montant_ttc)))
      if (imageFile) fd.append('image', imageFile)

      await api.post('/factures-achats', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      })
      toast.success('Facture enregistrée !')
      setImportOpen(false)
      setImageFile(null)
      setPreview(null)
      setForm(emptyForm)
      setAnalyzed(false)
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erreur lors de l\'enregistrement')
    } finally {
      setSaving(false)
    }
  }

  const closeDialog = () => {
    if (saving || analyzing) return
    setImportOpen(false)
    setImageFile(null)
    setPreview(null)
    setForm(emptyForm)
    setAnalyzed(false)
    setFormErrors({})
  }

  return (
    <Box className="fade-in">

      {/* ── Header ── */}
      <Box sx={{
        display: 'flex', justifyContent: 'space-between',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'flex-start', sm: 'center' },
        gap: 1.5, mb: 3,
      }}>
        <Box>
          <Typography variant="h5" fontWeight={800} color="#1a1a2e" fontSize={{ xs: 17, md: 22 }}>
            Factures d'achats
          </Typography>
          <Typography color="text.secondary" fontSize={14}>
            Gestion des achats fournisseurs — {rows.length} facture{rows.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
          <Tooltip title="Télécharger le tableau en Excel">
            <Button variant="outlined" startIcon={<TableChartIcon />} onClick={handleExportExcel}
              sx={{ borderRadius: 2.5, fontWeight: 600, minWidth: 0, borderColor: '#2E7D32', color: '#2E7D32',
                '&:hover': { bgcolor: '#F1F8E9', borderColor: '#1B5E20' } }}>
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Exporter Excel</Box>
            </Button>
          </Tooltip>
          <Button variant="contained" startIcon={<UploadFileIcon />} onClick={() => setImportOpen(true)}
            sx={{ borderRadius: 2.5, fontWeight: 600, minWidth: 0, bgcolor: '#1565C0', '&:hover': { bgcolor: '#0D47A1' } }}>
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Importer une facture</Box>
          </Button>
        </Box>
      </Box>

      {/* ── Table ── */}
      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <TextField placeholder="Rechercher…" value={search}
            onChange={e => setSearch(e.target.value)} size="small"
            sx={{ mb: 2.5, width: { xs: '100%', sm: 300 } }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }} />

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={32} />
            </Box>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table sx={{ minWidth: 520 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>N° Facture</TableCell>
                    {isAdmin && <TableCell>Client</TableCell>}
                    <TableCell>Fournisseur</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Date</TableCell>
                    <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>HT</TableCell>
                    <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>TVA</TableCell>
                    <TableCell align="right">TTC</TableCell>
                    <TableCell>Statut</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 9 : 8} align="center" sx={{ py: 5, color: '#94A3B8' }}>
                        Aucune facture d'achat enregistrée.
                      </TableCell>
                    </TableRow>
                  ) : filtered.map(row => {
                    const s = statusMap[row.statut] ?? statusMap.en_attente
                    return (
                      <TableRow key={row.id} sx={{ '&:hover': { bgcolor: '#f8f9ff' } }}>
                        <TableCell>
                          <Typography fontWeight={700} fontSize={13} color="#1565C0">{row.numero}</Typography>
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <Typography fontSize={13} fontWeight={600} color="#1565C0">
                              {row.client?.nom ?? '—'}
                            </Typography>
                            <Typography fontSize={11} color="#94A3B8">{row.client?.email ?? ''}</Typography>
                          </TableCell>
                        )}
                        <TableCell>{row.fournisseur}</TableCell>
                        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                          {new Date(row.date).toLocaleDateString('fr-FR')}
                        </TableCell>
                        <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                          {fmt(row.montant_ht)} {devise}
                        </TableCell>
                        <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                          {fmt(row.tva)} {devise}
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight={700} fontSize={13}>{fmt(row.montant_ttc)} {devise}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={s.label} size="small"
                            sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: 11 }} />
                        </TableCell>
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                          <Tooltip title="Voir la facture">
                            <IconButton size="small" onClick={() => handleView(row)}>
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Modifier">
                            <IconButton size="small" sx={{ color: '#1565C0' }} onClick={() => openEdit(row)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Supprimer">
                            <IconButton size="small" color="error" onClick={() => handleDelete(row)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* ── Image Preview Dialog ── */}
      <Dialog open={viewOpen} onClose={closeView} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontWeight: 700, fontSize: 16,
        }}>
          Aperçu de la facture
          <IconButton size="small" onClick={closeView}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 2, minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {viewLoading ? (
            <CircularProgress />
          ) : viewBlobUrl ? (
            viewMime === 'application/pdf' ? (
              <Box component="iframe" src={viewBlobUrl}
                sx={{ width: '100%', height: 600, border: 'none', borderRadius: 2 }} />
            ) : (
              <Box component="img" src={viewBlobUrl} alt="Facture"
                sx={{ maxWidth: '100%', maxHeight: 600, borderRadius: 2, objectFit: 'contain' }} />
            )
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ── Export Selection Modal ── */}
      <Dialog open={exportOpen} onClose={() => !exporting && setExportOpen(false)}
        maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 17, display: 'flex', alignItems: 'center', gap: 1 }}>
          <TableChartIcon sx={{ color: '#2E7D32', fontSize: 20 }} />
          Exporter en Excel
        </DialogTitle>

        <DialogContent sx={{ pb: 1 }}>
          <Typography fontSize={13} color="text.secondary" mb={1.5}>
            Sélectionnez les factures à inclure dans le fichier Excel.
          </Typography>

          {/* Select All */}
          <Box sx={{ px: 1, py: 0.5, bgcolor: '#F0F7FF', borderRadius: 2, mb: 1 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={toggleAll}
                  size="small"
                  sx={{ color: '#1565C0', '&.Mui-checked': { color: '#1565C0' } }}
                />
              }
              label={
                <Typography fontSize={13} fontWeight={700} color="#1565C0">
                  Tout sélectionner ({rows.length})
                </Typography>
              }
            />
          </Box>

          <Divider sx={{ mb: 1 }} />

          {/* Invoice list */}
          <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
            {rows.map(row => {
              const s = statusMap[row.statut] ?? statusMap.en_attente
              return (
                <Box key={row.id} onClick={() => toggleOne(row.id)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    px: 1.5, py: 1, borderRadius: 2, cursor: 'pointer',
                    bgcolor: selectedIds.has(row.id) ? '#F0F7FF' : 'transparent',
                    '&:hover': { bgcolor: '#F5F9FF' },
                    borderBottom: '1px solid #F0F4F8',
                  }}>
                  <Checkbox
                    checked={selectedIds.has(row.id)}
                    onChange={() => toggleOne(row.id)}
                    onClick={e => e.stopPropagation()}
                    size="small"
                    sx={{ p: 0.5, color: '#1565C0', '&.Mui-checked': { color: '#1565C0' } }}
                  />
                  <Typography fontWeight={700} fontSize={13} color="#1565C0" sx={{ minWidth: 80 }}>
                    {row.numero}
                  </Typography>
                  <Typography fontSize={13} sx={{ flex: 1 }} noWrap>{row.fournisseur}</Typography>
                  <Typography fontSize={12} color="text.secondary" sx={{ minWidth: 80 }}>
                    {new Date(row.date).toLocaleDateString('fr-FR')}
                  </Typography>
                  <Typography fontSize={13} fontWeight={700} sx={{ minWidth: 90, textAlign: 'right' }}>
                    {fmt(row.montant_ttc)} {devise}
                  </Typography>
                  <Chip label={s.label} size="small"
                    sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: 10, minWidth: 72 }} />
                </Box>
              )
            })}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1, borderTop: '1px solid #F0F4F8', pt: 1.5 }}>
          <Typography fontSize={13} color="text.secondary" sx={{ flex: 1 }}>
            {selectedIds.size} / {rows.length} sélectionnée(s)
          </Typography>
          <Button onClick={() => setExportOpen(false)} disabled={exporting}
            sx={{ borderRadius: 2, fontWeight: 600 }}>
            Annuler
          </Button>
          <Button variant="contained" onClick={handleConfirmExport}
            disabled={exporting || selectedIds.size === 0}
            startIcon={exporting ? <CircularProgress size={14} color="inherit" /> : <TableChartIcon />}
            sx={{ fontWeight: 700, borderRadius: 2, bgcolor: '#2E7D32', '&:hover': { bgcolor: '#1B5E20' } }}>
            {exporting ? 'Export en cours…' : `Confirmer l'export`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={!!editRow} onClose={() => !updating && setEditRow(null)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 17, display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditIcon sx={{ fontSize: 20, color: '#1565C0' }} />
          Modifier la facture {editRow?.numero}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField fullWidth label="Fournisseur *" InputLabelProps={{ shrink: true }}
                value={editForm.fournisseur} error={!!editErrors.fournisseur} helperText={editErrors.fournisseur}
                onChange={e => setEditForm(f => ({ ...f, fournisseur: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Date *" type="date" InputLabelProps={{ shrink: true }}
                value={editForm.date} error={!!editErrors.date} helperText={editErrors.date}
                onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label={`Montant HT (${devise}) *`} type="number" InputLabelProps={{ shrink: true }}
                inputProps={{ min: 0, step: '0.01' }}
                value={editForm.montant_ht} error={!!editErrors.montant_ht} helperText={editErrors.montant_ht}
                onChange={e => setEditForm(f => ({ ...f, montant_ht: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label={`TVA (${devise}) *`} type="number" InputLabelProps={{ shrink: true }}
                inputProps={{ min: 0, step: '0.01' }}
                value={editForm.tva} error={!!editErrors.tva} helperText={editErrors.tva}
                onChange={e => setEditForm(f => ({ ...f, tva: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label={`Montant TTC (${devise}) *`} type="number" InputLabelProps={{ shrink: true }}
                inputProps={{ min: 0, step: '0.01' }}
                value={editForm.montant_ttc} error={!!editErrors.montant_ttc} helperText={editErrors.montant_ttc}
                onChange={e => setEditForm(f => ({ ...f, montant_ttc: e.target.value }))} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setEditRow(null)} disabled={updating}
            sx={{ borderRadius: 2, fontWeight: 600 }}>
            Annuler
          </Button>
          <Button variant="contained" onClick={handleUpdate} disabled={updating}
            startIcon={updating ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
            sx={{ fontWeight: 700, borderRadius: 2 }}>
            {updating ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── AI Import Dialog ── */}
      <Dialog open={importOpen} onClose={closeDialog} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{
          background: 'linear-gradient(135deg,#1565C0,#0D47A1)',
          color: 'white', fontWeight: 700, fontSize: 17,
          display: 'flex', alignItems: 'center', gap: 1,
          px: 3, py: 2,
        }}>
          <AutoAwesomeIcon /> Importer une facture
        </DialogTitle>

        <DialogContent sx={{ pb: 2, px: 3, overflowY: 'auto',
          '&.MuiDialogContent-root': { paddingTop: '32px' } }}>
          <Grid container spacing={3} sx={{ mt: 0.5 }}>

            {/* Left: upload zone */}
            <Grid item xs={12} md={5}>
              <input ref={fileRef} type="file" accept="image/*,.pdf" hidden
                onChange={e => e.target.files?.[0] && pickFile(e.target.files[0])} />

              <Box
                onClick={() => !imageFile && fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) pickFile(f) }}
                sx={{
                  border: '2px dashed', borderColor: imageFile ? '#1565C0' : '#CBD5E1',
                  borderRadius: 3, p: 2, textAlign: 'center',
                  bgcolor: imageFile ? '#F0F7FF' : '#FAFAFA',
                  cursor: imageFile ? 'default' : 'pointer',
                  minHeight: 180, maxHeight: 260, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 1,
                  transition: 'all 0.2s', overflow: 'hidden',
                }}>
                {preview ? (
                  <Box component="img" src={preview}
                    sx={{ maxHeight: 180, maxWidth: '100%', borderRadius: 2, objectFit: 'contain' }} />
                ) : (
                  <>
                    <UploadFileIcon sx={{ fontSize: 40, color: '#94A3B8' }} />
                    <Typography fontSize={13} color="text.secondary">
                      Glisser-déposer ou cliquer pour choisir
                    </Typography>
                    <Typography fontSize={11} color="#B0BEC5">JPG, PNG, PDF</Typography>
                  </>
                )}
              </Box>

              {imageFile && (
                <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography fontSize={12} color="text.secondary" noWrap>{imageFile.name}</Typography>
                  {analyzing && <LinearProgress sx={{ borderRadius: 1 }} />}
                  <Button variant="contained" fullWidth startIcon={<AutoAwesomeIcon />}
                    onClick={handleAnalyze} disabled={analyzing}
                    sx={{ fontWeight: 700, borderRadius: 2,
                      bgcolor: analyzing ? undefined : '#7B1FA2',
                      '&:hover': { bgcolor: '#6A1B9A' } }}>
                    {analyzing ? 'Analyse en cours…' : 'Analyser'}
                  </Button>
                  {analyzed && (
                    <Button variant="outlined" fullWidth startIcon={<TableChartIcon />}
                      onClick={handleDownloadExcel}
                      sx={{
                        fontWeight: 700, borderRadius: 2,
                        borderColor: '#2E7D32', color: '#2E7D32',
                        '&:hover': { bgcolor: '#F1F8E9', borderColor: '#1B5E20' },
                      }}>
                      Télécharger Excel
                    </Button>
                  )}
                  <Button size="small" onClick={() => fileRef.current?.click()}
                    sx={{ fontSize: 12, color: '#64748B' }}>
                    Changer de fichier
                  </Button>
                </Box>
              )}
            </Grid>

            {/* Right: form */}
            <Grid item xs={12} md={7}>
              {!imageFile ? (
                <Box sx={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', height: '100%', minHeight: 220,
                  color: '#94A3B8', gap: 1.5,
                }}>
                  <UploadFileIcon sx={{ fontSize: 48, color: '#CBD5E1' }} />
                  <Typography fontSize={14} textAlign="center" color="#94A3B8">
                    Importez une photo de facture<br />pour remplir les champs automatiquement
                  </Typography>
                </Box>
              ) : (
                <>
                  {analyzed && (
                    <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2, borderRadius: 2 }}>
                      Informations extraites. Vérifiez avant d'enregistrer.
                    </Alert>
                  )}
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField fullWidth label="Fournisseur *" placeholder="Nom du fournisseur"
                        InputLabelProps={{ shrink: true }} value={form.fournisseur}
                        error={!!formErrors.fournisseur} helperText={formErrors.fournisseur}
                        onChange={e => setForm(f => ({ ...f, fournisseur: e.target.value }))} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label="N° Facture" placeholder="ex: FA-2025-001"
                        InputLabelProps={{ shrink: true }} value={form.numero_facture}
                        onChange={e => setForm(f => ({ ...f, numero_facture: e.target.value }))} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label="Date *" type="date" value={form.date}
                        InputLabelProps={{ shrink: true }}
                        error={!!formErrors.date} helperText={formErrors.date}
                        onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField fullWidth label={`Montant HT (${devise}) *`} placeholder="0.00"
                        InputLabelProps={{ shrink: true }} type="number"
                        inputProps={{ min: 0, step: '0.01' }} value={form.montant_ht}
                        error={!!formErrors.montant_ht} helperText={formErrors.montant_ht}
                        onChange={e => setForm(f => ({ ...f, montant_ht: e.target.value }))} />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField fullWidth label={`TVA (${devise}) *`} placeholder="0.00"
                        InputLabelProps={{ shrink: true }} type="number"
                        inputProps={{ min: 0, step: '0.01' }} value={form.tva}
                        error={!!formErrors.tva} helperText={formErrors.tva}
                        onChange={e => setForm(f => ({ ...f, tva: e.target.value }))} />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField fullWidth label={`Montant TTC (${devise}) *`} placeholder="0.00"
                        InputLabelProps={{ shrink: true }} type="number"
                        inputProps={{ min: 0, step: '0.01' }} value={form.montant_ttc}
                        error={!!formErrors.montant_ttc} helperText={formErrors.montant_ttc}
                        onChange={e => setForm(f => ({ ...f, montant_ttc: e.target.value }))} />
                    </Grid>
                    {form.montant_ht && form.tva && (
                      <Grid item xs={12}>
                        <Box sx={{ p: 1.5, bgcolor: '#E3F0FF', borderRadius: 2 }}>
                          <Typography fontSize={13} color="#1565C0" fontWeight={700}>
                            TTC calculé : {(Number(form.montant_ht) + Number(form.tva)).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {devise}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    {form.lignes.length > 0 && (
                      <Grid item xs={12}>
                        <Box sx={{ p: 1.5, bgcolor: '#E8F5E9', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CheckCircleIcon sx={{ color: '#2E7D32', fontSize: 18 }} />
                          <Typography fontSize={13} color="#2E7D32" fontWeight={700}>
                            {form.lignes.length} ligne{form.lignes.length > 1 ? 's' : ''} extraite{form.lignes.length > 1 ? 's' : ''} — visible{form.lignes.length > 1 ? 's' : ''} dans le fichier Excel
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                  </Grid>
                </>
              )}
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2.5, gap: 1 }}>
          <Button onClick={closeDialog} disabled={saving || analyzing}
            sx={{ borderRadius: 2, fontWeight: 600 }}>
            Annuler
          </Button>
          <Button variant="contained" onClick={handleSave}
            disabled={saving || !imageFile || analyzing}
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
            sx={{ fontWeight: 700, borderRadius: 2 }}>
            {saving ? 'Enregistrement…' : 'Enregistrer la facture'}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  )
}
