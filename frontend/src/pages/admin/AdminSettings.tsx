import { useState, useRef, useEffect } from 'react'
import {
  Box, Typography, Card, CardContent, Grid, TextField,
  Button, Divider, Switch, FormControlLabel, Avatar, Alert,
  IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  InputAdornment, Select, MenuItem, FormControl, InputLabel, CircularProgress,
} from '@mui/material'
import SettingsIcon      from '@mui/icons-material/Settings'
import SaveIcon          from '@mui/icons-material/Save'
import LockIcon          from '@mui/icons-material/Lock'
import NotificationsIcon from '@mui/icons-material/Notifications'
import CameraAltIcon     from '@mui/icons-material/CameraAlt'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import UploadFileIcon    from '@mui/icons-material/UploadFile'
import BusinessIcon      from '@mui/icons-material/Business'
import PaymentsIcon      from '@mui/icons-material/Payments'
import WhatsAppIcon      from '@mui/icons-material/WhatsApp'
import { useAuth }       from '../../contexts/AuthContext'
import { useCurrency, CURRENCY_OPTIONS } from '../../contexts/CurrencyContext'
import api               from '../../api/axios'
import toast             from 'react-hot-toast'
import { notifyRefresh } from '../../utils/notifyRefresh'
import { useProfilePhoto, setProfilePhoto, clearProfilePhoto, getProfilePhoto } from '../../utils/useProfilePhoto'

export default function AdminSettings() {
  const { user, updateUser } = useAuth()
  const { devise, setDevise, whatsapp, setWhatsapp } = useCurrency()
  const [savingDevise, setSavingDevise] = useState(false)
  const [whatsappInput, setWhatsappInput] = useState('')
  const [savingWhatsapp, setSavingWhatsapp] = useState(false)

  useEffect(() => { setWhatsappInput(whatsapp ?? '') }, [whatsapp])
  const email = user?.email ?? ''
  const photo = useProfilePhoto(email, user?.avatar)
  const fileRef = useRef<HTMLInputElement>(null)

  // Auto-sync: if photo is in localStorage but not yet in DB, push it silently
  useEffect(() => {
    if (!email || user?.avatar) return
    const local = getProfilePhoto(email)
    if (!local) return
    api.post('/profile/photo', { avatar: local })
      .then((r: { data: { avatar?: string } }) => {
        if (r.data?.avatar) updateUser({ avatar: r.data.avatar })
      })
      .catch(() => {})
  }, [email]) // eslint-disable-line react-hooks/exhaustive-deps

  const [nom, setNom]               = useState(user?.nom || '')
  const [entreprise, setEntreprise] = useState(user?.entreprise || '')
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd]         = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [notifEmail, setNotifEmail]       = useState<boolean>((user as any)?.notif_email ?? true)
  const [notifPlatform, setNotifPlatform] = useState<boolean>((user as any)?.notif_platform ?? true)
  const [saving, setSaving]   = useState(false)
  const [pwdError, setPwdError] = useState('')

  const [photoDialog, setPhotoDialog] = useState(false)
  const [preview, setPreview]         = useState<string | null>(null)

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      const res = await api.put('/profile', { nom, entreprise })
      updateUser({ nom: res.data.nom, entreprise: res.data.entreprise })
      notifyRefresh()
      toast.success('Profil mis à jour !')
    } catch {
      toast.error('Erreur lors de la mise à jour.')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    setPwdError('')
    if (newPwd !== confirmPwd) { setPwdError('Les mots de passe ne correspondent pas.'); return }
    if (newPwd.length < 8)     { setPwdError('Le mot de passe doit avoir au moins 8 caractères.'); return }
    setSaving(true)
    try {
      await api.put('/profile/password', {
        current_password: currentPwd,
        password: newPwd,
        password_confirmation: confirmPwd,
      })
      notifyRefresh()
      toast.success('Mot de passe modifié !')
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
    } catch (err: any) {
      setPwdError(err.response?.data?.message || 'Erreur lors du changement.')
    } finally {
      setSaving(false)
    }
  }

  const handleChangeDevise = async (code: string) => {
    setSavingDevise(true)
    try {
      await setDevise(code)
      notifyRefresh()
      toast.success('Devise mise à jour !')
    } catch {
      toast.error('Erreur lors de la mise à jour de la devise.')
    } finally {
      setSavingDevise(false)
    }
  }

  const handleSaveWhatsapp = async () => {
    setSavingWhatsapp(true)
    try {
      await setWhatsapp(whatsappInput.trim())
      notifyRefresh()
      toast.success('Numéro WhatsApp mis à jour !')
    } catch {
      toast.error('Erreur lors de la mise à jour du numéro WhatsApp.')
    } finally {
      setSavingWhatsapp(false)
    }
  }

  const handleSaveNotifications = async (notifMail: boolean, notifPlat: boolean) => {
    try {
      await api.put('/profile/notifications', { notif_email: notifMail, notif_platform: notifPlat })
      toast.success('Préférences de notifications sauvegardées')
    } catch {
      toast.error('Erreur lors de la sauvegarde')
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error('Image trop lourde (max 2 Mo)'); return }
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

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

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Box sx={{
          width: 48, height: 48, borderRadius: 2.5,
          background: 'linear-gradient(135deg,#1565C0,#0D47A1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <SettingsIcon sx={{ color: 'white', fontSize: 26 }} />
        </Box>
        <Box>
          <Typography variant="h5" fontWeight={800} color="#1a1a2e">Paramètres</Typography>
          <Typography color="text.secondary" fontSize={14}>Gérer votre compte administrateur</Typography>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* ── Profil ── */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                <SettingsIcon sx={{ color: '#1565C0' }} />
                <Typography fontWeight={700} fontSize={16}>Informations du profil</Typography>
              </Box>

              {/* Avatar + camera */}
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3, gap: 1 }}>
                <Box sx={{ position: 'relative', display: 'inline-block' }}>
                  <Avatar
                    src={photo ?? undefined}
                    sx={{ width: 90, height: 90, bgcolor: '#FF6F00', fontSize: 32, fontWeight: 700, border: '3px solid #FFE0B2' }}>
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
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<CameraAltIcon />}
                  sx={{ borderRadius: 2.5, fontWeight: 600, textTransform: 'none', fontSize: 12 }}
                  onClick={() => setPhotoDialog(true)}>
                  Changer la photo
                </Button>
              </Box>

              <TextField fullWidth label="Nom complet" value={nom}
                onChange={(e) => setNom(e.target.value)} sx={{ mb: 2 }} />
              <TextField fullWidth label="Entreprise" value={entreprise}
                onChange={(e) => setEntreprise(e.target.value)} sx={{ mb: 2 }}
                placeholder="Nom de votre société"
                InputProps={{ startAdornment: <InputAdornment position="start"><BusinessIcon sx={{ color: '#94A3B8', fontSize: 18 }} /></InputAdornment> }} />
              <TextField fullWidth label="Adresse email" value={email} disabled sx={{ mb: 3 }} />
              <Button fullWidth variant="contained" startIcon={<SaveIcon />}
                onClick={handleSaveProfile} disabled={saving}
                sx={{ py: 1.3, background: 'linear-gradient(135deg,#1565C0,#0D47A1)', fontWeight: 700 }}>
                Enregistrer
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* ── Mot de passe ── */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                <LockIcon sx={{ color: '#FF6F00' }} />
                <Typography fontWeight={700} fontSize={16}>Changer le mot de passe</Typography>
              </Box>
              {pwdError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{pwdError}</Alert>}
              <TextField fullWidth label="Mot de passe actuel" type="password"
                value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} sx={{ mb: 2 }} />
              <TextField fullWidth label="Nouveau mot de passe" type="password"
                value={newPwd} onChange={(e) => setNewPwd(e.target.value)} sx={{ mb: 2 }} />
              <TextField fullWidth label="Confirmer le nouveau" type="password"
                value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} sx={{ mb: 3 }} />
              <Button fullWidth variant="contained" startIcon={<LockIcon />}
                onClick={handleChangePassword} disabled={saving}
                sx={{ py: 1.3, background: 'linear-gradient(135deg,#FF6F00,#FF8F00)', fontWeight: 700 }}>
                Modifier le mot de passe
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* ── Devise ── */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <PaymentsIcon sx={{ color: '#2E7D32' }} />
                <Typography fontWeight={700} fontSize={16}>Devise</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Typography fontSize={13} color="text.secondary" mb={2}>
                Devise utilisée pour tous les montants affichés dans l'application (factures, relevés, exports Excel…).
              </Typography>
              <FormControl size="small" fullWidth disabled={savingDevise}>
                <InputLabel>Devise</InputLabel>
                <Select
                  value={devise}
                  label="Devise"
                  onChange={(e) => handleChangeDevise(e.target.value)}>
                  {CURRENCY_OPTIONS.map(opt => (
                    <MenuItem key={opt.code} value={opt.code}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </CardContent>
          </Card>
        </Grid>

        {/* ── WhatsApp support ── */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <WhatsAppIcon sx={{ color: '#25D366' }} />
                <Typography fontWeight={700} fontSize={16}>Support WhatsApp</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Typography fontSize={13} color="text.secondary" mb={2}>
                Numéro affiché sur le bouton WhatsApp flottant, visible par tous. Format international sans « + » ni espaces (ex : 21612345678).
              </Typography>
              <TextField
                fullWidth
                size="small"
                label="Numéro WhatsApp"
                placeholder="21612345678"
                value={whatsappInput}
                onChange={(e) => setWhatsappInput(e.target.value)}
                disabled={savingWhatsapp}
                sx={{ mb: 2 }}
              />
              <Button
                variant="contained"
                startIcon={savingWhatsapp ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                onClick={handleSaveWhatsapp}
                disabled={savingWhatsapp || whatsappInput.trim() === (whatsapp ?? '')}
                sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#1EBE5A' }, fontWeight: 700 }}>
                {savingWhatsapp ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* ── Notifications ── */}
        <Grid item xs={12}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <NotificationsIcon sx={{ color: '#1565C0' }} />
                <Typography fontWeight={700} fontSize={16}>Notifications</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <FormControlLabel
                control={<Switch checked={notifEmail} onChange={(e) => {
                  const val = e.target.checked
                  setNotifEmail(val)
                  handleSaveNotifications(val, notifPlatform)
                }} sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#1565C0' },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#1565C0' } }} />}
                label={<Box><Typography fontWeight={600} fontSize={14}>Notifications par email</Typography>
                  <Typography fontSize={12} color="text.secondary">Recevoir les alertes par email</Typography></Box>}
                sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }} />
              <FormControlLabel
                control={<Switch checked={notifPlatform} onChange={(e) => {
                  const val = e.target.checked
                  setNotifPlatform(val)
                  handleSaveNotifications(notifEmail, val)
                }} sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#1565C0' },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#1565C0' } }} />}
                label={<Box><Typography fontWeight={600} fontSize={14}>Notifications plateforme</Typography>
                  <Typography fontSize={12} color="text.secondary">Alertes dans l'interface</Typography></Box>}
                sx={{ display: 'flex', alignItems: 'flex-start' }} />
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
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2.5 }}>
            <Avatar
              src={preview ?? photo ?? undefined}
              sx={{
                width: 120, height: 120,
                bgcolor: '#FF6F00', fontSize: 44, fontWeight: 800,
                border: '4px solid #FFE0B2',
                boxShadow: '0 4px 20px rgba(255,111,0,0.25)',
              }}>
              {!(preview || photo) && initials}
            </Avatar>

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
