import { useState } from 'react'
import {
  Box, Typography, Table, TableBody, TableCell, TableHead, TableRow,
  Chip, IconButton, Tooltip, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, Button, Divider,
  FormControl, InputLabel, Select, MenuItem, TextField,
} from '@mui/material'
import CheckCircleIcon     from '@mui/icons-material/CheckCircle'
import CancelIcon          from '@mui/icons-material/Cancel'
import VisibilityIcon      from '@mui/icons-material/Visibility'
import DownloadIcon        from '@mui/icons-material/Download'
import FolderOpenIcon      from '@mui/icons-material/FolderOpen'
import CloseIcon           from '@mui/icons-material/Close'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import EditIcon            from '@mui/icons-material/Edit'
import SaveIcon            from '@mui/icons-material/Save'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import {
  DocRow, FILE_SUB, SOURCE_API, STAT_FIELD, REF_FIELD, REF_LABEL,
  STATUS_OPTIONS, VALIDATE_RAW, REJECT_RAW, STATUS_MAP,
  resolveStatut, resolveFichier, getClientId,
} from '../../utils/documentSources'
import { downloadDocExcel, writeFallbackExcel } from '../../utils/documentExcel'
import { useCurrency } from '../../contexts/CurrencyContext'

interface DocumentsTableProps {
  rows: DocRow[]
  updateRow: (key: string, patch: Partial<DocRow>) => void
  emptyMessage?: string
  minWidth?: number
}

export default function DocumentsTable({ rows, updateRow, emptyMessage, minWidth = 600 }: DocumentsTableProps) {
  const { devise } = useCurrency()
  const [actionId, setActionId] = useState<string | null>(null)

  // View dialog
  const [viewDoc, setViewDoc]               = useState<DocRow | null>(null)
  const [previewUrl, setPreviewUrl]         = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Edit dialog
  const [editDoc, setEditDoc]       = useState<DocRow | null>(null)
  const [editName, setEditName]     = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // ── View action ───────────────────────────────────────────────────────────

  const handleView = async (doc: DocRow) => {
    setViewDoc(doc)
    setPreviewUrl(null)
    const sub = FILE_SUB[doc.source]
    if (!sub) return
    setPreviewLoading(true)
    try {
      const res = await api.get(`/${SOURCE_API[doc.source]}/${doc.sourceId}/${sub}`, { responseType: 'blob' })
      setPreviewUrl(URL.createObjectURL(res.data as Blob))
    } catch { /* no file */ } finally {
      setPreviewLoading(false)
    }
  }

  const closeView = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setViewDoc(null)
    setPreviewUrl(null)
  }

  // ── Download action — AI analysis → Excel ────────────────────────────────

  const handleDownload = async (doc: DocRow) => {
    const hasFile = FILE_SUB[doc.source] && doc.rawItem.fichier
    setActionId(doc.key + '-dl')
    const tid = hasFile ? toast.loading('Analyse IA en cours… (peut prendre 10 s)') : null
    try {
      await downloadDocExcel(doc, devise)
      if (tid) toast.success('Analyse IA terminée — Excel téléchargé !', { id: tid })
      else toast.success('Excel téléchargé')
    } catch {
      if (tid) toast.dismiss(tid)
      writeFallbackExcel(doc, devise)
      toast.success('Excel téléchargé (sans analyse IA)')
    } finally {
      setActionId(null)
    }
  }

  // ── Validate / Reject ────────────────────────────────────────────────────

  const handleValidate = async (doc: DocRow) => {
    const statField = STAT_FIELD[doc.source]
    const statValue = doc.source === 'releve' ? true : VALIDATE_RAW[doc.source]
    try {
      await api.put(`/${SOURCE_API[doc.source]}/${doc.sourceId}`, { [statField]: statValue })
      updateRow(doc.key, { statut: 'validee' })
      toast.success('Document validé ✓')
    } catch { toast.error('Erreur lors de la validation.') }
  }

  const handleReject = async (doc: DocRow) => {
    const statField = STAT_FIELD[doc.source]
    const statValue = doc.source === 'releve' ? false : REJECT_RAW[doc.source]
    try {
      await api.put(`/${SOURCE_API[doc.source]}/${doc.sourceId}`, { [statField]: statValue })
      updateRow(doc.key, { statut: 'rejetee' })
      toast.success('Document rejeté')
    } catch { toast.error('Erreur lors du rejet.') }
  }

  // ── Edit dialog ───────────────────────────────────────────────────────────

  const openEdit = (doc: DocRow) => {
    const currentRef = String(doc.rawItem[REF_FIELD[doc.source]] ?? doc.fichier)
    const currentStatRaw = String(doc.rawItem[STAT_FIELD[doc.source]] ?? '')
    setEditDoc(doc)
    setEditName(currentRef)
    setEditStatus(currentStatRaw)
  }

  const closeEdit = () => { setEditDoc(null); setEditName(''); setEditStatus('') }

  const handleSaveEdit = async () => {
    if (!editDoc) return
    setEditSaving(true)
    const oldName = String(editDoc.rawItem[REF_FIELD[editDoc.source]] ?? editDoc.fichier)

    try {
      const refField  = REF_FIELD[editDoc.source]
      const statField = STAT_FIELD[editDoc.source]
      const statValue = editDoc.source === 'releve' ? editStatus === 'true' : editStatus

      const payload = { ...editDoc.rawItem, [refField]: editName, [statField]: statValue }
      delete payload.client
      delete payload.created_at
      delete payload.updated_at
      delete payload.fichier

      await api.put(`/${SOURCE_API[editDoc.source]}/${editDoc.sourceId}`, payload)

      const updatedRaw  = { ...editDoc.rawItem, [refField]: editName, [statField]: statValue }
      const newStatut   = resolveStatut(updatedRaw, editDoc.source)
      const newFichier  = resolveFichier(updatedRaw, editDoc.source)

      updateRow(editDoc.key, { fichier: newFichier, statut: newStatut, rawItem: updatedRaw })

      // If name changed → notify client via DB + email
      if (editName.trim() !== oldName.trim()) {
        const clientId = getClientId(editDoc.rawItem)
        if (clientId) {
          await api.post('/admin/documents/notify-rename', {
            client_id: clientId,
            source:    editDoc.source,
            old_name:  oldName,
            new_name:  editName,
          })
          toast.success('Document mis à jour — client notifié par email.')
        } else {
          toast.success('Document mis à jour.')
        }
      } else {
        toast.success('Document mis à jour.')
      }

      closeEdit()
    } catch {
      toast.error('Erreur lors de la mise à jour.')
    } finally {
      setEditSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (rows.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <FolderOpenIcon sx={{ fontSize: 52, color: '#ddd' }} />
        <Typography color="text.secondary" mt={1} fontSize={14}>
          {emptyMessage ?? 'Aucun document.'}
        </Typography>
      </Box>
    )
  }

  return (
    <>
      <Box sx={{ overflowX: 'auto' }}>
        <Table sx={{ minWidth }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8f9ff' }}>
              {['Client', 'Type', 'Fichier', 'Date dépôt', 'Statut', 'Actions'].map((h, i) => (
                <TableCell key={h} align={i === 5 ? 'center' : 'left'}
                  sx={{
                    fontWeight: 700, fontSize: 11, color: '#64748b',
                    textTransform: 'uppercase', letterSpacing: 0.7, py: 1.2,
                    display: i === 1 ? { xs: 'none', sm: 'table-cell' }
                      : i === 3 ? { xs: 'none', md: 'table-cell' }
                      : undefined,
                  }}>
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(doc => {
              const s       = STATUS_MAP[doc.statut]
              const dateStr = doc.date ? new Date(doc.date).toLocaleDateString('fr-FR') : '—'
              return (
                <TableRow key={doc.key} sx={{ '&:hover': { bgcolor: '#f8f9ff' }, transition: 'background .15s' }}>
                  <TableCell><Typography fontWeight={700} fontSize={13}>{doc.client}</Typography></TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' }, fontSize: 13 }}>{doc.type}</TableCell>
                  <TableCell><Typography fontSize={13} color="#1565C0" fontWeight={500}>{doc.fichier}</Typography></TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, fontSize: 13, color: '#555' }}>{dateStr}</TableCell>
                  <TableCell>
                    <Chip label={s.label} size="small"
                      sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: 11 }} />
                  </TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="Voir">
                      <IconButton size="small" sx={{ color: '#546e7a' }} onClick={() => handleView(doc)}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={FILE_SUB[doc.source] && doc.rawItem.fichier ? 'Analyser IA → Excel' : 'Télécharger Excel'}>
                      <span>
                        <IconButton size="small" sx={{ color: '#1565C0' }}
                          disabled={actionId === doc.key + '-dl'}
                          onClick={() => handleDownload(doc)}>
                          {actionId === doc.key + '-dl'
                            ? <CircularProgress size={14} />
                            : <DownloadIcon fontSize="small" />}
                        </IconButton>
                      </span>
                    </Tooltip>
                    {doc.statut === 'en_attente' && (
                      <>
                        <Tooltip title="Valider">
                          <IconButton size="small" sx={{ color: '#2E7D32' }}
                            onClick={() => handleValidate(doc)}>
                            <CheckCircleIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Rejeter">
                          <IconButton size="small" sx={{ color: '#C62828' }}
                            onClick={() => handleReject(doc)}>
                            <CancelIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                    {doc.statut !== 'en_attente' && (
                      <Tooltip title="Modifier">
                        <IconButton size="small" sx={{ color: '#6A1B9A' }}
                          onClick={() => openEdit(doc)}>
                          <EditIcon fontSize="small" />
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

      {/* ── View Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={!!viewDoc} onClose={closeView} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box>
            <Typography fontWeight={700} fontSize={16}>Détail du document</Typography>
            {viewDoc && <Typography fontSize={13} color="text.secondary">{viewDoc.type}</Typography>}
          </Box>
          <IconButton size="small" onClick={closeView}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {viewDoc && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {[
                { label: 'Client',    value: viewDoc.client },
                { label: 'Type',      value: viewDoc.type },
                { label: 'Référence', value: viewDoc.fichier },
                { label: 'Date',      value: viewDoc.date ? new Date(viewDoc.date).toLocaleDateString('fr-FR') : '—' },
                { label: 'Statut',    value: STATUS_MAP[viewDoc.statut].label },
              ].map(({ label, value }) => (
                <Box key={label} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Typography fontSize={12} color="text.secondary" sx={{ width: 90, flexShrink: 0 }}>{label}</Typography>
                  <Typography fontSize={13} fontWeight={600}>{value}</Typography>
                </Box>
              ))}
              <Divider sx={{ my: 1 }} />
              {previewLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={28} /></Box>
              ) : previewUrl ? (
                <Box sx={{ textAlign: 'center' }}>
                  <Box component="img" src={previewUrl} alt="document"
                    sx={{ maxWidth: '100%', maxHeight: 400, borderRadius: 2, display: 'block', mx: 'auto' }} />
                </Box>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2,
                  bgcolor: '#f8f9ff', borderRadius: 2, border: '1px solid #e3f0ff' }}>
                  <InsertDriveFileIcon sx={{ color: '#1565C0', fontSize: 32 }} />
                  <Box>
                    <Typography fontSize={13} fontWeight={600}>{viewDoc.fichier}</Typography>
                    <Typography fontSize={11} color="text.secondary">Aucun aperçu disponible pour ce type de document</Typography>
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5, gap: 1 }}>
          {viewDoc && FILE_SUB[viewDoc.source] && (
            <Button variant="outlined" startIcon={<DownloadIcon />}
              onClick={() => { closeView(); handleDownload(viewDoc!) }}>
              Télécharger
            </Button>
          )}
          {viewDoc?.statut === 'en_attente' && (
            <Button variant="contained" color="primary" startIcon={<EditIcon />}
              onClick={() => { closeView(); openEdit(viewDoc!) }}>
              Modifier
            </Button>
          )}
          <Button onClick={closeView} color="inherit">Fermer</Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit Dialog ───────────────────────────────────────────────────────── */}
      <Dialog open={!!editDoc} onClose={closeEdit} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 36, height: 36, borderRadius: 2,
              background: 'linear-gradient(135deg,#7B1FA2,#4A148C)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <EditIcon sx={{ color: 'white', fontSize: 18 }} />
            </Box>
            <Box>
              <Typography fontWeight={700} fontSize={16}>Modifier le document</Typography>
              {editDoc && <Typography fontSize={12} color="text.secondary">{editDoc.type} — {editDoc.client}</Typography>}
            </Box>
          </Box>
          <IconButton size="small" onClick={closeEdit}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {editDoc && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
              <TextField
                label={REF_LABEL[editDoc.source]}
                value={editName}
                onChange={e => setEditName(e.target.value)}
                fullWidth
                size="small"
                helperText="Ce nom sera visible sur le tableau de bord du client."
              />

              <FormControl fullWidth size="small">
                <InputLabel>Statut</InputLabel>
                <Select
                  value={editStatus}
                  label="Statut"
                  onChange={e => setEditStatus(e.target.value)}>
                  {STATUS_OPTIONS[editDoc.source].map(opt => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box sx={{ p: 1.5, bgcolor: '#FFF8E1', borderRadius: 2, border: '1px solid #FFE082' }}>
                <Typography fontSize={12} color="#E65100">
                  Si vous modifiez le nom du document, le client recevra automatiquement une notification par email.
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 1.5, gap: 1 }}>
          <Button onClick={closeEdit} color="inherit" disabled={editSaving}>Annuler</Button>
          <Button
            variant="contained"
            startIcon={editSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={handleSaveEdit}
            disabled={editSaving || !editName.trim()}
            sx={{ background: 'linear-gradient(135deg,#7B1FA2,#4A148C)', minWidth: 130 }}>
            {editSaving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
