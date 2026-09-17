import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Box, Card, CardContent, Typography, TextField, Button,
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
import toast from 'react-hot-toast'

const NAV_BG  = '#0A1628'
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
      await login(email, password, role)
      toast.success('Connexion réussie !')
      navigate(role === 'admin' ? '/admin/clients' : '/releves')
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
    <Box sx={{
      minHeight: '100vh',
      bgcolor: NAV_BG,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      px: 1.5,
      py: 3,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glows */}
      <Box sx={{ position:'absolute', top:-100, right:-100, width:360, height:360, borderRadius:'50%', background:'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 65%)', pointerEvents:'none' }} />
      <Box sx={{ position:'absolute', bottom:-80, left:-80, width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 65%)', pointerEvents:'none' }} />

      <Box sx={{ width:'100%', maxWidth: 425, position:'relative', zIndex:1 }}>

        {/* ── Logo ── */}
        <Box sx={{ textAlign:'center', mb: 2.5 }}>
          <Box sx={{
            width: 42, height: 42, borderRadius:'10px',
            background:'linear-gradient(135deg,#3B82F6,#1D4ED8)',
            display:'flex', alignItems:'center', justifyContent:'center',
            mx:'auto', mb: 1.5,
            boxShadow:'0 4px 14px rgba(59,130,246,0.4)',
          }}>
            <BarChartIcon sx={{ color:'white', fontSize: 22 }} />
          </Box>
          <Typography sx={{ color:'white', fontWeight:700, fontSize:18, letterSpacing:'-0.01em', lineHeight:1.2 }}>
            Intelligence Comptabilité
          </Typography>
          <Typography sx={{ color:'rgba(255,255,255,0.38)', fontSize:12, mt:0.4 }}>
            Connectez-vous à votre espace
          </Typography>
        </Box>

        {/* ── Card ── */}
        <Card sx={{
          borderRadius:'14px',
          boxShadow:'0 20px 50px rgba(0,0,0,0.55)',
          border:'1px solid rgba(255,255,255,0.06)',
          bgcolor:'#FFFFFF',
          overflow:'hidden',
        }}>
          {/* Card header */}
          <Box sx={{
            bgcolor: NAV_BG,
            px: 2.5, py: 1.6,
            borderBottom:'1px solid rgba(255,255,255,0.07)',
            display:'flex', alignItems:'center', justifyContent:'space-between',
          }}>
            <Typography sx={{ fontWeight:700, color:'white', fontSize:14 }}>
              Connexion
            </Typography>
            <Box sx={{
              px: 1.2, py: 0.4, borderRadius:'6px',
              bgcolor: isAdmin ? 'rgba(22,163,74,0.15)' : 'rgba(59,130,246,0.15)',
              border: `1px solid ${isAdmin ? 'rgba(22,163,74,0.3)' : 'rgba(59,130,246,0.3)'}`,
            }}>
              <Typography sx={{ fontSize:11, fontWeight:700, color: isAdmin ? '#4ADE80' : '#93C5FD' }}>
                {isAdmin ? 'Administrateur' : 'Client'}
              </Typography>
            </Box>
          </Box>

          <CardContent sx={{ p: 2.5, pb: '20px !important' }}>

            {/* Role selector */}
            <ToggleButtonGroup value={role} exclusive
              onChange={(_, v) => { if (v) { setRole(v); setEmailError(''); setGeneralError('') } }}
              fullWidth size="small"
              sx={{
                mb: 2.5,
                gap: 1,
                '& .MuiToggleButtonGroup-grouped': {
                  border:'1px solid rgba(0,0,0,0.1) !important',
                  borderRadius:'8px !important',
                  mx:'0 !important',
                },
              }}>
              <ToggleButton value="client" sx={{
                flex:1, py:1, px:1.5, gap:0.7,
                fontSize:13, fontWeight:600, color:'#64748B',
                transition:'all 0.15s',
                '&.Mui-selected': {
                  bgcolor:'#EFF6FF', color: PRIMARY,
                  borderColor:`${PRIMARY} !important`,
                  boxShadow:`inset 0 0 0 1px ${PRIMARY}`,
                },
              }}>
                <PersonOutlineIcon sx={{ fontSize:17, flexShrink:0 }} />
                <Box sx={{ textAlign:'left', minWidth:0 }}>
                  <Typography sx={{ fontSize:12.5, fontWeight:700, lineHeight:1, whiteSpace:'nowrap' }}>Client</Typography>
                  <Typography sx={{ fontSize:10, lineHeight:1.3, color:'inherit', opacity:0.65, whiteSpace:'nowrap' }}>Mon espace</Typography>
                </Box>
              </ToggleButton>

              <ToggleButton value="admin" sx={{
                flex:1, py:1, px:1.5, gap:0.7,
                fontSize:13, fontWeight:600, color:'#64748B',
                transition:'all 0.15s',
                '&.Mui-selected': {
                  bgcolor:'#F0FDF4', color:'#16A34A',
                  borderColor:'#16A34A !important',
                  boxShadow:'inset 0 0 0 1px #16A34A',
                },
              }}>
                <AdminPanelSettingsIcon sx={{ fontSize:17, flexShrink:0 }} />
                <Box sx={{ textAlign:'left', minWidth:0 }}>
                  <Typography sx={{ fontSize:12.5, fontWeight:700, lineHeight:1, whiteSpace:'nowrap' }}>Administrateur</Typography>
                  <Typography sx={{ fontSize:10, lineHeight:1.3, color:'inherit', opacity:0.65, whiteSpace:'nowrap' }}>Gestion globale</Typography>
                </Box>
              </ToggleButton>
            </ToggleButtonGroup>

            <Divider sx={{ mb: 2.5 }} />

            {generalError && (
              <Alert severity="error" sx={{ mb:2, borderRadius:'8px', fontSize:12.5, py:0.5 }}>
                {generalError}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth label="Adresse email" type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailError('') }}
                error={!!emailError} helperText={emailError}
                size="small"
                sx={{ mb: 1.8 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon sx={{ color: emailError ? '#DC2626' : '#94A3B8', fontSize:17 }} />
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
                size="small"
                sx={{ mb: 0.5 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon sx={{ color: passwordError ? '#DC2626' : '#94A3B8', fontSize:17 }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPwd(!showPwd)} edge="end" size="small">
                        {showPwd ? <VisibilityOff sx={{ fontSize:17 }} /> : <Visibility sx={{ fontSize:17 }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Box sx={{ textAlign:'right', mb: 2.5 }}>
                <Typography component={Link} to="/forgot-password"
                  sx={{ color: ACCENT, fontSize:12, fontWeight:600, textDecoration:'none', '&:hover': { textDecoration:'underline' } }}>
                  Mot de passe oublié ?
                </Typography>
              </Box>

              <Button fullWidth type="submit" variant="contained" disabled={loading}
                sx={{
                  py:1.25, fontSize:13.5, fontWeight:700, borderRadius:'9px',
                  background:'linear-gradient(135deg,#3B82F6,#1D4ED8)',
                  boxShadow:'0 3px 12px rgba(59,130,246,0.35)',
                  letterSpacing:'0.01em',
                  '&:hover': { background:'linear-gradient(135deg,#60A5FA,#2563EB)', boxShadow:'0 5px 18px rgba(59,130,246,0.45)' },
                  transition:'all 0.2s',
                }}>
                {loading
                  ? <CircularProgress size={18} sx={{ color:'white' }} />
                  : `Se connecter — ${isAdmin ? 'Admin' : 'Client'}`
                }
              </Button>
            </form>

            <Divider sx={{ my: 2 }}>
              <Typography sx={{ color:'#CBD5E1', fontSize:11 }}>ou</Typography>
            </Divider>

            <Box sx={{ textAlign:'center' }}>
              <Typography sx={{ fontSize:13, color:'#64748B' }}>
                Pas encore de compte ?{' '}
                <Typography component={Link} to="/register"
                  sx={{ color: PRIMARY, fontWeight:700, textDecoration:'none', '&:hover': { textDecoration:'underline' } }}>
                  Créer un compte
                </Typography>
              </Typography>
              <Typography component={Link} to="/"
                sx={{ display:'block', mt:0.8, color:'#94A3B8', fontSize:12, textDecoration:'none', '&:hover': { color: PRIMARY } }}>
                ← Retour à l'accueil
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* ── Demo accounts ── */}
        <Box sx={{
          mt: 2, p: 1.8, borderRadius:'10px',
          bgcolor:'rgba(255,255,255,0.04)',
          border:'1px solid rgba(255,255,255,0.07)',
        }}>
          <Typography sx={{ color:'rgba(255,255,255,0.45)', fontSize:10.5, fontWeight:700, mb:0.6, textTransform:'uppercase', letterSpacing:'0.07em' }}>
            Comptes de démonstration
          </Typography>
          <Typography sx={{ color:'rgba(255,255,255,0.35)', fontSize:11, lineHeight:1.7 }}>
            Admin : admin@comptabilite.ma / Admin123!
          </Typography>
          <Typography sx={{ color:'rgba(255,255,255,0.35)', fontSize:11, lineHeight:1.7 }}>
            Client : client@exemple.ma / Client123!
          </Typography>
        </Box>

      </Box>
    </Box>
  )
}