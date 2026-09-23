import { useNavigate } from 'react-router-dom'
import {
  Box, Button, Typography, Container, Grid, Card, CardContent, Chip, Stack
} from '@mui/material'
import Chatbot from '../../components/common/Chatbot'
import WhatsAppButton from '../../components/common/WhatsAppButton'
import Reveal from '../../components/common/Reveal'
import { useReveal, useCountUp } from '../../hooks/useReveal'
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
import SecurityIcon from '@mui/icons-material/Security'
import LockIcon from '@mui/icons-material/Lock'

// ── Palette — light, professional, one contained "premium" dark band ──────
const INK       = '#0F172A'
const INK_SOFT  = '#5B6B82'
const PRIMARY   = '#1565C0'
const PRIMARY_DARK = '#0D47A1'
const ACCENT    = '#3B82F6'
const BG_SOFT   = '#F5F8FC'
const BORDER    = 'rgba(15,23,42,0.08)'

// Curated, verified-loading stock photography (Unsplash CDN)
const IMG_HERO     = 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&q=80&auto=format&fit=crop'
const IMG_TEAM      = 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=80&auto=format&fit=crop'
const IMG_SECURITY  = 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1600&q=75&auto=format&fit=crop'

const features = [
  { icon: <ReceiptLongIcon />,    color: PRIMARY,    title: 'Gestion des factures',    desc: 'Import, suivi et export automatique en Excel — achats & ventes centralisés en temps réel.' },
  { icon: <AccountBalanceIcon />, color: '#0891B2',  title: 'Relevés bancaires',       desc: 'Rapprochement automatique des mouvements bancaires avec vos factures.' },
  { icon: <TableChartIcon />,     color: '#16A34A',  title: 'Déclarations fiscales',   desc: 'TVA, IS, IR — préparation, archivage et suivi des échéances légales tunisiennes.' },
  { icon: <AutoAwesomeIcon />,    color: '#7C3AED',  title: 'IA intégrée',             desc: 'Extraction intelligente des données depuis tout format de facture PDF.' },
  { icon: <NotificationsIcon />,  color: '#EA580C',  title: 'Notifications email',     desc: 'Alertes en temps réel à chaque dépôt, modification ou échéance critique.' },
  { icon: <SmartToyIcon />,       color: '#DC2626',  title: 'Assistant comptable IA',  desc: 'Chatbot disponible 24h/24 pour répondre à vos questions comptables.' },
]

const stats: { value: number; decimals: number; suffix: string; label: string }[] = [
  { value: 500,  decimals: 0, suffix: '+', label: 'Entreprises clientes' },
  { value: 99.9, decimals: 1, suffix: '%', label: 'Disponibilité SLA' },
  { value: 10,   decimals: 0, suffix: 'x', label: 'Gain de productivité' },
  { value: 100,  decimals: 0, suffix: '%', label: 'Données sécurisées' },
]

const benefits = [
  { title: 'Audit intelligent en continu',            desc: "Score de fiabilité calculé automatiquement, anomalies et pénalités estimées en temps réel." },
  { title: 'Conformité fiscale tunisienne intégrée',  desc: "Échéances DGI et CNSS, calcul des pénalités CDPF — jamais de surprise de dernière minute." },
  { title: 'Facturation électronique El Fatoora',      desc: "Suivi de conformité TEIF pour chaque facture de vente, conformément à la LF 2026." },
  { title: 'Export Excel & PDF en un clic',            desc: "Déclarations, factures et échéanciers générés et archivés automatiquement." },
]

const securityItems = [
  { icon: <LockIcon sx={{ fontSize: 20 }} />,        label: 'Chiffrement SSL 256-bit' },
  { icon: <CheckCircleIcon sx={{ fontSize: 20 }} />, label: 'Conformité RGPD' },
  { icon: <TrendingUpIcon sx={{ fontSize: 20 }} />,  label: 'Backups quotidiens' },
  { icon: <AutoAwesomeIcon sx={{ fontSize: 20 }} />, label: 'IA de pointe' },
]

// ── Animated stat tile ──────────────────────────────────────────────────────
function StatTile({ stat, showDivider }: { stat: typeof stats[number]; showDivider: boolean }) {
  const { ref, visible } = useReveal()
  const count = useCountUp(stat.value, visible)
  const display = stat.decimals > 0 ? count.toFixed(stat.decimals) : Math.round(count).toString()

  return (
    <Grid item xs={6} md={3}>
      <Box ref={ref} sx={{ textAlign: 'center', py: 4, borderRight: showDivider ? `1px solid ${BORDER}` : 'none' }}>
        <Typography className="stat-number" sx={{
          fontWeight: 800, fontSize: '2.2rem', letterSpacing: '-0.03em',
          background: `linear-gradient(135deg, ${PRIMARY}, ${ACCENT})`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          {display}{stat.suffix}
        </Typography>
        <Typography sx={{ color: '#64748B', fontSize: 13, mt: 0.3 }}>{stat.label}</Typography>
      </Box>
    </Grid>
  )
}

export default function Landing() {
  const navigate = useNavigate()

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fff', fontFamily: 'Inter, sans-serif', overflowX: 'hidden' }}>

      {/* ── NAVBAR (light) ── */}
      <Box sx={{
        position: 'sticky', top: 0, zIndex: 100,
        bgcolor: 'rgba(255,255,255,0.85)',
        borderBottom: `1px solid ${BORDER}`,
        backdropFilter: 'blur(12px)',
      }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: { xs: 1.4, md: 1.8 } }}>

            {/* Logo */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{
                width: 38, height: 38, borderRadius: '10px',
                background: `linear-gradient(135deg,${ACCENT},${PRIMARY_DARK})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 10px rgba(59,130,246,0.35)',
              }}>
                <BarChartIcon sx={{ color: 'white', fontSize: 20 }} />
              </Box>
              <Box>
                <Typography sx={{ color: INK, fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>
                  Intelligence
                </Typography>
                <Typography sx={{ color: '#94A3B8', fontSize: 11 }}>
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
                    color: '#475569', fontSize: 13.5, fontWeight: 500,
                    px: 1.8, py: 0.8, borderRadius: '8px', textTransform: 'none',
                    '&:hover': { color: PRIMARY, bgcolor: 'rgba(21,101,192,0.06)' },
                    transition: 'all 0.15s',
                  }}>
                  {label}
                </Button>
              ))}
            </Box>

            {/* Actions — right */}
            <Box sx={{ display: 'flex', gap: { xs: 0.8, md: 1.2 }, alignItems: 'center' }}>
              <Button onClick={() => navigate('/login')}
                sx={{
                  color: '#334155',
                  fontSize: { xs: 12.5, md: 13.5 },
                  fontWeight: 600,
                  px: { xs: 1.5, md: 2.2 },
                  py: { xs: 0.6, md: 0.8 },
                  borderRadius: '8px',
                  textTransform: 'none',
                  whiteSpace: 'nowrap',
                  border: `1px solid ${BORDER}`,
                  bgcolor: 'transparent',
                  minWidth: 0,
                  '&:hover': {
                    color: PRIMARY,
                    borderColor: 'rgba(21,101,192,0.35)',
                    bgcolor: 'rgba(21,101,192,0.05)',
                  },
                  transition: 'all 0.15s',
                }}>
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Se connecter</Box>
                <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>Connexion</Box>
              </Button>

              <Button onClick={() => navigate('/register')} variant="contained"
                sx={{
                  background: `linear-gradient(135deg,${ACCENT},${PRIMARY_DARK})`,
                  fontSize: { xs: 12.5, md: 13.5 },
                  fontWeight: 700,
                  px: { xs: 1.8, md: 2.4 },
                  py: { xs: 0.65, md: 0.85 },
                  borderRadius: '8px',
                  textTransform: 'none',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                  boxShadow: '0 2px 10px rgba(59,130,246,0.35)',
                  '&:hover': {
                    background: `linear-gradient(135deg,#60A5FA,${PRIMARY_DARK})`,
                    boxShadow: '0 4px 16px rgba(59,130,246,0.45)',
                  },
                  transition: 'all 0.2s',
                }}>
                Commencer
              </Button>
            </Box>

          </Box>
        </Container>
      </Box>

      {/* ── HERO (light) ── */}
      <Box sx={{
        bgcolor: BG_SOFT,
        pt: { xs: 7, md: 10 }, pb: { xs: 9, md: 12 },
        position: 'relative', overflow: 'hidden',
      }}>
        <Box className="drift-blob" sx={{ position: 'absolute', top: -140, right: -100, width: 560, height: 560, borderRadius: '50%', background: `radial-gradient(circle, ${ACCENT}1A 0%, transparent 70%)`, pointerEvents: 'none' }} />
        <Box sx={{ position: 'absolute', bottom: -100, left: -100, width: 420, height: 420, borderRadius: '50%', background: `radial-gradient(circle, ${PRIMARY}14 0%, transparent 70%)`, pointerEvents: 'none' }} />

        <Container maxWidth="lg">
          <Grid container spacing={8} alignItems="center">

            {/* Left — text */}
            <Grid item xs={12} md={6}>
              <Chip
                label="✦ Nouvelle génération comptable"
                size="small"
                sx={{ bgcolor: 'rgba(21,101,192,0.08)', color: PRIMARY, fontWeight: 600, mb: 3, border: '1px solid rgba(21,101,192,0.18)', borderRadius: '6px', fontSize: 12 }}
              />
              <Typography variant="h2" sx={{
                color: INK, fontWeight: 800,
                lineHeight: 1.12, letterSpacing: '-0.03em',
                fontSize: { xs: '2.4rem', md: '3.2rem' }, mb: 1.5,
              }}>
                Intelligence de
              </Typography>
              <Typography variant="h2" sx={{
                fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.03em',
                fontSize: { xs: '2.4rem', md: '3.2rem' }, mb: 3,
                background: `linear-gradient(135deg, ${PRIMARY}, ${ACCENT})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                Comptabilité
              </Typography>
              <Typography sx={{
                color: INK_SOFT, fontSize: { xs: 15, md: 16.5 },
                lineHeight: 1.75, mb: 4.5, maxWidth: 500,
              }}>
                Plateforme web d'intelligence financière dédiée à la gestion comptable des entreprises.
                Centralisez, automatisez et analysez vos documents comptables, fiscaux et sociaux.
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} mb={4}>
                <Button onClick={() => navigate('/register')} variant="contained" size="large"
                  endIcon={<ArrowForwardIcon />}
                  sx={{
                    background: `linear-gradient(135deg,${ACCENT},${PRIMARY_DARK})`,
                    px: 3.5, py: 1.4, fontSize: 14.5, fontWeight: 700, borderRadius: '10px',
                    boxShadow: '0 4px 20px rgba(59,130,246,0.35)',
                    '&:hover': { background: `linear-gradient(135deg,#60A5FA,${PRIMARY_DARK})`, boxShadow: '0 6px 24px rgba(59,130,246,0.45)' },
                    transition: 'all 0.2s',
                  }}>
                  Créer un compte
                </Button>
                <Button onClick={() => navigate('/login')} size="large"
                  sx={{
                    color: '#334155', px: 3.5, py: 1.4, fontSize: 14.5,
                    fontWeight: 600, borderRadius: '10px',
                    border: `1px solid ${BORDER}`,
                    '&:hover': { bgcolor: 'rgba(21,101,192,0.05)', borderColor: 'rgba(21,101,192,0.3)', color: PRIMARY },
                  }}>
                  Se connecter
                </Button>
              </Stack>

              <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap' }}>
                {['Sécurisé SSL', 'Export Excel', 'Notifications email', 'IA intégrée'].map((t) => (
                  <Box key={t} sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                    <CheckCircleIcon sx={{ fontSize: 14, color: '#16A34A' }} />
                    <Typography sx={{ color: '#64748B', fontSize: 12.5 }}>{t}</Typography>
                  </Box>
                ))}
              </Box>
            </Grid>

            {/* Right — real photo + floating product cards */}
            <Grid item xs={12} md={6}>
              <Box sx={{ position: 'relative', mt: { xs: 2, md: 0 } }}>
                <Box sx={{
                  position: 'relative', borderRadius: '20px', overflow: 'hidden',
                  boxShadow: '0 30px 70px rgba(15,23,42,0.18)',
                  border: '1px solid rgba(15,23,42,0.06)',
                }}>
                  <Box component="img" src={IMG_HERO} alt="Gestion comptable et déclarations fiscales"
                    sx={{ width: '100%', height: { xs: 260, sm: 340, md: 420 }, objectFit: 'cover', display: 'block' }} />
                </Box>

                {/* Floating card — audit score */}
                <Box className="float-y" sx={{
                  position: 'absolute', left: { xs: 10, md: -28 }, bottom: { xs: -18, md: -22 },
                  bgcolor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)',
                  borderRadius: '14px', p: 1.8, boxShadow: '0 14px 34px rgba(15,23,42,0.18)',
                  border: '1px solid rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 1.5,
                  maxWidth: 220, zIndex: 2,
                }}>
                  <Box sx={{ width: 38, height: 38, borderRadius: '10px', bgcolor: '#E8F5E9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <SecurityIcon sx={{ color: '#2E7D32', fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 800, fontSize: 12.5, color: INK, lineHeight: 1.3 }}>Audit intelligent</Typography>
                    <Typography sx={{ fontSize: 11, color: '#64748B' }}>Score de fiabilité : 98/100</Typography>
                  </Box>
                </Box>

                {/* Floating chip — Tunisia compliance */}
                <Chip
                  className="float-y-delay"
                  icon={<CheckCircleIcon sx={{ fontSize: 15, color: '#2E7D32 !important' }} />}
                  label="Conforme DGI & CNSS"
                  sx={{
                    position: 'absolute', top: 16, right: { xs: 10, md: -14 },
                    bgcolor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)',
                    fontWeight: 700, fontSize: 12, px: 0.5,
                    boxShadow: '0 10px 24px rgba(15,23,42,0.16)', border: '1px solid rgba(255,255,255,0.7)',
                    zIndex: 2,
                  }} />
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ── STATS (animated count-up) ── */}
      <Box id="avantages" sx={{ bgcolor: 'white', borderBottom: `1px solid ${BORDER}` }}>
        <Container maxWidth="lg">
          <Grid container>
            {stats.map((s, i) => (
              <StatTile key={s.label} stat={s} showDivider={i < stats.length - 1} />
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ── FEATURES ── */}
      <Box id="fonctionnalites" sx={{ bgcolor: BG_SOFT, py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Reveal>
            <Box textAlign="center" mb={8}>
              <Chip label="Fonctionnalités"
                sx={{ bgcolor: '#EFF6FF', color: PRIMARY, fontWeight: 700, mb: 2, border: '1px solid rgba(21,101,192,0.2)', borderRadius: '6px', fontSize: 12 }} />
              <Typography variant="h3" sx={{ fontWeight: 800, color: INK, letterSpacing: '-0.02em', mb: 1.5 }}>
                Tout ce dont vous avez besoin
              </Typography>
              <Typography sx={{ color: '#64748B', fontSize: 16, maxWidth: 520, mx: 'auto', lineHeight: 1.7 }}>
                Une suite complète d'outils pour gérer votre comptabilité avec intelligence et efficacité.
              </Typography>
            </Box>
          </Reveal>

          <Grid container spacing={2.5}>
            {features.map((f, i) => (
              <Grid item xs={12} sm={6} md={4} key={f.title}>
                <Reveal delay={i * 70}>
                  <Card sx={{
                    height: '100%', borderRadius: '14px',
                    border: '1px solid rgba(0,0,0,0.05)',
                    boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
                    transition: 'box-shadow 0.2s, transform 0.2s',
                    overflow: 'hidden',
                    '&:hover': { boxShadow: '0 8px 28px rgba(15,23,42,0.1)', transform: 'translateY(-3px)' },
                  }}>
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
                      <Typography sx={{ fontWeight: 700, fontSize: 15, color: INK, mb: 0.8 }}>
                        {f.title}
                      </Typography>
                      <Typography sx={{ color: '#64748B', fontSize: 13.5, lineHeight: 1.65 }}>
                        {f.desc}
                      </Typography>
                    </CardContent>
                  </Card>
                </Reveal>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ── BENEFITS — photo + text ── */}
      <Box id="a-propos" sx={{ bgcolor: 'white', py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={6}>
              <Reveal>
                <Box sx={{ position: 'relative', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(15,23,42,0.14)' }}>
                  <Box component="img" src={IMG_TEAM} alt="Équipe comptable collaborant sur la plateforme"
                    sx={{ width: '100%', height: { xs: 260, md: 400 }, objectFit: 'cover', display: 'block' }} />
                </Box>
              </Reveal>
            </Grid>
            <Grid item xs={12} md={6}>
              <Reveal delay={120}>
                <Chip label="Pourquoi nous choisir"
                  sx={{ bgcolor: '#EFF6FF', color: PRIMARY, fontWeight: 700, mb: 2, border: '1px solid rgba(21,101,192,0.2)', borderRadius: '6px', fontSize: 12 }} />
                <Typography variant="h3" sx={{ fontWeight: 800, color: INK, letterSpacing: '-0.02em', mb: 2, fontSize: { xs: '1.7rem', md: '2.1rem' } }}>
                  Pensée pour les cabinets comptables tunisiens
                </Typography>
                <Typography sx={{ color: INK_SOFT, fontSize: 15, lineHeight: 1.75, mb: 3.5 }}>
                  Chaque fonctionnalité est construite autour de la réglementation fiscale et sociale tunisienne réelle — pas d'approximation générique.
                </Typography>
                <Stack spacing={2.2}>
                  {benefits.map((b) => (
                    <Box key={b.title} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                      <Box sx={{
                        width: 26, height: 26, borderRadius: '8px', flexShrink: 0, mt: 0.2,
                        bgcolor: 'rgba(21,101,192,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <CheckCircleIcon sx={{ fontSize: 15, color: PRIMARY }} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: 14.5, color: INK }}>{b.title}</Typography>
                        <Typography sx={{ fontSize: 13, color: '#64748B', mt: 0.2 }}>{b.desc}</Typography>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </Reveal>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ── SECURITY — contained photo band (the one deliberate dark accent) ── */}
      <Box sx={{ position: 'relative', py: { xs: 9, md: 12 }, overflow: 'hidden' }}>
        <Box component="img" src={IMG_SECURITY} alt=""
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        <Box sx={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(120deg, rgba(8,15,28,0.93) 0%, rgba(10,22,40,0.82) 55%, rgba(10,22,40,0.62) 100%)',
        }} />
        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
          <Reveal>
            <Box textAlign="center">
              <Chip label="Sécurité & conformité"
                sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: '#93C5FD', fontWeight: 700, mb: 2.5, border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', fontSize: 12 }} />
              <Typography variant="h3" sx={{ color: 'white', fontWeight: 800, letterSpacing: '-0.02em', mb: 2, fontSize: { xs: '1.8rem', md: '2.3rem' } }}>
                Vos données, protégées à chaque étape
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.65)', mb: 5, fontSize: 15.5, lineHeight: 1.75, maxWidth: 560, mx: 'auto' }}>
                Chiffrement, sauvegardes et infrastructure surveillée en continu pour que votre comptabilité reste disponible et confidentielle.
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: { xs: 3, md: 6 }, flexWrap: 'wrap' }}>
                {securityItems.map((item) => (
                  <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ color: '#93C5FD' }}>{item.icon}</Box>
                    <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: 13.5, fontWeight: 500 }}>{item.label}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Reveal>
        </Container>
      </Box>

      {/* ── CTA — bright gradient, not navy ── */}
      <Box sx={{
        background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)`,
        py: { xs: 9, md: 12 }, textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        <Box className="drift-blob" sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
          <Reveal>
            <Typography variant="h3" sx={{ color: 'white', fontWeight: 800, letterSpacing: '-0.02em', mb: 2, fontSize: { xs: '1.8rem', md: '2.3rem' } }}>
              Prêt à transformer votre comptabilité ?
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.8)', mb: 5, fontSize: 16, lineHeight: 1.7 }}>
              Rejoignez des centaines d'entreprises qui font confiance à Intelligence Comptabilité pour gérer leur activité financière.
            </Typography>
            <Button onClick={() => navigate('/register')} variant="contained" size="large"
              endIcon={<ArrowForwardIcon />}
              sx={{
                bgcolor: 'white', color: PRIMARY,
                px: 5, py: 1.8, fontSize: 16, fontWeight: 700, borderRadius: '10px',
                boxShadow: '0 6px 24px rgba(0,0,0,0.2)',
                '&:hover': { bgcolor: '#F0F7FF', boxShadow: '0 8px 30px rgba(0,0,0,0.25)', transform: 'translateY(-2px)' },
                transition: 'all 0.2s',
              }}>
              Commencer maintenant — Gratuit
            </Button>
            <Typography sx={{ color: 'rgba(255,255,255,0.55)', mt: 2.5, fontSize: 12 }}>
              Aucune carte bancaire requise · Configuration en 2 minutes
            </Typography>
          </Reveal>
        </Container>
      </Box>

      {/* ── CHATBOT ── */}
      <Chatbot />
      <WhatsAppButton />

      {/* ── FOOTER (light) ── */}
      <Box sx={{ bgcolor: '#F8FAFC', borderTop: `1px solid ${BORDER}`, py: 3 }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
              <Box sx={{ width: 26, height: 26, borderRadius: '6px', background: `linear-gradient(135deg,${ACCENT},${PRIMARY_DARK})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChartIcon sx={{ color: 'white', fontSize: 15 }} />
              </Box>
              <Typography sx={{ color: '#64748B', fontSize: 12.5 }}>
                Intelligence Comptabilité
              </Typography>
            </Box>
            <Typography sx={{ color: '#94A3B8', fontSize: 12 }}>
              © 2026 Tous droits réservés.
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  )
}
