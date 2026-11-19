import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Button, ButtonBase, Chip, IconButton, Skeleton, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import ArrowForwardIcon   from '@mui/icons-material/ArrowForward'
import ChevronLeftIcon    from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon   from '@mui/icons-material/ChevronRight'
import CheckCircleIcon    from '@mui/icons-material/CheckCircle'
import AccountBalanceIcon from '@mui/icons-material/AccountBalanceOutlined'
import ReceiptIcon        from '@mui/icons-material/ReceiptOutlined'
import SecurityIcon       from '@mui/icons-material/SecurityOutlined'
import LibraryBooksIcon   from '@mui/icons-material/LibraryBooksOutlined'
import ForumIcon          from '@mui/icons-material/ForumOutlined'
import GavelIcon          from '@mui/icons-material/GavelOutlined'
import PeopleIcon         from '@mui/icons-material/PeopleOutlined'
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumberOutlined'
import ReceiptLongIcon    from '@mui/icons-material/ReceiptLongOutlined'
import FolderIcon         from '@mui/icons-material/FolderOutlined'
import CloudUploadIcon    from '@mui/icons-material/CloudUploadOutlined'
import AutoAwesomeIcon    from '@mui/icons-material/AutoAwesomeOutlined'
import TaskAltIcon        from '@mui/icons-material/TaskAltOutlined'
import api from '../../api/axios'
import { useAuth } from '../../contexts/AuthContext'
import { HEADER_H } from '../../components/layout/PageHero'
import Reveal from '../../components/common/Reveal'
import { useCountUp, useReveal } from '../../hooks/useReveal'
import { DocumentFiscal, categorieByKey, docUrl } from '../documentation/categories'

/* ───────────────────────────── Content ───────────────────────────── */

interface Slide {
  eyebrow: string
  title: React.ReactNode
  text: string
  color: string
  primary: { label: string; path: string }
  secondary?: { label: string; path: string }
  visual: Visual
}

interface Visual {
  icon: React.ReactNode
  title: string
  rows: { label: string; value: string }[]
  badge: string
  score?: number
}

const hl = (t: string) => <Box component="span" className="gradient-text">{t}</Box>

const clientSlides: Slide[] = [
  {
    eyebrow: 'Votre espace comptable', color: '#3B82F6',
    title: <>Votre comptabilité, {hl('enfin simple')}.</>,
    text: 'Déposez vos relevés et vos factures, votre comptable s’occupe du reste. Tout est suivi, classé et accessible à tout moment.',
    primary: { label: 'Déposer un relevé', path: '/releves' },
    secondary: { label: 'Écrire à mon comptable', path: '/messages' },
    visual: {
      icon: <AccountBalanceIcon />, title: 'Relevé bancaire · Mars', badge: 'Rapproché',
      rows: [{ label: 'Virement client', value: '+ 4 200,000' }, { label: 'Loyer bureau', value: '− 1 350,000' }, { label: 'STEG', value: '− 186,450' }],
    },
  },
  {
    eyebrow: 'Factures', color: '#06B6D4',
    title: <>Vos factures {hl('lues automatiquement')}.</>,
    text: 'Envoyez une photo ou un PDF : montants, TVA et fournisseur sont extraits pour vous, prêts pour vos déclarations.',
    primary: { label: "Factures d'achats", path: '/achats' },
    secondary: { label: 'Factures de ventes', path: '/ventes' },
    visual: {
      icon: <ReceiptIcon />, title: 'Facture F-2026-118', badge: 'TVA extraite',
      rows: [{ label: 'Montant HT', value: '2 500,000' }, { label: 'TVA 19 %', value: '475,000' }, { label: 'Total TTC', value: '2 975,000' }],
    },
  },
  {
    eyebrow: 'Audit intelligent', color: '#A78BFA',
    title: <>Un audit de vos comptes {hl('en continu')}.</>,
    text: 'Anomalies, doublons, écarts de TVA : l’audit intelligent analyse vos données et vous signale ce qui mérite votre attention.',
    primary: { label: 'Voir mon audit', path: '/audit' },
    visual: {
      icon: <SecurityIcon />, title: 'Score de santé', badge: 'Aucune alerte critique', score: 92,
      rows: [{ label: 'Cohérence TVA', value: 'OK' }, { label: 'Doublons', value: '0' }],
    },
  },
  {
    eyebrow: 'Documentation fiscale', color: '#22D3EE',
    title: <>Toute la fiscalité {hl('à portée de main')}.</>,
    text: 'Lois de finances, notes communes, conventions de non double imposition et codes fiscaux, consultables et téléchargeables.',
    primary: { label: 'Explorer la documentation', path: '/documentation' },
    visual: {
      icon: <LibraryBooksIcon />, title: 'Bibliothèque fiscale', badge: 'Mise à jour',
      rows: [{ label: 'Lois de finances', value: 'Jusqu’à 2026' }, { label: 'Notes communes', value: '680+' }, { label: 'Conventions', value: '58' }],
    },
  },
]

const adminSlides: Slide[] = [
  {
    eyebrow: 'Espace cabinet', color: '#3B82F6',
    title: <>Pilotez votre cabinet {hl('en un coup d’œil')}.</>,
    text: 'Clients, pièces déposées, messages et échéances : tout votre portefeuille réuni dans un seul espace.',
    primary: { label: 'Voir les clients', path: '/admin/clients' },
    secondary: { label: 'Messagerie', path: '/admin/messages' },
    visual: {
      icon: <PeopleIcon />, title: 'Portefeuille clients', badge: 'À jour',
      rows: [{ label: 'Dossiers', value: 'Centralisés' }, { label: 'Pièces déposées', value: 'Classées' }, { label: 'Messages', value: 'En direct' }],
    },
  },
  {
    eyebrow: 'Support & facturation', color: '#F59E0B',
    title: <>Tickets et honoraires, {hl('sans friction')}.</>,
    text: 'Suivez les demandes de vos clients et facturez vos prestations depuis le même espace.',
    primary: { label: 'Tickets', path: '/admin/tickets' },
    secondary: { label: 'Facturation', path: '/admin/facturation' },
    visual: {
      icon: <ConfirmationNumberIcon />, title: 'Ticket #482', badge: 'Résolu',
      rows: [{ label: 'Priorité', value: 'Haute' }, { label: 'Délai', value: '2 h' }],
    },
  },
  {
    eyebrow: 'Audit', color: '#A78BFA',
    title: <>Repérez les risques {hl('avant vos clients')}.</>,
    text: 'Le score d’audit de chaque dossier et les anomalies détectées automatiquement.',
    primary: { label: 'Ouvrir l’audit', path: '/audit' },
    visual: {
      icon: <SecurityIcon />, title: 'Audit des dossiers', badge: 'Analyse terminée', score: 87,
      rows: [{ label: 'Alertes', value: '3' }, { label: 'Dossiers sains', value: '94 %' }],
    },
  },
  {
    eyebrow: 'Documentation fiscale', color: '#22D3EE',
    title: <>La bibliothèque fiscale {hl('de vos clients')}.</>,
    text: 'Publiez et mettez à jour les textes fiscaux : vos clients y accèdent directement depuis leur espace.',
    primary: { label: 'Gérer la documentation', path: '/documentation' },
    visual: {
      icon: <LibraryBooksIcon />, title: 'Bibliothèque fiscale', badge: 'Publiée',
      rows: [{ label: 'Lois de finances', value: 'Jusqu’à 2026' }, { label: 'Notes communes', value: '680+' }],
    },
  },
]

interface Feature { title: string; text: string; path: string; icon: React.ReactNode; color: string }

const clientFeatures: Feature[] = [
  { title: 'Relevés bancaires', text: 'Déposez et suivez vos relevés.', path: '/releves', icon: <AccountBalanceIcon />, color: '#1565C0' },
  { title: 'Factures', text: 'Achats et ventes, TVA extraite.', path: '/achats', icon: <ReceiptIcon />, color: '#0891B2' },
  { title: 'Déclarations', text: 'Fiscales et sociales, à l’heure.', path: '/fiscales', icon: <GavelIcon />, color: '#D97706' },
  { title: 'Messagerie', text: 'Échangez avec votre comptable.', path: '/messages', icon: <ForumIcon />, color: '#7C3AED' },
]

const adminFeatures: Feature[] = [
  { title: 'Clients', text: 'Fiches et dossiers clients.', path: '/admin/clients', icon: <PeopleIcon />, color: '#1565C0' },
  { title: 'Documents', text: 'Pièces déposées à traiter.', path: '/admin/documents', icon: <FolderIcon />, color: '#0891B2' },
  { title: 'Tickets', text: 'Demandes de support.', path: '/admin/tickets', icon: <ConfirmationNumberIcon />, color: '#D97706' },
  { title: 'Facturation', text: 'Honoraires et paiements.', path: '/admin/facturation', icon: <ReceiptLongIcon />, color: '#7C3AED' },
]

/* ───────────────────────────── Hero carousel ───────────────────────────── */

const SLIDE_MS = 7000

function SlideVisual({ v, color }: { v: Visual; color: string }) {
  return (
    <Box sx={{ position: 'relative', maxWidth: 440, ml: 'auto', mr: { md: 2 } }}>
      <Box className="float-y" sx={{
        position: 'relative', borderRadius: 5, p: 3,
        background: 'linear-gradient(160deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04))',
        border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(18px)',
        boxShadow: `0 40px 80px rgba(2,8,23,0.5), 0 0 0 1px ${alpha(color, 0.15)}, 0 0 80px ${alpha(color, 0.25)}`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `linear-gradient(135deg, ${color}, ${alpha(color, 0.6)})`, '& svg': { fontSize: 22 },
          }}>{v.icon}</Box>
          <Box>
            <Typography fontWeight={700} fontSize={15}>{v.title}</Typography>
            <Typography fontSize={12} sx={{ color: 'rgba(255,255,255,0.55)' }}>Aperçu</Typography>
          </Box>
        </Box>

        {v.score !== undefined && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, mb: 2.5 }}>
            <Box sx={{
              width: 92, height: 92, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `conic-gradient(${color} ${v.score * 3.6}deg, rgba(255,255,255,0.1) 0)`,
            }}>
              <Box sx={{ width: 74, height: 74, borderRadius: '50%', bgcolor: '#0B1730', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography fontWeight={800} fontSize={24}>{v.score}</Typography>
              </Box>
            </Box>
            <Typography fontSize={13.5} sx={{ color: 'rgba(255,255,255,0.7)' }}>Exemple de score d’audit sur 100</Typography>
          </Box>
        )}

        {v.rows.map((r, i) => (
          <Box key={i} sx={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.3,
            borderTop: i ? '1px dashed rgba(255,255,255,0.12)' : 'none',
          }}>
            <Typography fontSize={13.5} sx={{ color: 'rgba(255,255,255,0.7)' }}>{r.label}</Typography>
            <Typography fontSize={14} fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>{r.value}</Typography>
          </Box>
        ))}
      </Box>

      {/* Floating badge */}
      <Box className="float-y-delay" sx={{
        position: 'absolute', left: -28, bottom: -22, display: 'flex', alignItems: 'center', gap: 1,
        px: 2, py: 1.2, borderRadius: 3, bgcolor: 'white', color: '#0F172A',
        boxShadow: '0 18px 40px rgba(2,8,23,0.35)',
      }}>
        <CheckCircleIcon sx={{ color: '#16A34A', fontSize: 20 }} />
        <Typography fontSize={13.5} fontWeight={700}>{v.badge}</Typography>
      </Box>
      <Box className="float-y-delay" sx={{
        position: 'absolute', right: -14, top: -18, width: 54, height: 54, borderRadius: 3,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg,#A78BFA,#7C3AED)', boxShadow: '0 14px 30px rgba(124,58,237,0.45)',
      }}>
        <AutoAwesomeIcon sx={{ color: 'white' }} />
      </Box>
    </Box>
  )
}

function HeroCarousel({ slides, name }: { slides: Slide[]; name?: string }) {
  const navigate = useNavigate()
  const theme = useTheme()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchX = useRef<number | null>(null)
  const n = slides.length

  const goTo = useCallback((i: number) => setIndex(((i % n) + n) % n), [n])

  useEffect(() => {
    if (paused) return
    const t = setTimeout(() => goTo(index + 1), SLIDE_MS)
    return () => clearTimeout(t)
  }, [index, paused, goTo])

  const s = slides[index]
  const ctrl = {
    color: 'white', width: 46, height: 46, border: '1px solid rgba(255,255,255,0.2)',
    bgcolor: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)',
    '&:hover': { bgcolor: 'rgba(255,255,255,0.16)' },
  }

  return (
    <Box component="section" aria-roledescription="carrousel" aria-label="À la une"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        if (Math.abs(dx) > 50) goTo(index + (dx < 0 ? 1 : -1))
        touchX.current = null
      }}
      onKeyDown={(e) => { if (e.key === 'ArrowRight') goTo(index + 1); if (e.key === 'ArrowLeft') goTo(index - 1) }}
      sx={{
        position: 'relative', overflow: 'hidden', color: 'white', bgcolor: '#050B18',
        minHeight: { xs: 640, md: 700 }, display: 'flex', alignItems: 'center',
        pt: `${HEADER_H}px`, pb: { xs: 12, md: 14 },
      }}>
      {/* Backgrounds (cross-fade) */}
      {slides.map((sl, i) => (
        <Box key={i} aria-hidden sx={{ position: 'absolute', inset: 0, opacity: i === index ? 1 : 0, transition: 'opacity 1.1s ease' }}>
          <Box className={i === index ? 'ken-burns' : undefined} sx={{
            position: 'absolute', inset: '-5%',
            background: `radial-gradient(ellipse 60% 70% at 78% 35%, ${alpha(sl.color, 0.55)} 0%, transparent 60%),
                         radial-gradient(ellipse 50% 60% at 10% 90%, rgba(124,58,237,0.35) 0%, transparent 60%),
                         linear-gradient(135deg, #050B18 0%, #0A1F44 55%, #0B2A5B 100%)`,
          }} />
        </Box>
      ))}
      <Box aria-hidden sx={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '56px 56px',
        maskImage: 'radial-gradient(ellipse 70% 60% at 60% 40%, black 10%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 60% 40%, black 10%, transparent 75%)',
      }} />

      {/* Slide content (keyed so the entrance animation replays) */}
      <Box key={index} sx={{
        position: 'relative', width: '100%', maxWidth: 1320, mx: 'auto', px: { xs: 2, md: 3 },
        display: 'grid', gap: { xs: 5, md: 6 }, alignItems: 'center',
        gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' },
      }}>
        <Box aria-live="polite">
          {index === 0 && name && (
            <Typography className="hero-rise" sx={{ fontSize: 15, color: 'rgba(255,255,255,0.7)', mb: 1.5 }}>
              Bonjour {name} 👋
            </Typography>
          )}
          <Box className="hero-rise" sx={{
            display: 'inline-flex', alignItems: 'center', gap: 1, mb: 2.5, px: 1.6, py: 0.7, borderRadius: 99,
            bgcolor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', animationDelay: '60ms',
          }}>
            <Box className="dot-pulse" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: s.color }} />
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{s.eyebrow}</Typography>
          </Box>
          <Typography component="h1" className="hero-rise" sx={{
            fontSize: { xs: 36, sm: 46, md: 60 }, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.04,
            animationDelay: '120ms', maxWidth: 640,
          }}>
            {s.title}
          </Typography>
          <Typography className="hero-rise" sx={{
            mt: 2.5, fontSize: { xs: 16, md: 18.5 }, lineHeight: 1.65, color: 'rgba(255,255,255,0.72)', maxWidth: 560,
            animationDelay: '200ms',
          }}>
            {s.text}
          </Typography>
          <Box className="hero-rise" sx={{ display: 'flex', gap: 1.5, mt: 4, flexWrap: 'wrap', animationDelay: '280ms' }}>
            <Button onClick={() => navigate(s.primary.path)} endIcon={<ArrowForwardIcon />} sx={{
              px: 3, py: 1.4, borderRadius: 99, fontWeight: 700, fontSize: 15, textTransform: 'none',
              bgcolor: 'white', color: '#0A1628', background: 'white',
              boxShadow: `0 12px 30px ${alpha(s.color, 0.45)}`,
              '&:hover': { background: '#E0ECFF', transform: 'translateY(-2px)' },
              '& .MuiButton-endIcon': { transition: 'transform .2s' },
              '&:hover .MuiButton-endIcon': { transform: 'translateX(3px)' },
              transition: 'all .2s ease',
            }}>
              {s.primary.label}
            </Button>
            {s.secondary && (
              <Button onClick={() => navigate(s.secondary!.path)} sx={{
                px: 3, py: 1.4, borderRadius: 99, fontWeight: 600, fontSize: 15, textTransform: 'none', color: 'white',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)',
                '&:hover': { background: 'rgba(255,255,255,0.14)' },
              }}>
                {s.secondary.label}
              </Button>
            )}
          </Box>
        </Box>
        <Box className="hero-rise" sx={{ display: { xs: 'none', md: 'block' }, animationDelay: '220ms' }}>
          <SlideVisual v={s.visual} color={s.color} />
        </Box>
      </Box>

      {/* Controls */}
      <Box sx={{
        position: 'absolute', left: 0, right: 0, bottom: { xs: 64, md: 84 },
        maxWidth: 1320, mx: 'auto', px: { xs: 2, md: 3 },
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2,
      }}>
        <Box sx={{ display: 'flex', gap: 1 }} role="tablist">
          {slides.map((sl, i) => (
            <ButtonBase key={i} onClick={() => goTo(i)} role="tab" aria-selected={i === index} aria-label={`Diapositive ${i + 1} : ${sl.eyebrow}`}
              sx={{
                height: 6, borderRadius: 99, overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.22)',
                width: i === index ? 56 : 22, transition: 'width .4s ease',
              }}>
              {i === index && (
                <Box key={`${index}-${paused}`} sx={{
                  width: '100%', height: '100%', bgcolor: 'white', transformOrigin: 'left',
                  animation: paused ? 'none' : `slideProgress ${SLIDE_MS}ms linear both`,
                  transform: paused ? 'scaleX(1)' : undefined,
                }} />
              )}
            </ButtonBase>
          ))}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontVariantNumeric: 'tabular-nums', display: { xs: 'none', sm: 'block' } }}>
            {String(index + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}
          </Typography>
          <IconButton aria-label="Précédent" onClick={() => goTo(index - 1)} sx={ctrl}><ChevronLeftIcon /></IconButton>
          <IconButton aria-label="Suivant" onClick={() => goTo(index + 1)} sx={ctrl}><ChevronRightIcon /></IconButton>
        </Box>
      </Box>

      {/* Wave */}
      <Box aria-hidden component="svg" viewBox="0 0 1440 80" preserveAspectRatio="none" sx={{
        position: 'absolute', left: 0, right: 0, bottom: -1, width: '100%', height: { xs: 36, md: 64 }, display: 'block',
      }}>
        <path d="M0,48 C240,88 480,8 720,32 C960,56 1200,80 1440,40 L1440,80 L0,80 Z" fill={theme.palette.background.default} />
      </Box>
    </Box>
  )
}

/* ───────────────────────────── Sections ───────────────────────────── */

const Container = ({ children, sx }: { children: React.ReactNode; sx?: object }) => (
  <Box sx={{ maxWidth: 1320, mx: 'auto', px: { xs: 2, md: 3 }, ...sx }}>{children}</Box>
)

function SectionTitle({ eyebrow, title, text, action }: { eyebrow: string; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, mb: { xs: 3, md: 4 }, flexWrap: 'wrap' }}>
      <Box sx={{ maxWidth: 640 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'primary.main', mb: 1 }}>
          {eyebrow}
        </Typography>
        <Typography component="h2" sx={{ fontSize: { xs: 26, md: 36 }, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.15 }}>
          {title}
        </Typography>
        {text && <Typography color="text.secondary" sx={{ mt: 1.2, fontSize: { xs: 15, md: 16.5 } }}>{text}</Typography>}
      </Box>
      {action}
    </Box>
  )
}

function QuickAccess({ features }: { features: Feature[] }) {
  const navigate = useNavigate()
  return (
    <Container sx={{ position: 'relative', zIndex: 2, mt: { xs: -7, md: -9 } }}>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' } }}>
        {features.map((f, i) => (
          <Reveal key={f.path} delay={i * 80} observe={false}>
            <ButtonBase onClick={() => navigate(f.path)} className="spotlight"
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
                e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
              }}
              sx={{
                width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left',
                gap: 1.5, p: { xs: 2, md: 3 }, borderRadius: 4, bgcolor: 'background.paper',
                border: '1px solid', borderColor: 'divider',
                boxShadow: '0 20px 50px rgba(15,23,42,0.10)',
                transition: 'transform .25s ease, box-shadow .25s ease, border-color .25s ease',
                '&:hover': { transform: 'translateY(-6px)', borderColor: alpha(f.color, 0.4), boxShadow: `0 26px 60px ${alpha(f.color, 0.22)}` },
                '&:hover .qa-icon': { bgcolor: f.color, color: 'white', transform: 'rotate(-6deg)' },
                '&:hover .qa-arrow': { transform: 'translateX(4px)' },
              }}>
              <Box className="qa-icon" sx={{
                width: 50, height: 50, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: alpha(f.color, 0.12), color: f.color, transition: 'all .25s ease', '& svg': { fontSize: 26 },
              }}>{f.icon}</Box>
              <Box>
                <Typography fontWeight={700} fontSize={{ xs: 15, md: 17 }} color="text.primary">{f.title}</Typography>
                <Typography fontSize={13.5} color="text.secondary" mt={0.3} sx={{ display: { xs: 'none', sm: 'block' } }}>{f.text}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 'auto', color: f.color, fontWeight: 600, fontSize: 13.5 }}>
                Accéder <ArrowForwardIcon className="qa-arrow" sx={{ fontSize: 16, transition: 'transform .2s' }} />
              </Box>
            </ButtonBase>
          </Reveal>
        ))}
      </Box>
    </Container>
  )
}

function DocsCarousel() {
  const navigate = useNavigate()
  const track = useRef<HTMLDivElement>(null)
  const [docs, setDocs] = useState<DocumentFiscal[] | null>(null)
  const [edges, setEdges] = useState({ start: true, end: false })

  useEffect(() => {
    api.get('/documents-fiscaux', { params: { limit: 14 } })
      .then((r: { data: DocumentFiscal[] }) => setDocs(r.data))
      .catch(() => setDocs([]))
  }, [])

  const updateEdges = () => {
    const el = track.current
    if (!el) return
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 })
  }
  useEffect(updateEdges, [docs])

  const scroll = (dir: 1 | -1) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.8, behavior: 'smooth' })

  if (docs && docs.length === 0) return null

  const arrow = { width: 44, height: 44, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper',
    '&:hover': { bgcolor: 'primary.main', color: 'white', borderColor: 'primary.main' }, '&.Mui-disabled': { opacity: 0.4 } }

  return (
    <Container sx={{ mt: { xs: 8, md: 12 } }}>
      <Reveal>
        <SectionTitle eyebrow="Documentation fiscale" title="Les derniers textes publiés"
          text="Lois de finances, notes communes et conventions : consultez-les directement en ligne."
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton aria-label="Précédent" onClick={() => scroll(-1)} disabled={edges.start} sx={arrow}><ChevronLeftIcon /></IconButton>
              <IconButton aria-label="Suivant" onClick={() => scroll(1)} disabled={edges.end} sx={arrow}><ChevronRightIcon /></IconButton>
            </Box>
          } />
      </Reveal>

      <Box ref={track} onScroll={updateEdges} className="no-scrollbar" sx={{
        display: 'flex', gap: 2, overflowX: 'auto', scrollSnapType: 'x mandatory', pb: 3, pt: 1, mx: -1, px: 1,
      }}>
        {(docs ?? Array.from({ length: 5 }, () => null)).map((d, i) => {
          const cat = d ? categorieByKey(d.categorie) : undefined
          const color = cat?.color ?? '#94A3B8'
          return (
            <ButtonBase key={d?.id ?? i} disabled={!d} onClick={() => d && navigate(docUrl(d))}
              sx={{
                flex: '0 0 auto', width: { xs: 250, md: 290 }, scrollSnapAlign: 'start',
                display: 'flex', flexDirection: 'column', alignItems: 'stretch', textAlign: 'left',
                borderRadius: 4, overflow: 'hidden', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
                transition: 'transform .25s ease, box-shadow .25s ease',
                '&:hover': { transform: 'translateY(-5px)', boxShadow: `0 20px 44px ${alpha(color, 0.22)}` },
                '&:hover .doc-cover svg': { transform: 'scale(1.12) rotate(-6deg)' },
              }}>
              <Box className="doc-cover" sx={{
                height: 120, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `linear-gradient(135deg, ${alpha(color, 0.95)}, ${alpha(color, 0.6)})`, color: 'white',
                '& svg': { fontSize: 46, transition: 'transform .3s ease', opacity: 0.95 },
              }}>
                <Box aria-hidden sx={{
                  position: 'absolute', inset: 0, opacity: 0.25,
                  backgroundImage: 'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '14px 14px',
                }} />
                {cat ? <cat.Icon /> : null}
                {d?.annee && (
                  <Chip label={d.annee} size="small" sx={{
                    position: 'absolute', top: 12, right: 12, fontWeight: 700, bgcolor: 'rgba(255,255,255,0.92)', color,
                  }} />
                )}
              </Box>
              <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
                {d ? (
                  <>
                    <Typography fontSize={12} fontWeight={700} sx={{ color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {cat?.short}
                    </Typography>
                    <Typography fontSize={14.5} fontWeight={600} color="text.primary" sx={{
                      display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 63,
                    }}>{d.titre}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 'auto', color: 'primary.main', fontSize: 13, fontWeight: 600 }}>
                      Consulter <ArrowForwardIcon sx={{ fontSize: 15 }} />
                    </Box>
                  </>
                ) : (
                  <><Skeleton width="40%" /><Skeleton /><Skeleton width="80%" /></>
                )}
              </Box>
            </ButtonBase>
          )
        })}
        <ButtonBase onClick={() => navigate('/documentation')} sx={{
          flex: '0 0 auto', width: { xs: 200, md: 230 }, scrollSnapAlign: 'start', borderRadius: 4,
          border: '2px dashed', borderColor: 'divider', flexDirection: 'column', gap: 1.5, color: 'primary.main',
          '&:hover': { borderColor: 'primary.main', bgcolor: (t) => alpha(t.palette.primary.main, 0.04) },
        }}>
          <LibraryBooksIcon sx={{ fontSize: 36 }} />
          <Typography fontWeight={700}>Toute la bibliothèque</Typography>
          <ArrowForwardIcon />
        </ButtonBase>
      </Box>
    </Container>
  )
}

function Counter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const { ref, visible } = useReveal()
  const v = useCountUp(value, visible)
  return <span ref={ref as React.RefObject<HTMLSpanElement>}>{Math.round(v).toLocaleString('fr-FR')}{suffix}</span>
}

function StatsBand() {
  const [stats, setStats] = useState<Record<string, number> | null>(null)
  useEffect(() => {
    api.get('/documents-fiscaux/stats')
      .then((r: { data: Record<string, number> | [] }) => setStats(Array.isArray(r.data) ? {} : r.data))
      .catch(() => setStats({}))
  }, [])

  const n = (k?: string) => stats === null ? null
    : k ? Number(stats[k] ?? 0) : Object.values(stats).reduce((a, b) => a + Number(b), 0)
  const items = [
    { value: n(), suffix: '', label: 'textes fiscaux en ligne' },
    { value: n('lois_finances'), suffix: '', label: 'lois de finances' },
    { value: n('notes_communes'), suffix: '', label: 'notes communes' },
    { value: n('conventions'), suffix: '', label: 'conventions fiscales' },
  ]

  return (
    <Container sx={{ mt: { xs: 8, md: 12 } }}>
      <Reveal>
        <Box sx={{
          position: 'relative', overflow: 'hidden', borderRadius: 6, color: 'white',
          px: { xs: 3, md: 6 }, py: { xs: 4, md: 6 },
          background: 'linear-gradient(135deg, #0A1628 0%, #0D47A1 60%, #7C3AED 130%)',
        }}>
          <Box aria-hidden className="drift-blob" sx={{
            position: 'absolute', right: -100, top: -120, width: 360, height: 360, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(34,211,238,0.35), transparent 65%)',
          }} />
          <Box sx={{ position: 'relative', display: 'grid', gap: { xs: 3, md: 2 }, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' } }}>
            {items.map((it, i) => (
              <Box key={i} sx={{ borderLeft: { md: i ? '1px solid rgba(255,255,255,0.12)' : 'none' }, pl: { md: i ? 4 : 0 } }}>
                <Typography sx={{ fontSize: { xs: 32, md: 46 }, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>
                  {it.value === null ? <Skeleton width={80} sx={{ bgcolor: 'rgba(255,255,255,0.15)' }} /> : <Counter value={it.value} suffix={it.suffix} />}
                </Typography>
                <Typography sx={{ mt: 1, fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>{it.label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Reveal>
    </Container>
  )
}

function Steps({ isAdmin }: { isAdmin: boolean }) {
  const steps = isAdmin
    ? [
        { icon: <CloudUploadIcon />, title: 'Vos clients déposent', text: 'Relevés, factures et pièces arrivent directement dans leur dossier.' },
        { icon: <AutoAwesomeIcon />, title: 'Vous traitez', text: 'Lecture automatique, audit et messagerie pour aller plus vite.' },
        { icon: <TaskAltIcon />, title: 'Vous déclarez', text: 'Déclarations à l’heure et clients informés à chaque étape.' },
      ]
    : [
        { icon: <CloudUploadIcon />, title: 'Déposez', text: 'Envoyez vos relevés et factures en PDF ou en photo, depuis n’importe où.' },
        { icon: <AutoAwesomeIcon />, title: 'Nous traitons', text: 'Votre comptable vérifie, saisit et analyse vos pièces.' },
        { icon: <TaskAltIcon />, title: 'Vous êtes à jour', text: 'Déclarations déposées à temps, et tout reste consultable ici.' },
      ]

  return (
    <Container sx={{ mt: { xs: 8, md: 12 } }}>
      <Reveal>
        <SectionTitle eyebrow="Comment ça marche" title={isAdmin ? 'Votre cabinet en trois étapes' : 'Votre comptabilité en trois étapes'} />
      </Reveal>
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, position: 'relative' }}>
        <Box aria-hidden sx={{
          display: { xs: 'none', md: 'block' }, position: 'absolute', top: 34, left: '16%', right: '16%', height: 2,
          background: 'repeating-linear-gradient(90deg, rgba(59,130,246,0.4) 0 8px, transparent 8px 16px)',
        }} />
        {steps.map((st, i) => (
          <Reveal key={i} delay={i * 120}>
            <Box sx={{ textAlign: { md: 'center' }, display: 'flex', flexDirection: { xs: 'row', md: 'column' }, alignItems: { md: 'center' }, gap: 2 }}>
              <Box sx={{
                position: 'relative', width: 68, height: 68, flexShrink: 0, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                background: 'linear-gradient(135deg,#3B82F6,#7C3AED)', boxShadow: '0 14px 30px rgba(59,130,246,0.35)',
                '& svg': { fontSize: 30 },
              }}>
                {st.icon}
                <Box sx={{
                  position: 'absolute', top: -4, right: -4, width: 26, height: 26, borderRadius: '50%',
                  bgcolor: 'background.paper', color: 'primary.main', fontSize: 13, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                }}>{i + 1}</Box>
              </Box>
              <Box>
                <Typography fontWeight={700} fontSize={18}>{st.title}</Typography>
                <Typography color="text.secondary" fontSize={14.5} mt={0.5} sx={{ maxWidth: 320, mx: { md: 'auto' } }}>{st.text}</Typography>
              </Box>
            </Box>
          </Reveal>
        ))}
      </Box>
    </Container>
  )
}

function CtaBand({ isAdmin }: { isAdmin: boolean }) {
  const navigate = useNavigate()
  return (
    <Container sx={{ mt: { xs: 8, md: 12 } }}>
      <Reveal>
        <Box sx={{
          position: 'relative', overflow: 'hidden', borderRadius: 6, p: { xs: 3.5, md: 6 },
          display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { md: 'center' }, justifyContent: 'space-between', gap: 3,
          bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
        }}>
          <Box aria-hidden sx={{
            position: 'absolute', inset: 0, opacity: 0.6,
            background: 'radial-gradient(ellipse 50% 90% at 100% 50%, rgba(59,130,246,0.14), transparent 70%)',
          }} />
          <Box sx={{ position: 'relative' }}>
            <Typography component="h2" sx={{ fontSize: { xs: 24, md: 32 }, fontWeight: 800, letterSpacing: '-0.02em' }}>
              {isAdmin ? 'Des messages vous attendent peut-être.' : 'Une question sur votre dossier ?'}
            </Typography>
            <Typography color="text.secondary" mt={1} fontSize={16}>
              {isAdmin ? 'Répondez à vos clients depuis la messagerie du cabinet.' : 'Votre comptable vous répond directement depuis la messagerie.'}
            </Typography>
          </Box>
          <Button variant="contained" size="large" endIcon={<ForumIcon />}
            onClick={() => navigate(isAdmin ? '/admin/messages' : '/messages')}
            sx={{ position: 'relative', borderRadius: 99, px: 4, py: 1.5, fontWeight: 700, textTransform: 'none', fontSize: 15.5, flexShrink: 0 }}>
            Ouvrir la messagerie
          </Button>
        </Box>
      </Reveal>
    </Container>
  )
}

/* ───────────────────────────── Page ───────────────────────────── */

export default function Accueil() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const firstName = user?.nom?.split(' ')[0]

  return (
    <Box sx={{ pb: { xs: 2, md: 4 } }}>
      <HeroCarousel slides={isAdmin ? adminSlides : clientSlides} name={firstName} />
      <QuickAccess features={isAdmin ? adminFeatures : clientFeatures} />
      <DocsCarousel />
      <StatsBand />
      <Steps isAdmin={isAdmin} />
      <CtaBand isAdmin={isAdmin} />
    </Box>
  )
}
