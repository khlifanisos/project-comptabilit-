import { useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, Box, Typography,
  Card, CardActionArea, CardContent, Avatar, Chip, IconButton,
  TextField, InputAdornment, CircularProgress, Tooltip,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import SearchIcon from '@mui/icons-material/Search'
import LoginIcon from '@mui/icons-material/Login'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import { useAuth } from '../../contexts/AuthContext'

interface ClientOption {
  id: number
  nom: string
  email: string
  entreprise: string | null
  avatar?: string | null
  is_actif: number | boolean
}

export default function RoleSwitcherModal() {
  const [open, setOpen]     = useState(false)
  const [picker, setPicker] = useState(false)
  const { user } = useAuth()
  const realRole = sessionStorage.getItem('real_role') || user?.role

  const [clients, setClients]           = useState<ClientOption[]>([])
  const [loadingClients, setLoadingClients] = useState(false)
  const [search, setSearch]             = useState('')
  const [impersonatingId, setImpersonatingId] = useState<number | null>(null)

  // Les clients ne peuvent pas accéder au mode admin
  if (realRole === 'client') return null

  const closeDialog = () => { setOpen(false); setPicker(false); setSearch('') }

  const openPicker = () => {
    setPicker(true)
    if (clients.length === 0) {
      setLoadingClients(true)
      api.get('/admin/clients')
        .then((r: { data: ClientOption[] }) => setClients(r.data))
        .catch(() => toast.error('Impossible de charger les clients.'))
        .finally(() => setLoadingClients(false))
    }
  }

  const handleImpersonate = async (c: ClientOption) => {
    setImpersonatingId(c.id)
    try {
      const res = await api.post(`/admin/clients/${c.id}/impersonate`)
      const url = `/impersonate?token=${encodeURIComponent(res.data.token)}&user=${encodeURIComponent(JSON.stringify(res.data.user))}`
      window.open(url, '_blank', 'noopener')
      closeDialog()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Impossible de se connecter en tant que ce client.')
    } finally {
      setImpersonatingId(null)
    }
  }

  const filtered = clients.filter(c =>
    c.nom.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <Box
        onClick={() => setOpen(true)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 0.8,
          borderRadius: 20, bgcolor: 'rgba(255,255,255,0.18)', cursor: 'pointer',
          border: '1px solid rgba(255,255,255,0.3)',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.28)' },
          transition: 'all 0.2s',
        }}>
        <SwapHorizIcon sx={{ color: 'white', fontSize: 18 }} />
        <Typography sx={{ color: 'white', fontSize: 13, fontWeight: 600 }}>Admin</Typography>
        <Chip label="ADMIN" size="small"
          sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: '#FF6F00', color: 'white' }} />
      </Box>

      <Dialog open={open} onClose={closeDialog} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 4, overflow: 'hidden' } }}>
        <DialogTitle sx={{
          background: 'linear-gradient(135deg,#1565C0,#0D47A1)',
          color: 'white', fontWeight: 700, fontSize: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <Box display="flex" alignItems="center" gap={1}>
            {picker && (
              <IconButton onClick={() => setPicker(false)} sx={{ color: 'white' }}>
                <ArrowBackIcon />
              </IconButton>
            )}
            <SwapHorizIcon /> {picker ? 'Se connecter en tant que…' : 'Changer de profil'}
          </Box>
          <IconButton onClick={closeDialog} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        {!picker ? (
          <DialogContent sx={{ py: 4, px: 3 }}>
            <Typography color="text.secondary" textAlign="center" mb={3}>
              Sélectionnez le type de compte à utiliser
            </Typography>

            <Box display="flex" gap={2}>
              <Card sx={{
                flex: 1, border: '2px solid #1565C0',
                borderRadius: 3, transition: 'all 0.2s',
                '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 24px rgba(21,101,192,0.2)' },
              }}>
                <CardActionArea onClick={closeDialog} sx={{ p: 3 }}>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Avatar sx={{ bgcolor: '#1565C0', width: 64, height: 64, mx: 'auto', mb: 2 }}>
                      <AdminPanelSettingsIcon sx={{ fontSize: 36 }} />
                    </Avatar>
                    <Typography fontWeight={700} fontSize={16}>Administrateur</Typography>
                    <Typography color="text.secondary" fontSize={12} mt={0.5}>
                      Accès complet — gestion globale
                    </Typography>
                    <Chip label="Actif" size="small" color="primary" sx={{ mt: 1 }} />
                  </CardContent>
                </CardActionArea>
              </Card>

              <Card sx={{
                flex: 1, border: '2px solid transparent',
                borderRadius: 3, transition: 'all 0.2s',
                '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 24px rgba(0,172,193,0.2)' },
              }}>
                <CardActionArea onClick={openPicker} sx={{ p: 3 }}>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Avatar sx={{ bgcolor: '#00ACC1', width: 64, height: 64, mx: 'auto', mb: 2 }}>
                      <PersonOutlineIcon sx={{ fontSize: 36 }} />
                    </Avatar>
                    <Typography fontWeight={700} fontSize={16}>Client</Typography>
                    <Typography color="text.secondary" fontSize={12} mt={0.5}>
                      Accéder à l'espace d'un client
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Box>
          </DialogContent>
        ) : (
          <DialogContent sx={{ py: 3, px: 3 }}>
            <TextField
              placeholder="Rechercher un client…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              fullWidth
              sx={{ mb: 2 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />

            {loadingClients ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>
            ) : filtered.length === 0 ? (
              <Typography color="text.secondary" textAlign="center" py={4} fontSize={14}>
                {search ? 'Aucun résultat.' : 'Aucun client enregistré.'}
              </Typography>
            ) : (
              <Box sx={{ maxHeight: 360, overflowY: 'auto' }}>
                {filtered.map(c => (
                  <Box key={c.id} sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    px: 1.5, py: 1, borderRadius: 2,
                    '&:hover': { bgcolor: '#F5F9FF' },
                    borderBottom: '1px solid #F0F4F8',
                  }}>
                    <Avatar src={c.avatar ?? undefined} sx={{ width: 36, height: 36, bgcolor: '#00ACC1', fontSize: 14, fontWeight: 700 }}>
                      {!c.avatar && c.nom.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography fontWeight={700} fontSize={13.5} noWrap>{c.nom}</Typography>
                      <Typography fontSize={12} color="text.secondary" noWrap>{c.email}</Typography>
                    </Box>
                    {!c.is_actif && (
                      <Chip label="Inactif" size="small" sx={{ bgcolor: '#F5F5F5', color: '#757575', fontWeight: 700, fontSize: 10 }} />
                    )}
                    <Tooltip title="Se connecter en tant que ce client">
                      <span>
                        <IconButton size="small" sx={{ color: '#7B1FA2' }}
                          disabled={impersonatingId === c.id}
                          onClick={() => handleImpersonate(c)}>
                          {impersonatingId === c.id
                            ? <CircularProgress size={16} />
                            : <LoginIcon fontSize="small" />}
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                ))}
              </Box>
            )}
          </DialogContent>
        )}
      </Dialog>
    </>
  )
}
