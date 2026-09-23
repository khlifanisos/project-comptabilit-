import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Card, CardContent, Grid, Chip, CircularProgress,
  Alert, List, ListItem, ListItemIcon, ListItemText, Divider, Button,
  LinearProgress, Tooltip,
} from '@mui/material'
import SecurityIcon from '@mui/icons-material/Security'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'
import RefreshIcon from '@mui/icons-material/Refresh'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import { useCurrency } from '../../contexts/CurrencyContext'

interface AiSummary {
  synthese: string
  actions_prioritaires: string[]
  cached: boolean
}

interface Anomalie {
  type: 'error' | 'warning' | 'info'
  titre: string
  detail: string
  impact: string
  lien?: string
}

interface Verification {
  ok: boolean
  label: string
  detail: string
}

interface AuditResult {
  score: number
  niveau: string
  anomalies: Anomalie[]
  verifications: Verification[]
  recommandations: string[]
  missing_tasks: string[]
  last_activity: string | null
  alerts_count: number
  stats: {
    total_ventes: number
    total_achats: number
    nb_factures: number
    nb_declarations: number
    nb_releves: number
    nb_leasing?: number
    cout_penalites_estime?: number
  }
}

const DEMO_AUDIT: AuditResult = {
  score: 74,
  niveau: 'Bon',
  alerts_count: 1,
  missing_tasks: ['Aucun relevé bancaire importé'],
  last_activity: null,
  anomalies: [
    { type: 'warning', titre: 'Facture sans rapprochement bancaire', detail: "3 factures de vente du mois de mai n'ont pas été rapprochées avec un mouvement bancaire correspondant.", impact: 'moyen',  lien: '/releves' },
    { type: 'error',   titre: 'Déclaration TVA en retard',           detail: 'La déclaration TVA du trimestre Q1 dépasse la date limite légale. Une pénalité peut être appliquée.',   impact: 'élevé',  lien: '/fiscales' },
    { type: 'info',    titre: "Contrat leasing proche de l'échéance",detail: "Le contrat CL-2023-04 expire dans 45 jours. Prévoir le renouvellement ou la clôture.",                   impact: 'faible', lien: '/leasing' },
  ],
  verifications: [
    { ok: true,  label: 'Cohérence des factures de vente', detail: 'Toutes les factures émises ont un numéro séquentiel valide et un client associé.' },
    { ok: true,  label: 'TVA collectée vs déclarée',        detail: 'Le montant de TVA collectée correspond aux déclarations soumises à la DGI.' },
    { ok: true,  label: 'Charges sociales CNSS',            detail: 'Les cotisations CNSS des 3 derniers mois ont été réglées dans les délais.' },
    { ok: false, label: 'Rapprochement bancaire complet',   detail: 'Des écarts subsistent entre le grand livre et les relevés bancaires importés.' },
    { ok: true,  label: 'Impôt sur les sociétés',           detail: "L'IS a été calculé correctement sur la base du résultat fiscal de l'exercice." },
    { ok: false, label: 'Aucun relevé bancaire importé',    detail: 'Action requise pour compléter votre dossier comptable' },
  ],
  recommandations: [
    'Réaliser le rapprochement bancaire hebdomadaire pour éviter les écarts en fin de mois.',
    'Mettre en place un rappel automatique 15 jours avant chaque échéance de déclaration fiscale.',
    "Archiver les pièces justificatives (factures fournisseurs) en version numérique dès réception.",
    "Vérifier les contrats de leasing dont l'échéance approche et anticiper les décisions de renouvellement.",
    "S'assurer que toutes les factures de ventes sont transmises dans les 7 jours suivant la prestation.",
    'Réaliser une revue trimestrielle des comptes de tiers pour détecter les soldes anormaux.',
  ],
  stats: {
    total_ventes:    1_240_500,
    total_achats:      875_200,
    nb_factures:            47,
    nb_declarations:        12,
    nb_releves:              0,
    nb_leasing:              3,
    cout_penalites_estime: 187.50,
  },
}

const POLL_INTERVAL = 60_000

function ScoreGauge({ score, niveau }: { score: number; niveau: string }) {
  const color =
    score >= 80 ? '#2E7D32'
    : score >= 60 ? '#1565C0'
    : score >= 40 ? '#E65100'
    : '#C62828'
  const bg =
    score >= 80 ? '#E8F5E9'
    : score >= 60 ? '#E3F0FF'
    : score >= 40 ? '#FFF3E0'
    : '#FFEBEE'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <CircularProgress variant="determinate" value={100} size={130} thickness={5}
          sx={{ color: '#f0f2f5', position: 'absolute' }} />
        <CircularProgress variant="determinate" value={score} size={130} thickness={5}
          sx={{ color, '& .MuiCircularProgress-circle': { strokeLinecap: 'round' } }} />
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="h3" fontWeight={800} color={color} lineHeight={1}>{score}</Typography>
          <Typography fontSize={12} color="text.secondary">/100</Typography>
        </Box>
      </Box>
      <Chip label={niveau} sx={{ bgcolor: bg, color, fontWeight: 700, fontSize: 14, px: 1 }} />
    </Box>
  )
}

const anomalieColor = (type: string) =>
  type === 'error' ? '#C62828' : type === 'warning' ? '#E65100' : '#1565C0'

const impactColor = (impact: string) =>
  impact === 'élevé' ? '#C62828' : impact === 'moyen' ? '#E65100' : '#2E7D32'

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60)   return `il y a ${diff}s`
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`
  return `il y a ${Math.floor(diff / 3600)}h`
}

export default function AuditIntelligent() {
  const { devise } = useCurrency()
  const navigate = useNavigate()
  const [audit, setAudit]       = useState<AuditResult | null>(null)
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefresh] = useState(false)
  const [isDemo, setIsDemo]     = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [, tick] = useState(0)

  // Copilote IA — appelé uniquement à la demande (jamais dans le polling)
  const [aiSummary, setAiSummary] = useState<AiSummary | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const generateAiSummary = useCallback((force = false) => {
    setAiLoading(true)
    api.get('/audit/ai-summary', { params: force ? { force: 1 } : {} })
      .then((r: { data: AiSummary }) => setAiSummary(r.data))
      .catch((err: any) => {
        toast.error(err?.response?.data?.message ?? "Impossible de générer l'analyse IA pour le moment.")
      })
      .finally(() => setAiLoading(false))
  }, [])

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchAudit = useCallback((silent = false) => {
    if (silent) setRefresh(true)
    else setLoading(true)
    setIsDemo(false)

    api.get('/audit')
      .then((r: { data: AuditResult }) => {
        const d = r.data
        if (d && typeof d.score === 'number') {
          setAudit(d)
          setIsDemo(false)
        } else {
          setAudit(DEMO_AUDIT)
          setIsDemo(true)
        }
        setLastUpdated(new Date())
      })
      .catch(() => {
        setAudit(DEMO_AUDIT)
        setIsDemo(true)
        setLastUpdated(new Date())
      })
      .finally(() => { setLoading(false); setRefresh(false) })
  }, [])

  useEffect(() => {
    fetchAudit()
    timerRef.current = setInterval(() => fetchAudit(true), POLL_INTERVAL)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [fetchAudit])

  // Tick every 10s to update "il y a Xs" display
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 10_000)
    return () => clearInterval(t)
  }, [])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 8 }}>
        <CircularProgress />
        <Typography color="text.secondary" fontSize={14}>Analyse en cours…</Typography>
      </Box>
    )
  }

  if (!audit) return null

  const okCount  = audit.verifications.filter(v => v.ok).length
  const nokCount = audit.verifications.filter(v => !v.ok).length

  return (
    <Box className="fade-in">
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{
            width: 48, height: 48, borderRadius: 2.5,
            background: 'linear-gradient(135deg,#7B1FA2,#6A1B9A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <SecurityIcon sx={{ color: 'white', fontSize: 26 }} />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={800} color="#1a1a2e">Audit intelligent</Typography>
            <Typography color="text.secondary" fontSize={14}>Analyse automatique de votre comptabilité</Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {lastUpdated && (
            <Tooltip title="Actualisation automatique toutes les 60 secondes">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                <AccessTimeIcon sx={{ fontSize: 14 }} />
                <Typography fontSize={11}>{timeAgo(lastUpdated)}</Typography>
              </Box>
            </Tooltip>
          )}
          {isDemo && (
            <Chip label="Données de démonstration" size="small"
              sx={{ bgcolor: '#FFF3E0', color: '#E65100', fontWeight: 600, fontSize: 11 }} />
          )}
          <Button startIcon={refreshing ? <CircularProgress size={14} /> : <RefreshIcon />}
            onClick={() => fetchAudit(false)} variant="outlined" size="small"
            disabled={refreshing}
            sx={{ fontWeight: 600, borderRadius: 2, textTransform: 'none' }}>
            Actualiser
          </Button>
        </Box>
      </Box>

      {/* Score + Stats */}
      <Grid container spacing={2.5} mb={3}>
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 3, height: '100%' }}>
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2.5 }}>
              <Typography fontWeight={700} fontSize={16} color="#1a1a2e" alignSelf="flex-start">Score de fiabilité</Typography>
              <ScoreGauge score={audit.score} niveau={audit.niveau} />
              <Box sx={{ width: '100%' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography fontSize={12} color="text.secondary">Progression globale</Typography>
                  <Typography fontSize={12} fontWeight={600}>{audit.score}%</Typography>
                </Box>
                <LinearProgress variant="determinate" value={audit.score}
                  sx={{ height: 7, borderRadius: 3, bgcolor: '#f0f2f5',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: audit.score >= 80 ? '#2E7D32' : audit.score >= 60 ? '#1565C0' : audit.score >= 40 ? '#E65100' : '#C62828',
                      borderRadius: 3,
                    },
                  }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card sx={{ borderRadius: 3, height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography fontWeight={700} fontSize={16} color="#1a1a2e" mb={2.5}>Données analysées</Typography>
              <Grid container spacing={1.5}>
                {[
                  { label: 'Total ventes',     value: `${Number(audit.stats.total_ventes).toLocaleString('fr-FR')} ${devise}`, color: '#1565C0' },
                  { label: 'Total achats',     value: `${Number(audit.stats.total_achats).toLocaleString('fr-FR')} ${devise}`, color: '#E65100' },
                  { label: 'Factures',         value: audit.stats.nb_factures,     color: '#2E7D32' },
                  { label: 'Déclarations',     value: audit.stats.nb_declarations, color: '#7B1FA2' },
                  { label: 'Relevés bancaires',value: audit.stats.nb_releves,      color: '#0288D1' },
                  { label: 'Anomalies',        value: audit.anomalies.length,      color: audit.anomalies.length > 0 ? '#C62828' : '#2E7D32' },
                  ...(audit.stats.cout_penalites_estime
                    ? [{
                        label: 'Pénalités estimées (CDPF)',
                        value: `${Number(audit.stats.cout_penalites_estime).toLocaleString('fr-FR')} ${devise}`,
                        color: '#C62828',
                      }]
                    : []),
                ].map((s) => (
                  <Grid item xs={6} sm={4} key={s.label}>
                    <Box sx={{ p: 1.8, borderRadius: 2, bgcolor: `${s.color}08`, border: `1px solid ${s.color}20` }}>
                      <Typography fontSize={11} color="text.secondary" mb={0.3}>{s.label}</Typography>
                      <Typography fontWeight={700} color={s.color} fontSize={15}>{s.value}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        {/* Anomalies */}
        <Grid item xs={12} lg={6}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                <ErrorOutlineIcon sx={{ color: '#C62828', fontSize: 21 }} />
                <Typography fontWeight={700} fontSize={16} color="#1a1a2e">Anomalies détectées</Typography>
                <Box sx={{ ml: 'auto', display: 'flex', gap: 0.8 }}>
                  {audit.alerts_count > 0 && (
                    <Chip label={`${audit.alerts_count} critique(s)`} size="small"
                      sx={{ bgcolor: '#FFEBEE', color: '#C62828', fontWeight: 700 }} />
                  )}
                  <Chip label={audit.anomalies.length} size="small"
                    sx={{ bgcolor: audit.anomalies.length > 0 ? '#FFF3E0' : '#E8F5E9',
                      color: audit.anomalies.length > 0 ? '#E65100' : '#2E7D32', fontWeight: 700 }} />
                </Box>
              </Box>
              {audit.anomalies.length === 0 ? (
                <Alert severity="success" sx={{ borderRadius: 2, fontSize: 13 }}>
                  Aucune anomalie détectée. Excellent travail !
                </Alert>
              ) : (
                <List disablePadding>
                  {audit.anomalies.map((a, i) => (
                    <Box key={i}>
                      {i > 0 && <Divider sx={{ my: 1 }} />}
                      <Box
                        onClick={() => a.lien && navigate(a.lien)}
                        sx={{
                          display: 'flex', gap: 1.5, py: 0.8, px: 1, borderRadius: 2,
                          cursor: a.lien ? 'pointer' : 'default',
                          transition: 'background 0.15s',
                          '&:hover': a.lien ? { bgcolor: `${anomalieColor(a.type)}08` } : {},
                        }}
                      >
                        <Box sx={{ mt: 0.6, width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          bgcolor: anomalieColor(a.type) }} />
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                            <Typography fontWeight={600} fontSize={13}
                              sx={{ color: a.lien ? anomalieColor(a.type) : 'inherit',
                                textDecoration: a.lien ? 'underline' : 'none',
                                textDecorationStyle: 'dotted' }}>
                              {a.titre}
                            </Typography>
                            <Chip label={`Impact ${a.impact}`} size="small"
                              sx={{ height: 18, fontSize: 10,
                                bgcolor: `${impactColor(a.impact)}15`, color: impactColor(a.impact), fontWeight: 700 }} />
                          </Box>
                          <Typography fontSize={12} color="text.secondary" mt={0.3}>{a.detail}</Typography>
                        </Box>
                      </Box>
                    </Box>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Vérifications */}
        <Grid item xs={12} lg={6}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                <CheckCircleIcon sx={{ color: '#2E7D32', fontSize: 21 }} />
                <Typography fontWeight={700} fontSize={16} color="#1a1a2e">Vérifications</Typography>
                <Box sx={{ ml: 'auto', display: 'flex', gap: 0.8 }}>
                  {okCount > 0 && (
                    <Chip label={`${okCount} ✓`} size="small"
                      sx={{ bgcolor: '#E8F5E9', color: '#2E7D32', fontWeight: 700 }} />
                  )}
                  {nokCount > 0 && (
                    <Chip label={`${nokCount} ✗`} size="small"
                      sx={{ bgcolor: '#FFEBEE', color: '#C62828', fontWeight: 700 }} />
                  )}
                </Box>
              </Box>
              {audit.verifications.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2, fontSize: 13 }}>
                  Aucune donnée disponible. Importez vos documents pour lancer l'analyse.
                </Alert>
              ) : (
                <List disablePadding>
                  {audit.verifications.map((v, i) => (
                    <Box key={i}>
                      {i > 0 && <Divider sx={{ my: 0.5 }} />}
                      <ListItem disablePadding sx={{ py: 0.8 }}>
                        <ListItemIcon sx={{ minWidth: 34 }}>
                          {v.ok
                            ? <CheckCircleIcon sx={{ color: '#2E7D32', fontSize: 18 }} />
                            : <CancelIcon sx={{ color: '#C62828', fontSize: 18 }} />
                          }
                        </ListItemIcon>
                        <ListItemText
                          primary={v.label}
                          secondary={v.detail}
                          primaryTypographyProps={{ fontSize: 13, fontWeight: 600, color: v.ok ? 'inherit' : '#C62828' }}
                          secondaryTypographyProps={{ fontSize: 12 }}
                        />
                      </ListItem>
                    </Box>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Copilote IA — généré à la demande uniquement */}
        <Grid item xs={12}>
          <Card sx={{ borderRadius: 3, border: '1px solid #E1BEE7' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: aiSummary ? 2 : 0, flexWrap: 'wrap' }}>
                <AutoAwesomeIcon sx={{ color: '#7B1FA2', fontSize: 21 }} />
                <Typography fontWeight={700} fontSize={16} color="#1a1a2e">Copilote IA</Typography>
                {aiSummary?.cached && (
                  <Chip label="Résultat en cache (15 min)" size="small"
                    sx={{ bgcolor: '#F3E5F5', color: '#7B1FA2', fontWeight: 600, fontSize: 10.5 }} />
                )}
                <Button
                  size="small" startIcon={aiLoading ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeIcon />}
                  onClick={() => generateAiSummary(!!aiSummary)}
                  disabled={aiLoading}
                  sx={{ ml: 'auto', textTransform: 'none', fontWeight: 700, borderRadius: 2,
                    bgcolor: '#7B1FA2', color: 'white', '&:hover': { bgcolor: '#6A1B9A' } }}
                  variant="contained"
                >
                  {aiLoading ? 'Analyse en cours…' : aiSummary ? 'Régénérer' : 'Générer une analyse IA'}
                </Button>
              </Box>
              {!aiSummary && !aiLoading && (
                <Typography fontSize={12.5} color="text.secondary">
                  Obtenez une synthèse en langage naturel et des actions prioritaires générées par IA à partir de cet audit (non actualisé automatiquement, pour préserver le quota).
                </Typography>
              )}
              {aiSummary && (
                <Box>
                  <Typography fontSize={13.5} color="#4A148C" sx={{ mb: 1.5, lineHeight: 1.6 }}>
                    {aiSummary.synthese}
                  </Typography>
                  {aiSummary.actions_prioritaires.length > 0 && (
                    <List disablePadding>
                      {aiSummary.actions_prioritaires.map((a, i) => (
                        <ListItem key={i} disablePadding sx={{ py: 0.5, alignItems: 'flex-start' }}>
                          <ListItemIcon sx={{ minWidth: 26, mt: 0.3 }}>
                            <Chip label={i + 1} size="small"
                              sx={{ height: 18, width: 18, fontSize: 10.5, fontWeight: 700, bgcolor: '#F3E5F5', color: '#7B1FA2' }} />
                          </ListItemIcon>
                          <ListItemText primary={a} primaryTypographyProps={{ fontSize: 13 }} />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recommandations */}
        <Grid item xs={12}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                <LightbulbOutlinedIcon sx={{ color: '#E65100', fontSize: 21 }} />
                <Typography fontWeight={700} fontSize={16} color="#1a1a2e">Recommandations</Typography>
                <Chip label={audit.recommandations.length} size="small"
                  sx={{ ml: 'auto', bgcolor: '#FFF3E0', color: '#E65100', fontWeight: 700 }} />
              </Box>
              <Grid container spacing={1.5}>
                {audit.recommandations.map((r, i) => (
                  <Grid item xs={12} sm={6} key={i}>
                    <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#FFFDE7', border: '1px solid #FFE082',
                      display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#E65100', mt: 0.8, flexShrink: 0 }} />
                      <Typography fontSize={13} color="#5D4037">{r}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
