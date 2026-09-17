import { useState, useRef, useEffect } from 'react'
import {
  Box, Typography, Card, CardContent, Grid, TextField, Button,
  Avatar, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  InputAdornment,
} from '@mui/material'
import SaveIcon         from '@mui/icons-material/Save'
import LockIcon         from '@mui/icons-material/Lock'
import CameraAltIcon    from '@mui/icons-material/CameraAlt'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import UploadFileIcon   from '@mui/icons-material/UploadFile'
import PhoneIcon        from '@mui/icons-material/Phone'
import LocationOnIcon   from '@mui/icons-material/LocationOn'
import { useAuth }      from '../../contexts/AuthContext'
import toast            from 'react-hot-toast'
import api              from '../../api/axios'
import { notifyRefresh } from '../../utils/notifyRefresh'
import { useProfilePhoto, setProfilePhoto, clearProfilePhoto, getProfilePhoto } from '../../utils/useProfilePhoto'

export default function Profile() {
  const { user, updateUser } = useAuth()
  const photo = useProfilePhoto(user?.email ?? '', user?.avatar)
  const fileRef = useRef<HTMLInputElement>(null)

  // Fetch fresh data from server on mount so admin changes are reflected immediately
  useEffect(() => {
    api.get('/auth/me').then((r: { data: { nom: string; email: string; entreprise?: string; telephone?: string; adresse?: string; avatar?: string } }) => {
      const d = r.data
      setForm({
        nom:        d.nom        ?? '',
        email:      d.email      ?? '',
        entreprise: d.entreprise ?? '',
        telephone:  d.telephone  ?? '',
        adresse:    d.adresse    ?? '',
      })
      updateUser(d)
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-sync: if photo is in localStorage but not yet in DB, push it silently
  useEffect(() => {
    const email = user?.email ?? ''
    if (!email || user?.avatar) return
    const local = getProfilePhoto(email)
    if (!local) return
    api.post('/profile/photo', { avatar: local })
      .then((r: { data: { avatar?: string } }) => {
        if (r.data?.avatar) updateUser({ avatar: r.data.avatar })
      })
      .catch(() => {})
  }, [user?.email]) // eslint-disable-line react-hooks/exhaustive-deps

  const [form, setForm] = useState({
    nom:        user?.nom        ?? '',
    email:      user?.email      ?? '',
    entreprise: user?.entreprise ?? '',
    telephone:  user?.telephone  ?? '',
    adresse:    user?.adresse    ?? '',
  })
  const [pwdForm, setPwdForm] = useState({ current: '', password: '', confirmation: '' })
  const [photoDialog, setPhotoDialog] = useState(false)
  const [preview, setPreview]         = useState<string | null>(null)

  const handleSave = async () => {
    try {
      await api.put('/profile', form)
      notifyRefresh()
      toast.success('Profil mis à jour !')
    } catch {
      toast.error('Erreur lors de la sauvegarde')
    }
  }

  const handlePwd = async () => {
    if (pwdForm.password !== pwdForm.confirmation) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }
    try {
      await api.put('/profile/password', pwdForm)
      notifyRefresh()
      toast.success('Mot de passe modifié !')
      setPwdForm({ current: '', password: '', confirmation: '' })
    } catch {
      toast.error('Erreur lors du changement de mot de passe')
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image trop lourde (max 2 Mo)')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const email = user?.email ?? ''

  const handleConfirmPhoto = async () => {
    if (preview) {
      const url = await setProfilePhoto(email, preview)
      updateUser({ avatar: url ?? preview })
      toast.success('Photo de profil mise à jour !')
    }
    setPhotoDialog(false)
    setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleRemovePhoto = async () => {
    await clearProfilePhoto(email)
    updateUser({ avatar: undefined })
    setPhotoDialog(false)
    setPreview(null)
    toast.success('Photo supprimée')
  }

  const initials = user?.nom?.charAt(0).toUpperCase() ?? '?'

  return (
    <Box className="fade-in">
      <Typography variant="h5" fontWeight={800} color="#1a1a2e" mb={3}>Mon profil</Typography>

      {/* hidden file input */}
      <Box
        component="input"
        ref={fileRef}
        type="file"
        accept="image/*"
        aria-label="Sélectionner une photo de profil"
        sx={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <Grid container spacing={3}>
        {/* ── Avatar card ── */}
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 3, textAlign: 'center', p: 3 }}>
            {/* Avatar + camera overlay */}
            <Box sx={{ position: 'relative', display: 'inline-block', mb: 2 }}>
              <Avatar
                src={photo ?? undefined}
                sx={{
                  width: 100, height: 100,
                  bgcolor: '#1565C0', fontSize: 38, fontWeight: 800,
                  border: '3px solid #e3f0ff',
                }}>
                {!photo && initials}
              </Avatar>
              <Tooltip title="Changer la photo">
                <IconButton
                  onClick={() => setPhotoDialog(true)}
                  sx={{
                    position: 'absolute', bottom: -4, right: -4,
                    width: 32, height: 32,
                    bgcolor: '#1565C0',
                    border: '2px solid white',
                    '&:hover': { bgcolor: '#1976D2' },
                  }}>
                  <CameraAltIcon sx={{ color: 'white', fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>

            <Typography fontWeight={700} fontSize={18}>{user?.nom}</Typography>
            <Typography color="text.secondary" fontSize={14}>{user?.email}</Typography>
            <Typography fontSize={13} color="#1565C0" fontWeight={600} mt={0.5}>
              {user?.role === 'admin' ? 'Administrateur' : 'Client'}
            </Typography>
            {user?.entreprise && (
              <Typography fontSize={13} color="text.secondary" mt={0.5}>{user.entreprise}</Typography>
            )}

            <Button
              size="small"
              variant="outlined"
              startIcon={<CameraAltIcon />}
              sx={{ mt: 2, borderRadius: 2.5, fontWeight: 600, textTransform: 'none', fontSize: 12 }}
              onClick={() => setPhotoDialog(true)}>
              Changer la photo
            </Button>
          </Card>
        </Grid>

        {/* ── Forms ── */}
        <Grid item xs={12} md={8}>
          <Card sx={{ borderRadius: 3, mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography fontWeight={700} fontSize={16} mb={3}>Informations personnelles</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Nom complet" value={form.nom}
                    onChange={(e) => setForm((p) => ({ ...p, nom: e.target.value }))} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Email" type="email" value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                </Grid>
                {user?.role === 'client' && (
                  <>
                    <Grid item xs={12}>
                      <TextField fullWidth label="Entreprise" value={form.entreprise}
                        onChange={(e) => setForm((p) => ({ ...p, entreprise: e.target.value }))} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label="Numéro de téléphone" value={form.telephone}
                        onChange={(e) => setForm((p) => ({ ...p, telephone: e.target.value }))}
                        InputProps={{ startAdornment: <InputAdornment position="start"><PhoneIcon sx={{ color: '#94A3B8', fontSize: 18 }} /></InputAdornment> }} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label="Adresse" value={form.adresse}
                        onChange={(e) => setForm((p) => ({ ...p, adresse: e.target.value }))}
                        InputProps={{ startAdornment: <InputAdornment position="start"><LocationOnIcon sx={{ color: '#94A3B8', fontSize: 18 }} /></InputAdornment> }} />
                    </Grid>
                  </>
                )}
              </Grid>
              <Button variant="contained" startIcon={<SaveIcon />} sx={{ mt: 3, fontWeight: 700 }} onClick={handleSave}>
                Sauvegarder
              </Button>
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" gap={1} mb={3}>
                <LockIcon sx={{ color: '#1565C0' }} />
                <Typography fontWeight={700} fontSize={16}>Modifier le mot de passe</Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField fullWidth label="Mot de passe actuel" type="password" value={pwdForm.current}
                    onChange={(e) => setPwdForm((p) => ({ ...p, current: e.target.value }))} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Nouveau mot de passe" type="password" value={pwdForm.password}
                    onChange={(e) => setPwdForm((p) => ({ ...p, password: e.target.value }))} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Confirmer" type="password" value={pwdForm.confirmation}
                    onChange={(e) => setPwdForm((p) => ({ ...p, confirmation: e.target.value }))} />
                </Grid>
              </Grid>
              <Button variant="contained" startIcon={<LockIcon />} sx={{ mt: 3, fontWeight: 700 }} onClick={handlePwd}>
                Changer le mot de passe
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Photo upload dialog ── */}
      <Dialog
        open={photoDialog}
        onClose={() => { setPhotoDialog(false); setPreview(null) }}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4 } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 18, pb: 1 }}>
          Photo de profil
        </DialogTitle>
        <DialogContent>
          {/* Preview zone */}
          <Box sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2.5,
          }}>
            <Avatar
              src={preview ?? photo ?? undefined}
              sx={{
                width: 120, height: 120,
                bgcolor: '#1565C0', fontSize: 44, fontWeight: 800,
                border: '4px solid #e3f0ff',
                boxShadow: '0 4px 20px rgba(21,101,192,0.25)',
              }}>
              {!(preview || photo) && initials}
            </Avatar>

            {/* Upload zone */}
            <Box
              onClick={() => fileRef.current?.click()}
              sx={{
                width: '100%', border: '2px dashed #90CAF9', borderRadius: 3,
                p: 3, textAlign: 'center', cursor: 'pointer',
                bgcolor: '#F0F7FF',
                transition: 'all 0.2s',
                '&:hover': { bgcolor: '#E3F0FF', borderColor: '#1565C0' },
              }}>
              <UploadFileIcon sx={{ color: '#1565C0', fontSize: 36, mb: 1 }} />
              <Typography fontWeight={600} color="#1565C0" fontSize={14}>
                Cliquer pour sélectionner une image
              </Typography>
              <Typography color="text.secondary" fontSize={12} mt={0.5}>
                JPG, PNG, WebP — max 2 Mo
              </Typography>
            </Box>

            {preview && (
              <Typography fontSize={12} color="success.main" fontWeight={600}>
                Nouvelle image prête — cliquez sur Confirmer
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          {(photo || preview) && (
            <Button
              color="error"
              startIcon={<DeleteOutlineIcon />}
              onClick={handleRemovePhoto}
              sx={{ mr: 'auto', fontWeight: 600, textTransform: 'none' }}>
              Supprimer
            </Button>
          )}
          <Button
            onClick={() => { setPhotoDialog(false); setPreview(null) }}
            sx={{ fontWeight: 600, textTransform: 'none' }}>
            Annuler
          </Button>
          <Button
            variant="contained"
            disabled={!preview}
            onClick={handleConfirmPhoto}
            sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 2.5 }}>
            Confirmer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
