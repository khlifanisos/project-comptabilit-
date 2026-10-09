import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Box, Typography, TextField, Button,
  InputAdornment, IconButton, Divider, Alert, CircularProgress,
  ToggleButtonGroup, ToggleButton
} from '@mui/material'
import EmailIcon from '@mui/icons-material/Email'
import LockIcon from '@mui/icons-material/Lock'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import BarChartIcon from '@mui/icons-material/BarChart'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import { useAuth } from '../../contexts/AuthContext'
import { UserRole } from '../../types'
import AuthVisualPanel from '../../components/auth/AuthVisualPanel'
import toast from 'react-hot-toast'

const PRIMARY = '#1565C0'
const ACCENT  = '#3B82F6'

export default function Login() {
  const navigate = useNavigate()
  const { login, loading } = useAuth()
  const [role, setRole]                   = useState<UserRole>('client')
  const [email, setEmail]                 = useState('')
  const [password, setPassword]           = useState('')
  const [showPwd, setShowPwd]             = useState(false)
  const [emailError, setEmailError]       = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [generalError, setGeneralError]   = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailError(''); setPasswordError(''); setGeneralError('')
    if (!email)    { setEmailError('Veuillez saisir votre adresse email.'); return }
    if (!password) { setPasswordError('Veuillez saisir votre mot de passe.'); return }
    try {
      const actualRole = await login(email, password, role)
      toast.success('Connexion réussie !')
      navigate(actualRole === 'admin' ? '/admin/clients' : '/releves')
    } catch (err: any) {
      if (!err.response) { setGeneralError('Impossible de contacter le serveur.'); return }
      const errors = err.response?.data?.errors || {}
      const msg    = err.response?.data?.message || ''
      if (errors.email)         setEmailError(Array.isArray(errors.email) ? errors.email[0] : errors.email)
      else if (errors.password) setPasswordError(Array.isArray(errors.password) ? errors.password[0] : errors.password)
      else if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('mot de passe')) setPasswordError(msg)
      else if (msg.toLowerCase().includes('email') || msg.toLowerCase().includes('compte')) setEmailError(msg)
      else setGeneralError(msg || 'Email ou mot de passe incorrect.')
    }
  }

  const isAdmin = role === 'admin'

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: '#F8FAFC' }}>
      <AuthVisualPanel order={2} />

      <Box sx={{
        order: 1,
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        px: 2.5, py: 5, position: 'relative', overflow: 'hidden',
      }}>
        {/* Subtle mobile-only background glow (visual panel is hidden below md) */}
        <Box sx={{
          display: { xs: 'block', md: 'none' },
          position: 'absolute', top: -120, right: -100, width: 320, height: 320, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 65%)', pointerEvents: 'none',
        }} />

        <Box sx={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}>

          <Box className="reveal-up is-visible" sx={{ mb: 4, display: { xs: 'block', md: 'none' } }}>
            <Box sx={{
              width: 42, height: 42, borderRadius: '10px',
              background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1.5,
            }}>
              <BarChartIcon sx={{ color: 'white', fontSize: 22 }} />
            </Box>
          </Box>

          <Box className="reveal-up is-visible" sx={{ mb: 4 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 24, color: '#0F172A', letterSpacing: '-0.015em', mb: 0.6 }}>
              Bon retour !
            </Typography>
            <Typography sx={{ color: '#64748B', fontSize: 14 }}>
              Connectez-vous à votre espace {isAdmin ? 'administrateur' : 'client'}.
            </Typography>
          </Box>

          <Box className="reveal-up is-visible" style={{ animationDelay: '60ms' }}>
            <ToggleButtonGroup value={role} exclusive
              onChange={(_, v) => { if (v) { setRole(v); setEmailError(''); setGeneralError('') } }}
              fullWidth size="small"
              sx={{
                mb: 3.5, gap: 1,
                '& .MuiToggleButtonGroup-grouped': {
                  border: '1px solid #E2E8F0 !important',
                  borderRadius: '10px !important',
                  mx: '0 !important',
                },
              }}>
              <ToggleButton value="client" sx={{
                flex: 1, py: 1.1, px: 1.5, gap: 0.7,
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
                flex: 1, py: 1.1, px: 1.5, gap: 0.7,
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
          </Box>

          {generalError && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: '10px', fontSize: 12.5 }}>
              {generalError}
            </Alert>
          )}

          <Box className="reveal-up is-visible" style={{ animationDelay: '120ms' }} component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth label="Adresse email" type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError('') }}
              error={!!emailError} helperText={emailError}
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '10px',
                  bgcolor: 'white',
                  transition: 'box-shadow 0.2s',
                  '&.Mui-focused': { boxShadow: `0 0 0 4px ${ACCENT}1A` },
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon sx={{ color: emailError ? '#DC2626' : '#94A3B8', fontSize: 18 }} />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth label="Mot de passe"
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPasswordError('') }}
              error={!!passwordError} helperText={passwordError}
              sx={{
                mb: 1,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '10px',
                  bgcolor: 'white',
                  transition: 'box-shadow 0.2s',
                  '&.Mui-focused': { boxShadow: `0 0 0 4px ${ACCENT}1A` },
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon sx={{ color: passwordError ? '#DC2626' : '#94A3B8', fontSize: 18 }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPwd(!showPwd)} edge="end" size="small">
                      {showPwd ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Box sx={{ textAlign: 'right', mb: 3 }}>
              <Typography component={Link} to="/forgot-password"
                sx={{ color: ACCENT, fontSize: 12.5, fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                Mot de passe oublié ?
              </Typography>
            </Box>

            <Button fullWidth type="submit" variant="contained" disabled={loading}
              sx={{
                py: 1.35, fontSize: 14, fontWeight: 700, borderRadius: '10px',
                background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)',
                boxShadow: '0 4px 16px rgba(59,130,246,0.35)',
                letterSpacing: '0.01em',
                '&:hover': { background: 'linear-gradient(135deg,#60A5FA,#2563EB)', boxShadow: '0 6px 20px rgba(59,130,246,0.45)', transform: 'translateY(-1px)' },
                transition: 'all 0.2s',
              }}>
              {loading
                ? <CircularProgress size={18} sx={{ color: 'white' }} />
                : `Se connecter — ${isAdmin ? 'Admin' : 'Client'}`
              }
            </Button>
          </Box>

          <Divider className="reveal-up is-visible" style={{ animationDelay: '160ms' }} sx={{ my: 3 }}>
            <Typography sx={{ color: '#CBD5E1', fontSize: 11 }}>ou</Typography>
          </Divider>

          <Box className="reveal-up is-visible" style={{ animationDelay: '200ms' }} sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: 13.5, color: '#64748B' }}>
              Pas encore de compte ?{' '}
              <Typography component={Link} to="/register"
                sx={{ color: PRIMARY, fontWeight: 700, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                Créer un compte
              </Typography>
            </Typography>
            <Typography component={Link} to="/"
              sx={{ display: 'block', mt: 1, color: '#94A3B8', fontSize: 12.5, textDecoration: 'none', '&:hover': { color: PRIMARY } }}>
              ← Retour à l'accueil
            </Typography>
          </Box>

          <Box className="reveal-up is-visible" style={{ animationDelay: '240ms' }} sx={{
            mt: 3, p: 1.8, borderRadius: '10px',
            bgcolor: '#F8FAFC',
            border: '1px solid #E2E8F0',
          }}>
            <Typography sx={{ color: '#94A3B8', fontSize: 10.5, fontWeight: 700, mb: 0.6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Comptes de démonstration
            </Typography>
            <Typography sx={{ color: '#64748B', fontSize: 11, lineHeight: 1.7 }}>
              Admin : admin@comptabilite.ma / Admin123!
            </Typography>
            <Typography sx={{ color: '#64748B', fontSize: 11, lineHeight: 1.7 }}>
              Client : client@exemple.ma / Client123!
            </Typography>
          </Box>

        </Box>
      </Box>
    </Box>
  )
}
