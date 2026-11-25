import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, CircularProgress, Typography } from '@mui/material'

// Landing page for a tab opened via "Se connecter en tant que ce client" —
// bootstraps this tab's own sessionStorage from the one-time token/user,
// then hands off to the normal client dashboard.
// They travel in the URL fragment (#token=…), which browsers never send to the
// server, so the token can't end up in server or proxy access logs.
export default function ImpersonateEntry() {
  const navigate = useNavigate()

  useEffect(() => {
    const params  = new URLSearchParams(window.location.hash.slice(1))
    const token   = params.get('token')
    const userRaw = params.get('user')

    if (!token || !userRaw) { navigate('/login', { replace: true }); return }

    try {
      const user = JSON.parse(userRaw)
      sessionStorage.setItem('token', token)
      sessionStorage.setItem('user', JSON.stringify(user))
      sessionStorage.setItem('real_role', user.role ?? 'client')
      // replace() also drops this URL (and its token) from the tab's history.
      window.location.replace('/releves')
    } catch {
      navigate('/login', { replace: true })
    }
  }, [navigate])

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
