import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Box, CircularProgress, Typography } from '@mui/material'

// Landing page for a tab opened via "Se connecter en tant que ce client" —
// bootstraps this tab's own sessionStorage from the one-time token/user
// passed in the URL, then hands off to the normal client dashboard.
export default function ImpersonateEntry() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const token   = params.get('token')
    const userRaw = params.get('user')

    if (!token || !userRaw) { navigate('/login', { replace: true }); return }

    try {
      const user = JSON.parse(userRaw)
      sessionStorage.setItem('token', token)
      sessionStorage.setItem('user', JSON.stringify(user))
      sessionStorage.setItem('real_role', user.role ?? 'client')
      window.location.replace('/releves')
    } catch {
      navigate('/login', { replace: true })
    }
  }, [params, navigate])

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', gap: 2, bgcolor: '#F5F7FB',
    }}>
      <CircularProgress />
      <Typography color="text.secondary" fontSize={14}>Connexion en cours…</Typography>
    </Box>
  )
}
