import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Card, CardContent, Grid, Chip, Avatar, Button, CircularProgress, useTheme
} from '@mui/material'
import PeopleIcon from '@mui/icons-material/People'
import FolderIcon from '@mui/icons-material/Folder'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import StatCard from '../../components/common/StatCard'
import Reveal from '../../components/common/Reveal'
import { useAuth } from '../../contexts/AuthContext'
import { useCurrency } from '../../contexts/CurrencyContext'
import api from '../../api/axios'
import toast from 'react-hot-toast'

const chartData = [
  { mois: 'Jan', clients: 4, documents: 28 },
  { mois: 'Fév', clients: 7, documents: 45 },
  { mois: 'Mar', clients: 5, documents: 38 },
  { mois: 'Avr', clients: 12, documents: 72 },
  { mois: 'Mai', clients: 9, documents: 61 },
  { mois: 'Jun', clients: 15, documents: 95 },
]

interface PendingClient {
  id: number
  nom: string
  email: string
  entreprise: string | null
  created_at: string
  avatar: string | null
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const { devise } = useCurrency()
  const navigate = useNavigate()
  const theme     = useTheme()
  const isDark    = theme.palette.mode === 'dark'
  const axisColor = theme.palette.text.secondary
  const gridColor = theme.palette.divider
  const [pending, setPending]         = useState<PendingClient[]>([])
  const [loadingPending, setLoadingPending] = useState(true)
  const [actioning, setActioning]     = useState<number | null>(null)
  const [acceptedIds, setAcceptedIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    api.get('/admin/clients/pending')
      .then(r => setPending(r.data))
      .catch(() => {})
      .finally(() => setLoadingPending(false))
  }, [])

  const handleApprove = async (id: number, email: string, nom: string) => {
    setActioning(id)
    try {
      await api.post(`/admin/clients/${id}/approve`)
      // Show green "Accepté" state on the card for 1.5 s, then remove it
      setAcceptedIds(prev => new Set(prev).add(id))
      setTimeout(() => {
        setPending(prev => prev.filter(c => c.id !== id))
        setAcceptedIds(prev => { const s = new Set(prev); s.delete(id); return s })
        navigate('/admin/clients')
      }, 1500)
      toast.success(`${nom} ajouté aux clients. Email de confirmation envoyé à ${email}.`, { duration: 5000 })
    } catch {
      toast.error('Erreur lors de l\'approbation')
    } finally {
      setActioning(null)
    }
  }

  const handleReject = async (id: number, nom: string) => {
    if (!window.confirm(`Rejeter la demande de ${nom} ? Un email lui sera envoyé.`)) return
    setActioning(id)
    try {
      await api.delete(`/admin/clients/${id}`)
      setPending(prev => prev.filter(c => c.id !== id))
      toast.success(`Demande de ${nom} rejetée. Email envoyé.`)
    } catch {
      toast.error('Erreur lors du rejet')
    } finally {
      setActioning(null)
    }
  }

  return (
    <Box className="fade-in">
      <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{
            width: { xs: 40, md: 48 }, height: { xs: 40, md: 48 }, borderRadius: 2.5,
            background: 'linear-gradient(135deg,#FF6F00,#FF8F00)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <AdminPanelSettingsIcon sx={{ color: 'white', fontSize: { xs: 22, md: 26 } }} />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={800} color="text.primary" fontSize={{ xs: 17, md: 22 }}>
              Console d'administration
            </Typography>
            <Typography color="text.secondary" fontSize={13}>
              Bienvenue, {user?.nom} — Vue globale
            </Typography>
          </Box>
        </Box>
        {user?.is_super_admin && (
          <Chip label="SUPER ADMIN" sx={{ bgcolor: '#FF6F00', color: 'white', fontWeight: 800, fontSize: 11 }} />
        )}
      </Box>

      <Grid container spacing={2.5} mb={3}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard delay={0} title="Clients totaux" value="52" icon={<PeopleIcon />} color="#1565C0" trend={15} subtitle="Ce mois" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard delay={70} title="Documents traités" value="339" icon={<FolderIcon />} color="#FF6F00" trend={22} subtitle="Ce mois" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard delay={140} title="Factures totales" value="1 248" icon={<ReceiptLongIcon />} color="#2E7D32" trend={18} subtitle="Ce mois" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard delay={210} title="Volume financier" value={`4,8M ${devise}`} icon={<TrendingUpIcon />} color="#7B1FA2" trend={31} subtitle="Ce mois" />
        </Grid>
      </Grid>

      <Grid container spacing={2.5} mb={3}>
        <Grid item xs={12} lg={8}>
          <Reveal observe={false} delay={100}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography fontWeight={700} fontSize={16} mb={3}>Activité mensuelle</Typography>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="mois" tick={{ fontSize: 12, fill: axisColor }} />
                  <YAxis tick={{ fontSize: 12, fill: axisColor }} />
                  <Tooltip contentStyle={{ background: theme.palette.background.paper, border: `1px solid ${gridColor}`, borderRadius: 8, color: theme.palette.text.primary }} />
                  <Legend wrapperStyle={{ color: axisColor }} />
                  <Bar dataKey="clients" name="Nouveaux clients" fill="#1565C0" radius={[4, 4, 0, 0]} animationDuration={900} animationEasing="ease-out" />
                  <Bar dataKey="documents" name="Documents" fill="#FF6F00" radius={[4, 4, 0, 0]} animationDuration={900} animationEasing="ease-out" animationBegin={150} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          </Reveal>
        </Grid>
        <Grid item xs={12} lg={4}>
          <Reveal observe={false} delay={180}>
          <Card sx={{ borderRadius: 3, height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography fontWeight={700} fontSize={16} mb={2.5}>Répartition des modules</Typography>
              {[
                { label: 'Factures ventes', count: 485, color: '#1565C0' },
                { label: 'Factures achats', count: 392, color: '#FF6F00' },
                { label: 'Déclarations fiscales', count: 218, color: '#2E7D32' },
                { label: 'Relevés bancaires', count: 153, color: '#7B1FA2' },
              ].map((item) => (
                <Box key={item.label} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography fontSize={13} fontWeight={600}>{item.label}</Typography>
                    <Typography fontSize={13} fontWeight={700} color={item.color}>{item.count}</Typography>
                  </Box>
                  <Box sx={{ height: 6, borderRadius: 3, bgcolor: isDark ? 'rgba(255,255,255,0.08)' : '#f0f2f5', overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', width: `${(item.count / 500) * 100}%`,
                      bgcolor: item.color, borderRadius: 3, transition: 'width 1s' }} />
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>
          </Reveal>
        </Grid>
      </Grid>

      {/* Pending client requests */}
      <Reveal observe={false} delay={260}>
      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
            <HourglassEmptyIcon sx={{ color: '#FF6F00', fontSize: 22 }} />
            <Typography fontWeight={700} fontSize={16}>Demandes en attente</Typography>
            {pending.length > 0 && (
              <Chip
                label={pending.length}
                size="small"
                sx={{ bgcolor: '#FFF3E0', color: '#E65100', fontWeight: 800, fontSize: 11, height: 20 }}
              />
            )}
          </Box>

          {loadingPending ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : pending.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5, color: '#94A3B8' }}>
              <CheckCircleOutlineIcon sx={{ fontSize: 40, mb: 1, color: '#B0BEC5' }} />
              <Typography fontSize={14}>Aucune demande en attente</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {pending.map(client => {
                const isAccepted = acceptedIds.has(client.id)
                return (
                <Box key={client.id} sx={{
                  display: 'flex', alignItems: 'center', gap: 2,
                  p: 2, borderRadius: 2,
                  border: `1px solid ${isAccepted ? '#A5D6A7' : (isDark ? 'rgba(255,111,0,0.35)' : '#FFF3E0')}`,
                  bgcolor: isAccepted
                    ? (isDark ? 'rgba(46,125,50,0.14)' : '#F1F8E9')
                    : (isDark ? 'rgba(255,111,0,0.08)' : '#FFFBF5'),
                  flexWrap: { xs: 'wrap', sm: 'nowrap' },
                  transition: 'background 0.3s, border-color 0.3s',
                }}>
                  <Avatar
                    src={client.avatar ?? undefined}
                    sx={{ width: 42, height: 42, bgcolor: isAccepted ? '#2E7D32' : '#FF6F00', fontSize: 16, flexShrink: 0 }}
                  >
                    {client.nom.charAt(0).toUpperCase()}
                  </Avatar>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={700} fontSize={14} noWrap>{client.nom}</Typography>
                    <Typography fontSize={12} color="text.secondary" noWrap>{client.email}</Typography>
                    {client.entreprise && (
                      <Typography fontSize={11} color={isAccepted ? '#2E7D32' : '#FF6F00'} fontWeight={600}>{client.entreprise}</Typography>
                    )}
                  </Box>

                  {isAccepted ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexShrink: 0 }}>
                      <CheckCircleOutlineIcon sx={{ color: '#2E7D32', fontSize: 20 }} />
                      <Typography fontSize={13} fontWeight={700} color="#2E7D32">Accepté — Email envoyé</Typography>
                    </Box>
                  ) : (
                    <>
                      <Typography fontSize={11} color="#94A3B8" sx={{ flexShrink: 0, display: { xs: 'none', md: 'block' } }}>
                        {new Date(client.created_at).toLocaleDateString('fr-FR')}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={actioning === client.id ? <CircularProgress size={12} color="inherit" /> : <CheckCircleOutlineIcon />}
                          disabled={actioning === client.id}
                          onClick={() => handleApprove(client.id, client.email, client.nom)}
                          sx={{
                            bgcolor: '#2E7D32', '&:hover': { bgcolor: '#1B5E20' },
                            fontSize: 12, fontWeight: 700, textTransform: 'none',
                            borderRadius: 2, px: 1.5,
                          }}
                        >
                          Accepter
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<CancelOutlinedIcon />}
                          disabled={actioning === client.id}
                          onClick={() => handleReject(client.id, client.nom)}
                          sx={{
                            borderColor: '#EF5350', color: '#EF5350',
                            '&:hover': { bgcolor: '#FFEBEE', borderColor: '#C62828', color: '#C62828' },
                            fontSize: 12, fontWeight: 700, textTransform: 'none',
                            borderRadius: 2, px: 1.5,
                          }}
                        >
                          Rejeter
                        </Button>
                      </Box>
                    </>
                  )}
                </Box>
                )
              })}
            </Box>
          )}
        </CardContent>
      </Card>
      </Reveal>
    </Box>
  )
}
