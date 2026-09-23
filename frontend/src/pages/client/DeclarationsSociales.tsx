import { useState, useEffect, useRef } from 'react'
import {
  Box, Typography, Card, CardContent, Button, Table, TableBody,
  TableCell, TableHead, TableRow, Chip, IconButton, Tooltip,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, TextField, LinearProgress, Alert, Divider, Autocomplete,
  Checkbox, FormControlLabel,
} from '@mui/material'
import AddIcon           from '@mui/icons-material/Add'
import DownloadIcon      from '@mui/icons-material/Download'
import VisibilityIcon    from '@mui/icons-material/Visibility'
import CloseIcon         from '@mui/icons-material/Close'
import DeleteIcon        from '@mui/icons-material/Delete'
import PeopleIcon        from '@mui/icons-material/People'
import AssignmentIcon    from '@mui/icons-material/Assignment'
import UploadFileIcon    from '@mui/icons-material/UploadFile'
import CheckCircleIcon   from '@mui/icons-material/CheckCircle'
import EditIcon          from '@mui/icons-material/Edit'
import PictureAsPdfIcon  from '@mui/icons-material/PictureAsPdf'
import TableChartIcon    from '@mui/icons-material/TableChart'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import { useCurrency } from '../../contexts/CurrencyContext'

interface DeclarationSociale {
  id: number
  type: string
  periode: string
  periode_type: string
  date_limite: string
  nombre_employes: number
  masse_salariale: number
  taux_cotisation: number
  part_patronale: number
  part_salariale: number
  montant: number
  statut: string
  notes: string | null
  fichier: string | null
  viewed_at: string | null
  client?: { id: number; nom: string; email: string; entreprise?: string }
}

interface ClientOption { id: number; nom: string; email: string; entreprise?: string }

const statusMap: Record<string, { label: string; color: string; bg: string }> = {
  validee:    { label: 'Validée',    color: '#2E7D32', bg: '#E8F5E9' },
  deposee:    { label: 'Déposée',    color: '#1565C0', bg: '#E3F0FF' },
  a_declarer: { label: 'À déclarer', color: '#E65100', bg: '#FFF3E0' },
}

const typeColor: Record<string, string> = {
  CNSS: '#1565C0', CIMR: '#7B1FA2', AMO: '#2E7D32', autre: '#00ACC1',
}
const typeLabel: Record<string, string> = {
  CNSS: 'Caisse Nationale de Sécurité Sociale',
  CIMR: 'Caisse Interprofessionnelle Marocaine de Retraite',
  AMO:  'Assurance Maladie Obligatoire',
}

const emptyForm = {
  client_email: '', type: 'CNSS', periode: '', periode_type: 'mensuelle',
  date_limite: '', nombre_employes: '', masse_salariale: '', taux_cotisation: '',
  part_patronale: '', part_salariale: '', statut: 'a_declarer', notes: '',
}

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

/**
 * Prochaine occurrence du jour légal tunisien (le 15 de chaque mois pour les
 * cotisations CNSS) à partir d'aujourd'hui, au format YYYY-MM-DD. Suggestion
 * seulement — le champ reste modifiable par l'utilisateur.
 */
function nextLegalDeadline(day: number): string {
  const now = new Date()
  const year  = now.getFullYear()
  const month = now.getDate() <= day ? now.getMonth() : now.getMonth() + 1
  const d = new Date(year, month, day)
  return d.toISOString().slice(0, 10)
}

function fmt(n: number) {
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function DeclarationsSociales() {
  const { devise } = useCurrency()
  const isAdmin = sessionStorage.getItem('real_role') === 'admin'

  const [rows, setRows]       = useState<DeclarationSociale[]>([])
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<ClientOption[]>([])

  // New declaration dialog (admin only)
  const [formOpen, setFormOpen]   = useState(false)
  const [form, setForm]           = useState({ ...emptyForm })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [saving, setSaving]       = useState(false)
  const [fichier, setFichier]     = useState<File | null>(null)
  const fileRef                   = useRef<HTMLInputElement>(null)

  // Detail / view dialog
  const [viewDecl, setViewDecl]   = useState<DeclarationSociale | null>(null)
  const [viewOpen, setViewOpen]   = useState(false)

  // Edit dialog (admin only)
  const [editDecl, setEditDecl]   = useState<DeclarationSociale | null>(null)
  const [editOpen, setEditOpen]   = useState(false)
  const [editForm, setEditForm]   = useState({ ...emptyForm })
  const [editSaving, setEditSaving] = useState(false)

  // Export PDF modal
  const [exportOpen, setExportOpen]       = useState(false)
  const [exportIds, setExportIds]         = useState<number[]>([])
  const [exportLoading, setExportLoading] = useState(false)

  // Export Excel modal
  const [xlsxOpen, setXlsxOpen]     = useState(false)
  const [xlsxIds, setXlsxIds]       = useState<Set<number>>(new Set())
  const [xlsxLoading, setXlsxLoading] = useState(false)

  const load = () => {
    setLoading(true)
    api.get('/declarations-sociales')
      .then(r => setRows(r.data?.data ?? r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    if (isAdmin) {
      api.get('/admin/clients').then(r => setClients(r.data?.data ?? r.data)).catch(() => {})
    }
  }, [])

  // ── Calculate derived fields ─────────────────────────────────────────
  const totalAPayer = (Number(form.part_patronale) || 0) + (Number(form.part_salariale) || 0)
  const days = form.date_limite ? daysUntil(form.date_limite) : null

  // Derived values for the view dialog (safe to compute at component level)
  const viewColor  = viewDecl ? (typeColor[viewDecl.type] ?? '#607D8B') : '#607D8B'
  const viewStatus = viewDecl ? (statusMap[viewDecl.statut] ?? statusMap.a_declarer) : statusMap.a_declarer

  // ── Eye icon: view detail + notify admin ────────────────────────────
  const handleView = async (decl: DeclarationSociale) => {
    setViewDecl(decl)
    setViewOpen(true)
    if (!isAdmin) {
      try {
        const token = sessionStorage.getItem('token')
        await fetch(`${api.defaults.baseURL}/declarations-sociales/${decl.id}/viewed`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
        // Update local viewed_at state
        setRows(prev => prev.map(r => r.id === decl.id ? { ...r, viewed_at: new Date().toISOString() } : r))
      } catch { /* silent */ }
    }
  }

  // ── Download PDF ────────────────────────────────────────────────────
  const handleDownloadPdf = async (decl: DeclarationSociale) => {
    try {
      const token = sessionStorage.getItem('token')
      const res = await fetch(`${api.defaults.baseURL}/declarations-sociales/${decl.id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `declaration_${decl.type}_${decl.periode}.pdf`
      a.click()
      URL.revokeObjectURL(a.href)
      toast.success('PDF téléchargé !')
    } catch {
      toast.error('Erreur lors du téléchargement PDF')
    }
  }

  // ── Download single declaration as Excel ─────────────────────────
  const handleDownloadRowExcel = async (decl: DeclarationSociale) => {
    const toastId = toast.loading('Génération Excel…')
    try {
      const res = await api.get('/declarations-sociales/export-excel', {
        responseType: 'blob',
        timeout: 30000,
        params: { ids: decl.id },
      })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(res.data)
      a.download = `declaration_${decl.type}_${decl.periode}.xlsx`
      a.click()
      URL.revokeObjectURL(a.href)
      toast.success('Excel téléchargé !', { id: toastId })
    } catch {
      toast.error('Erreur lors du téléchargement Excel', { id: toastId })
    }
  }

  // ── Edit (admin only) ───────────────────────────────────────────────
  const handleEditOpen = (decl: DeclarationSociale) => {
    setEditDecl(decl)
    setEditForm({
      client_email: decl.client?.email ?? '',
      type:           decl.type,
      periode:        decl.periode,
      periode_type:   decl.periode_type,
      date_limite:    decl.date_limite,
      nombre_employes: String(decl.nombre_employes),
      masse_salariale: String(decl.masse_salariale),
      taux_cotisation: String(decl.taux_cotisation),
      part_patronale:  String(decl.part_patronale),
      part_salariale:  String(decl.part_salariale),
      statut:         decl.statut,
      notes:          decl.notes ?? '',
    })
    setEditOpen(true)
  }

  const handleEditSave = async () => {
    if (!editDecl) return
    setEditSaving(true)
    try {
      const { data } = await api.put(`/declarations-sociales/${editDecl.id}`, {
        type:            editForm.type,
        periode:         editForm.periode,
        periode_type:    editForm.periode_type,
        date_limite:     editForm.date_limite,
        nombre_employes: Number(editForm.nombre_employes),
        masse_salariale: Number(editForm.masse_salariale),
        taux_cotisation: Number(editForm.taux_cotisation),
        part_patronale:  Number(editForm.part_patronale),
        part_salariale:  Number(editForm.part_salariale),
        statut:          editForm.statut,
        notes:           editForm.notes,
      })
      setRows(prev => prev.map(r => r.id === editDecl.id ? { ...r, ...data } : r))
      toast.success('Déclaration mise à jour !')
      setEditOpen(false)
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erreur lors de la mise à jour')
    } finally {
      setEditSaving(false)
    }
  }

  // ── Export PDF (batch) ────────────────────────────────────────────────
  const allIds = rows.map(r => r.id)
  const allSelected = exportIds.length === rows.length && rows.length > 0

  const toggleExportId = (id: number) =>
    setExportIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const handleExportPdf = async () => {
    if (exportIds.length === 0) { toast.error('Sélectionnez au moins une déclaration'); return }
    setExportLoading(true)
    try {
      const token = sessionStorage.getItem('token')
      const res = await fetch(`${api.defaults.baseURL}/declarations-sociales/export-pdf`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: exportIds }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `declarations_sociales_${new Date().toISOString().slice(0, 10)}.pdf`
      a.click()
      URL.revokeObjectURL(a.href)
      toast.success(`${exportIds.length} déclaration(s) exportée(s) en PDF !`)
      setExportOpen(false)
      setExportIds([])
    } catch {
      toast.error('Erreur lors de l\'export PDF')
    } finally {
      setExportLoading(false)
    }
  }

  // ── Export Excel ────────────────────────────────────────────────────
  const openXlsxDialog = () => {
    if (rows.length === 0) { toast.error('Aucune déclaration à exporter.'); return }
    setXlsxIds(new Set(rows.map(r => r.id)))
    setXlsxOpen(true)
  }

  const toggleXlsxAll = () => {
    setXlsxIds(xlsxIds.size === rows.length ? new Set() : new Set(rows.map(r => r.id)))
  }

  const toggleXlsxOne = (id: number) => {
    setXlsxIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleExportExcel = async () => {
    if (xlsxIds.size === 0) { toast.error('Sélectionnez au moins une déclaration.'); return }
    setXlsxLoading(true)
    try {
      const res = await api.get('/declarations-sociales/export-excel', {
        responseType: 'blob',
        timeout: 120000,
        params: { ids: [...xlsxIds].join(',') },
      })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `declarations_sociales_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`${xlsxIds.size} déclaration(s) exportée(s) en Excel.`)
      setXlsxOpen(false)
    } catch (err: any) {
      if (err?.response?.data instanceof Blob) {
        const text = await (err.response.data as Blob).text()
        try { toast.error(JSON.parse(text).message || "Erreur d'export.") } catch { toast.error("Erreur d'export.") }
      } else {
        toast.error("Erreur lors de l'export Excel.")
      }
    } finally {
      setXlsxLoading(false)
    }
  }

  // ── Delete (admin only) ─────────────────────────────────────────────
  const handleDelete = async (decl: DeclarationSociale) => {
    if (!window.confirm(`Supprimer la déclaration ${decl.type} — ${decl.periode} ?`)) return
    try {
      await api.delete(`/declarations-sociales/${decl.id}`)
      setRows(p => p.filter(r => r.id !== decl.id))
      toast.success('Déclaration supprimée')
    } catch {
      toast.error('Erreur lors de la suppression')
    }
  }

  // ── Submit new declaration (admin only) ─────────────────────────────
  const handleSave = async () => {
    const e: Record<string, string> = {}
    if (!form.client_email.trim())  e.client_email    = 'Requis'
    if (!form.periode.trim())       e.periode         = 'Requis'
    if (!form.date_limite)          e.date_limite     = 'Requis'
    if (!form.nombre_employes)      e.nombre_employes = 'Requis'
    if (!form.masse_salariale)      e.masse_salariale = 'Requis'
    if (!form.taux_cotisation)      e.taux_cotisation = 'Requis'
    if (!form.part_patronale)       e.part_patronale  = 'Requis'
    if (!form.part_salariale)       e.part_salariale  = 'Requis'
    if (Object.keys(e).length) { setFormErrors(e); return }

    setSaving(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)))
      if (fichier) fd.append('fichier', fichier)

      await api.post('/declarations-sociales', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      })
      toast.success('Déclaration créée et envoyée au client !')
      setFormOpen(false)
      setForm({ ...emptyForm })
      setFichier(null)
      setFormErrors({})
      load()
    } catch (err: any) {
      const serverErrors = err?.response?.data?.errors ?? {}
      if (serverErrors.client_email) {
        setFormErrors(prev => ({ ...prev, client_email: serverErrors.client_email[0] }))
        toast.error(serverErrors.client_email[0])
      } else {
        toast.error(err?.response?.data?.message ?? 'Erreur lors de la création')
      }
    } finally {
      setSaving(false)
    }
  }

  const closeForm = () => {
    if (saving) return
    setFormOpen(false)
    setForm({ ...emptyForm })
    setFichier(null)
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
            Déclarations sociales
          </Typography>
          <Typography color="text.secondary" fontSize={14}>CNSS, CIMR, AMO — charges du personnel</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
          <Button variant="outlined" startIcon={<TableChartIcon />}
            sx={{ borderRadius: 2.5, fontWeight: 600, minWidth: 0, borderColor: '#2E7D32', color: '#2E7D32',
              '&:hover': { borderColor: '#1B5E20', bgcolor: '#F1F8E9' } }}
            onClick={openXlsxDialog}>
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Exporter Excel</Box>
          </Button>
          <Button variant="outlined" startIcon={<PictureAsPdfIcon />}
            sx={{ borderRadius: 2.5, fontWeight: 600, minWidth: 0, borderColor: '#E65100', color: '#E65100',
              '&:hover': { borderColor: '#BF360C', bgcolor: '#FFF3E0' } }}
            onClick={() => { setExportIds([]); setExportOpen(true) }}>
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Exporter PDF</Box>
          </Button>
          {isAdmin && (
            <Button variant="contained" startIcon={<AddIcon />}
              onClick={() => setFormOpen(true)}
              sx={{ borderRadius: 2.5, fontWeight: 600, minWidth: 0, bgcolor: '#1565C0', '&:hover': { bgcolor: '#0D47A1' } }}>
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Nouvelle déclaration</Box>
            </Button>
          )}
        </Box>
      </Box>

      {/* ── Table ── */}
      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={32} />
            </Box>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table sx={{ minWidth: 460 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    {isAdmin && <TableCell>Client</TableCell>}
                    <TableCell>Période</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Date limite</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell>Statut</TableCell>
                    {isAdmin && <TableCell>Consulté</TableCell>}
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 8 : 6} align="center" sx={{ py: 5, color: '#94A3B8' }}>
                        Aucune déclaration sociale enregistrée.
                      </TableCell>
                    </TableRow>
                  ) : rows.map(row => {
                    const s = statusMap[row.statut] ?? statusMap.a_declarer
                    const color = typeColor[row.type] ?? '#607D8B'
                    return (
                      <TableRow key={row.id} sx={{ '&:hover': { bgcolor: '#f8f9ff' } }}>
                        <TableCell>
                          <Chip label={row.type} size="small"
                            sx={{ bgcolor: `${color}18`, color, fontWeight: 800, fontSize: 12 }} />
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <Typography fontSize={13} fontWeight={600}>{row.client?.nom ?? '—'}</Typography>
                            <Typography fontSize={11} color="#94A3B8">{row.client?.email ?? ''}</Typography>
                          </TableCell>
                        )}
                        <TableCell>
                          <Typography fontWeight={600} fontSize={13}>{row.periode}</Typography>
                          <Typography fontSize={11} color="#94A3B8">{row.periode_type}</Typography>
                        </TableCell>
                        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                          {new Date(row.date_limite).toLocaleDateString('fr-FR')}
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight={700} fontSize={13}>{fmt(row.montant)} {devise}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={s.label} size="small"
                            sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: 11 }} />
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            {row.viewed_at ? (
                              <Tooltip title={`Consulté le ${new Date(row.viewed_at).toLocaleString('fr-FR')}`}>
                                <CheckCircleIcon sx={{ color: '#2E7D32', fontSize: 18 }} />
                              </Tooltip>
                            ) : (
                              <Typography fontSize={11} color="#94A3B8">Non consulté</Typography>
                            )}
                          </TableCell>
                        )}
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                          <Tooltip title="Voir les détails">
                            <IconButton size="small" onClick={() => handleView(row)}>
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {!isAdmin && (
                            <Tooltip title="Télécharger Excel">
                              <IconButton size="small" sx={{ color: '#2E7D32' }} onClick={() => handleDownloadRowExcel(row)}>
                                <TableChartIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {isAdmin && (
                            <Tooltip title="Modifier">
                              <IconButton size="small" sx={{ color: '#7B1FA2' }} onClick={() => handleEditOpen(row)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {isAdmin && (
                            <Tooltip title="Supprimer">
                              <IconButton size="small" color="error" onClick={() => handleDelete(row)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
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

      {/* ── Detail View Dialog (read-only) ── */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        {viewDecl && (
          <>
            <DialogTitle sx={{
              background: `linear-gradient(135deg, ${viewColor}, ${viewColor}CC)`,
              color: 'white', fontWeight: 700, fontSize: 17,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 1, px: 3, py: 2,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AssignmentIcon />
                Déclaration {viewDecl.type} — {viewDecl.periode}
              </Box>
              <IconButton size="small" onClick={() => setViewOpen(false)} sx={{ color: 'white' }}>
                <CloseIcon />
              </IconButton>
            </DialogTitle>
              <DialogContent sx={{ p: 3 }}>

                {/* Type full label */}
                <Typography fontSize={12} color="text.secondary" mb={2}>
                  {typeLabel[viewDecl.type] ?? viewDecl.type}
                </Typography>

                {/* Client info (admin view) */}
                {isAdmin && viewDecl.client && (
                  <Box sx={{ bgcolor: '#F0F7FF', borderRadius: 2, p: 2, mb: 2 }}>
                    <Typography fontSize={12} fontWeight={700} color="#1565C0" mb={0.5}>
                      <PeopleIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                      Client
                    </Typography>
                    <Typography fontSize={13} fontWeight={600}>{viewDecl.client.nom}</Typography>
                    <Typography fontSize={12} color="#64748B">{viewDecl.client.email}</Typography>
                    {viewDecl.client.entreprise && (
                      <Typography fontSize={12} color="#64748B">{viewDecl.client.entreprise}</Typography>
                    )}
                  </Box>
                )}

                <Grid container spacing={2}>
                  {[
                    ['Période', viewDecl.periode],
                    ['Type de période', viewDecl.periode_type],
                    ['Date limite', new Date(viewDecl.date_limite).toLocaleDateString('fr-FR')],
                    ['Nb. employés', String(viewDecl.nombre_employes)],
                  ].map(([label, value]) => (
                    <Grid item xs={6} key={label}>
                      <Typography fontSize={11} color="text.secondary">{label}</Typography>
                      <Typography fontSize={13} fontWeight={600}>{value}</Typography>
                    </Grid>
                  ))}
                </Grid>

                <Divider sx={{ my: 2 }} />

                {/* Amounts */}
                <Box sx={{ bgcolor: '#FAFBFF', borderRadius: 2, p: 2, mb: 2 }}>
                  <Typography fontSize={12} fontWeight={700} color="#1A1A2E" mb={1.5}>
                    Montants des cotisations
                  </Typography>
                  {[
                    ['Masse salariale brute', `${fmt(viewDecl.masse_salariale)} ${devise}`],
                    ['Taux de cotisation',    `${viewDecl.taux_cotisation} %`],
                    ['Part patronale',        `${fmt(viewDecl.part_patronale)} ${devise}`],
                    ['Part salariale',        `${fmt(viewDecl.part_salariale)} ${devise}`],
                  ].map(([label, value]) => (
                    <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.6, borderBottom: '1px solid #F0F4F8' }}>
                      <Typography fontSize={12} color="#64748B">{label}</Typography>
                      <Typography fontSize={12} fontWeight={600}>{value}</Typography>
                    </Box>
                  ))}
                  <Box sx={{
                    display: 'flex', justifyContent: 'space-between',
                    mt: 1.5, pt: 1.5, borderTop: `2px solid ${viewColor}`,
                  }}>
                    <Typography fontSize={14} fontWeight={700} color={viewColor}>Total à payer</Typography>
                    <Typography fontSize={14} fontWeight={800} color={viewColor}>{fmt(viewDecl.montant)} {devise}</Typography>
                  </Box>
                </Box>

                {/* Status */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: viewDecl.notes ? 2 : 0 }}>
                  <Typography fontSize={12} color="text.secondary">Statut :</Typography>
                  <Chip label={viewStatus.label} size="small" sx={{ bgcolor: viewStatus.bg, color: viewStatus.color, fontWeight: 700 }} />
                </Box>

                {/* Notes */}
                {viewDecl.notes && (
                  <Box sx={{ bgcolor: '#FFFBF0', border: '1px solid #FDE68A', borderRadius: 2, p: 2, mt: 2 }}>
                    <Typography fontSize={11} fontWeight={700} color="#92400E" mb={0.5}>Notes</Typography>
                    <Typography fontSize={12} color="#78350F">{viewDecl.notes}</Typography>
                  </Box>
                )}
              </DialogContent>
              <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
                <Button onClick={() => setViewOpen(false)} sx={{ borderRadius: 2, fontWeight: 600 }}>
                  Fermer
                </Button>
                <Button variant="contained" startIcon={<DownloadIcon />}
                  onClick={() => handleDownloadPdf(viewDecl)}
                  sx={{ fontWeight: 700, borderRadius: 2, bgcolor: viewColor, '&:hover': { filter: 'brightness(0.9)' } }}>
                  Télécharger PDF
                </Button>
              </DialogActions>
            </>
          )}
      </Dialog>

      {/* ── New Declaration Form (Admin only) ── */}
      {isAdmin && (
        <Dialog open={formOpen} onClose={closeForm} maxWidth="md" fullWidth
          PaperProps={{ sx: { borderRadius: 3 } }}>
          <DialogTitle sx={{
            background: 'linear-gradient(135deg,#1565C0,#0D47A1)',
            color: 'white', fontWeight: 700, fontSize: 17,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            px: 3, py: 2,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AssignmentIcon /> Nouvelle déclaration sociale
            </Box>
            <IconButton size="small" onClick={closeForm} sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>

          <DialogContent sx={{ px: 3, py: 3, overflowY: 'auto' }}>

            {/* Type selector */}
            <Typography fontSize={12} fontWeight={700} color="#1A1A2E" mb={1}>
              Type de déclaration
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
              {(['CNSS', 'CIMR', 'AMO'] as const).map(t => (
                <Box key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                  sx={{
                    flex: 1, minWidth: 120, p: 1.5, borderRadius: 2, cursor: 'pointer', textAlign: 'center',
                    border: `2px solid ${form.type === t ? typeColor[t] : '#E2E8F0'}`,
                    bgcolor: form.type === t ? `${typeColor[t]}10` : 'transparent',
                    transition: 'all 0.15s',
                  }}>
                  <Typography fontWeight={800} fontSize={16} color={typeColor[t]}>{t}</Typography>
                  <Typography fontSize={10} color="text.secondary" lineHeight={1.3}>{typeLabel[t]}</Typography>
                </Box>
              ))}
            </Box>

            {/* Client email */}
            <Box sx={{ bgcolor: '#F8FAFF', borderRadius: 2, p: 2, mb: 3 }}>
              <Typography fontSize={12} fontWeight={700} color="#1A1A2E" mb={1.5}>
                <PeopleIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                Informations client
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={8}>
                  <Autocomplete
                    fullWidth
                    size="small"
                    options={clients}
                    getOptionLabel={c => c.email}
                    filterOptions={(opts, { inputValue }) => {
                      const q = inputValue.toLowerCase()
                      return opts.filter(c =>
                        c.email.toLowerCase().includes(q) ||
                        c.nom.toLowerCase().includes(q) ||
                        (c.entreprise ?? '').toLowerCase().includes(q)
                      )
                    }}
                    value={clients.find(c => c.email === form.client_email) ?? null}
                    onChange={(_, selected) => {
                      setForm(f => ({ ...f, client_email: selected?.email ?? '' }))
                      setFormErrors(p => ({ ...p, client_email: '' }))
                    }}
                    onInputChange={(_, val, reason) => {
                      if (reason === 'input') {
                        setForm(f => ({ ...f, client_email: val }))
                        setFormErrors(p => ({ ...p, client_email: '' }))
                      }
                    }}
                    renderOption={(props, c) => (
                      <Box component="li" {...props} key={c.id}>
                        <Box>
                          <Typography fontSize={13} fontWeight={600}>{c.nom}</Typography>
                          <Typography fontSize={11} color="#64748B">{c.email}
                            {c.entreprise ? ` — ${c.entreprise}` : ''}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                    renderInput={params => (
                      <TextField
                        {...params}
                        label="Email du client *"
                        placeholder="Rechercher par email ou nom…"
                        InputLabelProps={{ shrink: true }}
                        error={!!formErrors.client_email}
                        helperText={formErrors.client_email ?? 'Doit correspondre à un client enregistré'}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth label="Nb. d'employés déclarés *" size="small"
                    type="number" InputLabelProps={{ shrink: true }}
                    inputProps={{ min: 0 }}
                    value={form.nombre_employes}
                    error={!!formErrors.nombre_employes}
                    helperText={formErrors.nombre_employes}
                    onChange={e => setForm(f => ({ ...f, nombre_employes: e.target.value }))} />
                </Grid>
              </Grid>
            </Box>

            {/* Period & deadline */}
            <Box sx={{ bgcolor: '#F8FAFF', borderRadius: 2, p: 2, mb: 3 }}>
              <Typography fontSize={12} fontWeight={700} color="#1A1A2E" mb={1.5}>
                Période & date limite
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  {/* Periode type selector */}
                  <Box sx={{ display: 'flex', gap: 1, mb: 0 }}>
                    {(['mensuelle', 'trimestrielle'] as const).map(pt => (
                      <Box key={pt} onClick={() => setForm(f => ({ ...f, periode_type: pt }))}
                        sx={{
                          flex: 1, p: 1, borderRadius: 1.5, textAlign: 'center', cursor: 'pointer',
                          border: `1.5px solid ${form.periode_type === pt ? '#1565C0' : '#E2E8F0'}`,
                          bgcolor: form.periode_type === pt ? '#E3F0FF' : 'transparent',
                        }}>
                        <Typography fontSize={12} fontWeight={700}
                          color={form.periode_type === pt ? '#1565C0' : '#64748B'}>
                          {pt.charAt(0).toUpperCase() + pt.slice(1)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Période concernée *" size="small"
                    placeholder="ex: Juin 2024 / T2 2024"
                    InputLabelProps={{ shrink: true }}
                    value={form.periode}
                    error={!!formErrors.periode}
                    helperText={formErrors.periode}
                    onChange={e => setForm(f => ({ ...f, periode: e.target.value }))} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Date limite de dépôt *" type="date" size="small"
                    InputLabelProps={{ shrink: true }}
                    value={form.date_limite}
                    error={!!formErrors.date_limite}
                    helperText={formErrors.date_limite}
                    onChange={e => setForm(f => ({ ...f, date_limite: e.target.value }))} />
                </Grid>
                {form.type === 'CNSS' && (
                  <Grid item xs={12}>
                    <Button
                      size="small" variant="text"
                      onClick={() => setForm(f => ({ ...f, date_limite: nextLegalDeadline(15) }))}
                      sx={{ textTransform: 'none', fontWeight: 600, fontSize: 12.5, p: 0.5 }}
                    >
                      Utiliser la prochaine échéance légale (le 15 — cotisations CNSS)
                    </Button>
                  </Grid>
                )}
                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 1.5, bgcolor: days !== null && days >= 0 ? '#FFF8E7' : '#FFF0F0', borderRadius: 2, height: '100%',
                    display: 'flex', alignItems: 'center', border: `1px solid ${days !== null && days < 0 ? '#FECACA' : '#FDE68A'}` }}>
                    <Typography fontSize={12} fontWeight={700}
                      color={days !== null && days < 0 ? '#DC2626' : '#92400E'}>
                      {days === null ? 'Sélectionnez une date' : days < 0 ? `Délai dépassé de ${Math.abs(days)} jour(s)` : `${days} jours restants`}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
              {form.date_limite && days !== null && (
                <Alert severity={days < 0 ? 'error' : days < 7 ? 'warning' : 'info'}
                  sx={{ mt: 1.5, borderRadius: 2, fontSize: 12 }}>
                  {days < 0
                    ? `Délai dépassé — date limite le ${new Date(form.date_limite).toLocaleDateString('fr-FR')}`
                    : `Échéance dans ${days} jour(s) — pensez à déposer avant le ${new Date(form.date_limite).toLocaleDateString('fr-FR')}`}
                </Alert>
              )}
            </Box>

            {/* Amounts */}
            <Box sx={{ bgcolor: '#F8FAFF', borderRadius: 2, p: 2, mb: 3 }}>
              <Typography fontSize={12} fontWeight={700} color="#1A1A2E" mb={1.5}>
                Montants des cotisations
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label={`Masse salariale brute (${devise}) *`} size="small"
                    type="number" InputLabelProps={{ shrink: true }} inputProps={{ min: 0, step: '0.01' }}
                    value={form.masse_salariale}
                    error={!!formErrors.masse_salariale} helperText={formErrors.masse_salariale}
                    onChange={e => setForm(f => ({ ...f, masse_salariale: e.target.value }))} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Taux de cotisation (%) *" size="small"
                    type="number" InputLabelProps={{ shrink: true }} inputProps={{ min: 0, step: '0.01' }}
                    value={form.taux_cotisation}
                    error={!!formErrors.taux_cotisation} helperText={formErrors.taux_cotisation}
                    onChange={e => setForm(f => ({ ...f, taux_cotisation: e.target.value }))} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label={`Part patronale (${devise}) *`} size="small"
                    type="number" InputLabelProps={{ shrink: true }} inputProps={{ min: 0, step: '0.01' }}
                    value={form.part_patronale}
                    error={!!formErrors.part_patronale} helperText={formErrors.part_patronale}
                    onChange={e => setForm(f => ({ ...f, part_patronale: e.target.value }))} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label={`Part salariale (${devise}) *`} size="small"
                    type="number" InputLabelProps={{ shrink: true }} inputProps={{ min: 0, step: '0.01' }}
                    value={form.part_salariale}
                    error={!!formErrors.part_salariale} helperText={formErrors.part_salariale}
                    onChange={e => setForm(f => ({ ...f, part_salariale: e.target.value }))} />
                </Grid>
              </Grid>

              {/* Live summary cards */}
              <Grid container spacing={1.5} sx={{ mt: 1 }}>
                {[
                  { label: 'Part patronale', value: Number(form.part_patronale) || 0 },
                  { label: 'Part salariale', value: Number(form.part_salariale) || 0 },
                ].map(({ label, value }) => (
                  <Grid item xs={4} key={label}>
                    <Box sx={{ p: 1.5, bgcolor: 'white', borderRadius: 2, border: '1px solid #E2E8F0', textAlign: 'center' }}>
                      <Typography fontSize={10} color="text.secondary">{label}</Typography>
                      <Typography fontSize={14} fontWeight={700} color="#1A1A2E">{fmt(value)} {devise}</Typography>
                    </Box>
                  </Grid>
                ))}
                <Grid item xs={4}>
                  <Box sx={{ p: 1.5, bgcolor: '#1565C0', borderRadius: 2, textAlign: 'center' }}>
                    <Typography fontSize={10} color="rgba(255,255,255,0.8)">Total à payer</Typography>
                    <Typography fontSize={14} fontWeight={800} color="white">{fmt(totalAPayer)} {devise}</Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>

            {/* Status selector */}
            <Box sx={{ mb: 3 }}>
              <Typography fontSize={12} fontWeight={700} color="#1A1A2E" mb={1}>
                Statut de la déclaration
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                {([
                  { value: 'a_declarer', label: 'À déclarer', color: '#E65100', bg: '#FFF3E0', border: '#FED7AA' },
                  { value: 'deposee',    label: 'Déposée',    color: '#1565C0', bg: '#EBF5FF', border: '#BFDBFE' },
                  { value: 'validee',    label: 'Validée',    color: '#2E7D32', bg: '#E8F5E9', border: '#BBF7D0' },
                ] as const).map(opt => (
                  <Box key={opt.value} onClick={() => setForm(f => ({ ...f, statut: opt.value }))}
                    sx={{
                      flex: 1, p: 1.5, borderRadius: 2, textAlign: 'center', cursor: 'pointer',
                      border: `2px solid ${form.statut === opt.value ? opt.color : opt.border}`,
                      bgcolor: form.statut === opt.value ? opt.bg : 'transparent',
                      transition: 'all 0.15s',
                    }}>
                    <Typography fontSize={13} fontWeight={700} color={opt.color}>{opt.label}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* File attachment */}
            <Box sx={{ mb: 3 }}>
              <Typography fontSize={12} fontWeight={700} color="#1A1A2E" mb={1}>
                Pièce jointe
              </Typography>
              <input ref={fileRef} type="file" accept=".pdf,image/*" hidden
                onChange={e => setFichier(e.target.files?.[0] ?? null)} />
              <Box onClick={() => fileRef.current?.click()}
                sx={{
                  border: `2px dashed ${fichier ? '#1565C0' : '#CBD5E1'}`,
                  borderRadius: 2, p: 3, textAlign: 'center', cursor: 'pointer',
                  bgcolor: fichier ? '#F0F7FF' : '#FAFAFA',
                  transition: 'all 0.2s',
                }}>
                {fichier ? (
                  <Typography fontSize={13} fontWeight={600} color="#1565C0">{fichier.name}</Typography>
                ) : (
                  <>
                    <UploadFileIcon sx={{ fontSize: 32, color: '#94A3B8', mb: 1 }} />
                    <Typography fontSize={12} color="text.secondary">
                      Glissez votre fichier ici ou cliquez pour choisir
                    </Typography>
                    <Typography fontSize={11} color="#94A3B8">PDF, JPG, PNG — max 10 Mo</Typography>
                  </>
                )}
              </Box>
              {fichier && (
                <Button size="small" onClick={() => setFichier(null)} sx={{ mt: 0.5, fontSize: 11, color: '#64748B' }}>
                  Retirer le fichier
                </Button>
              )}
            </Box>

            {/* Notes */}
            <TextField fullWidth multiline rows={3}
              label="Notes & observations"
              placeholder="Ajoutez des remarques ou observations sur cette déclaration..."
              InputLabelProps={{ shrink: true }}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />

          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1, borderTop: '1px solid #F0F4F8' }}>
            {saving && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, borderRadius: 0 }} />}
            <Button onClick={closeForm} disabled={saving} sx={{ borderRadius: 2, fontWeight: 600 }}>
              Annuler
            </Button>
            <Button variant="contained" onClick={handleSave} disabled={saving}
              startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <AssignmentIcon />}
              sx={{ fontWeight: 700, borderRadius: 2, bgcolor: '#1565C0', '&:hover': { bgcolor: '#0D47A1' } }}>
              {saving ? 'Enregistrement…' : 'Enregistrer la déclaration'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* ── Export Excel Dialog ── */}
      <Dialog open={xlsxOpen} onClose={() => !xlsxLoading && setXlsxOpen(false)}
        maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
          <TableChartIcon sx={{ fontSize: 20, color: '#2E7D32' }} />
          Exporter en Excel
        </DialogTitle>
        <DialogContent sx={{ pt: 0, pb: 0 }}>
          <Typography fontSize={13} color="text.secondary" mb={1.5}>
            Sélectionnez les déclarations à inclure dans le fichier Excel.
          </Typography>

          <Box
            onClick={toggleXlsxAll}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.5,
              px: 1.5, py: 1, borderRadius: 2, cursor: 'pointer',
              bgcolor: '#E8F5E9', border: '1px solid #A5D6A7', mb: 1,
              '&:hover': { bgcolor: '#DCEDC8' },
            }}
          >
            <Checkbox
              checked={xlsxIds.size === rows.length && rows.length > 0}
              indeterminate={xlsxIds.size > 0 && xlsxIds.size < rows.length}
              onChange={toggleXlsxAll}
              onClick={e => e.stopPropagation()}
              size="small"
              sx={{ p: 0, color: '#2E7D32', '&.Mui-checked': { color: '#2E7D32' }, '&.MuiCheckbox-indeterminate': { color: '#2E7D32' } }}
            />
            <Typography fontWeight={700} fontSize={13} color="#1B5E20">
              Tout sélectionner ({rows.length})
            </Typography>
          </Box>

          <Divider sx={{ mb: 1 }} />

          <Box sx={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {rows.map(row => {
              const color = typeColor[row.type] ?? '#607D8B'
              const s     = statusMap[row.statut] ?? statusMap.a_declarer
              const checked = xlsxIds.has(row.id)
              return (
                <Box key={row.id} onClick={() => toggleXlsxOne(row.id)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    px: 1.5, py: 0.75, borderRadius: 1.5, cursor: 'pointer',
                    bgcolor: checked ? '#F1F8E9' : 'transparent',
                    '&:hover': { bgcolor: checked ? '#E8F5E9' : '#F8FAFC' },
                  }}>
                  <Checkbox checked={checked} size="small" sx={{ p: 0 }}
                    onChange={() => toggleXlsxOne(row.id)}
                    onClick={e => e.stopPropagation()} />
                  <Chip label={row.type} size="small"
                    sx={{ bgcolor: `${color}18`, color, fontWeight: 800, fontSize: 11, minWidth: 40 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontSize={13} fontWeight={600} noWrap>{row.periode}</Typography>
                    <Typography fontSize={11} color="text.secondary">
                      {new Date(row.date_limite).toLocaleDateString('fr-FR')} — {fmt(row.montant)} {devise}
                      {isAdmin && row.client ? ` · ${row.client.nom}` : ''}
                    </Typography>
                  </Box>
                  <Chip label={s.label} size="small"
                    sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: 10 }} />
                </Box>
              )
            })}
          </Box>

          {xlsxLoading && <LinearProgress sx={{ mt: 1.5, borderRadius: 1 }} />}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
          <Typography fontSize={13} color="text.secondary" fontWeight={600}>
            {xlsxIds.size} / {rows.length} sélectionnée(s)
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={() => setXlsxOpen(false)} disabled={xlsxLoading}
              sx={{ borderRadius: 2, fontWeight: 600 }}>
              Annuler
            </Button>
            <Button variant="contained" onClick={handleExportExcel}
              disabled={xlsxLoading || xlsxIds.size === 0}
              startIcon={xlsxLoading ? <CircularProgress size={14} color="inherit" /> : <TableChartIcon />}
              sx={{ fontWeight: 700, borderRadius: 2, bgcolor: '#2E7D32', '&:hover': { bgcolor: '#1B5E20' } }}>
              {xlsxLoading ? 'Export en cours…' : "Confirmer l'export"}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* ── Export PDF Modal ── */}
      <Dialog open={exportOpen} onClose={() => !exportLoading && setExportOpen(false)}
        maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{
          background: 'linear-gradient(135deg,#E65100,#BF360C)', color: 'white',
          fontWeight: 700, fontSize: 17, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', px: 3, py: 2,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PictureAsPdfIcon /> Exporter en PDF
          </Box>
          <IconButton size="small" onClick={() => setExportOpen(false)} disabled={exportLoading}
            sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          {/* Select all */}
          <Box sx={{ px: 3, py: 1.5, borderBottom: '1px solid #F0F4F8', bgcolor: '#FAFBFF',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={allSelected}
                  indeterminate={exportIds.length > 0 && !allSelected}
                  onChange={() => setExportIds(allSelected ? [] : allIds)}
                  sx={{ color: '#E65100', '&.Mui-checked': { color: '#E65100' },
                    '&.MuiCheckbox-indeterminate': { color: '#E65100' } }}
                />
              }
              label={<Typography fontSize={13} fontWeight={700}>Tout sélectionner</Typography>}
            />
            <Typography fontSize={12} color="#64748B">
              {exportIds.length} / {rows.length} sélectionné(s)
            </Typography>
          </Box>

          {/* Declaration list */}
          <Box sx={{ maxHeight: 380, overflowY: 'auto' }}>
            {rows.length === 0 ? (
              <Box sx={{ py: 5, textAlign: 'center', color: '#94A3B8' }}>
                <Typography fontSize={13}>Aucune déclaration disponible</Typography>
              </Box>
            ) : rows.map((row, i) => {
              const color = typeColor[row.type] ?? '#607D8B'
              const s = statusMap[row.statut] ?? statusMap.a_declarer
              const checked = exportIds.includes(row.id)
              return (
                <Box key={row.id} onClick={() => toggleExportId(row.id)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 2,
                    px: 3, py: 1.5, cursor: 'pointer',
                    borderBottom: i < rows.length - 1 ? '1px solid #F0F4F8' : 'none',
                    bgcolor: checked ? '#FFF3E0' : 'transparent',
                    '&:hover': { bgcolor: checked ? '#FFE0B2' : '#FAFBFF' },
                    transition: 'background 0.15s',
                  }}>
                  <Checkbox checked={checked} size="small"
                    sx={{ color: '#E65100', '&.Mui-checked': { color: '#E65100' }, p: 0 }}
                    onChange={() => toggleExportId(row.id)}
                    onClick={e => e.stopPropagation()} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.3 }}>
                      <Chip label={row.type} size="small"
                        sx={{ bgcolor: `${color}18`, color, fontWeight: 800, fontSize: 11 }} />
                      <Typography fontSize={13} fontWeight={600} noWrap>{row.periode}</Typography>
                    </Box>
                    {isAdmin && row.client && (
                      <Typography fontSize={11} color="#64748B" noWrap>{row.client.nom}</Typography>
                    )}
                  </Box>
                  <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                    <Typography fontSize={13} fontWeight={700}>{fmt(row.montant)} {devise}</Typography>
                    <Chip label={s.label} size="small"
                      sx={{ bgcolor: s.bg, color: s.color, fontWeight: 600, fontSize: 10, mt: 0.3 }} />
                  </Box>
                </Box>
              )
            })}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, pt: 2, gap: 1, borderTop: '1px solid #F0F4F8' }}>
          {exportLoading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}
          <Button onClick={() => setExportOpen(false)} disabled={exportLoading}
            sx={{ borderRadius: 2, fontWeight: 600 }}>
            Annuler
          </Button>
          <Button variant="contained" onClick={handleExportPdf} disabled={exportLoading || exportIds.length === 0}
            startIcon={exportLoading ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon />}
            sx={{ fontWeight: 700, borderRadius: 2, bgcolor: '#E65100', '&:hover': { bgcolor: '#BF360C' } }}>
            {exportLoading ? 'Génération…' : `Télécharger (${exportIds.length})`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit Dialog (admin only) ── */}
      {isAdmin && editDecl && (
        <Dialog open={editOpen} onClose={() => !editSaving && setEditOpen(false)}
          maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
          <DialogTitle sx={{
            background: 'linear-gradient(135deg,#7B1FA2,#4A148C)', color: 'white',
            fontWeight: 700, fontSize: 17, display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', px: 3, py: 2,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EditIcon /> Modifier — {editDecl.type} · {editDecl.periode}
            </Box>
            <IconButton size="small" onClick={() => setEditOpen(false)} disabled={editSaving}
              sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>

          <DialogContent sx={{ px: 3, py: 3 }}>
            <Grid container spacing={2}>
              {/* Type */}
              <Grid item xs={12}>
                <Typography fontSize={12} fontWeight={700} color="#1A1A2E" mb={1}>Type</Typography>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  {(['CNSS', 'CIMR', 'AMO'] as const).map(t => (
                    <Box key={t} onClick={() => setEditForm(f => ({ ...f, type: t }))}
                      sx={{
                        flex: 1, p: 1.5, borderRadius: 2, cursor: 'pointer', textAlign: 'center',
                        border: `2px solid ${editForm.type === t ? typeColor[t] : '#E2E8F0'}`,
                        bgcolor: editForm.type === t ? `${typeColor[t]}10` : 'transparent',
                        transition: 'all 0.15s',
                      }}>
                      <Typography fontWeight={800} fontSize={15} color={typeColor[t]}>{t}</Typography>
                    </Box>
                  ))}
                </Box>
              </Grid>

              {/* Period */}
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Période concernée *" size="small"
                  InputLabelProps={{ shrink: true }}
                  value={editForm.periode}
                  onChange={e => setEditForm(f => ({ ...f, periode: e.target.value }))} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Date limite *" type="date" size="small"
                  InputLabelProps={{ shrink: true }}
                  value={editForm.date_limite}
                  onChange={e => setEditForm(f => ({ ...f, date_limite: e.target.value }))} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Nb. employés *" size="small" type="number"
                  InputLabelProps={{ shrink: true }} inputProps={{ min: 0 }}
                  value={editForm.nombre_employes}
                  onChange={e => setEditForm(f => ({ ...f, nombre_employes: e.target.value }))} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label={`Masse salariale (${devise}) *`} size="small" type="number"
                  InputLabelProps={{ shrink: true }} inputProps={{ min: 0, step: '0.01' }}
                  value={editForm.masse_salariale}
                  onChange={e => setEditForm(f => ({ ...f, masse_salariale: e.target.value }))} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth label="Taux (%)" size="small" type="number"
                  InputLabelProps={{ shrink: true }} inputProps={{ min: 0, step: '0.01' }}
                  value={editForm.taux_cotisation}
                  onChange={e => setEditForm(f => ({ ...f, taux_cotisation: e.target.value }))} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth label={`Part patronale (${devise})`} size="small" type="number"
                  InputLabelProps={{ shrink: true }} inputProps={{ min: 0, step: '0.01' }}
                  value={editForm.part_patronale}
                  onChange={e => setEditForm(f => ({ ...f, part_patronale: e.target.value }))} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth label={`Part salariale (${devise})`} size="small" type="number"
                  InputLabelProps={{ shrink: true }} inputProps={{ min: 0, step: '0.01' }}
                  value={editForm.part_salariale}
                  onChange={e => setEditForm(f => ({ ...f, part_salariale: e.target.value }))} />
              </Grid>

              {/* Status */}
              <Grid item xs={12}>
                <Typography fontSize={12} fontWeight={700} color="#1A1A2E" mb={1}>Statut</Typography>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  {([
                    { value: 'a_declarer', label: 'À déclarer', color: '#E65100', bg: '#FFF3E0' },
                    { value: 'deposee',    label: 'Déposée',    color: '#1565C0', bg: '#EBF5FF' },
                    { value: 'validee',    label: 'Validée',    color: '#2E7D32', bg: '#E8F5E9' },
                  ] as const).map(opt => (
                    <Box key={opt.value} onClick={() => setEditForm(f => ({ ...f, statut: opt.value }))}
                      sx={{
                        flex: 1, p: 1, borderRadius: 2, textAlign: 'center', cursor: 'pointer',
                        border: `2px solid ${editForm.statut === opt.value ? opt.color : '#E2E8F0'}`,
                        bgcolor: editForm.statut === opt.value ? opt.bg : 'transparent',
                        transition: 'all 0.15s',
                      }}>
                      <Typography fontSize={12} fontWeight={700} color={opt.color}>{opt.label}</Typography>
                    </Box>
                  ))}
                </Box>
              </Grid>

              {/* Notes */}
              <Grid item xs={12}>
                <TextField fullWidth multiline rows={2} label="Notes" size="small"
                  InputLabelProps={{ shrink: true }}
                  value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
              </Grid>
            </Grid>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1, borderTop: '1px solid #F0F4F8' }}>
            {editSaving && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}
            <Button onClick={() => setEditOpen(false)} disabled={editSaving}
              sx={{ borderRadius: 2, fontWeight: 600 }}>
              Annuler
            </Button>
            <Button variant="contained" onClick={handleEditSave} disabled={editSaving}
              startIcon={editSaving ? <CircularProgress size={14} color="inherit" /> : <EditIcon />}
              sx={{ fontWeight: 700, borderRadius: 2, bgcolor: '#7B1FA2', '&:hover': { bgcolor: '#4A148C' } }}>
              {editSaving ? 'Enregistrement…' : 'Enregistrer les modifications'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

    </Box>
  )
}
