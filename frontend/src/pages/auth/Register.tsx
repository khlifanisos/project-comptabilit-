import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Box, Card, CardContent, Typography, TextField, Button,
  InputAdornment, IconButton, Alert, CircularProgress,
  ToggleButtonGroup, ToggleButton, Grid, Divider
} from '@mui/material'
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto'
import PersonIcon from '@mui/icons-material/Person'
import EmailIcon from '@mui/icons-material/Email'
import LockIcon from '@mui/icons-material/Lock'
import BusinessIcon from '@mui/icons-material/Business'
import PhoneIcon from '@mui/icons-material/Phone'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'
import VpnKeyIcon from '@mui/icons-material/VpnKey'
import BarChartIcon from '@mui/icons-material/BarChart'
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead'
import SmsIcon from '@mui/icons-material/Sms'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useAuth } from '../../contexts/AuthContext'
import { UserRole } from '../../types'
import api from '../../api/axios'
import toast from 'react-hot-toast'

const NAV_BG  = '#0A1628'
const PRIMARY = '#1565C0'
const ACCENT  = '#3B82F6'

export default function Register() {
  const navigate = useNavigate()
  const { register, loading } = useAuth()
  const [error, setError]         = useState('')
  const [emailError, setEmailError] = useState('')
  const [showPwd, setShowPwd]     = useState(false)
  const [role, setRole]           = useState<UserRole>('client')
  const [adminType, setAdminType] = useState<'admin' | 'super_admin'>('admin')
  const [superAdminCode, setSuperAdminCode] = useState('')
  const [step, setStep]           = useState<1 | 2>(1)
  const [sending, setSending]     = useState(false)
  const [verifyMethod, setVerifyMethod] = useState<'email' | 'sms'>('email')
  const [avatar, setAvatar]       = useState<string>('')
  const fileRef                   = useRef<HTMLInputElement>(null)
  const [digits, setDigits]       = useState<string[]>(['', '', '', '', '', ''])
  const [devCode, setDevCode]     = useState('')
  const digitRefs                 = useRef<Array<HTMLInputElement | null>>([null, null, null, null, null, null])
  const code                      = digits.join('')

  const handleDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = digit
    setDigits(next)
    if (digit && index < 5) digitRefs.current[index + 1]?.focus()
  }

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus()
    }
  }

  const handleDigitPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setDigits(pasted.split(''))
      digitRefs.current[5]?.focus()
    }
    e.preventDefault()
  }
  const [form, setForm] = useState({
    nom: '', email: '', password: '', password_confirmation: '',
    entreprise: '', telephone: '', adresse: '',
  })

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }))

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setAvatar(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setEmailError('')
    if (!form.nom || !form.email || !form.password || !form.password_confirmation) {
      setError('Veuillez remplir tous les champs obligatoires.')
      return
    }
    if (role === 'admin' && !form.entreprise.trim()) {
      setError("L'entreprise est obligatoire pour un compte administrateur.")
      return
    }
    if (role === 'admin' && adminType === 'super_admin' && !superAdminCode.trim()) {
      setError('Le code Super Admin est obligatoire pour ce type de compte.')
      return
    }
    if (role === 'client' && !form.adresse.trim()) {
      setError("L'adresse est obligatoire.")
      return
    }
    if (form.password !== form.password_confirmation) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    if (form.password.length < 8) {
      setError('Le mot de passe doit avoir au moins 8 caractères.')
      return
    }
    if (verifyMethod === 'sms' && !form.telephone.trim()) {
      setError('Entrez votre numéro de téléphone pour recevoir le code par SMS.')
      return
    }
    setSending(true)
    try {
      const payload: Record<string, string> = { email: form.email, method: verifyMethod }
      if (verifyMethod === 'sms') payload.telephone = form.telephone
      const res = await api.post('/auth/send-verification', payload)
      setDevCode('')
      const sent = verifyMethod === 'sms' ? res.data.sms_sent : res.data.email_sent
      if (!sent && res.data.code) {
        setDevCode(res.data.code)
      }
      setStep(2)
    } catch (err: any) {
      if (!err.response) {
        setError('Impossible de contacter le serveur. Vérifiez que le backend est démarré.')
      } else {
        const data = err.response?.data
        const emailErr = data?.errors?.email
        if (emailErr) setEmailError(Array.isArray(emailErr) ? emailErr[0] : emailErr)
        else setError(data?.message || `Erreur serveur (${err.response.status}).`)
      }
    } finally {
      setSending(false)
    }
  }

  const handleVerifyAndCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (code.length !== 6) { setError('Le code doit contenir 6 chiffres.'); return }
    try {
      await register({
        ...form, role, code, avatar: avatar || undefined,
        admin_type: role === 'admin' ? adminType : undefined,
        super_admin_code: role === 'admin' && adminType === 'super_admin' ? superAdminCode : undefined,
      })
      toast.success('Compte créé avec succès !')
      navigate(role === 'admin' ? '/admin/clients' : '/releves')
    } catch (err: any) {
      if (!err.response) {
        setError('Impossible de contacter le serveur.')
      } else {
        const data = err.response.data
        setError(data?.message || Object.values(data?.errors ?? {}).flat().join(' ') || 'Erreur lors de la création du compte.')
      }
    }
  }

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: NAV_BG,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      p: 2, position: 'relative', overflow: 'hidden',
    }}>
      {/* Subtle background glows */}
      <Box sx={{ position:'absolute', top:-150, right:-150, width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 65%)', pointerEvents:'none' }} />
      <Box sx={{ position:'absolute', bottom:-100, left:-100, width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 65%)', pointerEvents:'none' }} />

      <Box sx={{ width:'100%', maxWidth: 480, position:'relative', zIndex:1 }}>

        {/* Logo + title */}
        <Box sx={{ textAlign:'center', mb: 3.5 }}>
          <Box sx={{
            width: 46, height: 46, borderRadius: '12px',
            background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            mx: 'auto', mb: 2,
            boxShadow: '0 4px 16px rgba(59,130,246,0.4)',
          }}>
            <BarChartIcon sx={{ color: 'white', fontSize: 24 }} />
          </Box>
          <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em' }}>
            Créer un compte
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 12.5, mt: 0.4 }}>
            Intelligence Comptabilité
          </Typography>
        </Box>

        {/* Card */}
        <Card sx={{
          borderRadius: '16px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.06)',
          bgcolor: '#FFFFFF',
          overflow: 'hidden',
        }}>
          {/* Card header */}
          <Box sx={{
            bgcolor: NAV_BG,
            px: 3, py: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
          }}>
            <Typography sx={{ fontWeight: 700, color: 'white', fontSize: 15 }}>
              {step === 1 ? 'Inscription' : verifyMethod === 'sms' ? 'Vérification SMS' : 'Vérification email'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.6 }}>
              {[1, 2].map((s) => (
                <Box key={s} sx={{
                  width: s === step ? 20 : 6, height: 6,
                  borderRadius: '3px',
                  bgcolor: s === step ? ACCENT : 'rgba(255,255,255,0.2)',
                  transition: 'all 0.3s',
                }} />
              ))}
            </Box>
          </Box>

          <CardContent sx={{ p: 3.5 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2.5, borderRadius: '8px', fontSize: 13 }}>
                {error}
              </Alert>
            )}

            {/* ─── Step 1 ─── */}
            {step === 1 && (
              <>
                {/* Avatar picker */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    aria-label="Photo de profil"
                    style={{ display: 'none' }}
                    onChange={handleAvatarChange}
                  />
                  <Box
                    onClick={() => fileRef.current?.click()}
                    sx={{
                      width: 88, height: 88, borderRadius: '50%',
                      border: '2px dashed #CBD5E1',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', overflow: 'hidden', position: 'relative',
                      bgcolor: '#F8FAFC',
                      '&:hover': { borderColor: PRIMARY, bgcolor: '#EFF6FF' },
                      transition: 'all 0.2s',
                    }}>
                    {avatar
                      ? <Box component="img" src={avatar} alt="avatar" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <AddAPhotoIcon sx={{ fontSize: 28, color: '#94A3B8' }} />
                    }
                  </Box>
                  <Typography sx={{ fontSize: 11.5, color: '#94A3B8', mt: 1 }}>
                    Photo de profil <em>(optionnel)</em>
                  </Typography>
                  {avatar && (
                    <Typography
                      onClick={() => setAvatar('')}
                      sx={{ fontSize: 11, color: '#EF4444', cursor: 'pointer', mt: 0.3, '&:hover': { textDecoration: 'underline' } }}>
                      Supprimer
                    </Typography>
                  )}
                </Box>

                {/* Role selector */}
                <Box sx={{ mb: 3 }}>
                  <Typography sx={{ fontSize: 12, color: '#64748B', mb: 1, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Type de compte
                  </Typography>
                  <ToggleButtonGroup value={role} exclusive
                    onChange={(_, v) => v && setRole(v)} fullWidth
                    sx={{ gap: 1, '& .MuiToggleButtonGroup-grouped': { border: '1px solid rgba(0,0,0,0.1) !important', borderRadius: '8px !important', mx: '0 !important' } }}>
                    <ToggleButton value="client" sx={{
                      flex: 1, py: 1.2, fontSize: 13, fontWeight: 600, gap: 0.8,
                      color: '#64748B',
                      '&.Mui-selected': { bgcolor: '#EFF6FF', color: PRIMARY, borderColor: `${PRIMARY} !important` },
                    }}>
                      <PersonOutlineIcon sx={{ fontSize: 18 }} /> Client
                    </ToggleButton>
                    <ToggleButton value="admin" sx={{
                      flex: 1, py: 1.2, fontSize: 13, fontWeight: 600, gap: 0.8,
                      color: '#64748B',
                      '&.Mui-selected': { bgcolor: '#F0FDF4', color: '#16A34A', borderColor: '#16A34A !important' },
                    }}>
                      <AdminPanelSettingsIcon sx={{ fontSize: 18 }} /> Administrateur
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                {role === 'admin' && (
                  <Box sx={{ mb: 3 }}>
                    <Typography sx={{ fontSize: 12, color: '#64748B', mb: 1, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Niveau d'accès admin
                    </Typography>
                    <ToggleButtonGroup value={adminType} exclusive
                      onChange={(_, v) => v && setAdminType(v)} fullWidth
                      sx={{ gap: 1, '& .MuiToggleButtonGroup-grouped': { border: '1px solid rgba(0,0,0,0.1) !important', borderRadius: '8px !important', mx: '0 !important' } }}>
                      <ToggleButton value="admin" sx={{
                        flex: 1, py: 1.2, fontSize: 13, fontWeight: 600, gap: 0.8,
                        color: '#64748B',
                        '&.Mui-selected': { bgcolor: '#F0FDF4', color: '#16A34A', borderColor: '#16A34A !important' },
                      }}>
                        <AdminPanelSettingsIcon sx={{ fontSize: 18 }} /> Admin
                      </ToggleButton>
                      <ToggleButton value="super_admin" sx={{
                        flex: 1, py: 1.2, fontSize: 13, fontWeight: 600, gap: 0.8,
                        color: '#64748B',
                        '&.Mui-selected': { bgcolor: '#F5F3FF', color: '#6A1B9A', borderColor: '#6A1B9A !important' },
                      }}>
                        <VerifiedUserIcon sx={{ fontSize: 18 }} /> Super Admin
                      </ToggleButton>
                    </ToggleButtonGroup>
                    {adminType === 'super_admin' && (
                      <TextField fullWidth label="Code Super Admin" type="password" value={superAdminCode}
                        onChange={(e) => setSuperAdminCode(e.target.value)} required
                        sx={{ mt: 1.5 }}
                        helperText="Code fourni par l'administrateur de la plateforme."
                        InputProps={{ startAdornment: <InputAdornment position="start"><VpnKeyIcon sx={{ color: '#94A3B8', fontSize: 18 }} /></InputAdornment> }} />
                    )}
                  </Box>
                )}

                <Divider sx={{ mb: 3 }} />

                <form onSubmit={handleSendCode}>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField fullWidth label="Nom complet" value={form.nom} onChange={set('nom')} required
                        InputProps={{ startAdornment: <InputAdornment position="start"><PersonIcon sx={{ color: '#94A3B8', fontSize: 18 }} /></InputAdornment> }} />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField fullWidth label="Adresse email" type="email" value={form.email}
                        onChange={(e) => { setForm(p => ({ ...p, email: e.target.value })); setEmailError('') }}
                        error={!!emailError} helperText={emailError}
                        InputProps={{ startAdornment: <InputAdornment position="start"><EmailIcon sx={{ color: emailError ? '#DC2626' : '#94A3B8', fontSize: 18 }} /></InputAdornment> }} />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField fullWidth label={role === 'admin' ? 'Entreprise (obligatoire)' : 'Entreprise'} value={form.entreprise} onChange={set('entreprise')} required={role === 'admin'}
                        InputProps={{ startAdornment: <InputAdornment position="start"><BusinessIcon sx={{ color: '#94A3B8', fontSize: 18 }} /></InputAdornment> }} />
                    </Grid>
                    {role === 'client' && (
                      <>
                        <Grid item xs={12} sm={6}>
                          <TextField fullWidth label="Numéro de téléphone" value={form.telephone} onChange={set('telephone')}
                            InputProps={{ startAdornment: <InputAdornment position="start"><PhoneIcon sx={{ color: '#94A3B8', fontSize: 18 }} /></InputAdornment> }} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField fullWidth label="Adresse" value={form.adresse} onChange={set('adresse')} required
                            InputProps={{ startAdornment: <InputAdornment position="start"><LocationOnIcon sx={{ color: '#94A3B8', fontSize: 18 }} /></InputAdornment> }} />
                        </Grid>
                      </>
                    )}
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label="Mot de passe"
                        type={showPwd ? 'text' : 'password'} value={form.password} onChange={set('password')} required
                        InputProps={{
                          startAdornment: <InputAdornment position="start"><LockIcon sx={{ color: '#94A3B8', fontSize: 18 }} /></InputAdornment>,
                          endAdornment: <InputAdornment position="end">
                            <IconButton onClick={() => setShowPwd(!showPwd)} edge="end" size="small">
                              {showPwd ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                            </IconButton>
                          </InputAdornment>,
                        }} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label="Confirmer"
                        type={showPwd ? 'text' : 'password'} value={form.password_confirmation} onChange={set('password_confirmation')} required
                        InputProps={{ startAdornment: <InputAdornment position="start"><LockIcon sx={{ color: '#94A3B8', fontSize: 18 }} /></InputAdornment> }} />
                    </Grid>
                  </Grid>

                  {/* Verify method selector — SMS only available for clients with a phone */}
                  <Grid item xs={12}>
                    <Typography sx={{ fontSize: 12, color: '#64748B', mb: 1, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Recevoir le code par
                    </Typography>
                    <ToggleButtonGroup
                      value={verifyMethod} exclusive
                      onChange={(_, v) => v && setVerifyMethod(v)} fullWidth
                      sx={{ gap: 1, '& .MuiToggleButtonGroup-grouped': { border: '1px solid rgba(0,0,0,0.1) !important', borderRadius: '8px !important', mx: '0 !important' } }}
                    >
                      <ToggleButton value="email" sx={{
                        flex: 1, py: 1.1, fontSize: 13, fontWeight: 600, gap: 0.8, color: '#64748B',
                        '&.Mui-selected': { bgcolor: '#EFF6FF', color: PRIMARY, borderColor: `${PRIMARY} !important` },
                      }}>
                        <EmailIcon sx={{ fontSize: 17 }} /> Email
                      </ToggleButton>
                      <ToggleButton value="sms" disabled={role === 'admin'} sx={{
                        flex: 1, py: 1.1, fontSize: 13, fontWeight: 600, gap: 0.8, color: '#64748B',
                        '&.Mui-selected': { bgcolor: '#F0FDF4', color: '#16A34A', borderColor: '#16A34A !important' },
                      }}>
                        <SmsIcon sx={{ fontSize: 17 }} /> SMS
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Grid>

                  <Button fullWidth type="submit" variant="contained" size="large" disabled={sending}
                    sx={{
                      mt: 3, py: 1.4, fontSize: 14.5, fontWeight: 700, borderRadius: '10px',
                      background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)',
                      boxShadow: '0 4px 16px rgba(59,130,246,0.35)',
                      '&:hover': { background: 'linear-gradient(135deg,#60A5FA,#2563EB)', boxShadow: '0 6px 20px rgba(59,130,246,0.45)' },
                      transition: 'all 0.2s',
                    }}>
                    {sending ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Envoyer le code de vérification'}
                  </Button>
                </form>
              </>
            )}

            {/* ─── Step 2 ─── */}
            {step === 2 && (
              <form onSubmit={handleVerifyAndCreate}>
                <Box sx={{ textAlign: 'center', mb: 3.5 }}>
                  <Box sx={{
                    width: 60, height: 60, borderRadius: '14px',
                    background: verifyMethod === 'sms'
                      ? 'linear-gradient(135deg,#16A34A,#15803D)'
                      : 'linear-gradient(135deg,#3B82F6,#1D4ED8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    mx: 'auto', mb: 2,
                    boxShadow: verifyMethod === 'sms'
                      ? '0 4px 16px rgba(22,163,74,0.35)'
                      : '0 4px 16px rgba(59,130,246,0.35)',
                  }}>
                    {verifyMethod === 'sms'
                      ? <SmsIcon sx={{ color: 'white', fontSize: 28 }} />
                      : <MarkEmailReadIcon sx={{ color: 'white', fontSize: 28 }} />}
                  </Box>
                  <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#0F172A', mb: 0.5 }}>
                    {verifyMethod === 'sms' ? 'Vérifiez votre téléphone' : 'Vérifiez votre boîte email'}
                  </Typography>
                  <Typography sx={{ color: '#64748B', fontSize: 13 }}>
                    Code à 6 chiffres envoyé {verifyMethod === 'sms' ? 'au' : 'à'}{' '}
                    <Typography component="span" sx={{ color: '#0F172A', fontWeight: 700, fontSize: 'inherit' }}>
                      {verifyMethod === 'sms' ? form.telephone : form.email}
                    </Typography>
                  </Typography>
                </Box>

                {devCode && (
                  <Alert severity="warning" sx={{ mb: 2, borderRadius: '8px', fontSize: 13 }}>
                    {verifyMethod === 'sms' ? 'SMS non envoyé (Twilio non configuré).' : 'Email non envoyé (SMTP non configuré).'}{' '}
                    Votre code est : <strong>{devCode}</strong>
                  </Alert>
                )}

                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mb: 3 }}
                  onPaste={handleDigitPaste}>
                  {digits.map((d, i) => (
                    <TextField
                      key={i}
                      value={d}
                      onChange={(e) => handleDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handleDigitKeyDown(i, e as React.KeyboardEvent<HTMLInputElement>)}
                      inputRef={(el) => { digitRefs.current[i] = el }}
                      inputProps={{ maxLength: 1, inputMode: 'numeric', pattern: '[0-9]*' }}
                      sx={{
                        width: 52,
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '10px',
                          '&.Mui-focused fieldset': { borderColor: PRIMARY, borderWidth: 2 },
                        },
                        '& input': {
                          textAlign: 'center', fontSize: 26, fontWeight: 800,
                          fontFamily: 'monospace', p: '10px 0',
                        },
                      }}
                    />
                  ))}
                </Box>

                <Button fullWidth type="submit" variant="contained" size="large"
                  disabled={loading || code.length !== 6}
                  sx={{
                    py: 1.4, fontSize: 14.5, fontWeight: 700, borderRadius: '10px',
                    background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)',
                    boxShadow: '0 4px 16px rgba(59,130,246,0.35)',
                    '&:hover': { background: 'linear-gradient(135deg,#60A5FA,#2563EB)' },
                    transition: 'all 0.2s',
                    '&.Mui-disabled': { opacity: 0.5 },
                  }}>
                  {loading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Créer mon compte'}
                </Button>

                <Button fullWidth onClick={() => { setStep(1); setDigits(['', '', '', '', '', '']); setDevCode(''); setError('') }}
                  startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
                  sx={{ mt: 1.5, color: '#64748B', fontWeight: 600, fontSize: 13 }}>
                  Modifier mes informations
                </Button>

                <Typography sx={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', mt: 1.5 }}>
                  Pas reçu ?{' '}
                  <Typography component="span"
                    onClick={handleSendCode as any}
                    sx={{ color: PRIMARY, cursor: 'pointer', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}>
                    Renvoyer le code
                  </Typography>
                </Typography>
              </form>
            )}

            {/* Footer links */}
            <Divider sx={{ mt: 3, mb: 2.5 }} />
            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontSize: 13, color: '#64748B' }}>
                Déjà un compte ?{' '}
                <Typography component={Link} to="/login"
                  sx={{ color: PRIMARY, fontWeight: 700, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                  Se connecter
                </Typography>
              </Typography>
              <Typography component={Link} to="/"
                sx={{ display: 'block', mt: 1, color: '#94A3B8', fontSize: 12.5, textDecoration: 'none', '&:hover': { color: PRIMARY } }}>
                ← Retour à l'accueil
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  )
}