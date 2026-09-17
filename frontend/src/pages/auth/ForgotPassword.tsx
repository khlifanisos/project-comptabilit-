import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Typography, TextField, Button,
  InputAdornment, IconButton, Alert, CircularProgress, Divider,
  ToggleButtonGroup, ToggleButton,
} from '@mui/material'
import EmailIcon              from '@mui/icons-material/Email'
import LockIcon               from '@mui/icons-material/Lock'
import Visibility             from '@mui/icons-material/Visibility'
import VisibilityOff          from '@mui/icons-material/VisibilityOff'
import BarChartIcon           from '@mui/icons-material/BarChart'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import PersonOutlineIcon      from '@mui/icons-material/PersonOutline'
import MarkEmailReadIcon      from '@mui/icons-material/MarkEmailRead'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { UserRole }           from '../../types'
import api                    from '../../api/axios'
import toast                  from 'react-hot-toast'

type StepNum = 1 | 2 | 3

const NAV_BG  = '#0A1628'
const PRIMARY = '#1565C0'
const ACCENT  = '#3B82F6'

const STEPS = [
  { n: 1, label: 'Email' },
  { n: 2, label: 'Vérification' },
  { n: 3, label: 'Nouveau mot de passe' },
]

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [step, setStep]           = useState<StepNum>(1)
  const [role, setRole]           = useState<UserRole>('client')
  const [email, setEmail]         = useState('')
  const [code, setCode]           = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [password, setPassword]   = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPwd, setShowPwd]     = useState(false)
  const [loading, setLoading]     = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown]   = useState(0)
  const [error, setError]         = useState('')
  const [emailError, setEmailError]       = useState('')
  const [codeError, setCodeError]         = useState('')
  const [passwordError, setPasswordError] = useState('')


  React.useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const doSendCode = async () => {
    const res = await api.post('/auth/forgot-password', { email, role })
    setEmailSent(res.data.email_sent ?? false)
    setCooldown(60)
  }

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setEmailError('')
    if (!email) { setEmailError('Veuillez saisir votre adresse email.'); return }
    setLoading(true)
    try {
      await doSendCode()
      setStep(2)
    } catch (err: any) {
      const data = err.response?.data
      const emailErr = data?.errors?.email
      if (emailErr) setEmailError(Array.isArray(emailErr) ? emailErr[0] : emailErr)
      else if (!err.response) setError('Impossible de contacter le serveur.')
      else setError(data?.message || 'Erreur lors de l\'envoi du code.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (cooldown > 0 || resending) return
    setResending(true); setCodeError(''); setCode('')
    try {
      await doSendCode()
      toast.success(emailSent ? 'Code renvoyé par email !' : 'Nouveau code généré.')
    } catch {
      toast.error('Impossible de renvoyer le code.')
    } finally {
      setResending(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setCodeError('')
    if (code.length !== 6) { setCodeError('Le code doit contenir 6 chiffres.'); return }
    setStep(3)
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setPasswordError('')
    if (password.length < 8) { setPasswordError('Minimum 8 caractères.'); return }
    if (password !== passwordConfirm) { setPasswordError('Les mots de passe ne correspondent pas.'); return }
    setLoading(true)
    try {
      await api.post('/auth/reset-password', {
        email, role, code,
        password, password_confirmation: passwordConfirm,
      })
      toast.success('Mot de passe réinitialisé avec succès !')
      navigate('/login')
    } catch (err: any) {
      const data = err.response?.data
      const codeErr = data?.errors?.code
      if (codeErr) { setStep(2); setCodeError(Array.isArray(codeErr) ? codeErr[0] : codeErr) }
      else setError(data?.message || 'Erreur lors de la réinitialisation.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: NAV_BG,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      px: 1.5, py: 3,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background glows */}
      <Box sx={{ position: 'absolute', top: -100, right: -100, width: 360, height: 360, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 65%)', pointerEvents: 'none' }} />
      <Box sx={{ position: 'absolute', bottom: -80, left: -80, width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 65%)', pointerEvents: 'none' }} />

      <Box sx={{ width: '100%', maxWidth: 425, position: 'relative', zIndex: 1 }}>

        {/* ── Logo ── */}
        <Box sx={{ textAlign: 'center', mb: 2.5 }}>
          <Box sx={{
            width: 42, height: 42, borderRadius: '10px',
            background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            mx: 'auto', mb: 1.5,
            boxShadow: '0 4px 14px rgba(59,130,246,0.4)',
          }}>
            <BarChartIcon sx={{ color: 'white', fontSize: 22 }} />
          </Box>
          <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 18, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
            Intelligence Comptabilité
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.38)', fontSize: 12, mt: 0.4 }}>
            Réinitialisation du mot de passe
          </Typography>
        </Box>

        {/* ── Card ── */}
        <Card sx={{
          borderRadius: '14px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.55)',
          border: '1px solid rgba(255,255,255,0.06)',
          bgcolor: '#FFFFFF',
          overflow: 'hidden',
        }}>

          {/* Card header — step indicator */}
          <Box sx={{
            bgcolor: NAV_BG,
            px: 2.5, py: 1.6,
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <Typography sx={{ fontWeight: 700, color: 'white', fontSize: 14 }}>
              Mot de passe oublié
            </Typography>

            {/* Step pills */}
            <Box sx={{ display: 'flex', gap: 0.6, alignItems: 'center' }}>
              {STEPS.map(({ n, label }) => {
                const done    = n < step
                const active  = n === step
                const pending = n > step
                return (
                  <Box key={n} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{
                      width: 20, height: 20, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: done ? '#16A34A' : active ? ACCENT : 'rgba(255,255,255,0.12)',
                      fontSize: 10, fontWeight: 800, color: pending ? 'rgba(255,255,255,0.35)' : 'white',
                      transition: 'all 0.3s',
                      flexShrink: 0,
                    }}>
                      {done ? '✓' : n}
                    </Box>
                    {active && (
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap' }}>
                        {label}
                      </Typography>
                    )}
                    {n < STEPS.length && (
                      <Box sx={{ width: 14, height: 1, bgcolor: 'rgba(255,255,255,0.15)', mx: 0.3 }} />
                    )}
                  </Box>
                )
              })}
            </Box>
          </Box>

          <CardContent sx={{ p: 2.5, pb: '20px !important' }}>

            {error && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: 12.5, py: 0.5 }}>
                {error}
              </Alert>
            )}

            {/* ── Step 1: Email + role ── */}
            {step === 1 && (
              <>
                {/* Role selector */}
                <ToggleButtonGroup value={role} exclusive
                  onChange={(_, v) => { if (v) { setRole(v); setEmailError(''); setError('') } }}
                  fullWidth size="small"
                  sx={{
                    mb: 2.5, gap: 1,
                    '& .MuiToggleButtonGroup-grouped': {
                      border: '1px solid rgba(0,0,0,0.1) !important',
                      borderRadius: '8px !important',
                      mx: '0 !important',
                    },
                  }}>
                  <ToggleButton value="client" sx={{
                    flex: 1, py: 1, px: 1.5, gap: 0.7,
                    fontSize: 13, fontWeight: 600, color: '#64748B',
                    transition: 'all 0.15s',
                    '&.Mui-selected': {
                      bgcolor: '#EFF6FF', color: PRIMARY,
                      borderColor: `${PRIMARY} !important`,
                      boxShadow: `inset 0 0 0 1px ${PRIMARY}`,
                    },
                  }}>
                    <PersonOutlineIcon sx={{ fontSize: 17, flexShrink: 0 }} />
                    <Box sx={{ textAlign: 'left', minWidth: 0 }}>
                      <Typography sx={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap' }}>Client</Typography>
                      <Typography sx={{ fontSize: 10, lineHeight: 1.3, color: 'inherit', opacity: 0.65, whiteSpace: 'nowrap' }}>Mon espace</Typography>
                    </Box>
                  </ToggleButton>

                  <ToggleButton value="admin" sx={{
                    flex: 1, py: 1, px: 1.5, gap: 0.7,
                    fontSize: 13, fontWeight: 600, color: '#64748B',
                    transition: 'all 0.15s',
                    '&.Mui-selected': {
                      bgcolor: '#F0FDF4', color: '#16A34A',
                      borderColor: '#16A34A !important',
                      boxShadow: 'inset 0 0 0 1px #16A34A',
                    },
                  }}>
                    <AdminPanelSettingsIcon sx={{ fontSize: 17, flexShrink: 0 }} />
                    <Box sx={{ textAlign: 'left', minWidth: 0 }}>
                      <Typography sx={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap' }}>Administrateur</Typography>
                      <Typography sx={{ fontSize: 10, lineHeight: 1.3, color: 'inherit', opacity: 0.65, whiteSpace: 'nowrap' }}>Gestion globale</Typography>
                    </Box>
                  </ToggleButton>
                </ToggleButtonGroup>

                <Divider sx={{ mb: 2.5 }} />

                <form onSubmit={handleSendCode}>
                  <TextField
                    fullWidth label="Adresse email" type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setEmailError('') }}
                    error={!!emailError} helperText={emailError}
                    size="small" sx={{ mb: 2.5 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <EmailIcon sx={{ color: emailError ? '#DC2626' : '#94A3B8', fontSize: 17 }} />
                        </InputAdornment>
                      ),
                    }}
                  />

                  <Button fullWidth type="submit" variant="contained" disabled={loading}
                    sx={{
                      py: 1.25, fontSize: 13.5, fontWeight: 700, borderRadius: '9px',
                      background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)',
                      boxShadow: '0 3px 12px rgba(59,130,246,0.35)',
                      letterSpacing: '0.01em',
                      '&:hover': { background: 'linear-gradient(135deg,#60A5FA,#2563EB)', boxShadow: '0 5px 18px rgba(59,130,246,0.45)' },
                      transition: 'all 0.2s',
                    }}>
                    {loading ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Envoyer le code'}
                  </Button>
                </form>
              </>
            )}

            {/* ── Step 2: Verify code ── */}
            {step === 2 && (
              <form onSubmit={handleVerifyCode}>
                {/* Icon + title */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                  <Box sx={{
                    width: 40, height: 40, borderRadius: '10px', flexShrink: 0,
                    background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <MarkEmailReadIcon sx={{ color: 'white', fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>Code de vérification</Typography>
                    <Typography sx={{ fontSize: 12, color: '#64748B', mt: 0.3 }}>
                      Envoyé à{' '}
                      <Typography component="span" sx={{ color: PRIMARY, fontWeight: 700, fontSize: 'inherit' }}>{email}</Typography>
                    </Typography>
                  </Box>
                </Box>

                <Alert severity="info" sx={{ mb: 2, borderRadius: '8px', fontSize: 12.5, py: 0.5 }}>
                  Vérifiez votre boîte de réception (et les spams).
                </Alert>

                <TextField
                  fullWidth label="Code à 6 chiffres"
                  value={code}
                  onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setCodeError('') }}
                  error={!!codeError} helperText={codeError}
                  size="small"
                  inputProps={{
                    maxLength: 6, inputMode: 'numeric', pattern: '[0-9]*',
                    style: { textAlign: 'center', fontSize: 28, fontWeight: 900, letterSpacing: 12, fontFamily: 'monospace' },
                  }}
                  placeholder="000000"
                  sx={{ mb: 2 }}
                />

                <Button fullWidth type="submit" variant="contained"
                  disabled={code.length !== 6}
                  sx={{
                    py: 1.25, fontSize: 13.5, fontWeight: 700, borderRadius: '9px',
                    background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)',
                    boxShadow: '0 3px 12px rgba(59,130,246,0.35)',
                    '&:hover': { background: 'linear-gradient(135deg,#60A5FA,#2563EB)' },
                    transition: 'all 0.2s',
                  }}>
                  Valider le code
                </Button>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5 }}>
                  <Button size="small" onClick={() => { setStep(1); setCode('') }}
                    sx={{ color: '#64748B', fontSize: 12, fontWeight: 600, textTransform: 'none', p: 0 }}>
                    ← Changer l'email
                  </Button>
                  <Typography sx={{ fontSize: 12, color: '#64748B' }}>
                    Pas reçu ?{' '}
                    {cooldown > 0 ? (
                      <Typography component="span" sx={{ color: '#94A3B8', fontWeight: 600 }}>
                        Renvoyer dans {cooldown}s
                      </Typography>
                    ) : (
                      <Typography component="span"
                        onClick={handleResend}
                        sx={{ color: resending ? '#94A3B8' : ACCENT, cursor: resending ? 'default' : 'pointer', fontWeight: 700 }}>
                        {resending ? <CircularProgress size={10} sx={{ mr: 0.4 }} /> : null}
                        Renvoyer
                      </Typography>
                    )}
                  </Typography>
                </Box>
              </form>
            )}

            {/* ── Step 3: New password ── */}
            {step === 3 && (
              <form onSubmit={handleReset}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                  <Box sx={{
                    width: 40, height: 40, borderRadius: '10px', flexShrink: 0,
                    background: 'linear-gradient(135deg,#16A34A,#15803D)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CheckCircleOutlineIcon sx={{ color: 'white', fontSize: 22 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>Nouveau mot de passe</Typography>
                    <Typography sx={{ fontSize: 12, color: '#64748B', mt: 0.3 }}>
                      Choisissez un mot de passe sécurisé (min. 8 caractères)
                    </Typography>
                  </Box>
                </Box>

                <TextField
                  fullWidth label="Nouveau mot de passe"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPasswordError('') }}
                  error={!!passwordError}
                  size="small" sx={{ mb: 1.8 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon sx={{ color: passwordError ? '#DC2626' : '#94A3B8', fontSize: 17 }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPwd(!showPwd)} edge="end" size="small">
                          {showPwd ? <VisibilityOff sx={{ fontSize: 17 }} /> : <Visibility sx={{ fontSize: 17 }} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  fullWidth label="Confirmer le mot de passe"
                  type={showPwd ? 'text' : 'password'}
                  value={passwordConfirm}
                  onChange={(e) => { setPasswordConfirm(e.target.value); setPasswordError('') }}
                  error={!!passwordError} helperText={passwordError}
                  size="small" sx={{ mb: 2.5 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon sx={{ color: passwordError ? '#DC2626' : '#94A3B8', fontSize: 17 }} />
                      </InputAdornment>
                    ),
                  }}
                />

                <Button fullWidth type="submit" variant="contained" disabled={loading}
                  sx={{
                    py: 1.25, fontSize: 13.5, fontWeight: 700, borderRadius: '9px',
                    background: 'linear-gradient(135deg,#16A34A,#15803D)',
                    boxShadow: '0 3px 12px rgba(22,163,74,0.35)',
                    '&:hover': { background: 'linear-gradient(135deg,#22C55E,#16A34A)', boxShadow: '0 5px 18px rgba(22,163,74,0.45)' },
                    transition: 'all 0.2s',
                  }}>
                  {loading
                    ? <CircularProgress size={18} sx={{ color: 'white' }} />
                    : 'Réinitialiser le mot de passe'
                  }
                </Button>
              </form>
            )}

            <Divider sx={{ my: 2 }} />

            <Box sx={{ textAlign: 'center' }}>
              <Typography component={Link} to="/login"
                sx={{ color: '#64748B', fontSize: 13, fontWeight: 600, textDecoration: 'none', '&:hover': { color: PRIMARY } }}>
                ← Retour à la connexion
              </Typography>
            </Box>

          </CardContent>
        </Card>
      </Box>
    </Box>
  )
}