import { useState, useEffect, useRef } from 'react'
import {
  Box, Typography, Card, CardContent, Button, Table, TableBody,
  TableCell, TableHead, TableRow, Chip, IconButton, Tooltip,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, TextField, LinearProgress, Divider, Autocomplete,
  Checkbox, FormControlLabel,
} from '@mui/material'
import AddIcon            from '@mui/icons-material/Add'
import VisibilityIcon     from '@mui/icons-material/Visibility'
import CloseIcon          from '@mui/icons-material/Close'
import DeleteIcon         from '@mui/icons-material/Delete'
import EditIcon           from '@mui/icons-material/Edit'
import DownloadIcon       from '@mui/icons-material/Download'
import DirectionsCarIcon  from '@mui/icons-material/DirectionsCar'
import CalendarTodayIcon  from '@mui/icons-material/CalendarToday'
import PictureAsPdfIcon   from '@mui/icons-material/PictureAsPdf'
import UploadFileIcon     from '@mui/icons-material/UploadFile'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import StatCard from '../../components/common/StatCard'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import { useCurrency } from '../../contexts/CurrencyContext'

interface EcheancierLeasing {
  id: number
  contrat_ref: string
  bien: string
  description_bien: string | null
  bailleur: string
  date_debut: string
  date_fin: string
  mensualite: number
  nombre_mensualites: number
  option_achat: number | null
  valeur_achat: number | null
  capital_restant_du: number | null
  taux_interet: number | null
  tva_loyers: number | null
  total_loyers: number | null
  prochaine_echeance: string
  statut: string
  notes: string | null
  fichier: string | null
  client?: { id: number; nom: string; email: string; entreprise?: string }
}

interface ClientOption { id: number; nom: string; email: string; entreprise?: string }

const statusMap: Record<string, { label: string; color: string; bg: string }> = {
  actif:     { label: 'En cours',  color: '#2E7D32', bg: '#E8F5E9' },
  solde:     { label: 'Soldé',     color: '#1565C0', bg: '#E3F0FF' },
  en_retard: { label: 'En retard', color: '#C62828', bg: '#FFEBEE' },
  a_venir:   { label: 'À venir',   color: '#E65100', bg: '#FFF3E0' },
}

const emptyForm = {
  client_email: '',
  bien: '', description_bien: '', bailleur: '',
  date_debut: '', date_fin: '',
  mensualite: '', nombre_mensualites: '',
  option_achat: '', valeur_achat: '',
  capital_restant_du: '', taux_interet: '',
  tva_loyers: '', total_loyers: '',
  prochaine_echeance: '', statut: 'actif', notes: '',
}

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function progression(debut: string, fin: string): number {
  const start = new Date(debut).getTime()
  const end   = new Date(fin).getTime()
  const now   = Date.now()
  if (now >= end)   return 100
  if (now <= start) return 0
  return Math.round(((now - start) / (end - start)) * 100)
}

export default function EcheancierLeasing() {
  const { devise } = useCurrency()
  const isAdmin = sessionStorage.getItem('real_role') === 'admin'

  const [rows, setRows]       = useState<EcheancierLeasing[]>([])
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<ClientOption[]>([])

  // New contract dialog (admin only)
  const [formOpen, setFormOpen]     = useState(false)
  const [form, setForm]             = useState({ ...emptyForm })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [saving, setSaving]         = useState(false)
  const [fichier, setFichier]       = useState<File | null>(null)
  const fileRef                     = useRef<HTMLInputElement>(null)

  // View dialog
  const [viewRow, setViewRow]   = useState<EcheancierLeasing | null>(null)
  const [viewOpen, setViewOpen] = useState(false)

  // Edit dialog (admin only)
  const [editRow, setEditRow]       = useState<EcheancierLeasing | null>(null)
  const [editOpen, setEditOpen]     = useState(false)
  const [editForm, setEditForm]     = useState({ ...emptyForm })
  const [editSaving, setEditSaving] = useState(false)
  const [editFichier, setEditFichier] = useState<File | null>(null)
  const editFileRef                   = useRef<HTMLInputElement>(null)

  // Export PDF modal
  const [exportOpen, setExportOpen]       = useState(false)
  const [exportIds, setExportIds]         = useState<number[]>([])
  const [exportLoading, setExportLoading] = useState(false)

  const load = () => {
    setLoading(true)
    api.get('/echeanciers-leasing')
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

  // Auto-compute total_loyers when mensualite + nombre_mensualites change
  useEffect(() => {
    const m = parseFloat(form.mensualite)
    const n = parseInt(form.nombre_mensualites)
    if (!isNaN(m) && !isNaN(n) && n > 0) {
      setForm(f => ({ ...f, total_loyers: (m * n).toFixed(2) }))
    }
  }, [form.mensualite, form.nombre_mensualites])

  useEffect(() => {
    const m = parseFloat(editForm.mensualite)
    const n = parseInt(editForm.nombre_mensualites)
    if (!isNaN(m) && !isNaN(n) && n > 0) {
      setEditForm(f => ({ ...f, total_loyers: (m * n).toFixed(2) }))
    }
  }, [editForm.mensualite, editForm.nombre_mensualites])

  // Stat computations
  const actifs       = rows.filter(r => r.statut === 'actif' || r.statut === 'a_venir')
  const totalMensuel = actifs.reduce((s, r) => s + r.mensualite, 0)
  const prochaine    = rows
    .filter(r => r.prochaine_echeance && r.statut !== 'solde')
    .sort((a, b) => new Date(a.prochaine_echeance).getTime() - new Date(b.prochaine_echeance).getTime())[0]

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleView = (row: EcheancierLeasing) => {
    setViewRow(row)
    setViewOpen(true)
  }

  const handleEditOpen = (row: EcheancierLeasing) => {
    setEditRow(row)
    setEditForm({
      client_email:       row.client?.email          ?? '',
      bien:               row.bien                   ?? '',
      description_bien:   row.description_bien       ?? '',
      bailleur:           row.bailleur               ?? '',
      date_debut:         row.date_debut?.substring(0, 10) ?? '',
      date_fin:           row.date_fin?.substring(0, 10)   ?? '',
      mensualite:         String(row.mensualite       ?? ''),
      nombre_mensualites: String(row.nombre_mensualites ?? ''),
      option_achat:       row.option_achat      != null ? String(row.option_achat)      : '',
      valeur_achat:       row.valeur_achat      != null ? String(row.valeur_achat)      : '',
      capital_restant_du: row.capital_restant_du != null ? String(row.capital_restant_du) : '',
      taux_interet:       row.taux_interet      != null ? String(row.taux_interet)      : '',
      tva_loyers:         row.tva_loyers        != null ? String(row.tva_loyers)        : '',
      total_loyers:       row.total_loyers      != null ? String(row.total_loyers)      : '',
      prochaine_echeance: row.prochaine_echeance?.substring(0, 10) ?? '',
      statut:             row.statut            ?? 'actif',
      notes:              row.notes             ?? '',
    })
    setEditFichier(null)
    setEditOpen(true)
  }

  const buildFormData = (f: typeof emptyForm, file: File | null, clientId?: number) => {
    const fd = new FormData()
    if (clientId) fd.append('client_id', String(clientId))
    Object.entries(f).forEach(([k, v]) => {
      if (k !== 'client_email' && v !== '') fd.append(k, v)
    })
    if (file) fd.append('fichier', file)
    return fd
  }

  const validate = (f: typeof emptyForm) => {
    const e: Record<string, string> = {}
    if (!f.bien.trim())              e.bien = 'Requis'
    if (!f.bailleur.trim())          e.bailleur = 'Requis'
    if (!f.date_debut)               e.date_debut = 'Requis'
    if (!f.date_fin)                 e.date_fin = 'Requis'
    if (!f.mensualite)               e.mensualite = 'Requis'
    if (!f.prochaine_echeance)       e.prochaine_echeance = 'Requis'
    if (isAdmin && !f.client_email)  e.client_email = 'Requis'
    if (isAdmin && f.client_email && !clients.find(c => c.email === f.client_email))
      e.client_email = 'Sélectionnez un client dans la liste'
    return e
  }

  const handleSave = async () => {
    const errs = validate(form)
    if (Object.keys(errs).length) { setFormErrors(errs); return }
    setSaving(true)
    try {
      const client = clients.find(c => c.email === form.client_email)
      const fd = buildFormData(form, fichier, client?.id)
      await api.post('/echeanciers-leasing', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Contrat enregistré')
      setFormOpen(false)
      setForm({ ...emptyForm })
      setFichier(null)
      load()
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Erreur lors de l\'enregistrement'
      toast.error(msg)
    } finally { setSaving(false) }
  }

  const handleEditSave = async () => {
    if (!editRow) return
    setEditSaving(true)
    try {
      const fd = buildFormData(editForm, editFichier)
      fd.append('_method', 'PUT')
      await api.post(`/echeanciers-leasing/${editRow.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Contrat mis à jour')
      setEditOpen(false)
      load()
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Erreur lors de la mise à jour'
      toast.error(msg)
    } finally { setEditSaving(false) }
  }

  const handleDelete = async (row: EcheancierLeasing) => {
    if (!window.confirm(`Supprimer le contrat ${row.contrat_ref} ?`)) return
    try {
      await api.delete(`/echeanciers-leasing/${row.id}`)
      toast.success('Contrat supprimé')
      load()
    } catch { toast.error('Erreur lors de la suppression') }
  }

  const handleDownloadPdf = async (row: EcheancierLeasing) => {
    try {
      const token = sessionStorage.getItem('token')
      const res = await fetch(`${api.defaults.baseURL}/echeanciers-leasing/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: [row.id] }),
      })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `leasing_${row.contrat_ref}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Erreur lors du téléchargement') }
  }

  const handleExportPdf = async () => {
    if (!exportIds.length) { toast.error('Sélectionnez au moins un contrat'); return }
    setExportLoading(true)
    try {
      const token = sessionStorage.getItem('token')
      const res = await fetch(`${api.defaults.baseURL}/echeanciers-leasing/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: exportIds }),
      })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `echeanciers_leasing_${new Date().toISOString().slice(0, 10)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      setExportOpen(false)
      setExportIds([])
      toast.success('PDF téléchargé')
    } catch { toast.error('Erreur lors de l\'export PDF') }
    finally { setExportLoading(false) }
  }

  // ── Shared form fields renderer ───────────────────────────────────────
  const renderFormFields = (
    f: typeof emptyForm,
    setF: React.Dispatch<React.SetStateAction<typeof emptyForm>>,
    errs: Record<string, string>,
    setErrs: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    fileState: File | null,
    setFileState: (v: File | null) => void,
    fRef: React.RefObject<HTMLInputElement>,
  ) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Client email — admin only */}
      {isAdmin && (
        <Autocomplete
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
          value={clients.find(c => c.email === f.client_email) ?? null}
          onChange={(_, selected) => {
            setF(p => ({ ...p, client_email: selected?.email ?? '' }))
            setErrs(p => ({ ...p, client_email: '' }))
          }}
          onInputChange={(_, val, reason) => {
            if (reason === 'input') {
              setF(p => ({ ...p, client_email: val }))
              setErrs(p => ({ ...p, client_email: '' }))
            }
          }}
          renderOption={(props, c) => (
            <Box component="li" {...props} key={c.id}>
              <Box>
                <Typography fontSize={13} fontWeight={600}>{c.nom}</Typography>
                <Typography fontSize={11} color="#64748B">
                  {c.email}{c.entreprise ? ` — ${c.entreprise}` : ''}
                </Typography>
              </Box>
            </Box>
          )}
          renderInput={params => (
            <TextField {...params} label="Client *" size="small" error={!!errs.client_email}
              helperText={errs.client_email} />
          )}
        />
      )}

      <Divider sx={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>CONTRAT</Divider>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth size="small" label="Nature du bien *" value={f.bien}
            error={!!errs.bien} helperText={errs.bien}
            onChange={e => { setF(p => ({ ...p, bien: e.target.value })); setErrs(p => ({ ...p, bien: '' })) }} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth size="small" label="Bailleur *" value={f.bailleur}
            error={!!errs.bailleur} helperText={errs.bailleur}
            onChange={e => { setF(p => ({ ...p, bailleur: e.target.value })); setErrs(p => ({ ...p, bailleur: '' })) }} />
        </Grid>
        <Grid item xs={12}>
          <TextField fullWidth size="small" label="Description du bien" value={f.description_bien}
            onChange={e => setF(p => ({ ...p, description_bien: e.target.value }))} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth size="small" label="Date de début *" type="date" value={f.date_debut}
            error={!!errs.date_debut} helperText={errs.date_debut}
            InputLabelProps={{ shrink: true }}
            onChange={e => { setF(p => ({ ...p, date_debut: e.target.value })); setErrs(p => ({ ...p, date_debut: '' })) }} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth size="small" label="Date de fin *" type="date" value={f.date_fin}
            error={!!errs.date_fin} helperText={errs.date_fin}
            InputLabelProps={{ shrink: true }}
            onChange={e => { setF(p => ({ ...p, date_fin: e.target.value })); setErrs(p => ({ ...p, date_fin: '' })) }} />
        </Grid>
      </Grid>

      <Divider sx={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>BIEN FINANCÉ</Divider>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth size="small" label={`Valeur d'achat (${devise})`} type="number" value={f.valeur_achat}
            onChange={e => setF(p => ({ ...p, valeur_achat: e.target.value }))} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth size="small" label={`Option d'achat (${devise})`} type="number" value={f.option_achat}
            onChange={e => setF(p => ({ ...p, option_achat: e.target.value }))} />
        </Grid>
      </Grid>

      <Divider sx={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>DÉTAIL DES ÉCHÉANCES</Divider>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth size="small" label={`Mensualité (${devise}) *`} type="number" value={f.mensualite}
            error={!!errs.mensualite} helperText={errs.mensualite}
            onChange={e => { setF(p => ({ ...p, mensualite: e.target.value })); setErrs(p => ({ ...p, mensualite: '' })) }} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth size="small" label="Nombre de mensualités" type="number" value={f.nombre_mensualites}
            onChange={e => setF(p => ({ ...p, nombre_mensualites: e.target.value }))} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth size="small" label={`Capital restant dû (${devise})`} type="number" value={f.capital_restant_du}
            onChange={e => setF(p => ({ ...p, capital_restant_du: e.target.value }))} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth size="small" label="Prochaine échéance *" type="date" value={f.prochaine_echeance}
            error={!!errs.prochaine_echeance} helperText={errs.prochaine_echeance}
            InputLabelProps={{ shrink: true }}
            onChange={e => { setF(p => ({ ...p, prochaine_echeance: e.target.value })); setErrs(p => ({ ...p, prochaine_echeance: '' })) }} />
        </Grid>
      </Grid>

      <Divider sx={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>TABLEAU D'AMORTISSEMENT</Divider>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth size="small" label="Taux d'intérêt (%)" type="number" value={f.taux_interet}
            onChange={e => setF(p => ({ ...p, taux_interet: e.target.value }))} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth size="small" label={`TVA sur loyers (${devise})`} type="number" value={f.tva_loyers}
            onChange={e => setF(p => ({ ...p, tva_loyers: e.target.value }))} />
        </Grid>
        <Grid item xs={12}>
          <TextField fullWidth size="small" label={`Total des loyers (${devise}) — calculé auto`} type="number" value={f.total_loyers}
            InputLabelProps={{ shrink: !!f.total_loyers }}
            onChange={e => setF(p => ({ ...p, total_loyers: e.target.value }))} />
        </Grid>
      </Grid>

      <Divider sx={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>STATUT DU CONTRAT</Divider>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {([
          { value: 'actif',     label: 'En cours',  color: '#2E7D32', bg: '#E8F5E9', border: '#A7F3D0' },
          { value: 'solde',     label: 'Soldé',     color: '#1565C0', bg: '#EBF5FF', border: '#BFDBFE' },
          { value: 'en_retard', label: 'En retard', color: '#C62828', bg: '#FFEBEE', border: '#FECACA' },
          { value: 'a_venir',   label: 'À venir',   color: '#E65100', bg: '#FFF3E0', border: '#FED7AA' },
        ] as const).map(s => (
          <Chip key={s.value} label={s.label} onClick={() => setF(p => ({ ...p, statut: s.value }))}
            sx={{
              cursor: 'pointer', fontWeight: 700, fontSize: 12,
              bgcolor: f.statut === s.value ? s.bg : 'transparent',
              color:   f.statut === s.value ? s.color : '#64748B',
              border:  `2px solid ${f.statut === s.value ? s.border : '#E2E8F0'}`,
            }} />
        ))}
      </Box>

      <TextField fullWidth size="small" label="Notes & observations" multiline rows={3} value={f.notes}
        onChange={e => setF(p => ({ ...p, notes: e.target.value }))} />

      {/* File upload */}
      <Box component="input" type="file" accept=".pdf,.jpg,.jpeg,.png" ref={fRef as React.RefObject<HTMLInputElement>}
        aria-label="Pièce jointe contrat"
        sx={{ display: 'none' }}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFileState(e.target.files?.[0] ?? null)} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Button variant="outlined" size="small" startIcon={<UploadFileIcon />}
          onClick={() => fRef.current?.click()}
          sx={{ borderRadius: 2, fontWeight: 600, borderColor: '#CBD5E1', color: '#64748B' }}>
          {fileState ? fileState.name : 'Pièce jointe contrat'}
        </Button>
        {fileState && (
          <Typography fontSize={11} color="success.main">Fichier sélectionné</Typography>
        )}
      </Box>
    </Box>
  )

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
            Échéancier leasing
          </Typography>
          <Typography color="text.secondary" fontSize={14}>Suivi des contrats de crédit-bail</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
          <Button variant="outlined" startIcon={<PictureAsPdfIcon />}
            onClick={() => { setExportIds([]); setExportOpen(true) }}
            sx={{ borderRadius: 2.5, fontWeight: 600, borderColor: '#E65100', color: '#E65100',
              '&:hover': { bgcolor: '#FFF3E0', borderColor: '#E65100' } }}>
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Exporter PDF</Box>
          </Button>
          {isAdmin && (
            <Button variant="contained" startIcon={<AddIcon />}
              onClick={() => { setForm({ ...emptyForm }); setFormErrors({}); setFichier(null); setFormOpen(true) }}
              sx={{ borderRadius: 2.5, fontWeight: 600 }}>
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Nouveau contrat</Box>
            </Button>
          )}
        </Box>
      </Box>

      {/* ── Stat cards ── */}
      <Grid container spacing={2.5} mb={3}>
        <Grid item xs={12} sm={4}>
          <StatCard title="Contrats actifs" value={actifs.length} icon={<AccountBalanceIcon />} color="#1565C0" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard title="Charges mensuelles" value={`${fmt(totalMensuel)} ${devise}`} icon={<CalendarTodayIcon />} color="#E65100" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard
            title="Prochaine échéance"
            value={prochaine ? new Date(prochaine.prochaine_echeance).toLocaleDateString('fr-FR') : '—'}
            icon={<DirectionsCarIcon />} color="#7B1FA2"
          />
        </Grid>
      </Grid>

      {/* ── Table ── */}
      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={32} />
            </Box>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table sx={{ minWidth: 600 }}>
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 800, fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 } }}>
                    <TableCell>Réf.</TableCell>
                    {isAdmin && <TableCell>Client</TableCell>}
                    <TableCell>Bien financé</TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Bailleur</TableCell>
                    <TableCell align="right">Mensualité</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Proch. échéance</TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Progression</TableCell>
                    <TableCell>Statut</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 9 : 8} align="center" sx={{ py: 5, color: '#94A3B8' }}>
                        Aucun contrat de leasing enregistré.
                      </TableCell>
                    </TableRow>
                  ) : rows.map(row => {
                    const s    = statusMap[row.statut] ?? statusMap.actif
                    const prog = row.date_debut && row.date_fin
                      ? progression(row.date_debut, row.date_fin) : 0
                    return (
                      <TableRow key={row.id} sx={{ '&:hover': { bgcolor: '#f8f9ff' } }}>
                        <TableCell>
                          <Typography fontWeight={700} fontSize={13} color="#1565C0">{row.contrat_ref}</Typography>
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <Typography fontSize={13} fontWeight={600}>{row.client?.nom ?? '—'}</Typography>
                            <Typography fontSize={11} color="#94A3B8">{row.client?.email ?? ''}</Typography>
                          </TableCell>
                        )}
                        <TableCell>
                          <Typography fontWeight={600} fontSize={13}>{row.bien}</Typography>
                          {row.description_bien && (
                            <Typography fontSize={11} color="#94A3B8">{row.description_bien}</Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{row.bailleur}</TableCell>
                        <TableCell align="right">
                          <Typography fontWeight={700} fontSize={13}>{fmt(row.mensualite)} {devise}</Typography>
                        </TableCell>
                        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                          {row.prochaine_echeance
                            ? new Date(row.prochaine_echeance).toLocaleDateString('fr-FR')
                            : '—'}
                        </TableCell>
                        <TableCell sx={{ minWidth: 100, display: { xs: 'none', md: 'table-cell' } }}>
                          <Typography fontSize={11} color="text.secondary" mb={0.5}>{prog}%</Typography>
                          <LinearProgress variant="determinate" value={prog}
                            sx={{ height: 6, borderRadius: 3, bgcolor: '#e3f0ff',
                              '& .MuiLinearProgress-bar': { bgcolor: '#1565C0', borderRadius: 3 } }} />
                        </TableCell>
                        <TableCell>
                          <Chip label={s.label} size="small"
                            sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: 11 }} />
                        </TableCell>
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                          <Tooltip title="Voir les détails">
                            <IconButton size="small" onClick={() => handleView(row)}>
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Télécharger PDF">
                            <IconButton size="small" sx={{ color: '#1565C0' }} onClick={() => handleDownloadPdf(row)}>
                              <DownloadIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
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

      {/* ── View dialog ── */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        {viewRow && (
          <>
            <DialogTitle sx={{
              background: 'linear-gradient(135deg, #1565C0, #1565C0CC)',
              color: 'white', fontWeight: 700, fontSize: 17,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 1, px: 3, py: 2,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AccountBalanceIcon />
                {viewRow.contrat_ref} — {viewRow.bien}
              </Box>
              <IconButton size="small" onClick={() => setViewOpen(false)} sx={{ color: 'white' }}>
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent sx={{ p: 0 }}>
              {/* Meta bar */}
              <Box sx={{ bgcolor: '#1565C010', px: 3, py: 1.5, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Chip label={statusMap[viewRow.statut]?.label ?? viewRow.statut} size="small"
                  sx={{ bgcolor: statusMap[viewRow.statut]?.bg, color: statusMap[viewRow.statut]?.color, fontWeight: 700 }} />
                <Typography fontSize={12} color="#64748B" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  Bailleur : <strong>{viewRow.bailleur}</strong>
                </Typography>
              </Box>
              <Box sx={{ px: 3, py: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Client & Contrat */}
                {isAdmin && viewRow.client && (
                  <Box>
                    <Typography fontSize={10} fontWeight={700} color="#1565C0" textTransform="uppercase"
                      letterSpacing={1} mb={0.5}>Client</Typography>
                    <Typography fontSize={13} fontWeight={600}>{viewRow.client.nom}</Typography>
                    <Typography fontSize={12} color="#64748B">{viewRow.client.email}</Typography>
                  </Box>
                )}
                {/* Bien financé */}
                <Box>
                  <Typography fontSize={10} fontWeight={700} color="#1565C0" textTransform="uppercase"
                    letterSpacing={1} mb={1} sx={{ borderBottom: '2px solid #1565C020', pb: 0.5 }}>
                    Bien financé
                  </Typography>
                  <Grid container spacing={1}>
                    {[
                      ['Nature du bien',   viewRow.bien],
                      ['Description',      viewRow.description_bien ?? '—'],
                      ['Valeur d\'achat',  viewRow.valeur_achat ? `${fmt(viewRow.valeur_achat)} ${devise}` : '—'],
                      ['Option d\'achat',  viewRow.option_achat  ? `${fmt(viewRow.option_achat)} ${devise}` : '—'],
                    ].map(([label, val]) => (
                      <Grid item xs={6} key={label}>
                        <Typography fontSize={11} color="#64748B">{label}</Typography>
                        <Typography fontSize={12} fontWeight={600}>{val}</Typography>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
                {/* Période */}
                <Box>
                  <Typography fontSize={10} fontWeight={700} color="#1565C0" textTransform="uppercase"
                    letterSpacing={1} mb={1} sx={{ borderBottom: '2px solid #1565C020', pb: 0.5 }}>
                    Période & Échéances
                  </Typography>
                  <Grid container spacing={1}>
                    {[
                      ['Date de début',   viewRow.date_debut ? new Date(viewRow.date_debut).toLocaleDateString('fr-FR') : '—'],
                      ['Date de fin',     viewRow.date_fin   ? new Date(viewRow.date_fin).toLocaleDateString('fr-FR')   : '—'],
                      ['Nb mensualités',  viewRow.nombre_mensualites ? `${viewRow.nombre_mensualites} mois` : '—'],
                      ['Proch. échéance', viewRow.prochaine_echeance ? new Date(viewRow.prochaine_echeance).toLocaleDateString('fr-FR') : '—'],
                    ].map(([label, val]) => (
                      <Grid item xs={6} key={label}>
                        <Typography fontSize={11} color="#64748B">{label}</Typography>
                        <Typography fontSize={12} fontWeight={600}>{val}</Typography>
                      </Grid>
                    ))}
                  </Grid>
                  {viewRow.date_debut && viewRow.date_fin && (
                    <Box mt={1.5}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography fontSize={11} color="#64748B">Progression du contrat</Typography>
                        <Typography fontSize={11} fontWeight={700} color="#1565C0">
                          {progression(viewRow.date_debut, viewRow.date_fin)}%
                        </Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={progression(viewRow.date_debut, viewRow.date_fin)}
                        sx={{ height: 8, borderRadius: 4, bgcolor: '#e3f0ff',
                          '& .MuiLinearProgress-bar': { bgcolor: '#1565C0', borderRadius: 4 } }} />
                    </Box>
                  )}
                </Box>
                {/* Tableau financier */}
                <Box sx={{ bgcolor: '#EFF6FF', borderRadius: 2, p: 2 }}>
                  <Typography fontSize={10} fontWeight={700} color="#1565C0" textTransform="uppercase"
                    letterSpacing={1} mb={1}>Tableau financier</Typography>
                  <Grid container spacing={1}>
                    {[
                      ['Taux d\'intérêt',    viewRow.taux_interet  ? `${fmt(viewRow.taux_interet)} %` : '—'],
                      ['TVA sur loyers',     viewRow.tva_loyers    ? `${fmt(viewRow.tva_loyers)} ${devise}`  : '—'],
                      ['Capital restant dû', viewRow.capital_restant_du ? `${fmt(viewRow.capital_restant_du)} ${devise}` : '—'],
                      ['Mensualité',         `${fmt(viewRow.mensualite)} ${devise}`],
                    ].map(([label, val]) => (
                      <Grid item xs={6} key={label}>
                        <Typography fontSize={11} color="#64748B">{label}</Typography>
                        <Typography fontSize={12} fontWeight={600}>{val}</Typography>
                      </Grid>
                    ))}
                  </Grid>
                  <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid #BFDBFE',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography fontSize={13} fontWeight={700} color="#1565C0">Total des loyers</Typography>
                    <Typography fontSize={16} fontWeight={800} color="#1565C0">
                      {viewRow.total_loyers ? `${fmt(viewRow.total_loyers)} ${devise}` : '—'}
                    </Typography>
                  </Box>
                </Box>
                {/* Notes */}
                {viewRow.notes && (
                  <Box sx={{ bgcolor: '#FFFBEB', borderLeft: '3px solid #F59E0B', borderRadius: 1, p: 1.5 }}>
                    <Typography fontSize={11} color="#92400E">{viewRow.notes}</Typography>
                  </Box>
                )}
              </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={() => setViewOpen(false)} variant="outlined" sx={{ borderRadius: 2 }}>
                Fermer
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* ── New contract dialog (admin only) ── */}
      {isAdmin && (
        <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="md" fullWidth
          PaperProps={{ sx: { borderRadius: 3 } }}>
          <DialogTitle sx={{
            background: 'linear-gradient(135deg, #1565C0, #1E40AF)',
            color: 'white', fontWeight: 700, fontSize: 17,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccountBalanceIcon /> Nouveau contrat de leasing
            </Box>
            <IconButton size="small" onClick={() => setFormOpen(false)} sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 3, mt: 1 }}>
            {renderFormFields(form, setForm, formErrors, setFormErrors, fichier, setFichier, fileRef)}
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setFormOpen(false)} variant="outlined" sx={{ borderRadius: 2 }}>Annuler</Button>
            <Button onClick={handleSave} variant="contained" disabled={saving}
              sx={{ borderRadius: 2, fontWeight: 700 }}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* ── Edit dialog (admin only) ── */}
      {isAdmin && (
        <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="md" fullWidth
          PaperProps={{ sx: { borderRadius: 3 } }}>
          <DialogTitle sx={{
            background: 'linear-gradient(135deg, #7B1FA2, #9C27B0)',
            color: 'white', fontWeight: 700, fontSize: 17,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EditIcon /> Modifier — {editRow?.contrat_ref}
            </Box>
            <IconButton size="small" onClick={() => setEditOpen(false)} sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 3, mt: 1 }}>
            {renderFormFields(editForm, setEditForm, {}, () => {}, editFichier, setEditFichier, editFileRef)}
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setEditOpen(false)} variant="outlined" sx={{ borderRadius: 2 }}>Annuler</Button>
            <Button onClick={handleEditSave} variant="contained" disabled={editSaving}
              sx={{ borderRadius: 2, fontWeight: 700, bgcolor: '#7B1FA2', '&:hover': { bgcolor: '#6A1B9A' } }}>
              {editSaving ? 'Mise à jour…' : 'Mettre à jour'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* ── Export PDF modal ── */}
      <Dialog open={exportOpen} onClose={() => setExportOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{
          background: 'linear-gradient(135deg, #E65100, #F57C00)',
          color: 'white', fontWeight: 700, fontSize: 17,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PictureAsPdfIcon /> Exporter en PDF
          </Box>
          <IconButton size="small" onClick={() => setExportOpen(false)} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Typography fontSize={13} color="#64748B" mb={2}>
            Sélectionnez les contrats à inclure dans le PDF :
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={exportIds.length === rows.length && rows.length > 0}
                indeterminate={exportIds.length > 0 && exportIds.length < rows.length}
                onChange={e => setExportIds(e.target.checked ? rows.map(r => r.id) : [])}
              />
            }
            label={<Typography fontWeight={700} fontSize={13}>Tout sélectionner</Typography>}
            sx={{ mb: 1, pl: 1 }}
          />
          <Divider sx={{ mb: 1 }} />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 320, overflowY: 'auto' }}>
            {rows.map(row => {
              const s = statusMap[row.statut] ?? statusMap.actif
              return (
                <Box key={row.id} sx={{
                  display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1.5,
                  border: '1px solid', cursor: 'pointer',
                  borderColor: exportIds.includes(row.id) ? '#1565C040' : '#E2E8F0',
                  bgcolor: exportIds.includes(row.id) ? '#EFF6FF' : 'white',
                  '&:hover': { bgcolor: '#F8FAFF' },
                }} onClick={() =>
                  setExportIds(ids => ids.includes(row.id) ? ids.filter(i => i !== row.id) : [...ids, row.id])
                }>
                  <Checkbox size="small" checked={exportIds.includes(row.id)}
                    onChange={() => setExportIds(ids => ids.includes(row.id) ? ids.filter(i => i !== row.id) : [...ids, row.id])}
                    onClick={e => e.stopPropagation()} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontSize={13} fontWeight={700} color="#1565C0">{row.contrat_ref}</Typography>
                    <Typography fontSize={11} color="#64748B" noWrap>{row.bien} — {row.bailleur}</Typography>
                  </Box>
                  <Typography fontSize={12} fontWeight={700}>{fmt(row.mensualite)} {devise}</Typography>
                  <Chip label={s.label} size="small"
                    sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: 10, ml: 1 }} />
                </Box>
              )
            })}
          </Box>
          {exportIds.length > 0 && (
            <Typography fontSize={12} color="#1565C0" fontWeight={600} mt={1.5}>
              {exportIds.length} contrat(s) sélectionné(s)
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setExportOpen(false)} variant="outlined" sx={{ borderRadius: 2 }}>Annuler</Button>
          <Button onClick={handleExportPdf} variant="contained" disabled={exportLoading || !exportIds.length}
            startIcon={<PictureAsPdfIcon />}
            sx={{ borderRadius: 2, fontWeight: 700, bgcolor: '#E65100', '&:hover': { bgcolor: '#BF360C' } }}>
            {exportLoading ? 'Génération…' : 'Confirmer le téléchargement'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
