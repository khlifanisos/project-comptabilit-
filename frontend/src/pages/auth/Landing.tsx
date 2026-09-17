import { useNavigate } from 'react-router-dom'
import {
  Box, Button, Typography, Container, Grid, Card, CardContent, Chip, Stack
} from '@mui/material'
import Chatbot from '../../components/common/Chatbot'
import WhatsAppButton from '../../components/common/WhatsAppButton'
import { useCurrency } from '../../contexts/CurrencyContext'
import BarChartIcon from '@mui/icons-material/BarChart'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import NotificationsIcon from '@mui/icons-material/Notifications'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import TableChartIcon from '@mui/icons-material/TableChart'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'

const NAV_BG   = '#0A1628'
const PRIMARY  = '#1565C0'
const ACCENT   = '#3B82F6'
const BG_LIGHT = '#F0F4F8'

const features = [
  { icon: <ReceiptLongIcon />,    color: PRIMARY,    title: 'Gestion des factures',    desc: 'Import, suivi et export automatique en Excel — achats & ventes centralisés en temps réel.' },
  { icon: <AccountBalanceIcon />, color: '#0891B2',  title: 'Relevés bancaires',       desc: 'Rapprochement automatique des mouvements bancaires avec vos factures.' },
  { icon: <TableChartIcon />,     color: '#16A34A',  title: 'Déclarations fiscales',   desc: 'TVA, IS, IR — préparation, archivage et suivi des échéances fiscales.' },
  { icon: <AutoAwesomeIcon />,    color: '#7C3AED',  title: 'IA intégrée',             desc: 'Extraction intelligente des données depuis tout format de facture PDF.' },
  { icon: <NotificationsIcon />,  color: '#EA580C',  title: 'Notifications email',     desc: 'Alertes en temps réel à chaque dépôt, modification ou échéance critique.' },
  { icon: <SmartToyIcon />,       color: '#DC2626',  title: 'Assistant comptable IA',  desc: 'Chatbot disponible 24h/24 pour répondre à vos questions comptables.' },
]

const stats = [
  { value: '500+',   label: 'Entreprises clientes' },
  { value: '99.9%',  label: 'Disponibilité SLA' },
  { value: '10x',    label: 'Gain de productivité' },
  { value: '100%',   label: 'Données sécurisées' },
]


export default function Landing() {
  const navigate = useNavigate()
  const { devise } = useCurrency()

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: BG_LIGHT, fontFamily: 'Inter, sans-serif' }}>

      {/* ── NAVBAR ── */}
      <Box sx={{
        position: 'sticky', top: 0, zIndex: 100,
        bgcolor: NAV_BG,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(12px)',
      }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: { xs: 1.4, md: 1.8 }, px: { xs: 0, md: 0 } }}>

            {/* Logo */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{
                width: 38, height: 38, borderRadius: '10px',
                background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 10px rgba(59,130,246,0.4)',
              }}>
                <BarChartIcon sx={{ color: 'white', fontSize: 20 }} />
              </Box>
              <Box>
                <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>
                  Intelligence
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
                  Comptabilité
                </Typography>
              </Box>
            </Box>

            {/* Nav links — center */}
            <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.5, alignItems: 'center' }}>
              {[
                { label: 'Fonctionnalités', id: 'fonctionnalites' },
                { label: 'Avantages',       id: 'avantages'       },
                { label: 'À propos',        id: 'a-propos'        },
              ].map(({ label, id }) => (
                <Button key={label}
                  onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  sx={{
                    color: 'rgba(255,255,255,0.6)', fontSize: 13.5, fontWeight: 500,
                    px: 1.8, py: 0.8, borderRadius: '8px', textTransform: 'none',
                    '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.06)' },
                    transition: 'all 0.15s',
                  }}>
                  {label}
                </Button>
              ))}
            </Box>

            {/* Actions — right */}
            <Box sx={{ display: 'flex', gap: { xs: 0.8, md: 1.2 }, alignItems: 'center' }}>
              {/* "Connexion" text on xs, "Se connecter" on md+ */}
              <Button onClick={() => navigate('/login')}
                sx={{
                  color: 'rgba(255,255,255,0.78)',
                  fontSize: { xs: 12.5, md: 13.5 },
                  fontWeight: 600,
                  px: { xs: 1.5, md: 2.2 },
                  py: { xs: 0.6, md: 0.8 },
                  borderRadius: '8px',
                  textTransform: 'none',
                  whiteSpace: 'nowrap',
                  border: '1px solid rgba(255,255,255,0.16)',
                  bgcolor: 'transparent',
                  minWidth: 0,
                  '&:hover': {
                    color: 'white',
                    borderColor: 'rgba(255,255,255,0.45)',
                    bgcolor: 'rgba(255,255,255,0.07)',
                  },
                  transition: 'all 0.15s',
                }}>
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Se connecter</Box>
                <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>Connexion</Box>
              </Button>

              <Button onClick={() => navigate('/register')} variant="contained"
                sx={{
                  background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)',
                  fontSize: { xs: 12.5, md: 13.5 },
                  fontWeight: 700,
                  px: { xs: 1.8, md: 2.4 },
                  py: { xs: 0.65, md: 0.85 },
                  borderRadius: '8px',
                  textTransform: 'none',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                  boxShadow: '0 2px 10px rgba(59,130,246,0.4)',
                  '&:hover': {
                    background: 'linear-gradient(135deg,#60A5FA,#2563EB)',
                    boxShadow: '0 4px 16px rgba(59,130,246,0.5)',
                  },
                  transition: 'all 0.2s',
                }}>
                Commencer
              </Button>
            </Box>

          </Box>
        </Container>
      </Box>

      {/* ── HERO ── */}
      <Box sx={{
        bgcolor: NAV_BG,
        pt: { xs: 8, md: 11 }, pb: { xs: 10, md: 14 },
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Subtle glow blobs */}
        <Box sx={{ position:'absolute', top: -120, right: -120, width: 600, height: 600, borderRadius:'50%', background:'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)', pointerEvents:'none' }} />
        <Box sx={{ position:'absolute', bottom: -80, left: -80, width: 400, height: 400, borderRadius:'50%', background:'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)', pointerEvents:'none' }} />

        <Container maxWidth="lg">
          <Grid container spacing={8} alignItems="center">

            {/* Left — text */}
            <Grid item xs={12} md={6}>
              <Chip
                label="✦ Nouvelle génération comptable"
                size="small"
                sx={{ bgcolor: 'rgba(59,130,246,0.15)', color: '#93C5FD', fontWeight: 600, mb: 3, border: '1px solid rgba(59,130,246,0.25)', borderRadius: '6px', fontSize: 12 }}
              />
              <Typography variant="h2" sx={{
                color: 'white', fontWeight: 800,
                lineHeight: 1.12, letterSpacing: '-0.03em',
                fontSize: { xs: '2.4rem', md: '3.2rem' }, mb: 1.5,
              }}>
                Intelligence de
              </Typography>
              <Typography variant="h2" sx={{
                fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.03em',
                fontSize: { xs: '2.4rem', md: '3.2rem' }, mb: 3,
                background: `linear-gradient(135deg, ${ACCENT}, #818CF8)`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                Comptabilité
              </Typography>
              <Typography sx={{
                color: 'rgba(255,255,255,0.6)', fontSize: { xs: 15, md: 16.5 },
                lineHeight: 1.75, mb: 4.5, maxWidth: 500,
              }}>
                Plateforme web d'intelligence financière dédiée à la gestion comptable des entreprises.
                Centralisez, automatisez et analysez vos documents comptables, fiscaux et sociaux.
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} mb={4}>
                <Button onClick={() => navigate('/register')} variant="contained" size="large"
                  endIcon={<ArrowForwardIcon />}
                  sx={{
                    background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)',
                    px: 3.5, py: 1.4, fontSize: 14.5, fontWeight: 700, borderRadius: '10px',
                    boxShadow: '0 4px 20px rgba(59,130,246,0.4)',
                    '&:hover': { background: 'linear-gradient(135deg,#60A5FA,#2563EB)', boxShadow: '0 6px 24px rgba(59,130,246,0.5)' },
                    transition: 'all 0.2s',
                  }}>
                  Créer un compte
                </Button>
                <Button onClick={() => navigate('/login')} size="large"
                  sx={{
                    color: 'rgba(255,255,255,0.75)', px: 3.5, py: 1.4, fontSize: 14.5,
                    fontWeight: 600, borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.3)', color: 'white' },
                  }}>
                  Se connecter
                </Button>
              </Stack>

              <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap' }}>
                {['Sécurisé SSL', 'Export Excel', 'Notifications email', 'IA intégrée'].map((t) => (
                  <Box key={t} sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                    <CheckCircleIcon sx={{ fontSize: 14, color: '#4ADE80' }} />
                    <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: 12.5 }}>{t}</Typography>
                  </Box>
                ))}
              </Box>
            </Grid>

            {/* Right — dashboard preview (matches real platform style) */}
            <Grid item xs={12} md={6}>
              <Box sx={{
                bgcolor: '#F0F4F8', borderRadius: '16px',
                overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                {/* Fake topbar */}
                <Box sx={{ bgcolor: NAV_BG, px: 2, py: 1.2, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#DC2626' }} />
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#EA580C' }} />
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#16A34A' }} />
                  <Box sx={{ flex: 1, mx: 1.5, bgcolor: 'rgba(255,255,255,0.08)', borderRadius: '6px', height: 22, border: '1px solid rgba(255,255,255,0.07)' }} />
                </Box>

                {/* Fake content */}
                <Box sx={{ p: 2.5 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#0F172A', mb: 2 }}>
                    Tableau de bord
                  </Typography>

                  {/* Mini stat cards */}
                  <Grid container spacing={1.5} mb={2}>
                    {[
                      { label: 'Ventes',  value: '245 800', color: PRIMARY },
                      { label: 'Achats',  value: '189 200', color: '#EA580C' },
                      { label: 'Solde',   value: '56 600',  color: '#16A34A' },
                      { label: 'Factures',value: '48',      color: '#7C3AED' },
                    ].map((c) => (
                      <Grid item xs={6} key={c.label}>
                        <Box sx={{
                          bgcolor: 'white', borderRadius: '10px', p: 1.5,
                          borderTop: `3px solid ${c.color}`,
                          border: '1px solid rgba(0,0,0,0.06)',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        }}>
                          <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', mb: 0.4 }}>
                            {c.label}
                          </Typography>
                          <Typography sx={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                            {c.value} <Typography component="span" sx={{ fontSize: 9, color: '#94A3B8' }}>{devise}</Typography>
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>

                  {/* Mini table */}
                  <Box sx={{ bgcolor: 'white', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                    <Box sx={{ px: 2, py: 1, bgcolor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between' }}>
                      <Typography sx={{ fontSize: 9, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Facture</Typography>
                      <Typography sx={{ fontSize: 9, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Montant</Typography>
                      <Typography sx={{ fontSize: 9, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Statut</Typography>
                    </Box>
                    {[
                      { num: 'VTE-001', amt: '15 000', st: 'Réglé',      sc: '#16A34A', sb: '#F0FDF4' },
                      { num: 'VTE-002', amt: '9 800',  st: 'Partiel',    sc: '#EA580C', sb: '#FFF7ED' },
                      { num: 'VTE-003', amt: '25 200', st: 'Non réglé',  sc: '#DC2626', sb: '#FEF2F2' },
                    ].map((r) => (
                      <Box key={r.num} sx={{ px: 2, py: 0.9, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', '&:last-child': { borderBottom: 'none' } }}>
                        <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: '#1565C0' }}>{r.num}</Typography>
                        <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: '#0F172A' }}>{r.amt} {devise}</Typography>
                        <Box sx={{ bgcolor: r.sb, color: r.sc, fontSize: 9, fontWeight: 700, px: 1, py: 0.3, borderRadius: '4px' }}>{r.st}</Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ── STATS ── */}
      <Box id="avantages" sx={{ bgcolor: 'white', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <Container maxWidth="lg">
          <Grid container>
            {stats.map((s, i) => (
              <Grid item xs={6} md={3} key={s.label}>
                <Box sx={{
                  textAlign: 'center', py: 4,
                  borderRight: i < 3 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                }}>
                  <Typography sx={{
                    fontWeight: 800, fontSize: '2.2rem', letterSpacing: '-0.03em',
                    background: `linear-gradient(135deg, ${PRIMARY}, ${ACCENT})`,
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  }}>
                    {s.value}
                  </Typography>
                  <Typography sx={{ color: '#64748B', fontSize: 13, mt: 0.3 }}>{s.label}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ── FEATURES ── */}
      <Box id="fonctionnalites" sx={{ bgcolor: BG_LIGHT, py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Box textAlign="center" mb={8}>
            <Chip label="Fonctionnalités"
              sx={{ bgcolor: '#EFF6FF', color: PRIMARY, fontWeight: 700, mb: 2, border: `1px solid rgba(21,101,192,0.2)`, borderRadius: '6px', fontSize: 12 }} />
            <Typography variant="h3" sx={{ fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', mb: 1.5 }}>
              Tout ce dont vous avez besoin
            </Typography>
            <Typography sx={{ color: '#64748B', fontSize: 16, maxWidth: 520, mx: 'auto', lineHeight: 1.7 }}>
              Une suite complète d'outils pour gérer votre comptabilité avec intelligence et efficacité.
            </Typography>
          </Box>

          <Grid container spacing={2.5}>
            {features.map((f) => (
              <Grid item xs={12} sm={6} md={4} key={f.title}>
                <Card sx={{
                  height: '100%', borderRadius: '14px',
                  border: '1px solid rgba(0,0,0,0.05)',
                  boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
                  transition: 'box-shadow 0.2s, transform 0.2s',
                  overflow: 'hidden',
                  '&:hover': { boxShadow: `0 8px 28px rgba(15,23,42,0.1)`, transform: 'translateY(-3px)' },
                }}>
                  {/* Top color stripe */}
                  <Box sx={{ height: 3, background: `linear-gradient(90deg, ${f.color}, ${f.color}88)` }} />
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{
                      width: 44, height: 44, borderRadius: '10px',
                      background: `${f.color}14`,
                      border: `1px solid ${f.color}22`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: f.color, mb: 2, '& svg': { fontSize: 22 },
                    }}>
                      {f.icon}
                    </Box>
                    <Typography sx={{ fontWeight: 700, fontSize: 15, color: '#0F172A', mb: 0.8 }}>
                      {f.title}
                    </Typography>
                    <Typography sx={{ color: '#64748B', fontSize: 13.5, lineHeight: 1.65 }}>
                      {f.desc}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ── SECURITY BANNER ── */}
      <Box sx={{ bgcolor: 'white', borderTop: '1px solid rgba(0,0,0,0.06)', borderBottom: '1px solid rgba(0,0,0,0.06)', py: 5 }}>
        <Container maxWidth="md">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
            {[
              { icon: <CheckCircleIcon sx={{ fontSize: 20 }} />, label: 'Chiffrement SSL 256-bit' },
              { icon: <CheckCircleIcon sx={{ fontSize: 20 }} />, label: 'Conformité RGPD' },
              { icon: <TrendingUpIcon sx={{ fontSize: 20 }} />, label: 'Backups quotidiens' },
              { icon: <AutoAwesomeIcon sx={{ fontSize: 20 }} />, label: 'IA de pointe' },
            ].map((item) => (
              <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ color: PRIMARY }}>{item.icon}</Box>
                <Typography sx={{ color: '#64748B', fontSize: 13.5, fontWeight: 500 }}>{item.label}</Typography>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      {/* ── CTA ── */}
      <Box id="a-propos" sx={{ bgcolor: NAV_BG, py: { xs: 10, md: 14 }, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <Box sx={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width: 700, height: 700, borderRadius:'50%', background:'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 65%)', pointerEvents:'none' }} />
        <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
          <Typography variant="h3" sx={{ color: 'white', fontWeight: 800, letterSpacing: '-0.02em', mb: 2 }}>
            Prêt à transformer votre comptabilité ?
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.55)', mb: 5, fontSize: 16, lineHeight: 1.7 }}>
            Rejoignez des centaines d'entreprises qui font confiance à Intelligence Comptabilité pour gérer leur activité financière.
          </Typography>
          <Button onClick={() => navigate('/register')} variant="contained" size="large"
            endIcon={<ArrowForwardIcon />}
            sx={{
              background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)',
              px: 5, py: 1.8, fontSize: 16, fontWeight: 700, borderRadius: '10px',
              boxShadow: '0 6px 24px rgba(59,130,246,0.4)',
              '&:hover': { background: 'linear-gradient(135deg,#60A5FA,#2563EB)', boxShadow: '0 8px 30px rgba(59,130,246,0.5)', transform: 'translateY(-2px)' },
              transition: 'all 0.2s',
            }}>
            Commencer maintenant — Gratuit
          </Button>
          <Typography sx={{ color: 'rgba(255,255,255,0.3)', mt: 2.5, fontSize: 12 }}>
            Aucune carte bancaire requise · Configuration en 2 minutes
          </Typography>
        </Container>
      </Box>

      {/* ── CHATBOT ── */}
      <Chatbot />
      <WhatsAppButton />

      {/* ── FOOTER ── */}
      <Box sx={{ bgcolor: '#060E1A', borderTop: '1px solid rgba(255,255,255,0.05)', py: 3 }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
              <Box sx={{ width: 26, height: 26, borderRadius: '6px', background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChartIcon sx={{ color: 'white', fontSize: 15 }} />
              </Box>
              <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 12.5 }}>
                Intelligence Comptabilité
              </Typography>
            </Box>
            <Typography sx={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>
              © 2026 Tous droits réservés.
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  )
}