import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Card, CardContent, Chip, Avatar, TextField,
  InputAdornment, IconButton, Tooltip, CircularProgress, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Alert,
} from '@mui/material'
import SearchIcon    from '@mui/icons-material/Search'
import EmailIcon     from '@mui/icons-material/Email'
import SendIcon      from '@mui/icons-material/Send'
import CloseIcon     from '@mui/icons-material/Close'
import EditIcon      from '@mui/icons-material/Edit'
import DeleteIcon    from '@mui/icons-material/Delete'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import LoginIcon      from '@mui/icons-material/Login'
import WhatsAppIcon   from '@mui/icons-material/WhatsApp'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import CameraAltIcon from '@mui/icons-material/CameraAlt'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import { useAuth } from '../../contexts/AuthContext'
import { notifyRefresh } from '../../utils/notifyRefresh'

// ── Avatar with photo fallback ──────────────────────────────────────────────
function ClientAvatar({ email, nom, avatar }: { email: string; nom: string; avatar?: string | null }) {
  const [photo, setPhoto] = useState<string | null>(() =>
    avatar || localStorage.getItem(`profile_photo_${email}`) || null
  )
  useEffect(() => {
    const resolved = avatar || localStorage.getItem(`profile_photo_${email}`) || null
    setPhoto(resolved)
    const handler = () => setPhoto(avatar || localStorage.getItem(`profile_photo_${email}`) || null)
    window.addEventListener('profile_photo_changed', handler)
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener('profile_photo_changed', handler)
      window.removeEventListener('storage', handler)
    }
  }, [email, avatar])
  return (
    <Avatar src={photo ?? undefined}
      sx={{ width: 56, height: 56, bgcolor: '#1565C0', fontSize: 22, fontWeight: 700, flexShrink: 0 }}>
      {!photo && nom.charAt(0).toUpperCase()}
    </Avatar>
  )
}

// ── Types ───────────────────────────────────────────────────────────────────
interface Client {
  id: number
  nom: string
  email: string
  entreprise: string | null
  telephone: string | null
  adresse: string | null
  avatar?: string | null
  nb_factures: number
  nb_declarations: number
  is_actif: number
  is_connected: boolean
  created_at: string
}
interface EmailTarget { id: number; nom: string; email: string }
interface EditForm { nom: string; entreprise: string; telephone: string; adresse: string }

// ── Component ───────────────────────────────────────────────────────────────
export default function AdminClients() {
  const { user }   = useAuth()
  const navigate    = useNavigate()
  const [clients, setClients]   = useState<Client[]>([])
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)

  // Email compose
  const [emailTarget, setEmailTarget] = useState<EmailTarget | null>(null)
  const [subject, setSubject]         = useState('')
  const [message, setMessage]         = useState('')
  const [sending, setSending]         = useState(false)

  // Edit dialog
  const [editTarget, setEditTarget]   = useState<Client | null>(null)
  const [editForm, setEditForm]       = useState<EditForm>({ nom: '', entreprise: '', telephone: '', adresse: '' })
  const [editAvatar, setEditAvatar]   = useState<string>('')
  const [editLoading, setEditLoading] = useState(false)

  // Delete dialog
  const [deleteTarget, setDeleteTarget]   = useState<Client | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Invite dialog
  const [inviteOpen, setInviteOpen]   = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteResult, setInviteResult]   = useState<{ status: string; message: string } | null>(null)

  const [adminEntreprise, setAdminEntreprise] = useState<string | null>(user?.entreprise ?? null)

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Fetch fresh admin profile so enterprise filter is always current
    api.get('/auth/me')
      .then((r: { data: { entreprise?: string } }) => setAdminEntreprise(r.data.entreprise ?? null))
      .catch(() => {})

    api.get('/admin/clients')
      .then((r: { data: Client[] }) => setClients(r.data))
      .catch(() => toast.error('Impossible de charger les clients.'))
      .finally(() => setLoading(false))
  }, [])

  const entrepriseFilter = adminEntreprise?.toLowerCase() ?? null

  const filtered = clients
    .filter(c =>
      !entrepriseFilter ||
      (c.entreprise ?? '').toLowerCase() === entrepriseFilter
    )
    .filter(c =>
      c.nom.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.entreprise ?? '').toLowerCase().includes(search.toLowerCase())
    )



  // ── Email compose ─────────────────────────────────────────────────────────
  const openEmail   = (c: Client) => { setEmailTarget({ id: c.id, nom: c.nom, email: c.email }); setSubject(''); setMessage('') }
  const closeEmail  = () => { setEmailTarget(null); setSubject(''); setMessage('') }
  const handleSendEmail = async () => {
    if (!emailTarget || !subject.trim() || !message.trim()) return
    setSending(true)
    try {
      await api.post(`/admin/clients/${emailTarget.id}/send-email`, { subject, message })
      toast.success(`Email envoyé à ${emailTarget.email}`)
      notifyRefresh()
      closeEmail()
    } catch { toast.error("Erreur lors de l'envoi de l'email.") }
    finally { setSending(false) }
  }

  // ── WhatsApp ─────────────────────────────────────────────────────────────
  const openWhatsApp = (c: Client) => {
    const digits = (c.telephone ?? '').replace(/\D/g, '')
    if (!digits) { toast.error('Aucun numéro de téléphone pour ce client.'); return }
    window.open(`https://wa.me/${digits}`, '_blank', 'noopener')
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  const openEdit = (c: Client) => {
    setEditTarget(c)
    setEditForm({ nom: c.nom, entreprise: c.entreprise ?? '', telephone: c.telephone ?? '', adresse: c.adresse ?? '' })
    setEditAvatar('')
  }
  const closeEdit = () => { setEditTarget(null); setEditAvatar('') }

  const handleEditAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setEditAvatar(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleUpdate = async () => {
    if (!editTarget) return
    setEditLoading(true)
    try {
      const payload: Record<string, unknown> = { ...editForm }
      if (editAvatar) payload.avatar = editAvatar
      const res = await api.put(`/admin/clients/${editTarget.id}`, payload)
      setClients(prev => prev.map(c => c.id === editTarget.id ? { ...c, ...res.data } : c))
      toast.success('Informations mises à jour.')
      notifyRefresh()
      closeEdit()
    } catch { toast.error('Erreur lors de la modification.') }
    finally { setEditLoading(false) }
  }

  // ── Impersonate (login as this client) ──────────────────────────────────────
  const [impersonatingId, setImpersonatingId] = useState<number | null>(null)
  const handleImpersonate = async (c: Client) => {
    setImpersonatingId(c.id)
    try {
      const res = await api.post(`/admin/clients/${c.id}/impersonate`)
      const url = `/impersonate?token=${encodeURIComponent(res.data.token)}&user=${encodeURIComponent(JSON.stringify(res.data.user))}`
      window.open(url, '_blank', 'noopener')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Impossible de se connecter en tant que ce client.')
    } finally {
      setImpersonatingId(null)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const openDelete  = (c: Client) => setDeleteTarget(c)
  const closeDelete = () => setDeleteTarget(null)
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await api.delete(`/admin/clients/${deleteTarget.id}`)
      setClients(prev => prev.filter(c => c.id !== deleteTarget.id))
      toast.success(`Client ${deleteTarget.nom} supprimé.`)
      notifyRefresh()
      closeDelete()
    } catch { toast.error('Erreur lors de la suppression.') }
    finally { setDeleteLoading(false) }
  }

  // ── Invite ────────────────────────────────────────────────────────────────
  const openInvite  = () => { setInviteOpen(true); setInviteEmail(''); setInviteResult(null) }
  const closeInvite = () => { setInviteOpen(false); setInviteEmail(''); setInviteResult(null) }
  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviteLoading(true)
    try {
      const res = await api.post('/admin/clients/invite', { email: inviteEmail.trim() })
      setInviteResult({ status: res.data.status, message: res.data.message })
      notifyRefresh()
      if (res.data.status === 'invited_same_company' || res.data.status === 'invited_existing') {
        api.get('/admin/clients').then((r: { data: Client[] }) => setClients(r.data)).catch(() => {})
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setInviteResult({ status: 'error', message: msg || "Erreur lors de l'invitation." })
    }
    finally { setInviteLoading(false) }
  }

  const inviteAlertColor = (status: string) => {
    if (status === 'invited_same_company' || status === 'invited_existing') return 'success' as const
    if (status === 'different_company') return 'warning' as const
    if (status === 'sent_registration') return 'info' as const
    return 'error' as const
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Box className="fade-in">
      {/* Header */}
      <Box sx={{
        display: 'flex', justifyContent: 'space-between',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'flex-start', sm: 'center' },
        gap: 1.5, mb: 3,
      }}>
        <Box>
          <Typography variant="h5" fontWeight={800} color="#1a1a2e" fontSize={{ xs: 17, md: 22 }}>
            Gestion des clients
          </Typography>
          <Typography color="text.secondary" fontSize={14}>
            {filtered.length} client(s)
            {adminEntreprise
              ? <> — entreprise : <strong>{adminEntreprise}</strong></>
              : ' — définissez votre entreprise dans votre profil pour filtrer'}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<PersonAddIcon />}
          onClick={openInvite}
          sx={{ bgcolor: '#1565C0', fontWeight: 700, borderRadius: 2, px: 2.5, whiteSpace: 'nowrap' }}
        >
          Ajouter un client
        </Button>
      </Box>

      {/* Search */}
      <TextField
        placeholder="Rechercher par nom, email ou entreprise…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        size="small"
        sx={{ mb: 2.5, width: { xs: '100%', sm: 380 } }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
      />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
      ) : filtered.length === 0 ? (
        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography color="text.secondary" textAlign="center" py={4} fontSize={14}>
              {search ? 'Aucun résultat pour cette recherche.' : 'Aucun client enregistré.'}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)', xl: 'repeat(4, 1fr)' },
          gap: 2,
        }}>
          {filtered.map((c) => (
            <Card key={c.id}
              onClick={() => navigate(`/admin/clients/${c.id}/dossier`)}
              sx={{
                borderRadius: 3, cursor: 'pointer', transition: 'all .15s',
                '&:hover': { boxShadow: '0 6px 20px rgba(21,101,192,0.14)', transform: 'translateY(-2px)' },
              }}>
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1.5 }}>
                  <ClientAvatar email={c.email} nom={c.nom} avatar={c.avatar} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={700} fontSize={14} noWrap>{c.nom}</Typography>
                    <Typography fontSize={12} color="text.secondary" noWrap>{c.entreprise ?? '—'}</Typography>
                  </Box>
                  <Tooltip title={c.is_connected ? 'Session ouverte' : 'Aucune session active'}>
                    <Chip
                      size="small"
                      label={c.is_connected ? 'Actif' : 'Inactif'}
                      sx={{
                        bgcolor: c.is_connected ? '#E8F5E9' : '#F5F5F5',
                        color:   c.is_connected ? '#2E7D32' : '#757575',
                        fontWeight: 700, fontSize: 10, flexShrink: 0,
                      }}
                    />
                  </Tooltip>
                </Box>

                <Typography fontSize={12.5} color="text.secondary" noWrap mb={1.5}>{c.email}</Typography>

                <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                  <Chip label={`${c.nb_factures} fact.`} size="small" sx={{ bgcolor: '#e3f0ff', color: '#1565C0', fontWeight: 700, fontSize: 11 }} />
                  <Chip label={`${c.nb_declarations} décl.`} size="small" sx={{ bgcolor: '#f3e5f5', color: '#7B1FA2', fontWeight: 700, fontSize: 11 }} />
                </Box>

                <Typography fontSize={11} color="text.secondary" mb={1.5}>
                  Inscrit le {new Date(c.created_at).toLocaleDateString('fr-FR')}
                </Typography>

                <Divider sx={{ mb: 1 }} />

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                  <Tooltip title="Voir le dossier">
                    <IconButton sx={{ color: '#2E7D32' }}
                      onClick={() => navigate(`/admin/clients/${c.id}/dossier`)}>
                      <FolderOpenIcon fontSize="medium" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Se connecter en tant que ce client">
                    <span>
                      <IconButton sx={{ color: '#7B1FA2' }}
                        disabled={impersonatingId === c.id}
                        onClick={() => handleImpersonate(c)}>
                        {impersonatingId === c.id
                          ? <CircularProgress size={24} />
                          : <LoginIcon fontSize="medium" />}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Modifier">
                    <IconButton sx={{ color: '#1565C0' }} onClick={() => openEdit(c)}>
                      <EditIcon fontSize="medium" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Envoyer un email">
                    <IconButton sx={{ color: '#0288d1' }} onClick={() => openEmail(c)}>
                      <EmailIcon fontSize="medium" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={c.telephone ? 'Discuter sur WhatsApp' : 'Aucun numéro de téléphone'}>
                    <span>
                      <IconButton sx={{ color: '#25D366' }} disabled={!c.telephone} onClick={() => openWhatsApp(c)}>
                        <WhatsAppIcon fontSize="medium" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Supprimer">
                    <IconButton color="error" onClick={() => openDelete(c)}>
                      <DeleteIcon fontSize="medium" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* ── Edit Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={!!editTarget} onClose={closeEdit} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box>
            <Typography fontWeight={700} fontSize={16}>Modifier le client</Typography>
            {editTarget && <Typography fontSize={13} color="text.secondary">{editTarget.email}</Typography>}
          </Box>
          <IconButton size="small" onClick={closeEdit}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2.5 }}>

          {/* Avatar picker — label wraps input so clicking avatar/icon reliably opens file picker */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Cliquer pour changer la photo">
              <Box
                component="label"
                sx={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }}
              >
                <Box
                  component="input"
                  type="file"
                  accept="image/*"
                  aria-label="Photo de profil du client"
                  sx={{ display: 'none' }}
                  onChange={handleEditAvatarChange}
                />
                <Avatar
                  src={editAvatar || editTarget?.avatar || undefined}
                  sx={{ width: 96, height: 96, bgcolor: '#1565C0', fontSize: 34, fontWeight: 700, border: '3px solid #e3f0ff', boxShadow: '0 4px 14px rgba(21,101,192,0.2)' }}
                >
                  {!editAvatar && !editTarget?.avatar && (editTarget?.nom.charAt(0).toUpperCase() ?? '?')}
                </Avatar>
                <Box sx={{
                  position: 'absolute', bottom: 2, right: 2,
                  width: 30, height: 30, bgcolor: '#1565C0',
                  border: '2px solid white', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                  '&:hover': { bgcolor: '#1976D2' },
                }}>
                  <CameraAltIcon sx={{ color: 'white', fontSize: 15 }} />
                </Box>
              </Box>
            </Tooltip>
            <Typography fontSize={12} color={editAvatar ? 'success.main' : 'text.secondary'} fontWeight={600}>
              {editAvatar ? 'Nouvelle photo sélectionnée ✓' : 'Cliquer sur la photo pour la changer'}
            </Typography>
          </Box>

          <TextField label="Nom complet" value={editForm.nom}
            onChange={(e) => setEditForm(f => ({ ...f, nom: e.target.value }))}
            fullWidth size="small" required />
          <TextField label="Entreprise" value={editForm.entreprise}
            onChange={(e) => setEditForm(f => ({ ...f, entreprise: e.target.value }))}
            fullWidth size="small" />
          <TextField label="Téléphone" value={editForm.telephone}
            onChange={(e) => setEditForm(f => ({ ...f, telephone: e.target.value }))}
            fullWidth size="small" />
          <TextField label="Adresse" value={editForm.adresse}
            onChange={(e) => setEditForm(f => ({ ...f, adresse: e.target.value }))}
            fullWidth size="small" multiline rows={2} />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button onClick={closeEdit} disabled={editLoading} color="inherit">Annuler</Button>
          <Button variant="contained" onClick={handleUpdate}
            disabled={editLoading || !editForm.nom.trim()}
            startIcon={editLoading ? <CircularProgress size={16} color="inherit" /> : undefined}>
            {editLoading ? 'Sauvegarde…' : 'Enregistrer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirmation Dialog ───────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onClose={closeDelete} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography fontWeight={700} fontSize={16}>Confirmer la suppression</Typography>
          <IconButton size="small" onClick={closeDelete}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 1 }}>
            Cette action est irréversible. Le compte de <strong>{deleteTarget?.nom}</strong> sera définitivement supprimé.
          </Alert>
          <Typography fontSize={13} color="text.secondary">
            Email : {deleteTarget?.email}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button onClick={closeDelete} disabled={deleteLoading} color="inherit">Annuler</Button>
          <Button variant="contained" color="error" onClick={handleDelete}
            disabled={deleteLoading}
            startIcon={deleteLoading ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}>
            {deleteLoading ? 'Suppression…' : 'Supprimer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Email Compose Dialog ─────────────────────────────────────────── */}
      <Dialog open={!!emailTarget} onClose={closeEmail} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box>
            <Typography fontWeight={700} fontSize={16}>Envoyer un email</Typography>
            {emailTarget && (
              <Typography fontSize={13} color="text.secondary">
                À : {emailTarget.nom} &lt;{emailTarget.email}&gt;
              </Typography>
            )}
          </Box>
          <IconButton size="small" onClick={closeEmail}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Objet" value={subject}
            onChange={(e) => setSubject(e.target.value)}
            fullWidth size="small" inputProps={{ maxLength: 255 }} />
          <TextField label="Message" value={message}
            onChange={(e) => setMessage(e.target.value)}
            fullWidth multiline rows={6}
            inputProps={{ maxLength: 5000 }}
            helperText={`${message.length}/5000`} />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button onClick={closeEmail} disabled={sending} color="inherit">Annuler</Button>
          <Button variant="contained"
            startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
            onClick={handleSendEmail}
            disabled={sending || !subject.trim() || !message.trim()}>
            {sending ? 'Envoi…' : 'Envoyer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Invite Dialog ────────────────────────────────────────────────── */}
      <Dialog open={inviteOpen} onClose={closeInvite} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box>
            <Typography fontWeight={700} fontSize={16}>Ajouter / Inviter un client</Typography>
            <Typography fontSize={13} color="text.secondary">
              Entrez l'email — nous vérifions s'il a déjà un compte.
            </Typography>
          </Box>
          <IconButton size="small" onClick={closeInvite}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2 }}>
          <TextField
            label="Adresse email du client"
            type="email"
            value={inviteEmail}
            onChange={(e) => { setInviteEmail(e.target.value); setInviteResult(null) }}
            fullWidth
            size="small"
            placeholder="client@example.com"
            sx={{ mb: inviteResult ? 2 : 0 }}
          />
          {inviteResult && (
            <Alert severity={inviteAlertColor(inviteResult.status)} sx={{ mt: 2 }}>
              {inviteResult.message}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button onClick={closeInvite} color="inherit">Fermer</Button>
          <Button
            variant="contained"
            startIcon={inviteLoading ? <CircularProgress size={16} color="inherit" /> : <PersonAddIcon />}
            onClick={handleInvite}
            disabled={inviteLoading || !inviteEmail.trim()}
            sx={{ bgcolor: '#1565C0' }}
          >
            {inviteLoading ? 'Vérification…' : 'Vérifier & Inviter'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}