import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Card, CardContent, Table, TableBody,
  TableCell, TableHead, TableRow, Chip, CircularProgress,
  Alert, Avatar, LinearProgress, Button, Tooltip, Collapse,
  List, ListItem, ListItemText, Divider, Grid,
} from '@mui/material'
import SecurityIcon from '@mui/icons-material/Security'
import RefreshIcon from '@mui/icons-material/Refresh'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import api from '../../api/axios'

function ClientAvatar({ email, nom, avatar }: { email: string; nom: string; avatar?: string | null }) {
  const [photo, setPhoto] = useState<string | null>(() =>
    avatar || localStorage.getItem(`profile_photo_${email}`) || null
  )
  useEffect(() => {
    const resolved = avatar || localStorage.getItem(`profile_photo_${email}`) || null
    setPhoto(resolved)
    const handler = () => {
      setPhoto(avatar || localStorage.getItem(`profile_photo_${email}`) || null)
    }
    window.addEventListener('profile_photo_changed', handler)
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener('profile_photo_changed', handler)
      window.removeEventListener('storage', handler)
    }
  }, [email, avatar])
  return (
    <Avatar src={photo ?? undefined}
      sx={{ width: 32, height: 32, bgcolor: '#1565C0', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
      {!photo && nom.charAt(0).toUpperCase()}
    </Avatar>
  )
}

interface ClientAudit {
  client: { id: number; nom: string; email: string; entreprise: string | null; avatar?: string | null }
  score: number
  niveau: string
  alerts_count: number
  missing_tasks: string[]
  last_activity: string | null
  anomalies: Array<{ type: string; titre: string; detail: string; impact: string }>
  verifications: Array<{ ok: boolean; label: string; detail: string }>
  recommandations: string[]
  stats: { total_ventes: number; total_achats: number; nb_factures: number; nb_declarations: number; nb_releves: number; nb_leasing?: number }
}

const scoreColor = (s: number) => s >= 80 ? '#2E7D32' : s >= 60 ? '#1565C0' : s >= 40 ? '#E65100' : '#C62828'
const scoreBg   = (s: number) => s >= 80 ? '#E8F5E9' : s >= 60 ? '#E3F0FF' : s >= 40 ? '#FFF3E0' : '#FFEBEE'

function formatActivity(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AdminAudit() {
  const [audits, setAudits]   = useState<ClientAudit[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)

  const fetchAudits = useCallback(() => {
    setLoading(true)
    api.get('/audit')
      .then((r: { data: { audits?: ClientAudit[] } }) => setAudits(r.data.audits ?? []))
      .catch(() => setAudits([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchAudits() }, [fetchAudits])

  const avgScore      = audits.length > 0 ? Math.round(audits.reduce((s, a) => s + a.score, 0) / audits.length) : 0
  const critical      = audits.filter(a => a.score < 40).length
  const withAnomalies = audits.filter(a => a.anomalies.length > 0).length
  const totalMissing  = audits.reduce((s, a) => s + (a.missing_tasks?.length ?? 0), 0)

  return (
    <Box className="fade-in">
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
            <Typography variant="h5" fontWeight={800} color="#1a1a2e">Audit des clients</Typography>
            <Typography color="text.secondary" fontSize={14}>Vue d'ensemble de la santé comptable de tous les clients</Typography>
          </Box>
        </Box>
        <Button startIcon={<RefreshIcon />} onClick={fetchAudits} variant="outlined" size="small"
          sx={{ fontWeight: 600, borderRadius: 2, textTransform: 'none' }}>
          Actualiser
        </Button>
      </Box>

      {/* Summary KPIs */}
      {!loading && audits.length > 0 && (
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          {[
            { label: 'Score moyen',       value: `${avgScore}/100`,  color: scoreColor(avgScore), bg: scoreBg(avgScore) },
            { label: 'Clients analysés',  value: audits.length,      color: '#1565C0',            bg: '#E3F0FF' },
            { label: 'Avec anomalies',    value: withAnomalies,      color: '#E65100',            bg: '#FFF3E0' },
            { label: 'Score critique',    value: critical,           color: '#C62828',            bg: '#FFEBEE' },
            { label: 'Tâches manquantes', value: totalMissing,       color: '#7B1FA2',            bg: '#F3E5F5' },
          ].map((k) => (
            <Card key={k.label} sx={{ borderRadius: 2.5, flex: '1 1 130px', minWidth: 130 }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography fontSize={11} color="text.secondary" mb={0.3}>{k.label}</Typography>
                <Typography fontWeight={800} fontSize={22} color={k.color}>{k.value}</Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : audits.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 3 }}>Aucun client enregistré sur la plateforme.</Alert>
      ) : (
        <Card sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: 0 }}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8f9ff' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Client</TableCell>
                  <TableCell sx={{ fontWeight: 700, minWidth: 150 }}>Score de fiabilité</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Niveau</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Anomalies</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Alertes</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Tâches</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Factures</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Déclarations</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Dernière activité</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Détail</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {audits.map((a) => (
                  <>
                    <TableRow key={a.client.id} sx={{ '&:hover': { bgcolor: '#f8f9ff' } }}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <ClientAvatar email={a.client.email} nom={a.client.nom} avatar={a.client.avatar} />
                          <Box>
                            <Typography fontWeight={600} fontSize={13}>{a.client.nom}</Typography>
                            <Typography fontSize={11} color="text.secondary">{a.client.entreprise ?? a.client.email}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <LinearProgress variant="determinate" value={a.score}
                            sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: '#f0f0f0',
                              '& .MuiLinearProgress-bar': { bgcolor: scoreColor(a.score), borderRadius: 3 } }} />
                          <Typography fontWeight={700} fontSize={13} color={scoreColor(a.score)} sx={{ minWidth: 28 }}>
                            {a.score}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label={a.niveau} size="small"
                          sx={{ bgcolor: scoreBg(a.score), color: scoreColor(a.score), fontWeight: 700 }} />
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={a.anomalies.length} size="small"
                          sx={{ bgcolor: a.anomalies.length > 0 ? '#FFF3E0' : '#E8F5E9',
                            color: a.anomalies.length > 0 ? '#E65100' : '#2E7D32', fontWeight: 700 }} />
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={(a.alerts_count ?? 0)} size="small"
                          sx={{ bgcolor: (a.alerts_count ?? 0) > 0 ? '#FFEBEE' : '#E8F5E9',
                            color: (a.alerts_count ?? 0) > 0 ? '#C62828' : '#2E7D32', fontWeight: 700 }} />
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title={(a.missing_tasks ?? []).join(' • ') || 'Aucune tâche manquante'}>
                          <Chip label={(a.missing_tasks ?? []).length} size="small"
                            sx={{ bgcolor: (a.missing_tasks ?? []).length > 0 ? '#F3E5F5' : '#E8F5E9',
                              color: (a.missing_tasks ?? []).length > 0 ? '#7B1FA2' : '#2E7D32', fontWeight: 700 }} />
                        </Tooltip>
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={a.stats.nb_factures} size="small" sx={{ bgcolor: '#e3f0ff', color: '#1565C0', fontWeight: 600 }} />
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={a.stats.nb_declarations} size="small" sx={{ bgcolor: '#f3e5f5', color: '#7B1FA2', fontWeight: 600 }} />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                          <AccessTimeIcon sx={{ fontSize: 13 }} />
                          <Typography fontSize={12}>{formatActivity(a.last_activity ?? null)}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title={expanded === a.client.id ? 'Réduire' : 'Voir le détail'}>
                          <Button size="small" variant="text"
                            onClick={() => setExpanded(expanded === a.client.id ? null : a.client.id)}
                            sx={{ minWidth: 0, p: 0.5 }}>
                            {expanded === a.client.id ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                          </Button>
                        </Tooltip>
                      </TableCell>
                    </TableRow>

                    {/* Expandable detail */}
                    <TableRow key={`detail-${a.client.id}`}>
                      <TableCell colSpan={10} sx={{ p: 0, border: 0 }}>
                        <Collapse in={expanded === a.client.id} timeout="auto" unmountOnExit>
                          <Box sx={{ px: 3, py: 2.5, bgcolor: '#fafbff', borderBottom: '1px solid #f0f0f0' }}>
                            <Grid container spacing={2.5}>

                              {/* Anomalies */}
                              <Grid item xs={12} md={4}>
                                <Typography fontWeight={700} fontSize={13} mb={1.5} color="#1a1a2e">
                                  Anomalies ({a.anomalies.length})
                                </Typography>
                                {a.anomalies.length === 0 ? (
                                  <Typography fontSize={12} color="#2E7D32" fontWeight={600}>
                                    ✓ Aucune anomalie détectée.
                                  </Typography>
                                ) : (
                                  <List disablePadding>
                                    {a.anomalies.map((an, i) => (
                                      <Box key={i}>
                                        {i > 0 && <Divider sx={{ my: 0.5 }} />}
                                        <ListItem disablePadding sx={{ py: 0.5 }}>
                                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', mr: 1.5, mt: 0.5, flexShrink: 0,
                                            bgcolor: an.type === 'error' ? '#C62828' : an.type === 'warning' ? '#E65100' : '#1565C0' }} />
                                          <ListItemText
                                            primary={an.titre}
                                            secondary={an.detail}
                                            primaryTypographyProps={{ fontSize: 12, fontWeight: 600 }}
                                            secondaryTypographyProps={{ fontSize: 11 }}
                                          />
                                          <Chip label={an.impact} size="small"
                                            sx={{ height: 18, fontSize: 10, ml: 1,
                                              bgcolor: an.impact === 'élevé' ? '#FFEBEE' : '#FFF3E0',
                                              color: an.impact === 'élevé' ? '#C62828' : '#E65100', fontWeight: 700 }} />
                                        </ListItem>
                                      </Box>
                                    ))}
                                  </List>
                                )}
                              </Grid>

                              {/* Vérifications */}
                              <Grid item xs={12} md={4}>
                                <Typography fontWeight={700} fontSize={13} mb={1.5} color="#1a1a2e">
                                  Vérifications ({a.verifications.filter(v => v.ok).length}/{a.verifications.length})
                                </Typography>
                                {a.verifications.length === 0 ? (
                                  <Typography fontSize={12} color="text.secondary">Aucune donnée.</Typography>
                                ) : (
                                  <List disablePadding>
                                    {a.verifications.map((v, i) => (
                                      <Box key={i}>
                                        {i > 0 && <Divider sx={{ my: 0.3 }} />}
                                        <ListItem disablePadding sx={{ py: 0.4 }}>
                                          {v.ok
                                            ? <CheckCircleIcon sx={{ color: '#2E7D32', fontSize: 16, mr: 1, flexShrink: 0 }} />
                                            : <CancelIcon sx={{ color: '#C62828', fontSize: 16, mr: 1, flexShrink: 0 }} />
                                          }
                                          <ListItemText
                                            primary={v.label}
                                            primaryTypographyProps={{ fontSize: 12, fontWeight: 600,
                                              color: v.ok ? 'inherit' : '#C62828' }}
                                          />
                                        </ListItem>
                                      </Box>
                                    ))}
                                  </List>
                                )}
                              </Grid>

                              {/* Recommandations */}
                              <Grid item xs={12} md={4}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1.5 }}>
                                  <LightbulbOutlinedIcon sx={{ color: '#E65100', fontSize: 16 }} />
                                  <Typography fontWeight={700} fontSize={13} color="#1a1a2e">
                                    Recommandations ({a.recommandations.length})
                                  </Typography>
                                </Box>
                                {a.recommandations.map((r, i) => (
                                  <Box key={i} sx={{ display: 'flex', gap: 1, mb: 0.8, alignItems: 'flex-start' }}>
                                    <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#E65100', mt: 0.7, flexShrink: 0 }} />
                                    <Typography fontSize={11} color="#5D4037">{r}</Typography>
                                  </Box>
                                ))}
                              </Grid>

                            </Grid>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </Box>
  )
}
