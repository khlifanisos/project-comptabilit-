import {
  Box, Typography, Card, CardContent, Grid, Chip, Divider, Button, Stack
} from '@mui/material'
import BarChartIcon from '@mui/icons-material/BarChart'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import PeopleIcon from '@mui/icons-material/People'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import DownloadIcon from '@mui/icons-material/Download'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { useCurrency } from '../../contexts/CurrencyContext'

const mensuelData = [
  { mois: 'Jan', achats: 42000, ventes: 61000 },
  { mois: 'Fév', achats: 38000, ventes: 55000 },
  { mois: 'Mar', achats: 51000, ventes: 72000 },
  { mois: 'Avr', achats: 47000, ventes: 68000 },
  { mois: 'Mai', achats: 63000, ventes: 91000 },
  { mois: 'Jun', achats: 58000, ventes: 84000 },
]

const clientsData = [
  { mois: 'Jan', nouveaux: 4 },
  { mois: 'Fév', nouveaux: 7 },
  { mois: 'Mar', nouveaux: 5 },
  { mois: 'Avr', nouveaux: 12 },
  { mois: 'Mai', nouveaux: 9 },
  { mois: 'Jun', nouveaux: 15 },
]

const statutData = [
  { name: 'Validées',   value: 68, color: '#4CAF50' },
  { name: 'En attente', value: 22, color: '#FF9800' },
  { name: 'Rejetées',   value: 10, color: '#F44336' },
]

function buildKpis(devise: string) {
  return [
    { label: "Chiffre d'affaires", value: `4.8M ${devise}`, icon: <TrendingUpIcon />, color: '#1565C0', trend: '+18%' },
    { label: 'Clients actifs',     value: '52',        icon: <PeopleIcon />,     color: '#FF6F00', trend: '+15%' },
    { label: 'Factures traitées',  value: '1 248',     icon: <ReceiptLongIcon />,color: '#4CAF50', trend: '+23%' },
    { label: 'Taux de validation', value: '68%',       icon: <BarChartIcon />,   color: '#9C27B0', trend: '+5%' },
  ]
}

const exportsList = [
  { label: 'Factures de vente',     endpoint: '/factures-ventes/export-excel',      file: 'factures_ventes.xlsx',      color: '#1565C0' },
  { label: "Factures d'achat",      endpoint: '/factures-achats/export-excel',       file: 'factures_achats.xlsx',       color: '#E65100' },
  { label: 'Relevés bancaires',     endpoint: '/releves-bancaires/export-excel',     file: 'releves_bancaires.xlsx',     color: '#2E7D32' },
  { label: 'Déclarations fiscales', endpoint: '/declarations-fiscales/export-excel', file: 'declarations_fiscales.xlsx', color: '#7B1FA2' },
  { label: 'Déclarations sociales', endpoint: '/declarations-sociales/export-excel', file: 'declarations_sociales.xlsx', color: '#0288D1' },
  { label: 'Échéancier leasing',    endpoint: '/echeanciers-leasing/export-excel',   file: 'echeancier_leasing.xlsx',    color: '#00695C' },
]

function downloadExcel(endpoint: string, filename: string) {
  api.get(endpoint, { responseType: 'blob', timeout: 120000 })
    .then((res: { data: Blob }) => {
      const url = URL.createObjectURL(res.data)
      const a   = document.createElement('a')
      a.href     = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`${filename} téléchargé.`)
    })
    .catch(async (err: any) => {
      let msg = "Impossible d'exporter ce fichier."
      try {
        if (err.response?.data instanceof Blob) {
          const text = await (err.response.data as Blob).text()
          const json = JSON.parse(text)
          if (json.message) msg = json.message
        }
      } catch {}
      toast.error(msg, { duration: 6000 })
    })
}

export default function AdminRapports() {
  const { devise } = useCurrency()
  const kpis = buildKpis(devise)
  return (
    <Box className="fade-in">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Box sx={{
          width: 48, height: 48, borderRadius: 2.5,
          background: 'linear-gradient(135deg,#1565C0,#0D47A1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <BarChartIcon sx={{ color: 'white', fontSize: 26 }} />
        </Box>
        <Box>
          <Typography variant="h5" fontWeight={800} color="#1a1a2e">Rapports</Typography>
          <Typography color="text.secondary" fontSize={14}>Analyse globale et exports de la plateforme</Typography>
        </Box>
        <Chip label="2026" sx={{ ml: 'auto', bgcolor: '#1565C0', color: 'white', fontWeight: 700 }} />
      </Box>

      {/* KPIs */}
      <Grid container spacing={2.5} mb={3}>
        {kpis.map((k) => (
          <Grid item xs={12} sm={6} lg={3} key={k.label}>
            <Card sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', border: '1px solid #f0f0f0' }}>
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography color="text.secondary" fontSize={12} fontWeight={600} mb={0.5}>{k.label}</Typography>
                    <Typography variant="h5" fontWeight={800} color={k.color}>{k.value}</Typography>
                  </Box>
                  <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: `${k.color}15`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: k.color }}>
                    {k.icon}
                  </Box>
                </Box>
                <Chip label={k.trend} size="small"
                  sx={{ mt: 1.5, bgcolor: '#E8F5E9', color: '#2E7D32', fontWeight: 700, fontSize: 11 }} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2.5}>
        {/* Achats vs Ventes */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography fontWeight={700} mb={2.5} color="#1a1a2e">{`Achats vs Ventes (${devise})`}</Typography>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={mensuelData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => `${v.toLocaleString()} ${devise}`} />
                  <Legend />
                  <Bar dataKey="achats" name="Achats" fill="#FF6F00" radius={[4,4,0,0]} />
                  <Bar dataKey="ventes" name="Ventes" fill="#1565C0" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Statut factures */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography fontWeight={700} mb={2.5} color="#1a1a2e">Statut des factures</Typography>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statutData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                    label={({ value }) => `${value}%`}>
                    {statutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v}%`} />
                </PieChart>
              </ResponsiveContainer>
              <Divider sx={{ my: 1.5 }} />
              {statutData.map((s) => (
                <Box key={s.name} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: s.color }} />
                    <Typography fontSize={13}>{s.name}</Typography>
                  </Box>
                  <Typography fontSize={13} fontWeight={700}>{s.value}%</Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Évolution clients */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography fontWeight={700} mb={2.5} color="#1a1a2e">Nouveaux clients par mois</Typography>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={clientsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="nouveaux" name="Nouveaux clients"
                    stroke="#1565C0" strokeWidth={3} dot={{ fill: '#1565C0', r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Exports CSV */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                <DownloadIcon sx={{ color: '#1565C0' }} />
                <Typography fontWeight={700} color="#1a1a2e">Exporter les données</Typography>
              </Box>
              <Stack spacing={1.2}>
                {exportsList.map((e) => (
                  <Button
                    key={e.label}
                    variant="outlined"
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={() => downloadExcel(e.endpoint, e.file)}
                    sx={{
                      justifyContent: 'flex-start',
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: 12,
                      borderColor: `${e.color}40`,
                      color: e.color,
                      '&:hover': { bgcolor: `${e.color}08`, borderColor: e.color },
                    }}
                  >
                    {e.label}
                  </Button>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}