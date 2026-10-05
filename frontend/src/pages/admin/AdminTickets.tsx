import { useState, useEffect, useCallback, useRef } from 'react'
import type { ChangeEvent } from 'react'
import {
  Box, Typography, Card, CardContent, Button, Table, TableBody,
  TableCell, TableHead, TableRow, Chip, IconButton, Tooltip, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Grid, Avatar, Divider, FormControl, InputLabel, Select,
} from '@mui/material'
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber'
import AddIcon              from '@mui/icons-material/Add'
import PlayArrowIcon        from '@mui/icons-material/PlayArrow'
import SendIcon             from '@mui/icons-material/Send'
import CheckCircleIcon      from '@mui/icons-material/CheckCircle'
import CancelIcon           from '@mui/icons-material/Cancel'
import EditIcon             from '@mui/icons-material/Edit'
import DeleteIcon           from '@mui/icons-material/Delete'
import VisibilityIcon       from '@mui/icons-material/Visibility'
import CloseIcon            from '@mui/icons-material/Close'
import AttachFileIcon       from '@mui/icons-material/AttachFile'
import DownloadIcon         from '@mui/icons-material/Download'
import InsertDriveFileIcon  from '@mui/icons-material/InsertDriveFile'
import ImageIcon            from '@mui/icons-material/Image'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import { useAuth } from '../../contexts/AuthContext'

type Statut = 'a_faire' | 'en_cours' | 'en_attente_validation' | 'valide' | 'rejete'
type Priorite = 'basse' | 'normale' | 'haute' | 'urgente'

interface AdminRef { id: number; nom: string; email: string; avatar: string | null; entreprise?: string | null }

interface TicketAttachment {
  id: number
  ticket_id: number
  uploaded_by: number
  nom_original: string
  mime_type: string | null
  taille: number | null
  uploader: AdminRef
}

interface TicketRow {
  id: number
  titre: string
  description: string | null
  statut: Statut
  priorite: Priorite
  date_echeance: string | null
  commentaire_validation: string | null
  submitted_at: string | null
  reviewed_at: string | null
  created_at: string
  creator: AdminRef
  assignee: AdminRef
  attachments: TicketAttachment[]
}

const MAX_ATTACHMENTS = 10
const ACCEPTED_ATTACHMENT_TYPES = '.pdf,image/*'

function formatFileSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

const STATUT_MAP: Record<Statut, { label: string; color: string; bg: string }> = {
  a_faire:               { label: 'À faire',                 color: '#64748B', bg: '#F1F5F9' },
  en_cours:               { label: 'En cours',                 color: '#1565C0', bg: '#E3F0FF' },
  en_attente_validation:  { label: 'En attente de validation', color: '#E65100', bg: '#FFF3E0' },
  valide:                 { label: 'Validé',                   color: '#2E7D32', bg: '#E8F5E9' },
  rejete:                 { label: 'Rejeté',                   color: '#C62828', bg: '#FFEBEE' },
}

const PRIORITE_MAP: Record<Priorite, { label: string; color: string }> = {
  basse:   { label: 'Basse',   color: '#64748B' },
  normale: { label: 'Normale', color: '#1565C0' },
  haute:   { label: 'Haute',   color: '#E65100' },
  urgente: { label: 'Urgente', color: '#C62828' },
}

const emptyCreateForm = {
  titre: '', description: '', assigned_to: '' as number | '', priorite: 'normale' as Priorite, date_echeance: '',
}

export default function AdminTickets() {
  const { user } = useAuth()
  const isSuperAdmin = !!user?.is_super_admin

  const [tickets, setTickets]   = useState<TicketRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [statutFilter, setStatutFilter] = useState<Statut | ''>('')

  const [assignableAdmins, setAssignableAdmins] = useState<AdminRef[]>([])

  const load = useCallback(() => {
    setLoading(true)
    api.get('/tickets')
      .then((r: { data: TicketRow[] }) => setTickets(r.data))
      .catch(() => toast.error('Impossible de charger les tickets.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!isSuperAdmin) return
    api.get('/tickets/assignable-admins')
      .then((r: { data: AdminRef[] }) => setAssignableAdmins(r.data))
      .catch(() => {})
  }, [isSuperAdmin])

  // ── Create dialog (super admin) ─────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(emptyCreateForm)
  const [createFiles, setCreateFiles] = useState<File[]>([])
  const [creating, setCreating]     = useState(false)

  const openCreate = () => {
    setCreateForm({ ...emptyCreateForm, assigned_to: assignableAdmins[0]?.id ?? '' })
    setCreateFiles([])
    setCreateOpen(true)
  }

  const handlePickCreateFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (picked.length === 0) return
    setCreateFiles(prev => {
      const next = [...prev, ...picked].slice(0, MAX_ATTACHMENTS)
      if (prev.length + picked.length > MAX_ATTACHMENTS) {
        toast.error(`Maximum ${MAX_ATTACHMENTS} fichiers.`)
      }
      return next
    })
  }

  const handleCreate = async () => {
    if (!createForm.titre.trim() || !createForm.assigned_to) {
      toast.error('Titre et assignation requis.')
      return
    }
    setCreating(true)
    try {
      const fd = new FormData()
      fd.append('titre', createForm.titre.trim())
      if (createForm.description.trim()) fd.append('description', createForm.description.trim())
      fd.append('assigned_to', String(createForm.assigned_to))
      fd.append('priorite', createForm.priorite)
      if (createForm.date_echeance) fd.append('date_echeance', createForm.date_echeance)
      createFiles.forEach(f => fd.append('fichiers[]', f))

      await api.post('/tickets', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Ticket créé et assigné.')
      setCreateOpen(false)
      setCreateFiles([])
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erreur lors de la création.')
    } finally {
      setCreating(false)
    }
  }

  // ── Lifecycle actions ────────────────────────────────────────────────────
  const [actioningId, setActioningId] = useState<number | null>(null)

  const handleStart = async (t: TicketRow) => {
    setActioningId(t.id)
    try {
      await api.post(`/tickets/${t.id}/start`)
      toast.success('Ticket démarré.')
      load()
    } catch (err: any) { toast.error(err?.response?.data?.message ?? 'Erreur.') }
    finally { setActioningId(null) }
  }

  const handleSubmit = async (t: TicketRow) => {
    setActioningId(t.id)
    try {
      await api.post(`/tickets/${t.id}/submit`)
      toast.success('Ticket soumis pour validation.')
      load()
    } catch (err: any) { toast.error(err?.response?.data?.message ?? 'Erreur.') }
    finally { setActioningId(null) }
  }

  const handleValidate = async (t: TicketRow) => {
    setActioningId(t.id)
    try {
      await api.post(`/tickets/${t.id}/validate`)
      toast.success('Ticket validé.')
      load()
    } catch (err: any) { toast.error(err?.response?.data?.message ?? 'Erreur.') }
    finally { setActioningId(null) }
  }

  const handleDelete = async (t: TicketRow) => {
    if (!window.confirm(`Supprimer le ticket « ${t.titre} » ?`)) return
    setActioningId(t.id)
    try {
      await api.delete(`/tickets/${t.id}`)
      toast.success('Ticket supprimé.')
      load()
    } catch (err: any) { toast.error(err?.response?.data?.message ?? 'Erreur.') }
    finally { setActioningId(null) }
  }

  // ── Reject dialog (super admin) ──────────────────────────────────────────
  const [rejectTarget, setRejectTarget] = useState<TicketRow | null>(null)
  const [rejectComment, setRejectComment] = useState('')
  const [rejecting, setRejecting] = useState(false)

  const handleReject = async () => {
    if (!rejectTarget || !rejectComment.trim()) { toast.error('Un commentaire est requis.'); return }
    setRejecting(true)
    try {
      await api.post(`/tickets/${rejectTarget.id}/reject`, { commentaire_validation: rejectComment.trim() })
      toast.success('Ticket renvoyé avec vos remarques.')
      setRejectTarget(null)
      setRejectComment('')
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erreur.')
    } finally {
      setRejecting(false)
    }
  }

  const removeCreateFile = (idx: number) => {
    setCreateFiles(prev => prev.filter((_, i) => i !== idx))
  }

  // ── View dialog ───────────────────────────────────────────────────────────
  const [viewTarget, setViewTarget] = useState<TicketRow | null>(null)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<number | null>(null)
  const viewFileInputRef = useRef<HTMLInputElement>(null)

  const canManageAttachment = (att: TicketAttachment) =>
    isSuperAdmin || att.uploaded_by === user?.id

  const openViewFor = (t: TicketRow) => {
    const fresh = tickets.find(x => x.id === t.id) ?? t
    setViewTarget(fresh)
  }

  const refreshViewTarget = (updated: TicketRow) => {
    setViewTarget(updated)
    setTickets(prev => prev.map(t => (t.id === updated.id ? updated : t)))
  }

  const handlePickViewFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (picked.length === 0 || !viewTarget) return
    setUploadingAttachment(true)
    try {
      const fd = new FormData()
      picked.forEach(f => fd.append('fichiers[]', f))
      const { data } = await api.post<TicketRow>(`/tickets/${viewTarget.id}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Fichier(s) ajouté(s).')
      refreshViewTarget(data)
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Erreur lors de l'ajout du fichier.")
    } finally {
      setUploadingAttachment(false)
    }
  }

  const handleDownloadAttachment = async (att: TicketAttachment) => {
    if (!viewTarget) return
    try {
      const res = await api.get(`/tickets/${viewTarget.id}/attachments/${att.id}/fichier`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = att.nom_original
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error('Impossible de télécharger ce fichier.')
    }
  }

  const handleDeleteAttachment = async (att: TicketAttachment) => {
    if (!viewTarget) return
    if (!window.confirm(`Supprimer « ${att.nom_original} » ?`)) return
    setDeletingAttachmentId(att.id)
    try {
      await api.delete(`/tickets/${viewTarget.id}/attachments/${att.id}`)
      const updated = { ...viewTarget, attachments: viewTarget.attachments.filter(a => a.id !== att.id) }
      refreshViewTarget(updated)
      toast.success('Pièce jointe supprimée.')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erreur lors de la suppression.')
    } finally {
      setDeletingAttachmentId(null)
    }
  }

  const filtered = statutFilter ? tickets.filter(t => t.statut === statutFilter) : tickets
  const pendingReview = tickets.filter(t => t.statut === 'en_attente_validation').length

  return (
    <Box className="fade-in">
      <Box sx={{
        display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between',
        flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, mb: 3,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{
            width: 48, height: 48, borderRadius: 2.5,
            background: 'linear-gradient(135deg,#6A1B9A,#4A148C)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ConfirmationNumberIcon sx={{ color: 'white', fontSize: 26 }} />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={800} color="text.primary" fontSize={{ xs: 17, md: 22 }}>
              Tickets
            </Typography>
            <Typography color="text.secondary" fontSize={14}>
              {isSuperAdmin ? 'Assignez des tâches et validez le travail de votre équipe' : 'Vos tâches assignées'}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          {isSuperAdmin && pendingReview > 0 && (
            <Chip label={`${pendingReview} à valider`}
              sx={{ bgcolor: '#FFF3E0', color: '#E65100', fontWeight: 700 }} />
          )}
          {isSuperAdmin && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}
              disabled={assignableAdmins.length === 0}
              sx={{ borderRadius: 2.5, fontWeight: 600 }}>
              Nouveau ticket
            </Button>
          )}
        </Box>
      </Box>

      {isSuperAdmin && assignableAdmins.length === 0 && !loading && (
        <Card sx={{ mb: 3, borderRadius: 3, bgcolor: '#FFF8E1', border: '1px solid #FFE082' }}>
          <CardContent sx={{ p: 2.5 }}>
            <Typography fontSize={13} color="#E65100">
              Aucun autre admin dans votre cabinet pour l'instant — invitez un collègue admin avant de pouvoir créer un ticket.
            </Typography>
          </CardContent>
        </Card>
      )}

      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Statut</InputLabel>
              <Select value={statutFilter} label="Statut"
                onChange={e => setStatutFilter(e.target.value as Statut | '')}>
                <MenuItem value="">Tous</MenuItem>
                {Object.entries(STATUT_MAP).map(([k, v]) => (
                  <MenuItem key={k} value={k}>{v.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
          ) : filtered.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <ConfirmationNumberIcon sx={{ fontSize: 52, color: '#ddd' }} />
              <Typography color="text.secondary" mt={1} fontSize={14}>
                {tickets.length === 0 ? 'Aucun ticket pour le moment.' : 'Aucun résultat pour ce filtre.'}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table sx={{ minWidth: 700 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Titre</TableCell>
                    <TableCell>{isSuperAdmin ? 'Assigné à' : 'Assigné par'}</TableCell>
                    <TableCell>Priorité</TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Échéance</TableCell>
                    <TableCell>Statut</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map(t => {
                    const s = STATUT_MAP[t.statut]
                    const p = PRIORITE_MAP[t.priorite]
                    const person = isSuperAdmin ? t.assignee : t.creator
                    const busy = actioningId === t.id
                    return (
                      <TableRow key={t.id} sx={{ '&:hover': { bgcolor: '#f8f9ff' }, cursor: 'pointer' }}
                        onClick={() => openViewFor(t)}>
                        <TableCell>
                          <Typography fontWeight={700} fontSize={13}>{t.titre}</Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar src={person.avatar ?? undefined} sx={{ width: 24, height: 24, fontSize: 11, bgcolor: '#1565C0' }}>
                              {person.nom.charAt(0).toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography fontSize={12.5} lineHeight={1.3}>{person.nom}</Typography>
                              {isSuperAdmin && person.entreprise && (
                                <Typography fontSize={10.5} color="text.secondary" lineHeight={1.2}>{person.entreprise}</Typography>
                              )}
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip label={p.label} size="small" sx={{ bgcolor: `${p.color}18`, color: p.color, fontWeight: 700, fontSize: 11 }} />
                        </TableCell>
                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, fontSize: 13, color: '#555' }}>
                          {t.date_echeance ? new Date(t.date_echeance).toLocaleDateString('fr-FR') : '—'}
                        </TableCell>
                        <TableCell>
                          <Chip label={s.label} size="small" sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: 11 }} />
                        </TableCell>
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                          <Tooltip title="Voir le détail">
                            <IconButton size="small" sx={{ color: '#546E7A' }} onClick={() => openViewFor(t)}>
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {t.attachments.length > 0 && (
                            <Tooltip title={`${t.attachments.length} pièce(s) jointe(s)`}>
                              <Chip size="small" icon={<AttachFileIcon sx={{ fontSize: 13 }} />}
                                label={t.attachments.length}
                                sx={{ ml: 0.5, height: 22, fontSize: 11, bgcolor: '#F1F5F9', color: '#546E7A' }} />
                            </Tooltip>
                          )}

                          {!isSuperAdmin && t.statut === 'a_faire' && (
                            <Tooltip title="Démarrer">
                              <IconButton size="small" sx={{ color: '#1565C0' }} disabled={busy} onClick={() => handleStart(t)}>
                                {busy ? <CircularProgress size={16} /> : <PlayArrowIcon fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                          )}
                          {!isSuperAdmin && (t.statut === 'en_cours' || t.statut === 'rejete') && (
                            <Tooltip title="Soumettre pour validation">
                              <IconButton size="small" sx={{ color: '#2E7D32' }} disabled={busy} onClick={() => handleSubmit(t)}>
                                {busy ? <CircularProgress size={16} /> : <SendIcon fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                          )}

                          {isSuperAdmin && t.statut === 'en_attente_validation' && (
                            <>
                              <Tooltip title="Valider">
                                <IconButton size="small" sx={{ color: '#2E7D32' }} disabled={busy} onClick={() => handleValidate(t)}>
                                  {busy ? <CircularProgress size={16} /> : <CheckCircleIcon fontSize="small" />}
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Rejeter avec remarques">
                                <IconButton size="small" sx={{ color: '#C62828' }}
                                  onClick={() => { setRejectTarget(t); setRejectComment('') }}>
                                  <CancelIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                          {isSuperAdmin && (
                            <Tooltip title="Supprimer">
                              <IconButton size="small" sx={{ color: '#C62828' }} disabled={busy} onClick={() => handleDelete(t)}>
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

      {/* ── Create Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={createOpen} onClose={() => !creating && setCreateOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 17, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AddIcon sx={{ fontSize: 20, color: '#6A1B9A' }} />
          Nouveau ticket
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField fullWidth label="Titre *" value={createForm.titre}
                onChange={e => setCreateForm(f => ({ ...f, titre: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Description" multiline rows={3} value={createForm.description}
                onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label="Assigné à *" value={createForm.assigned_to}
                onChange={e => setCreateForm(f => ({ ...f, assigned_to: Number(e.target.value) }))}>
                {assignableAdmins.map(a => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.nom}{a.entreprise ? ` — ${a.entreprise}` : ''} ({a.email})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label="Priorité" value={createForm.priorite}
                onChange={e => setCreateForm(f => ({ ...f, priorite: e.target.value as Priorite }))}>
                {Object.entries(PRIORITE_MAP).map(([k, v]) => (
                  <MenuItem key={k} value={k}>{v.label}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Échéance (optionnel)" type="date" InputLabelProps={{ shrink: true }}
                value={createForm.date_echeance}
                onChange={e => setCreateForm(f => ({ ...f, date_echeance: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <Button component="label" variant="outlined" startIcon={<AttachFileIcon />}
                disabled={createFiles.length >= MAX_ATTACHMENTS}
                sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}>
                Joindre des fichiers (PDF, images)
                <input type="file" hidden multiple accept={ACCEPTED_ATTACHMENT_TYPES} onChange={handlePickCreateFiles} />
              </Button>
              {createFiles.length > 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1.5 }}>
                  {createFiles.map((f, idx) => (
                    <Box key={`${f.name}-${idx}`} sx={{
                      display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.75,
                      bgcolor: '#F8F9FF', borderRadius: 1.5, border: '1px solid #EEF0FA',
                    }}>
                      {f.type.startsWith('image/') ? <ImageIcon sx={{ fontSize: 16, color: '#1565C0' }} /> : <InsertDriveFileIcon sx={{ fontSize: 16, color: '#1565C0' }} />}
                      <Typography fontSize={12.5} sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.name}
                      </Typography>
                      <Typography fontSize={11} color="text.secondary">{formatFileSize(f.size)}</Typography>
                      <IconButton size="small" onClick={() => removeCreateFile(idx)}>
                        <CloseIcon fontSize="small" sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5, gap: 1 }}>
          <Button onClick={() => setCreateOpen(false)} disabled={creating} color="inherit">Annuler</Button>
          <Button variant="contained" onClick={handleCreate} disabled={creating}
            startIcon={creating ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
            sx={{ fontWeight: 700, borderRadius: 2, bgcolor: '#6A1B9A', '&:hover': { bgcolor: '#4A148C' } }}>
            {creating ? 'Création…' : 'Créer et assigner'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Reject Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={!!rejectTarget} onClose={() => !rejecting && setRejectTarget(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>Renvoyer le ticket</DialogTitle>
        <DialogContent>
          <Typography fontSize={13} color="text.secondary" mb={2}>
            Expliquez à {rejectTarget?.assignee.nom} ce qui doit être corrigé.
          </Typography>
          <TextField fullWidth multiline rows={3} label="Remarques *" value={rejectComment}
            onChange={e => setRejectComment(e.target.value)} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setRejectTarget(null)} disabled={rejecting} color="inherit">Annuler</Button>
          <Button variant="contained" color="error" onClick={handleReject} disabled={rejecting || !rejectComment.trim()}
            startIcon={rejecting ? <CircularProgress size={14} color="inherit" /> : <CancelIcon />}>
            {rejecting ? 'Envoi…' : 'Renvoyer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── View Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={!!viewTarget} onClose={() => setViewTarget(null)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Typography fontWeight={700} fontSize={16}>{viewTarget?.titre}</Typography>
          <IconButton size="small" onClick={() => setViewTarget(null)}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {viewTarget && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {[
                { label: 'Statut',     value: <Chip label={STATUT_MAP[viewTarget.statut].label} size="small" sx={{ bgcolor: STATUT_MAP[viewTarget.statut].bg, color: STATUT_MAP[viewTarget.statut].color, fontWeight: 700 }} /> },
                { label: 'Priorité',   value: <Chip label={PRIORITE_MAP[viewTarget.priorite].label} size="small" sx={{ bgcolor: `${PRIORITE_MAP[viewTarget.priorite].color}18`, color: PRIORITE_MAP[viewTarget.priorite].color, fontWeight: 700 }} /> },
                { label: 'Assigné à',  value: <Typography fontSize={13} fontWeight={600}>{viewTarget.assignee.nom}</Typography> },
                { label: 'Créé par',   value: <Typography fontSize={13} fontWeight={600}>{viewTarget.creator.nom}</Typography> },
                { label: 'Échéance',   value: <Typography fontSize={13}>{viewTarget.date_echeance ? new Date(viewTarget.date_echeance).toLocaleDateString('fr-FR') : '—'}</Typography> },
              ].map(({ label, value }) => (
                <Box key={label} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Typography fontSize={12} color="text.secondary" sx={{ width: 100, flexShrink: 0 }}>{label}</Typography>
                  {value}
                </Box>
              ))}
              {viewTarget.description && (
                <>
                  <Divider sx={{ my: 0.5 }} />
                  <Typography fontSize={12} color="text.secondary">Description</Typography>
                  <Typography fontSize={13} sx={{ whiteSpace: 'pre-wrap' }}>{viewTarget.description}</Typography>
                </>
              )}
              {viewTarget.commentaire_validation && (
                <>
                  <Divider sx={{ my: 0.5 }} />
                  <Box sx={{ p: 1.5, bgcolor: '#FFEBEE', borderRadius: 2, border: '1px solid #FFCDD2' }}>
                    <Typography fontSize={12} fontWeight={700} color="#C62828" mb={0.5}>Remarques du super admin</Typography>
                    <Typography fontSize={13} color="#C62828">{viewTarget.commentaire_validation}</Typography>
                  </Box>
                </>
              )}

              <Divider sx={{ my: 0.5 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography fontSize={12} color="text.secondary">
                  Pièces jointes {viewTarget.attachments.length > 0 ? `(${viewTarget.attachments.length})` : ''}
                </Typography>
                <Button component="label" size="small" startIcon={uploadingAttachment ? <CircularProgress size={13} /> : <AttachFileIcon sx={{ fontSize: 15 }} />}
                  disabled={uploadingAttachment || viewTarget.attachments.length >= MAX_ATTACHMENTS}
                  sx={{ fontSize: 12, textTransform: 'none', fontWeight: 600 }}>
                  Ajouter
                  <input ref={viewFileInputRef} type="file" hidden multiple accept={ACCEPTED_ATTACHMENT_TYPES} onChange={handlePickViewFiles} />
                </Button>
              </Box>

              {viewTarget.attachments.length === 0 ? (
                <Typography fontSize={12.5} color="text.secondary">Aucune pièce jointe.</Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  {viewTarget.attachments.map(att => (
                    <Box key={att.id} sx={{
                      display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.75,
                      bgcolor: '#F8F9FF', borderRadius: 1.5, border: '1px solid #EEF0FA',
                    }}>
                      {(att.mime_type ?? '').startsWith('image/') ? <ImageIcon sx={{ fontSize: 17, color: '#1565C0' }} /> : <InsertDriveFileIcon sx={{ fontSize: 17, color: '#1565C0' }} />}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography fontSize={12.5} fontWeight={600} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {att.nom_original}
                        </Typography>
                        <Typography fontSize={10.5} color="text.secondary">
                          {formatFileSize(att.taille)}{att.uploader?.nom ? ` · ${att.uploader.nom}` : ''}
                        </Typography>
                      </Box>
                      <Tooltip title="Télécharger">
                        <IconButton size="small" onClick={() => handleDownloadAttachment(att)}>
                          <DownloadIcon fontSize="small" sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      {canManageAttachment(att) && (
                        <Tooltip title="Supprimer">
                          <IconButton size="small" disabled={deletingAttachmentId === att.id} onClick={() => handleDeleteAttachment(att)}>
                            {deletingAttachmentId === att.id ? <CircularProgress size={14} /> : <DeleteIcon fontSize="small" sx={{ fontSize: 16, color: '#C62828' }} />}
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button onClick={() => setViewTarget(null)} color="inherit">Fermer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
