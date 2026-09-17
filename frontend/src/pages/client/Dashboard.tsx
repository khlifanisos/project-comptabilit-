import { useState, useEffect } from 'react'
import {
  Grid, Typography, Box, Card, CardContent, Chip,
  Table, TableBody, TableCell, TableHead, TableRow,
  LinearProgress, Button, CircularProgress
} from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import StatCard from '../../components/common/StatCard'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useCurrency } from '../../contexts/CurrencyContext'
import api from '../../api/axios'

interface Echeance {
  label: string
  date: string
  jours: number
  color: string
}

const chartData = [
  { mois: 'Jan', ventes: 42000, achats: 28000 },
  { mois: 'Fév', ventes: 58000, achats: 35000 },
  { mois: 'Mar', ventes: 47000, achats: 31000 },
  { mois: 'Avr', ventes: 63000, achats: 42000 },
  { mois: 'Mai', ventes: 71000, achats: 39000 },
  { mois: 'Jun', ventes: 85000, achats: 55000 },
]

const statusColor: Record<string, string> = {
  validée: '#2E7D32', en_attente: '#E65100', rejetée: '#C62828'
}
const statusBg: Record<string, string> = {
  validée: '#E8F5E9', en_attente: '#FFF3E0', rejetée: '#FFEBEE'
}

export default function Dashboard() {
  const { user } = useAuth()
  const { devise } = useCurrency()
  const navigate  = useNavigate()

  const [stats, setStats]         = useState({ ventes: 0, achats: 0, solde: 0, nbFactures: 0, nbEnAttente: 0 })
  const [recentInvoices, setRecent] = useState<any[]>([])
  const [echeances, setEcheances] = useState<Echeance[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    Promise.allSettled([
      api.get('/factures-ventes'),
      api.get('/factures-achats'),
      api.get('/releves-bancaires'),
      api.get('/declarations-fiscales'),
      api.get('/declarations-sociales'),
      api.get('/echeanciers-leasing'),
    ]).then(([ventesR, achatsR, relevesR, fiscalesR, socialesR, leasingR]) => {
      const extract = (r: PromiseSettledResult<any>) =>
        r.status === 'fulfilled' ? (r.value.data?.data ?? r.value.data ?? []) : []

      const ventes  = extract(ventesR)
      const achats  = extract(achatsR)
      const releves = extract(relevesR)

      const totalVentes = ventes.reduce((s: number, f: any) => s + Number(f.montant_ttc ?? 0), 0)
      const totalAchats = achats.reduce((s: number, f: any) => s + Number(f.montant_ttc ?? 0), 0)
      const solde       = releves.length > 0 ? Number(releves[releves.length - 1].solde) : 0
      const nbEnAttente = ventes.filter((f: any) => f.statut === 'en_attente').length

      setStats({ ventes: totalVentes, achats: totalAchats, solde, nbFactures: ventes.length + achats.length, nbEnAttente })
      setRecent([...ventes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 4))

      const today   = new Date()
      const echList: Echeance[] = []

      extract(fiscalesR).filter((d: any) => d.statut === 'a_declarer' && d.date_limite).forEach((d: any) => {
        const days = Math.ceil((new Date(d.date_limite).getTime() - today.getTime()) / 86400000)
        if (days >= 0 && days <= 60)
          echList.push({ label: `${d.type} ${d.periode ?? ''}`.trim(),
            date: new Date(d.date_limite).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
            jours: days, color: days <= 7 ? '#C62828' : days <= 15 ? '#E65100' : '#1565C0' })
      })

      extract(socialesR).filter((d: any) => d.statut === 'a_declarer' && d.date_limite).forEach((d: any) => {
        const days = Math.ceil((new Date(d.date_limite).getTime() - today.getTime()) / 86400000)
        if (days >= 0 && days <= 60)
          echList.push({ label: `${d.type} ${d.periode ?? ''}`.trim(),
            date: new Date(d.date_limite).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
            jours: days, color: days <= 7 ? '#C62828' : '#2E7D32' })
      })

      extract(leasingR).filter((l: any) => l.prochaine_echeance && l.statut === 'actif').forEach((l: any) => {
        const days = Math.ceil((new Date(l.prochaine_echeance).getTime() - today.getTime()) / 86400000)
        if (days >= 0 && days <= 60)
          echList.push({ label: l.bien ?? l.contrat_ref,
            date: new Date(l.prochaine_echeance).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
            jours: days, color: '#7B1FA2' })
      })

      echList.sort((a, b) => a.jours - b.jours)
      setEcheances(echList.slice(0, 4))
    }).finally(() => setLoading(false))
  }, [])

  return (
    <Box className="fade-in">
      <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} color="#1a1a2e" fontSize={{ xs: 18, md: 22 }}>
            Bonjour, {user?.nom} 👋
          </Typography>
          <Typography color="text.secondary" fontSize={14}>
            Voici le résumé de votre activité comptable
          </Typography>
        </Box>
        <Chip label={new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
          sx={{ bgcolor: '#e3f0ff', color: '#1565C0', fontWeight: 600, fontSize: { xs: 11, sm: 13 } }} />
      </Box>

      {/* Stat cards */}
      <Grid container spacing={2.5} mb={3}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard title="Total ventes"
            value={loading ? '…' : `${stats.ventes.toLocaleString('fr-FR')} ${devise}`}
            icon={<TrendingUpIcon />} color="#1565C0" subtitle="Toutes factures" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard title="Total achats"
            value={loading ? '…' : `${stats.achats.toLocaleString('fr-FR')} ${devise}`}
            icon={<ShoppingCartIcon />} color="#FF6F00" subtitle="Toutes factures" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard title="Solde bancaire"
            value={loading ? '…' : `${stats.solde.toLocaleString('fr-FR')} ${devise}`}
            icon={<AccountBalanceWalletIcon />} color="#2E7D32" subtitle="Dernier relevé" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard title="Factures"
            value={loading ? '…' : String(stats.nbFactures)}
            icon={<ReceiptLongIcon />} color="#7B1FA2"
            subtitle={`${stats.nbEnAttente} en attente`} />
        </Grid>
      </Grid>

      <Grid container spacing={2.5} mb={3}>
        {/* Chart */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ borderRadius: 3, height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Typography fontWeight={700} fontSize={16}>Évolution financière</Typography>
                <Chip label="6 derniers mois" size="small" sx={{ bgcolor: '#e3f0ff', color: '#1565C0' }} />
              </Box>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="ventes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1565C0" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#1565C0" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="achats" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF6F00" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#FF6F00" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => `${Number(v).toLocaleString('fr-FR')} ${devise}`} />
                  <Legend />
                  <Area type="monotone" dataKey="ventes" name="Ventes" stroke="#1565C0" fill="url(#ventes)" strokeWidth={2.5} />
                  <Area type="monotone" dataKey="achats" name="Achats" stroke="#FF6F00" fill="url(#achats)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Échéances réelles */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ borderRadius: 3, height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <WarningAmberIcon sx={{ color: '#E65100' }} />
                <Typography fontWeight={700} fontSize={16}>Échéances proches</Typography>
              </Box>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress size={30} />
                </Box>
              ) : echeances.length === 0 ? (
                <Typography color="text.secondary" fontSize={13} textAlign="center" py={3}>
                  Aucune échéance dans les 60 prochains jours
                </Typography>
              ) : (
                echeances.map((item) => (
                  <Box key={`${item.label}-${item.jours}`} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography fontSize={13} fontWeight={600} noWrap sx={{ flex: 1, mr: 1 }}>{item.label}</Typography>
                      <Chip label={`${item.jours}j`} size="small"
                        sx={{ height: 20, fontSize: 11, bgcolor: `${item.color}18`, color: item.color, fontWeight: 700 }} />
                    </Box>
                    <Typography fontSize={11} color="text.secondary" mb={0.8}>Date limite : {item.date}</Typography>
                    <LinearProgress variant="determinate" value={Math.max(0, (60 - item.jours) / 60 * 100)}
                      sx={{ height: 5, borderRadius: 3,
                        bgcolor: `${item.color}18`,
                        '& .MuiLinearProgress-bar': { bgcolor: item.color, borderRadius: 3 } }} />
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent invoices */}
      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
            <Typography fontWeight={700} fontSize={16}>Factures de vente récentes</Typography>
            <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/ventes')}
              sx={{ textTransform: 'none', fontWeight: 600 }}>
              Voir tout
            </Button>
          </Box>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}><CircularProgress size={28} /></Box>
          ) : recentInvoices.length === 0 ? (
            <Typography color="text.secondary" fontSize={13} textAlign="center" py={2}>
              Aucune facture enregistrée
            </Typography>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 500 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>N° Facture</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Client</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Montant TTC</TableCell>
                    <TableCell>Statut</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentInvoices.map((inv) => (
                    <TableRow key={inv.id} sx={{ '&:hover': { bgcolor: '#f8f9ff' } }}>
                      <TableCell><Typography fontWeight={700} fontSize={13}>{inv.numero ?? `VTE-${inv.id}`}</Typography></TableCell>
                      <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{inv.client_nom ?? '—'}</TableCell>
                      <TableCell>{new Date(inv.date).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell><Typography fontWeight={600} fontSize={13}>{Number(inv.montant_ttc).toLocaleString('fr-FR')} {devise}</Typography></TableCell>
                      <TableCell>
                        <Chip label={(inv.statut ?? '').replace('_', ' ')} size="small" sx={{
                          bgcolor: statusBg[inv.statut] ?? '#f5f5f5',
                          color: statusColor[inv.statut] ?? '#666',
                          fontWeight: 700, fontSize: 11
                        }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}