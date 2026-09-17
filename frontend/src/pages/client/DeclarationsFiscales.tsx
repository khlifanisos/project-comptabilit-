import React, { useState, useEffect } from 'react'
import {
  Box, Typography, Card, CardContent, Button, Table, TableBody,
  TableCell, TableHead, TableRow, Chip, IconButton, Tooltip, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Grid, Checkbox, Divider, LinearProgress,
} from '@mui/material'
import AddIcon          from '@mui/icons-material/Add'
import DownloadIcon     from '@mui/icons-material/Download'
import EditIcon         from '@mui/icons-material/Edit'
import DeleteIcon       from '@mui/icons-material/Delete'
import VisibilityIcon   from '@mui/icons-material/Visibility'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CheckCircleIcon  from '@mui/icons-material/CheckCircle'
import AccessTimeIcon   from '@mui/icons-material/AccessTime'
import TableChartIcon   from '@mui/icons-material/TableChart'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import { useCurrency } from '../../contexts/CurrencyContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Declaration {
  id: number
  type: string
  periode: string
  date_limite: string
  montant: number
  statut: string
  notes?: string
}

// ─── Status config ────────────────────────────────────────────────────────────

const statusMap: Record<string, { label: string; color: string; bg: string }> = {
  validee:    { label: 'Validée',    color: '#2E7D32', bg: '#E8F5E9' },
  deposee:    { label: 'Déposée',    color: '#0277BD', bg: '#E1F5FE' },
  a_declarer: { label: 'À déclarer', color: '#1565C0', bg: '#E3F0FF' },
  rejetee:    { label: 'Rejetée',    color: '#C62828', bg: '#FFEBEE' },
  en_retard:  { label: 'En retard',  color: '#B71C1C', bg: '#FFCDD2' },
}

const typeColor: Record<string, string> = {
  TVA: '#1565C0', IS: '#7B1FA2', IR: '#FF6F00', autre: '#00ACC1',
}

const typeLabel: Record<string, string> = {
  TVA: 'Taxe sur la Valeur Ajoutée',
  IS:  'Impôt sur les Sociétés',
  IR:  'Impôt sur le Revenu',
  autre: 'Autre',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolves the visual status of a declaration:
 *  - "en_retard"  → deadline passed AND still a_declarer (not yet submitted)
 *  - "a_declarer" → not yet past deadline
 *  - anything else → the DB value (deposee, validee, rejetee)
 */
function effectiveStatut(row: Declaration): string {
  if (row.statut === 'a_declarer' && new Date(row.date_limite) < new Date()) {
    return 'en_retard'
  }
  return row.statut
}

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
}

const emptyForm = {
  type: 'TVA', periode: '', date_limite: '', montant: '', statut: 'a_declarer', notes: '',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DeclarationsFiscales() {
  const { devise } = useCurrency()
  const realRole    = sessionStorage.getItem('real_role') ?? 'client'
  const userObj     = JSON.parse(sessionStorage.getItem('user') ?? '{}')
  const currentRole = userObj.role ?? realRole          // changes on role-switch
  const isAdminToken   = realRole === 'admin'           // backend sees admin
  const isClientMode   = currentRole === 'client'       // UI is in client mode
  const isAdminMode    = currentRole === 'admin'        // UI is in admin mode
  // Legacy alias kept for edit/download visibility
  const isAdmin = isAdminMode

  const [rows, setRows]       = useState<Declaration[]>([])
  const [loading, setLoading] = useState(true)

  // Client selector (shown when admin token in client mode)
  const [clients, setClients]               = useState<{ id: number; nom: string; email: string }[]>([])
  const [selectedClientId, setSelectedClientId] = useState<number | ''>('')

  // Create dialog
  const [open, setOpen]     = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm]     = useState(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // View dialog
  const [viewRow, setViewRow] = useState<Declaration | null>(null)

  // Delete dialog
  const [deleteRow, setDeleteRow]   = useState<Declaration | null>(null)
  const [deleting, setDeleting]     = useState(false)

  // Edit dialog
  const [editRow, setEditRow]     = useState<Declaration | null>(null)
  const [editOpen, setEditOpen]   = useState(false)
  const [editForm, setEditForm]   = useState(emptyForm)
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})
  const [updating, setUpdating]   = useState(false)

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = () => {
    setLoading(true)
    api.get('/declarations-fiscales')
      .then(r => setRows(r.data?.data ?? r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // ── Banner logic ──────────────────────────────────────────────────────────
  // Rules:
  //  RED    → at least one declaration is overdue (date passed, still a_declarer)
  //  ORANGE → nearest a_declarer deadline is ≤ 7 days away (not yet overdue)
  //  GREEN  → all declarations are deposee or validee (nothing pending)
  //  NONE   → no rows, or mixed states with no urgency

  const pendingRows = rows.filter(r => r.statut === 'a_declarer')
  const overdueRows = pendingRows.filter(r => new Date(r.date_limite) < new Date())
  const upcomingRows = pendingRows
    .filter(r => new Date(r.date_limite) >= new Date())
    .sort((a, b) => new Date(a.date_limite).getTime() - new Date(b.date_limite).getTime())

  const soonest = upcomingRows[0]
  const soonestDays = soonest ? daysUntil(soonest.date_limite) : null

  const allSettled = rows.length > 0 && rows.every(r => r.statut === 'validee')

  // ── Export Excel dialog ────────────────────────────────────────────────────

  const [exportOpen, setExportOpen]   = useState(false)
  const [exportIds, setExportIds]     = useState<Set<number>>(new Set())
  const [exporting, setExporting]     = useState(false)

  const openExportDialog = () => {
    if (rows.length === 0) { toast.error('Aucune déclaration à exporter.'); return }
    setExportIds(new Set(rows.map(r => r.id)))
    setExportOpen(true)
  }

  const toggleExportAll = () => {
    setExportIds(exportIds.size === rows.length ? new Set() : new Set(rows.map(r => r.id)))
  }

  const toggleExportOne = (id: number) => {
    setExportIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleExportConfirm = async () => {
    if (exportIds.size === 0) { toast.error('Sélectionnez au moins une déclaration.'); return }
    setExporting(true)
    try {
      const res = await api.get('/declarations-fiscales/export-excel', {
        responseType: 'blob',
        timeout: 120000,
        params: { ids: [...exportIds].join(',') },
      })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `declarations_fiscales_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`${exportIds.size} déclaration(s) exportée(s) en Excel.`)
      setExportOpen(false)
    } catch (err: any) {
      if (err?.response?.data instanceof Blob) {
        const text = await (err.response.data as Blob).text()
        try { toast.error(JSON.parse(text).message || "Erreur d'export.") } catch { toast.error("Erreur d'export.") }
      } else {
        toast.error("Erreur lors de l'export Excel.")
      }
    } finally {
      setExporting(false)
    }
  }

  // ── Auto-advance status when client views/downloads ───────────────────────
  //   a_declarer (overdue) → deposee   (removes red banner)
  //   deposee              → validee   (client has acknowledged)

  const nextStatut = (statut: string): string | null => {
    if (statut === 'a_declarer') return 'validee'
    if (statut === 'deposee')    return 'validee'
    return null
  }

  const advanceStatut = async (row: Declaration): Promise<Declaration> => {
    if (isAdmin) return row
    const next = nextStatut(row.statut)
    if (!next) return row
    try {
      await api.put(`/declarations-fiscales/${row.id}`, { statut: next })
      const updated = { ...row, statut: next }
      setRows(p => p.map(r => r.id === row.id ? updated : r))
      return updated
    } catch {
      return row
    }
  }

  // ── Delete declaration ─────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteRow) return
    setDeleting(true)
    try {
      await api.delete(`/declarations-fiscales/${deleteRow.id}`)
      setRows(p => p.filter(r => r.id !== deleteRow.id))
      toast.success(`Déclaration ${deleteRow.type} — ${deleteRow.periode} supprimée.`)
      setDeleteRow(null)
    } catch {
      toast.error('Erreur lors de la suppression.')
    } finally {
      setDeleting(false)
    }
  }

  // ── View declaration ───────────────────────────────────────────────────────

  const handleView = async (row: Declaration) => {
    setViewRow(row)
    const updated = await advanceStatut(row)
    setViewRow(updated)
  }

  // ── Download single declaration ────────────────────────────────────────────

  const handleDownload = async (row: Declaration) => {
    const updatedRow = await advanceStatut(row)
    const s = statusMap[effectiveStatut(updatedRow)] ?? statusMap.a_declarer
    const content = [
      '════════════════════════════════════════',
      '       DÉCLARATION FISCALE',
      '════════════════════════════════════════',
      '',
      `Type d'impôt   : ${typeLabel[updatedRow.type] ?? updatedRow.type} (${updatedRow.type})`,
      `Période        : ${updatedRow.periode}`,
      `Date limite    : ${new Date(updatedRow.date_limite).toLocaleDateString('fr-FR')}`,
      `Montant        : ${Number(updatedRow.montant).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${devise}`,
      `Statut         : ${s.label}`,
      updatedRow.notes ? `Notes          : ${updatedRow.notes}` : '',
      '',
      '────────────────────────────────────────',
      `Généré le      : ${new Date().toLocaleString('fr-FR')}`,
      '════════════════════════════════════════',
    ].filter(Boolean).join('\n')

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `declaration_${updatedRow.type}_${updatedRow.periode.replace(/\s+/g, '_')}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success(`Déclaration ${updatedRow.type} — ${updatedRow.periode} téléchargée`)
  }

  // ── Create dialog ─────────────────────────────────────────────────────────

  const handleOpen = () => {
    setForm(emptyForm)
    setErrors({})
    setSelectedClientId('')
    // If admin token in client mode, fetch client list to let them pick the target client
    if (isAdminToken && isClientMode && clients.length === 0) {
      api.get('/admin/clients').then(r => {
        const list = r.data?.data ?? r.data ?? []
        setClients(list)
        // Pre-select the client whose email matches the admin's own email
        const match = list.find((c: { email: string }) => c.email === userObj.email)
        if (match) setSelectedClientId(match.id)
      }).catch(() => {})
    }
    setOpen(true)
  }
  const handleClose = () => { if (!saving) setOpen(false) }

  const validateForm = (f: typeof emptyForm) => {
    const e: Record<string, string> = {}
    if (!f.periode.trim())  e.periode     = 'Période requise'
    if (!f.date_limite)     e.date_limite = 'Date limite requise'
    if (!f.montant || isNaN(Number(f.montant)) || Number(f.montant) < 0)
      e.montant = 'Montant invalide'
    return e
  }

  const handleSave = async () => {
    const e = validateForm(form)
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    try {
      await api.post('/declarations-fiscales', {
        type:        form.type,
        periode:     form.periode.trim(),
        date_limite: form.date_limite,
        montant:     Number(form.montant),
        statut:      'a_declarer',
        notes:       form.notes.trim() || null,
        // When admin token in client mode, pass the chosen client_id
        ...(isAdminToken && selectedClientId ? { client_id: selectedClientId } : {}),
      })
      toast.success('Déclaration enregistrée avec succès.')
      setOpen(false)
      load()
    } catch (err: any) {
      const msg = err?.response?.data?.message
        || Object.values(err?.response?.data?.errors ?? {})[0]
        || "Erreur lors de l'enregistrement."
      toast.error(String(msg))
    } finally {
      setSaving(false)
    }
  }

  // ── Edit dialog ────────────────────────────────────────────────────────────

  const openEdit = (row: Declaration) => {
    setEditRow(row)
    setEditForm({
      type:        row.type,
      periode:     row.periode,
      date_limite: row.date_limite?.slice(0, 10) ?? '',
      montant:     String(row.montant),
      statut:      row.statut,
      notes:       row.notes ?? '',
    })
    setEditErrors({})
    setEditOpen(true)
  }

  const handleUpdate = async () => {
    const e = validateForm(editForm)
    if (Object.keys(e).length) { setEditErrors(e); return }
    setUpdating(true)
    try {
      const { data } = await api.put(`/declarations-fiscales/${editRow!.id}`, {
        type:        editForm.type,
        periode:     editForm.periode.trim(),
        date_limite: editForm.date_limite,
        montant:     Number(editForm.montant),
        statut:      editForm.statut,
        notes:       editForm.notes.trim() || null,
      })
      setRows(p => p.map(r => r.id === editRow!.id ? { ...r, ...data } : r))
      toast.success('Déclaration mise à jour.')
      setEditOpen(false)
    } catch (err: any) {
      const msg = err?.response?.data?.message
        || Object.values(err?.response?.data?.errors ?? {})[0]
        || 'Erreur lors de la mise à jour.'
      toast.error(String(msg))
    } finally {
      setUpdating(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Box className="fade-in">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <Box sx={{
        display: 'flex', justifyContent: 'space-between',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'flex-start', sm: 'center' },
        gap: 1.5, mb: 3,
      }}>
        <Box>
          <Typography variant="h5" fontWeight={800} color="#1a1a2e" fontSize={{ xs: 17, md: 22 }}>
            Déclarations fiscales
          </Typography>
          <Typography color="text.secondary" fontSize={14}>TVA, IS, IR — suivi et archivage</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
          <Button
            variant="outlined"
            startIcon={<TableChartIcon />}
            onClick={openExportDialog}
            sx={{ borderRadius: 2.5, fontWeight: 600, minWidth: 0, borderColor: '#2E7D32', color: '#2E7D32', '&:hover': { bgcolor: '#F1F8E9', borderColor: '#1B5E20' } }}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Exporter Excel</Box>
          </Button>
          {isClientMode && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpen}
              sx={{ borderRadius: 2.5, fontWeight: 600, minWidth: 0 }}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Nouvelle déclaration</Box>
            </Button>
          )}
        </Box>
      </Box>

      {/* ── Alert banner ─────────────────────────────────────────────────── */}
      {/* RED — overdue declarations */}
      {overdueRows.length > 0 && (
        <Card sx={{ mb: 3, borderRadius: 3, bgcolor: '#FFEBEE', border: '1px solid #EF9A9A' }}>
          <CardContent sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <WarningAmberIcon sx={{ color: '#B71C1C', fontSize: 26, flexShrink: 0, mt: 0.3 }} />
            <Box>
              <Typography fontWeight={700} color="#B71C1C" fontSize={14}>
                Échéance dépassée — action requise
              </Typography>
              {overdueRows.map(r => (
                <Typography key={r.id} fontSize={13} color="#C62828" mt={0.4}>
                  {r.type} — {r.periode} : due le{' '}
                  {new Date(r.date_limite).toLocaleDateString('fr-FR')}{' '}
                  ({Math.abs(daysUntil(r.date_limite))} jour(s) de retard) — cliquez{' '}
                  <Box
                    component="span"
                    onClick={() => openEdit(r)}
                    sx={{ textDecoration: 'underline', cursor: 'pointer', fontWeight: 700 }}
                  >
                    Modifier
                  </Box>{' '}
                  pour soumettre.
                </Typography>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* ORANGE — upcoming deadline ≤ 7 days */}
      {overdueRows.length === 0 && soonest && soonestDays !== null && soonestDays <= 7 && (
        <Card sx={{ mb: 3, borderRadius: 3, bgcolor: '#FFF3E0', border: '1px solid #FFCC99' }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <AccessTimeIcon sx={{ color: '#E65100', fontSize: 26, flexShrink: 0 }} />
            <Box>
              <Typography fontWeight={700} color="#E65100" fontSize={14}>Échéance proche</Typography>
              <Typography fontSize={13} color="#B45309">
                {soonest.type} — {soonest.periode} : due le{' '}
                {new Date(soonest.date_limite).toLocaleDateString('fr-FR')}{' '}
                ({soonestDays} jour{soonestDays !== 1 ? 's' : ''} restant{soonestDays !== 1 ? 's' : ''})
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* GREEN — all declarations submitted or validated */}
      {allSettled && (
        <Card sx={{ mb: 3, borderRadius: 3, bgcolor: '#E8F5E9', border: '1px solid #A5D6A7' }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <CheckCircleIcon sx={{ color: '#2E7D32', fontSize: 26, flexShrink: 0 }} />
            <Box>
              <Typography fontWeight={700} color="#2E7D32" fontSize={14}>Toutes les déclarations sont à jour</Typography>
              <Typography fontSize={13} color="#388E3C">
                Aucune déclaration en attente — vous êtes en règle.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* ── Table ────────────────────────────────────────────────────────── */}
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
                    <TableCell>Période</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Date limite</TableCell>
                    <TableCell align="right">Montant</TableCell>
                    <TableCell>Statut</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 5, color: '#94A3B8' }}>
                        Aucune déclaration fiscale enregistrée.
                      </TableCell>
                    </TableRow>
                  ) : rows.map(row => {
                    const eff = effectiveStatut(row)
                    const s   = statusMap[eff] ?? statusMap.a_declarer
                    const isLate = eff === 'en_retard'
                    return (
                      <TableRow
                        key={row.id}
                        sx={{ '&:hover': { bgcolor: isLate ? '#fff5f5' : '#f8f9ff' } }}
                      >
                        <TableCell>
                          <Chip
                            label={row.type} size="small"
                            sx={{
                              bgcolor: `${typeColor[row.type] ?? '#607D8B'}18`,
                              color: typeColor[row.type] ?? '#607D8B',
                              fontWeight: 800,
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography fontWeight={600}>{row.periode}</Typography>
                        </TableCell>
                        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                          <Typography
                            fontSize={13}
                            fontWeight={isLate ? 700 : 400}
                            color={isLate ? '#B71C1C' : 'inherit'}
                          >
                            {new Date(row.date_limite).toLocaleDateString('fr-FR')}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {row.montant
                            ? <Typography fontWeight={700}>
                                {Number(row.montant).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {devise}
                              </Typography>
                            : <Typography color="text.secondary" fontSize={13}>—</Typography>}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={s.label} size="small"
                            sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: 11 }}
                          />
                        </TableCell>
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                          {/* View — visible to everyone */}
                          <Tooltip title="Voir la déclaration">
                            <IconButton size="small" onClick={() => handleView(row)} sx={{ color: '#0891B2' }}>
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {/* Edit + Delete — admin mode OR admin-token in client mode */}
                          {(isAdmin || (isAdminToken && isClientMode)) && (<>
                            <Tooltip title="Modifier la déclaration">
                              <IconButton size="small" onClick={() => openEdit(row)} sx={{ color: '#1565C0' }}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Supprimer la déclaration">
                              <IconButton size="small" onClick={() => setDeleteRow(row)} sx={{ color: '#C62828' }}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>)}
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

      {/* ── Delete Confirmation Dialog ────────────────────────────────────── */}
      <Dialog open={!!deleteRow} onClose={() => !deleting && setDeleteRow(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteIcon sx={{ fontSize: 20, color: '#C62828' }} />
          Supprimer la déclaration
        </DialogTitle>
        <DialogContent>
          <Typography fontSize={14}>
            Voulez-vous vraiment supprimer la déclaration{' '}
            <strong>{deleteRow?.type} — {deleteRow?.periode}</strong> ?
            Cette action est irréversible.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDeleteRow(null)} disabled={deleting} sx={{ borderRadius: 2, fontWeight: 600 }}>
            Annuler
          </Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}
            startIcon={deleting ? <CircularProgress size={14} color="inherit" /> : <DeleteIcon />}
            sx={{ fontWeight: 700, borderRadius: 2 }}>
            {deleting ? 'Suppression…' : 'Supprimer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── View Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={!!viewRow} onClose={() => setViewRow(null)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 17, display: 'flex', alignItems: 'center', gap: 1 }}>
          <VisibilityIcon sx={{ fontSize: 20, color: '#0891B2' }} />
          Détails de la déclaration
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {viewRow && (() => {
            const eff = effectiveStatut(viewRow)
            const s   = statusMap[eff] ?? statusMap.a_declarer
            const rows2: [string, React.ReactNode][] = [
              ["Type d'impôt", <Chip label={viewRow.type} size="small" sx={{ bgcolor: `${typeColor[viewRow.type] ?? '#607D8B'}18`, color: typeColor[viewRow.type] ?? '#607D8B', fontWeight: 800 }} />],
              ["Période",      <Typography fontWeight={600}>{viewRow.periode}</Typography>],
              ["Date limite",  <Typography color={eff === 'en_retard' ? '#B71C1C' : 'inherit'} fontWeight={eff === 'en_retard' ? 700 : 400}>{new Date(viewRow.date_limite).toLocaleDateString('fr-FR')}</Typography>],
              ["Montant",      <Typography fontWeight={700}>{Number(viewRow.montant).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {devise}</Typography>],
              ["Statut",       <Chip label={s.label} size="small" sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: 11 }} />],
              ...(viewRow.notes ? [["Notes", <Typography fontSize={13} color="text.secondary">{viewRow.notes}</Typography>] as [string, React.ReactNode]] : []),
            ]
            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {rows2.map(([label, value]) => (
                  <Box key={label} sx={{ display: 'flex', alignItems: 'center', py: 1.5, borderBottom: '1px solid #F1F5F9' }}>
                    <Typography fontSize={13} color="text.secondary" sx={{ minWidth: 120, flexShrink: 0 }}>{label}</Typography>
                    {value}
                  </Box>
                ))}
              </Box>
            )
          })()}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setViewRow(null)} sx={{ borderRadius: 2, fontWeight: 600 }}>Fermer</Button>
          <Button variant="outlined" startIcon={<DownloadIcon />}
            onClick={() => { if (viewRow) handleDownload(viewRow) }}
            sx={{ borderRadius: 2, fontWeight: 600 }}>
            Télécharger
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Create Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 17 }}>
          Nouvelle déclaration fiscale
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            {/* Client selector — only for admin token in client mode */}
            {isAdminToken && isClientMode && (
              <Grid item xs={12}>
                <TextField
                  select fullWidth label="Client *"
                  value={selectedClientId}
                  onChange={e => setSelectedClientId(Number(e.target.value))}
                  helperText="Sélectionnez le client pour cette déclaration"
                >
                  {clients.map(c => (
                    <MenuItem key={c.id} value={c.id}>{c.nom} — {c.email}</MenuItem>
                  ))}
                </TextField>
              </Grid>
            )}
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label="Type d'impôt *" value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {['TVA', 'IS', 'IR', 'autre'].map(t => (
                  <MenuItem key={t} value={t}>{typeLabel[t]}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Période *" placeholder="ex: Mai 2026, T1 2026"
                value={form.periode} error={!!errors.periode} helperText={errors.periode}
                onChange={e => setForm(f => ({ ...f, periode: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Date limite *" type="date"
                InputLabelProps={{ shrink: true }}
                value={form.date_limite} error={!!errors.date_limite} helperText={errors.date_limite}
                onChange={e => setForm(f => ({ ...f, date_limite: e.target.value }))} />
            </Grid>
            {form.date_limite && (() => {
              const isPast  = new Date(form.date_limite) < new Date()
              const preview = isPast ? statusMap.en_retard : statusMap.a_declarer
              return (
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5,
                    bgcolor: preview.bg, border: `1px solid ${preview.color}22`,
                    borderRadius: 2, px: 2, py: 1 }}>
                    <Typography fontSize={12} color={preview.color} fontWeight={600}>
                      Statut initial :
                    </Typography>
                    <Chip label={preview.label} size="small"
                      sx={{ bgcolor: preview.bg, color: preview.color, fontWeight: 700, fontSize: 11 }} />
                    <Typography fontSize={12} color={preview.color}>
                      {isPast
                        ? 'La date limite est déjà dépassée.'
                        : 'La date limite est dans le futur.'}
                    </Typography>
                  </Box>
                </Grid>
              )
            })()}
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label={`Montant (${devise}) *`} type="number"
                inputProps={{ min: 0, step: '0.01' }}
                value={form.montant} error={!!errors.montant} helperText={errors.montant}
                onChange={e => setForm(f => ({ ...f, montant: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Notes (optionnel)" multiline rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={handleClose} disabled={saving} sx={{ borderRadius: 2, fontWeight: 600 }}>
            Annuler
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <AddIcon />}
            sx={{ fontWeight: 700, borderRadius: 2 }}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Export Excel Dialog ───────────────────────────────────────────── */}
      <Dialog open={exportOpen} onClose={() => !exporting && setExportOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
          <TableChartIcon sx={{ fontSize: 20, color: '#2E7D32' }} />
          Exporter en Excel
        </DialogTitle>
        <DialogContent sx={{ pt: 0, pb: 0 }}>
          <Typography fontSize={13} color="text.secondary" mb={1.5}>
            Sélectionnez les déclarations à inclure dans le fichier Excel.
          </Typography>

          {/* Select all row */}
          <Box
            onClick={toggleExportAll}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.5,
              px: 1.5, py: 1, borderRadius: 2, cursor: 'pointer',
              bgcolor: '#E8F5E9', border: '1px solid #A5D6A7', mb: 1,
              '&:hover': { bgcolor: '#DCEDC8' },
            }}
          >
            <Checkbox
              checked={exportIds.size === rows.length && rows.length > 0}
              indeterminate={exportIds.size > 0 && exportIds.size < rows.length}
              onChange={toggleExportAll}
              onClick={e => e.stopPropagation()}
              size="small"
              sx={{ p: 0, color: '#2E7D32', '&.Mui-checked': { color: '#2E7D32' }, '&.MuiCheckbox-indeterminate': { color: '#2E7D32' } }}
            />
            <Typography fontWeight={700} fontSize={13} color="#1B5E20">
              Tout sélectionner ({rows.length})
            </Typography>
          </Box>

          <Divider sx={{ mb: 1 }} />

          {/* Declaration list */}
          <Box sx={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {rows.map(row => {
              const eff = effectiveStatut(row)
              const s   = statusMap[eff] ?? statusMap.a_declarer
              const checked = exportIds.has(row.id)
              return (
                <Box
                  key={row.id}
                  onClick={() => toggleExportOne(row.id)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    px: 1.5, py: 0.75, borderRadius: 1.5, cursor: 'pointer',
                    bgcolor: checked ? '#F1F8E9' : 'transparent',
                    '&:hover': { bgcolor: checked ? '#E8F5E9' : '#F8FAFC' },
                  }}
                >
                  <Checkbox
                    checked={checked}
                    onChange={() => toggleExportOne(row.id)}
                    onClick={e => e.stopPropagation()}
                    size="small"
                    sx={{ p: 0 }}
                  />
                  <Chip
                    label={row.type} size="small"
                    sx={{ bgcolor: `${typeColor[row.type] ?? '#607D8B'}18`, color: typeColor[row.type] ?? '#607D8B', fontWeight: 800, fontSize: 11, minWidth: 36 }}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontSize={13} fontWeight={600} noWrap>{row.periode}</Typography>
                    <Typography fontSize={11} color="text.secondary">
                      {new Date(row.date_limite).toLocaleDateString('fr-FR')} — {Number(row.montant).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {devise}
                    </Typography>
                  </Box>
                  <Chip label={s.label} size="small" sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: 10 }} />
                </Box>
              )
            })}
          </Box>

          {exporting && <LinearProgress sx={{ mt: 1.5, borderRadius: 1 }} />}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
          <Typography fontSize={13} color="text.secondary" fontWeight={600}>
            {exportIds.size} / {rows.length} sélectionnée(s)
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={() => setExportOpen(false)} disabled={exporting} sx={{ borderRadius: 2, fontWeight: 600 }}>
              Annuler
            </Button>
            <Button
              variant="contained"
              onClick={handleExportConfirm}
              disabled={exporting || exportIds.size === 0}
              startIcon={exporting ? <CircularProgress size={14} color="inherit" /> : <TableChartIcon />}
              sx={{ fontWeight: 700, borderRadius: 2, bgcolor: '#2E7D32', '&:hover': { bgcolor: '#1B5E20' } }}
            >
              {exporting ? 'Export en cours…' : 'Confirmer l\'export'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* ── Edit Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={editOpen} onClose={() => !updating && setEditOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 17, display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditIcon sx={{ fontSize: 20, color: '#1565C0' }} />
          Modifier la déclaration — {editRow?.type} {editRow?.periode}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label="Type d'impôt *" value={editForm.type}
                onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}>
                {['TVA', 'IS', 'IR', 'autre'].map(t => (
                  <MenuItem key={t} value={t}>{typeLabel[t]}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label="Statut *" value={editForm.statut}
                onChange={e => setEditForm(f => ({ ...f, statut: e.target.value }))}>
                <MenuItem value="a_declarer">À déclarer</MenuItem>
                <MenuItem value="deposee">Déposée</MenuItem>
                <MenuItem value="validee">Validée</MenuItem>
                <MenuItem value="rejetee">Rejetée</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Période *" placeholder="ex: Mai 2026, T1 2026"
                value={editForm.periode}
                error={!!editErrors.periode} helperText={editErrors.periode}
                onChange={e => setEditForm(f => ({ ...f, periode: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Date limite *" type="date"
                InputLabelProps={{ shrink: true }}
                value={editForm.date_limite}
                error={!!editErrors.date_limite} helperText={editErrors.date_limite}
                onChange={e => setEditForm(f => ({ ...f, date_limite: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label={`Montant (${devise}) *`} type="number"
                inputProps={{ min: 0, step: '0.01' }}
                value={editForm.montant}
                error={!!editErrors.montant} helperText={editErrors.montant}
                onChange={e => setEditForm(f => ({ ...f, montant: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Notes (optionnel)" multiline rows={2}
                value={editForm.notes}
                onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setEditOpen(false)} disabled={updating}
            sx={{ borderRadius: 2, fontWeight: 600 }}>
            Annuler
          </Button>
          <Button variant="contained" onClick={handleUpdate} disabled={updating}
            startIcon={updating ? <CircularProgress size={14} color="inherit" /> : <EditIcon />}
            sx={{ fontWeight: 700, borderRadius: 2 }}>
            {updating ? 'Mise à jour…' : 'Enregistrer les modifications'}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  )
}
