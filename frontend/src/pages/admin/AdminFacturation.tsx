import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Box, Typography, Card, CardContent, Button, IconButton, Tooltip, Chip, Tabs, Tab,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, MenuItem, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid, Switch, FormControlLabel, InputAdornment,
} from '@mui/material'
import ReceiptLongIcon   from '@mui/icons-material/ReceiptLong'
import PictureAsPdfIcon  from '@mui/icons-material/PictureAsPdf'
import PaymentsIcon      from '@mui/icons-material/Payments'
import TaskAltIcon       from '@mui/icons-material/TaskAlt'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon          from '@mui/icons-material/Edit'
import AddIcon           from '@mui/icons-material/Add'
import AutorenewIcon     from '@mui/icons-material/Autorenew'
import SearchIcon        from '@mui/icons-material/Search'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import { useAuth } from '../../contexts/AuthContext'

// ── Types ────────────────────────────────────────────────────────────────────
type Etat = 'prefacture' | 'en_instance' | 'impayee' | 'partielle' | 'reglee'
type ModeReglement = 'virement' | 'cheque' | 'especes' | 'traite' | 'carte'
type TypeContrat = 'mensuelle' | 'trimestrielle' | 'semestrielle' | 'annuelle' | 'mission'

interface Reglement {
  id: number
  mode: ModeReglement
  banque: string | null
  reference: string | null
  montant: number
  date_reglement: string
  observation: string | null
}

interface Facture {
  id: number
  numero: string
  prefacture: boolean
  date_facture: string
  client_id: number | null
  client_nom: string
  matricule_fiscale: string | null
  societe: string | null
  origine: 'ticket' | 'contrat' | 'autre'
  origine_label: string
  periode_debut: string | null
  periode_fin: string | null
  montant_ht: number
  net_facture: number
  etat: Etat
  reglements: Reglement[]
  montant_regle: number
  reste: number
}


interface Contrat {
  id: number
  client_id: number
  societe: string | null
  designation: string | null
  type: TypeContrat
  montant_ht: number
  taux_tva: number
  date_debut: string
  date_fin: string | null
  actif: boolean
}

interface ClientFiche {
  id: number
  nom: string
  email: string
  raison_sociale: string | null
  matricule_fiscale: string | null
  gerant: string | null
  contact: string | null
  telephone: string | null
  adresse: string | null
  contrats: Contrat[]
  total_facture: number
  solde: number
}

// ── Labels ───────────────────────────────────────────────────────────────────
const ETATS: Record<Etat, { label: string; bg: string; color: string }> = {
  prefacture:  { label: 'Préfacture',  bg: '#EDE7F6', color: '#5E35B1' },
  en_instance: { label: 'En instance', bg: '#F1F5F9', color: '#475569' },
  impayee:     { label: 'Impayée',     bg: '#FFEBEE', color: '#C62828' },
  partielle:   { label: 'Partielle',   bg: '#FFF3E0', color: '#E65100' },
  reglee:      { label: 'Réglée',      bg: '#E8F5E9', color: '#2E7D32' },
}

const MODES: Record<ModeReglement, string> = {
  virement: 'Virement bancaire', cheque: 'Chèque', especes: 'Espèces', traite: 'Traite', carte: 'Carte bancaire',
}
const MODES_AVEC_BANQUE: ModeReglement[] = ['virement', 'cheque', 'traite']
const BANQUES = ['BIAT', 'STB', 'BNA', 'Attijari Bank', 'Amen Bank', 'BH Bank', 'UIB', 'UBCI', 'BT', 'ATB', 'Banque Zitouna', 'Al Baraka', 'QNB', 'Poste Tunisienne']

const TYPES: Record<TypeContrat, { label: string; mois: number }> = {
  mensuelle:     { label: 'Mensuelle',          mois: 1 },
  trimestrielle: { label: 'Trimestrielle',      mois: 3 },
  semestrielle:  { label: 'Semestrielle',       mois: 6 },
  annuelle:      { label: 'Annuelle',           mois: 12 },
  mission:       { label: 'Mission temporaire', mois: 0 },
}

const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const fmtDate = (d: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR') : '—')
const today = () => new Date().toISOString().slice(0, 10)
const errMsg = (err: any, fallback: string) => {
  const errors = err?.response?.data?.errors
  return errors ? String(Object.values(errors)[0]) : err?.response?.data?.message ?? fallback
}

async function downloadBlob(url: string, filename: string) {
  const res = await api.get(url, { responseType: 'blob' })
  const href = window.URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(href)
}

// ═════════════════════════════════════════════════════════════════════════════
export default function AdminFacturation() {
  const { user } = useAuth()
  const isSuperAdmin = !!user?.is_super_admin
  const [tab, setTab] = useState(0)
  const [clients, setClients] = useState<ClientFiche[]>([])

  const loadClients = useCallback(() => {
    api.get('/facturation/clients')
      .then((r: { data: ClientFiche[] }) => setClients(r.data))
      .catch(() => toast.error('Impossible de charger les clients.'))
  }, [])

  useEffect(() => { loadClients() }, [loadClients])

  return (
    <Box className="fade-in">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5 }}>
        <Box sx={{
          width: 48, height: 48, borderRadius: 2.5, background: 'linear-gradient(135deg,#1F4E78,#0D2E4D)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ReceiptLongIcon sx={{ color: 'white', fontSize: 26 }} />
        </Box>
        <Box>
          <Typography variant="h5" fontWeight={800} color="text.primary" fontSize={{ xs: 17, md: 22 }}>Facturation</Typography>
          <Typography color="text.secondary" fontSize={14}>
            Factures des tickets et des contrats, imputation des règlements, fiches clients
          </Typography>
        </Box>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2.5, '& .MuiTab-root': { textTransform: 'none', fontWeight: 700 } }}>
        <Tab label="Liste des factures" />
        <Tab label="Fiches clients" />
        <Tab label="Contrats" />
      </Tabs>

      {tab === 0 && <FacturesTab clients={clients} isSuperAdmin={isSuperAdmin} onChanged={loadClients} />}
      {tab === 1 && <FichesTab clients={clients} isSuperAdmin={isSuperAdmin} reload={loadClients} />}
      {tab === 2 && <ContratsTab clients={clients} isSuperAdmin={isSuperAdmin} reload={loadClients} />}
    </Box>
  )
}

// ── Dossier client : tout ce qui concerne la facturation d'un client ─────────
interface Totaux { facture: number; regle: number; reste: number; prefactures: number; nb_prefactures: number }

/** Facturation folder of the client dossier: summary, contracts, then the client's invoices and préfactures. */
export function ClientFacturationFolder({ clientId, onChanged }: { clientId: number; onChanged?: () => void }) {
  const { user } = useAuth()
  const isSuperAdmin = !!user?.is_super_admin
  const [fiche, setFiche] = useState<ClientFiche | null>(null)
  const [totaux, setTotaux] = useState<Totaux | null>(null)

  const loadFiche = useCallback(() => {
    api.get('/facturation/clients')
      .then((r: { data: ClientFiche[] }) => setFiche(r.data.find(c => c.id === clientId) ?? null))
      .catch(() => {})
  }, [clientId])

  useEffect(() => { loadFiche() }, [loadFiche])

  const changed = () => { loadFiche(); onChanged?.() }

  const stat = (label: string, value: string, color: string) => (
    <Box sx={{ flex: '1 1 150px', p: 1.5, borderRadius: 2, bgcolor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
      <Typography fontSize={11.5} color="text.secondary" fontWeight={600}>{label}</Typography>
      <Typography fontSize={16} fontWeight={800} color={color}>{value}</Typography>
    </Box>
  )

  return (
    <>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
        {stat('Total facturé', totaux ? fmt(totaux.facture) : '—', '#1F4E78')}
        {stat('Total réglé', totaux ? fmt(totaux.regle) : '—', '#2E7D32')}
        {stat('Reste à encaisser', totaux ? fmt(totaux.reste) : '—', totaux && totaux.reste > 0 ? '#C62828' : '#2E7D32')}
        {stat(`Préfactures (${totaux?.nb_prefactures ?? 0})`, totaux ? fmt(totaux.prefactures) : '—', '#5E35B1')}
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography fontWeight={700} fontSize={13.5} mb={1}>Contrats</Typography>
        {!fiche || fiche.contrats.length === 0 ? (
          <Typography fontSize={12.5} color="text.secondary">Aucun contrat pour ce client.</Typography>
        ) : (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {fiche.contrats.map(k => (
              <Box key={k.id} sx={{ px: 1.5, py: 1, borderRadius: 2, border: '1px solid #E2E8F0', bgcolor: k.actif ? '#fff' : '#F8FAFC' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography fontSize={12.5} fontWeight={700}>{TYPES[k.type].label}{k.designation ? ` — ${k.designation}` : ''}</Typography>
                  <Chip size="small" label={k.actif ? 'Actif' : 'Inactif'}
                    sx={{ height: 18, fontSize: 10.5, fontWeight: 700, bgcolor: k.actif ? '#E8F5E9' : '#F1F5F9', color: k.actif ? '#2E7D32' : '#64748B' }} />
                </Box>
                <Typography fontSize={11.5} color="text.secondary">
                  {fmt(k.montant_ht)} HT · TVA {k.taux_tva} % · {fmtDate(k.date_debut)} → {fmtDate(k.date_fin)}{k.societe ? ` · ${k.societe}` : ''}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      <FacturesTab clientId={clientId} isSuperAdmin={isSuperAdmin} onChanged={changed} onTotaux={setTotaux} />
    </>
  )
}

// ── Liste des factures ───────────────────────────────────────────────────────
/** With clientId the list is locked on that client (client dossier): no client filter nor generation. */
function FacturesTab({ clients = [], isSuperAdmin, onChanged, clientId, onTotaux }: {
  clients?: ClientFiche[]; isSuperAdmin: boolean; onChanged: () => void; clientId?: number; onTotaux?: (t: Totaux) => void
}) {
  const [factures, setFactures] = useState<Facture[]>([])
  const [societes, setSocietes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ societe: '', client_id: clientId ? String(clientId) : '', statut: '', origine: '', du: '', au: '', q: '' })
  const [busyId, setBusyId] = useState<number | null>(null)
  const [reglementFor, setReglementFor] = useState<Facture | null>(null)
  const [genOpen, setGenOpen] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''))
    api.get('/facturation/factures', { params })
      .then(({ data }) => { setFactures(data.factures); setSocietes(data.societes); onTotaux?.(data.totaux) })
      .catch(() => toast.error('Impossible de charger les factures.'))
      .finally(() => setLoading(false))
  }, [filters, onTotaux])

  useEffect(() => {
    const t = setTimeout(load, filters.q ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, filters.q])

  const setF = (k: keyof typeof filters, v: string) => setFilters(f => ({ ...f, [k]: v }))
  const replace = (f: Facture) => setFactures(prev => prev.map(x => (x.id === f.id ? f : x)))

  const valider = async (f: Facture) => {
    if (!window.confirm(`Valider la préfacture ${f.numero} ? Elle recevra un numéro de facture définitif.`)) return
    setBusyId(f.id)
    try {
      const { data } = await api.post(`/facturation/factures/${f.id}/valider`)
      toast.success(data.message)
      load(); onChanged()
    } catch (err) { toast.error(errMsg(err, 'Erreur lors de la validation.')) }
    finally { setBusyId(null) }
  }

  const supprimer = async (f: Facture) => {
    if (!window.confirm(`Supprimer la préfacture ${f.numero} ?`)) return
    setBusyId(f.id)
    try {
      const { data } = await api.delete(`/facturation/factures/${f.id}`)
      toast.success(data.message)
      load()
    } catch (err) { toast.error(errMsg(err, 'Erreur lors de la suppression.')) }
    finally { setBusyId(null) }
  }

  const supprimerReglement = async (r: Reglement) => {
    if (!window.confirm(`Supprimer le règlement de ${fmt(r.montant)} ?`)) return
    try {
      const { data } = await api.delete(`/facturation/reglements/${r.id}`)
      toast.success(data.message)
      replace(data.facture); load(); onChanged()
    } catch (err) { toast.error(errMsg(err, 'Erreur lors de la suppression.')) }
  }

  const pdf = async (f: Facture) => {
    setBusyId(f.id)
    try { await downloadBlob(`/facturation/factures/${f.id}/pdf`, `${f.prefacture ? 'Prefacture' : 'Facture'}_${f.numero}.pdf`) }
    catch { toast.error('Impossible de générer le PDF.') }
    finally { setBusyId(null) }
  }

  const head = { fontWeight: 700, fontSize: 12, bgcolor: '#1F4E78', color: '#fff', whiteSpace: 'nowrap' as const }
  const cell = { fontSize: 12.5, verticalAlign: 'top' as const }

  return (
    <>

      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
          {/* Filtres */}
          <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
            <TextField size="small" placeholder="N° ou client…" value={filters.q} onChange={e => setF('q', e.target.value)} sx={{ width: 180 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
            <TextField select size="small" label="Société" value={filters.societe} onChange={e => setF('societe', e.target.value)} sx={{ minWidth: 140 }}>
              <MenuItem value="">Toutes</MenuItem>
              {societes.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
            {!clientId && (
              <TextField select size="small" label="Client" value={filters.client_id} onChange={e => setF('client_id', e.target.value)} sx={{ minWidth: 170 }}>
                <MenuItem value="">Tous</MenuItem>
                {clients.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.raison_sociale || c.nom}</MenuItem>)}
              </TextField>
            )}
            <TextField select size="small" label="État" value={filters.statut} onChange={e => setF('statut', e.target.value)} sx={{ minWidth: 130 }}>
              <MenuItem value="">Tous</MenuItem>
              {(Object.keys(ETATS) as Etat[]).map(e => <MenuItem key={e} value={e}>{ETATS[e].label}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Origine" value={filters.origine} onChange={e => setF('origine', e.target.value)} sx={{ minWidth: 120 }}>
              <MenuItem value="">Toutes</MenuItem>
              <MenuItem value="ticket">Tickets</MenuItem>
              <MenuItem value="contrat">Contrats</MenuItem>
            </TextField>
            <TextField size="small" type="date" label="Du" InputLabelProps={{ shrink: true }} value={filters.du} onChange={e => setF('du', e.target.value)} />
            <TextField size="small" type="date" label="Au" InputLabelProps={{ shrink: true }} value={filters.au} onChange={e => setF('au', e.target.value)} />
            {isSuperAdmin && !clientId && (
              <Button variant="contained" startIcon={<AutorenewIcon />} onClick={() => setGenOpen(true)}
                sx={{ ml: 'auto', textTransform: 'none', fontWeight: 700, borderRadius: 2, bgcolor: '#5E35B1', '&:hover': { bgcolor: '#4527A0' } }}>
                Générer les préfactures
              </Button>
            )}
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={24} /></Box>
          ) : factures.length === 0 ? (
            <Typography color="text.secondary" fontSize={13.5} textAlign="center" py={6}>
              {clientId ? 'Aucune facture ni préfacture pour ce client.' : 'Aucune facture pour ces filtres.'}
            </Typography>
          ) : (
            <Box sx={{ overflowX: 'auto', maxHeight: '65vh', overflowY: 'auto' }}>
              <Table size="small" stickyHeader sx={{ minWidth: 1100 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={head}>Facture</TableCell>
                    <TableCell sx={head}>Client</TableCell>
                    <TableCell sx={head}>Origine</TableCell>
                    <TableCell sx={head} align="right">Montant TTC</TableCell>
                    <TableCell sx={head}>Règlement</TableCell>
                    <TableCell sx={head} align="right">Montant</TableCell>
                    <TableCell sx={head}>Date de règlement</TableCell>
                    <TableCell sx={head} align="right">Reste</TableCell>
                    <TableCell sx={head}>État</TableCell>
                    <TableCell sx={head} align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {factures.map(f => {
                    const e = ETATS[f.etat]
                    const busy = busyId === f.id
                    return (
                      <TableRow key={f.id} hover>
                        <TableCell sx={cell}>
                          <Typography fontSize={12.5} fontWeight={700} fontFamily="monospace" color={f.prefacture ? '#5E35B1' : '#1F4E78'}>{f.numero}</Typography>
                          <Typography fontSize={11.5} color="text.secondary">{fmtDate(f.date_facture)}{f.societe ? ` · ${f.societe}` : ''}</Typography>
                        </TableCell>
                        <TableCell sx={cell}>
                          <Typography fontSize={12.5} fontWeight={600}>{f.client_nom}</Typography>
                          {f.matricule_fiscale && <Typography fontSize={11} color="text.secondary">IU {f.matricule_fiscale}</Typography>}
                        </TableCell>
                        <TableCell sx={{ ...cell, maxWidth: 220 }}>
                          <Typography fontSize={12} noWrap title={f.origine_label}>{f.origine_label}</Typography>
                          {f.periode_debut && <Typography fontSize={11} color="text.secondary">{fmtDate(f.periode_debut)} → {fmtDate(f.periode_fin)}</Typography>}
                        </TableCell>
                        <TableCell sx={{ ...cell, fontWeight: 700 }} align="right">{fmt(f.net_facture)}</TableCell>

                        {/* One line per imputed payment, as on the paper register. */}
                        <TableCell sx={cell}>
                          {f.reglements.length === 0 ? <Typography fontSize={12} color="text.disabled">—</Typography> : f.reglements.map(r => (
                            <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', minHeight: 24 }}>
                              <Typography fontSize={12}>
                                {MODES[r.mode]}{r.banque ? ` — ${r.banque}` : ''}{r.reference ? ` · ${r.reference}` : ''}
                              </Typography>
                            </Box>
                          ))}
                        </TableCell>
                        <TableCell sx={cell} align="right">
                          {f.reglements.map(r => (
                            <Box key={r.id} sx={{ minHeight: 24, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                              <Typography fontSize={12} color="#2E7D32" fontWeight={600}>{fmt(r.montant)}</Typography>
                            </Box>
                          ))}
                        </TableCell>
                        <TableCell sx={cell}>
                          {f.reglements.map(r => (
                            <Box key={r.id} sx={{ minHeight: 24, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Typography fontSize={12}>{fmtDate(r.date_reglement)}</Typography>
                              <Tooltip title="Supprimer ce règlement">
                                <IconButton size="small" sx={{ p: 0.25 }} onClick={() => supprimerReglement(r)}>
                                  <DeleteOutlineIcon sx={{ fontSize: 15, color: '#C62828' }} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          ))}
                        </TableCell>

                        <TableCell sx={{ ...cell, fontWeight: 700, color: f.reste > 0 ? '#C62828' : '#2E7D32' }} align="right">{fmt(f.reste)}</TableCell>
                        <TableCell sx={cell}><Chip size="small" label={e.label} sx={{ bgcolor: e.bg, color: e.color, fontWeight: 700, fontSize: 11 }} /></TableCell>
                        <TableCell sx={{ ...cell, whiteSpace: 'nowrap' }} align="center">
                          {(f.etat === 'prefacture' || f.etat === 'en_instance') && (
                            <Tooltip title="Valider en facture">
                              <span><IconButton size="small" disabled={busy} onClick={() => valider(f)}><TaskAltIcon fontSize="small" sx={{ color: '#5E35B1' }} /></IconButton></span>
                            </Tooltip>
                          )}
                          {(f.etat === 'impayee' || f.etat === 'partielle') && (
                            <Tooltip title="Imputer un règlement">
                              <IconButton size="small" onClick={() => setReglementFor(f)}><PaymentsIcon fontSize="small" sx={{ color: '#2E7D32' }} /></IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="PDF">
                            <span><IconButton size="small" disabled={busy} onClick={() => pdf(f)}><PictureAsPdfIcon fontSize="small" sx={{ color: '#1F4E78' }} /></IconButton></span>
                          </Tooltip>
                          {isSuperAdmin && f.prefacture && (
                            <Tooltip title="Supprimer la préfacture">
                              <span><IconButton size="small" disabled={busy} onClick={() => supprimer(f)}><DeleteOutlineIcon fontSize="small" sx={{ color: '#C62828' }} /></IconButton></span>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>

      <ReglementDialog facture={reglementFor} onClose={() => setReglementFor(null)}
        onSaved={f => { replace(f); setReglementFor(null); load(); onChanged() }} />
      <GenererDialog open={genOpen} onClose={() => setGenOpen(false)} onDone={() => { setGenOpen(false); load() }} />
    </>
  )
}

function ReglementDialog({ facture, onClose, onSaved }: { facture: Facture | null; onClose: () => void; onSaved: (f: Facture) => void }) {
  const [form, setForm] = useState({ mode: 'virement' as ModeReglement, banque: '', reference: '', montant: '', date_reglement: today(), observation: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (facture) setForm({ mode: 'virement', banque: '', reference: '', montant: String(facture.reste), date_reglement: today(), observation: '' })
  }, [facture])

  const avecBanque = MODES_AVEC_BANQUE.includes(form.mode)
  const save = async () => {
    if (!facture) return
    setSaving(true)
    try {
      const { data } = await api.post(`/facturation/factures/${facture.id}/reglements`, {
        ...form, montant: Number(form.montant.replace(',', '.')), banque: avecBanque ? form.banque : null,
      })
      toast.success(data.message)
      onSaved(data.facture)
    } catch (err) { toast.error(errMsg(err, "Erreur lors de l'imputation.")) }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={!!facture} onClose={() => !saving && onClose()} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 800, pb: 0.5 }}>Imputer un règlement</DialogTitle>
      {facture && (
        <DialogContent>
          <Typography fontSize={13} color="text.secondary" mb={2}>
            Facture <b>{facture.numero}</b> — {facture.client_nom} — reste à payer <b>{fmt(facture.reste)}</b>
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
            <TextField select size="small" label="Mode de règlement" value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value as ModeReglement }))}>
              {(Object.keys(MODES) as ModeReglement[]).map(m => <MenuItem key={m} value={m}>{MODES[m]}</MenuItem>)}
            </TextField>
            {avecBanque && (
              <TextField select size="small" label="Banque" required value={form.banque} onChange={e => setForm(f => ({ ...f, banque: e.target.value }))}>
                {BANQUES.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
              </TextField>
            )}
            <TextField size="small" label={form.mode === 'cheque' ? 'N° de chèque' : form.mode === 'traite' ? 'N° de traite' : 'Référence'}
              value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <TextField size="small" label="Montant" required value={form.montant} inputProps={{ inputMode: 'decimal' }}
                onChange={e => /^[\d\s]*[.,]?\d*$/.test(e.target.value) && setForm(f => ({ ...f, montant: e.target.value }))} sx={{ flex: 1 }} />
              <TextField size="small" type="date" label="Date" required InputLabelProps={{ shrink: true }} value={form.date_reglement}
                onChange={e => setForm(f => ({ ...f, date_reglement: e.target.value }))} sx={{ flex: 1 }} />
            </Box>
            <TextField size="small" label="Observation" value={form.observation} onChange={e => setForm(f => ({ ...f, observation: e.target.value }))} />
          </Box>
        </DialogContent>
      )}
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: 'none' }}>Annuler</Button>
        <Button variant="contained" onClick={save} disabled={saving} startIcon={saving ? <CircularProgress size={14} /> : <PaymentsIcon />}
          sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#2E7D32', '&:hover': { bgcolor: '#1B5E20' } }}>
          Imputer
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function GenererDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [date, setDate] = useState(today())
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    try {
      const { data } = await api.post('/facturation/factures/generer', { jusqu_au: date })
      toast.success(data.message)
      onDone()
    } catch (err) { toast.error(errMsg(err, 'Erreur lors de la génération.')) }
    finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 800 }}>Générer les préfactures</DialogTitle>
      <DialogContent>
        <Typography fontSize={13} color="text.secondary" mb={2}>
          Crée, pour chaque contrat actif, une préfacture par période échue jusqu'à cette date (une période est facturée le lendemain de sa fin).
          Les périodes déjà facturées sont ignorées.
        </Typography>
        <TextField fullWidth size="small" type="date" label="Jusqu'au" InputLabelProps={{ shrink: true }} value={date} onChange={e => setDate(e.target.value)} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: 'none' }}>Annuler</Button>
        <Button variant="contained" onClick={run} disabled={busy} startIcon={busy ? <CircularProgress size={14} /> : <AutorenewIcon />}
          sx={{ textTransform: 'none', fontWeight: 700 }}>Générer</Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Fiches clients ───────────────────────────────────────────────────────────
function FichesTab({ clients, isSuperAdmin, reload }: { clients: ClientFiche[]; isSuperAdmin: boolean; reload: () => void }) {
  const [edit, setEdit] = useState<ClientFiche | null>(null)
  const [contratFor, setContratFor] = useState<{ clientId: number; contrat: Contrat | null } | null>(null)
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? clients.filter(c => [c.nom, c.raison_sociale, c.matricule_fiscale, c.gerant].some(v => v?.toLowerCase().includes(t))) : clients
  }, [clients, q])

  const head = { fontWeight: 700, fontSize: 12, bgcolor: '#1F4E78', color: '#fff', whiteSpace: 'nowrap' as const }

  return (
    <Card sx={{ borderRadius: 3 }}>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <TextField size="small" placeholder="Nom, raison sociale, IU, gérant…" value={q} onChange={e => setQ(e.target.value)} sx={{ width: 300, mb: 2 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 1000 }}>
            <TableHead>
              <TableRow>
                {['Client', 'Identifiant unique (IU)', 'Gérant', 'Téléphone', 'Contact', 'Adresse', 'Contrat', 'Solde dû', ''].map(h => (
                  <TableCell key={h} sx={head} align={h === 'Solde dû' ? 'right' : 'left'}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(c => {
                const actif = c.contrats.find(k => k.actif)
                return (
                  <TableRow key={c.id} hover>
                    <TableCell sx={{ fontSize: 12.5 }}>
                      <Typography fontSize={12.5} fontWeight={700}>{c.raison_sociale || c.nom}</Typography>
                      <Typography fontSize={11} color="text.secondary">{c.raison_sociale ? c.nom : c.email}</Typography>
                    </TableCell>
                    <TableCell sx={{ fontSize: 12.5, fontFamily: 'monospace' }}>{c.matricule_fiscale || <Missing />}</TableCell>
                    <TableCell sx={{ fontSize: 12.5 }}>{c.gerant || <Missing />}</TableCell>
                    <TableCell sx={{ fontSize: 12.5 }}>{c.telephone || <Missing />}</TableCell>
                    <TableCell sx={{ fontSize: 12.5, maxWidth: 180 }}>{c.contact || <Missing />}</TableCell>
                    <TableCell sx={{ fontSize: 12.5, maxWidth: 200 }}>{c.adresse || <Missing />}</TableCell>
                    <TableCell sx={{ fontSize: 12.5 }}>
                      {actif ? (
                        <Chip size="small" label={`${TYPES[actif.type].label} · ${fmt(actif.montant_ht)} HT`}
                          sx={{ bgcolor: '#E3F0FF', color: '#1565C0', fontWeight: 700, fontSize: 11 }} />
                      ) : isSuperAdmin ? (
                        <Button size="small" startIcon={<AddIcon />} sx={{ textTransform: 'none', fontSize: 12 }}
                          onClick={() => setContratFor({ clientId: c.id, contrat: null })}>Contrat</Button>
                      ) : <Missing />}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12.5, fontWeight: 700, color: c.solde > 0 ? '#C62828' : 'inherit' }} align="right">{fmt(c.solde)}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Modifier la fiche">
                        <IconButton size="small" onClick={() => setEdit(c)}><EditIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Box>
      </CardContent>

      <FicheDialog client={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload() }} />
      <ContratDialog target={contratFor} clients={clients} onClose={() => setContratFor(null)} onSaved={() => { setContratFor(null); reload() }} />
    </Card>
  )
}

const Missing = () => <Typography component="span" fontSize={12} color="text.disabled">—</Typography>

function FicheDialog({ client, onClose, onSaved }: { client: ClientFiche | null; onClose: () => void; onSaved: () => void }) {
  const empty = { raison_sociale: '', matricule_fiscale: '', gerant: '', contact: '', telephone: '', adresse: '' }
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (client) setForm(Object.fromEntries(Object.keys(empty).map(k => [k, (client as any)[k] ?? ''])) as typeof empty)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client])

  const save = async () => {
    if (!client) return
    setSaving(true)
    try {
      const { data } = await api.put(`/facturation/clients/${client.id}`, form)
      toast.success(data.message)
      onSaved()
    } catch (err) { toast.error(errMsg(err, "Erreur lors de l'enregistrement.")) }
    finally { setSaving(false) }
  }

  const field = (k: keyof typeof empty, label: string, props: object = {}) => (
    <TextField size="small" fullWidth label={label} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} {...props} />
  )

  return (
    <Dialog open={!!client} onClose={() => !saving && onClose()} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 800 }}>Fiche client — {client?.nom}</DialogTitle>
      <DialogContent>
        <Grid container spacing={1.75} sx={{ pt: 1 }}>
          <Grid item xs={12} sm={7}>{field('raison_sociale', 'Raison sociale')}</Grid>
          <Grid item xs={12} sm={5}>{field('matricule_fiscale', 'Identifiant unique (IU)', { placeholder: '1234567A' })}</Grid>
          <Grid item xs={12} sm={6}>{field('gerant', 'Gérant')}</Grid>
          <Grid item xs={12} sm={6}>{field('telephone', 'Téléphone')}</Grid>
          <Grid item xs={12}>{field('contact', 'Contact', { placeholder: 'Personne à contacter, téléphone, e-mail…' })}</Grid>
          <Grid item xs={12}>{field('adresse', 'Adresse', { multiline: true, minRows: 2 })}</Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: 'none' }}>Annuler</Button>
        <Button variant="contained" onClick={save} disabled={saving} sx={{ textTransform: 'none', fontWeight: 700 }}>Enregistrer</Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Contrats ─────────────────────────────────────────────────────────────────
function ContratsTab({ clients, isSuperAdmin, reload }: { clients: ClientFiche[]; isSuperAdmin: boolean; reload: () => void }) {
  const [target, setTarget] = useState<{ clientId: number; contrat: Contrat | null } | null>(null)
  const contrats = useMemo(
    () => clients.flatMap(c => c.contrats.map(k => ({ ...k, client: c.raison_sociale || c.nom }))),
    [clients],
  )

  const supprimer = async (k: Contrat) => {
    if (!window.confirm('Supprimer ce contrat et ses préfactures non validées ?')) return
    try {
      const { data } = await api.delete(`/facturation/contrats/${k.id}`)
      toast.success(data.message)
      reload()
    } catch (err) { toast.error(errMsg(err, 'Erreur lors de la suppression.')) }
  }

  const head = { fontWeight: 700, fontSize: 12, bgcolor: '#1F4E78', color: '#fff', whiteSpace: 'nowrap' as const }

  return (
    <Card sx={{ borderRadius: 3 }}>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography fontSize={13} color="text.secondary">
            La rémunération est le montant HT facturé à chaque période ; la préfacture est datée du lendemain de la fin de période.
          </Typography>
          {isSuperAdmin && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setTarget({ clientId: clients[0]?.id ?? 0, contrat: null })}
              sx={{ ml: 'auto', textTransform: 'none', fontWeight: 700, borderRadius: 2, flexShrink: 0 }}>
              Nouveau contrat
            </Button>
          )}
        </Box>

        {contrats.length === 0 ? (
          <Typography color="text.secondary" fontSize={13.5} textAlign="center" py={6}>Aucun contrat.</Typography>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 900 }}>
              <TableHead>
                <TableRow>
                  {['Client', 'Société de facturation', 'Prestation', 'Rémunération', 'Montant HT', 'TVA', 'Début', 'Fin', 'Statut', ''].map(h => (
                    <TableCell key={h} sx={head} align={h === 'Montant HT' ? 'right' : 'left'}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {contrats.map(k => (
                  <TableRow key={k.id} hover>
                    <TableCell sx={{ fontSize: 12.5, fontWeight: 600 }}>{k.client}</TableCell>
                    <TableCell sx={{ fontSize: 12.5 }}>{k.societe || <Missing />}</TableCell>
                    <TableCell sx={{ fontSize: 12.5 }}>{k.designation || <Missing />}</TableCell>
                    <TableCell sx={{ fontSize: 12.5 }}>{TYPES[k.type].label}</TableCell>
                    <TableCell sx={{ fontSize: 12.5, fontWeight: 700 }} align="right">{fmt(k.montant_ht)}</TableCell>
                    <TableCell sx={{ fontSize: 12.5 }}>{k.taux_tva} %</TableCell>
                    <TableCell sx={{ fontSize: 12.5 }}>{fmtDate(k.date_debut)}</TableCell>
                    <TableCell sx={{ fontSize: 12.5 }}>{k.date_fin ? fmtDate(k.date_fin) : 'Indéterminée'}</TableCell>
                    <TableCell>
                      <Chip size="small" label={k.actif ? 'Actif' : 'Inactif'}
                        sx={{ bgcolor: k.actif ? '#E8F5E9' : '#F1F5F9', color: k.actif ? '#2E7D32' : '#64748B', fontWeight: 700, fontSize: 11 }} />
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {isSuperAdmin && (
                        <>
                          <IconButton size="small" onClick={() => setTarget({ clientId: k.client_id, contrat: k })}><EditIcon fontSize="small" /></IconButton>
                          <IconButton size="small" onClick={() => supprimer(k)}><DeleteOutlineIcon fontSize="small" sx={{ color: '#C62828' }} /></IconButton>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </CardContent>

      <ContratDialog target={target} clients={clients} onClose={() => setTarget(null)} onSaved={() => { setTarget(null); reload() }} />
    </Card>
  )
}

function ContratDialog({ target, clients, onClose, onSaved }: {
  target: { clientId: number; contrat: Contrat | null } | null
  clients: ClientFiche[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    client_id: 0, societe: '', designation: '', type: 'mensuelle' as TypeContrat, montant_ht: '',
    taux_tva: 19, date_debut: today(), date_fin: '', actif: true,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!target) return
    const k = target.contrat
    setForm({
      client_id: target.clientId, societe: k?.societe ?? '', designation: k?.designation ?? 'Tenue de comptabilité',
      type: k?.type ?? 'mensuelle', montant_ht: k ? String(k.montant_ht) : '', taux_tva: k?.taux_tva ?? 19,
      date_debut: k?.date_debut ?? today(), date_fin: k?.date_fin ?? '', actif: k?.actif ?? true,
    })
  }, [target])

  const montant = Number(form.montant_ht.replace(',', '.')) || 0
  const mois = TYPES[form.type].mois

  const save = async () => {
    if (!target) return
    setSaving(true)
    try {
      const payload = { ...form, montant_ht: montant, date_fin: form.date_fin || null }
      const { data } = target.contrat
        ? await api.put(`/facturation/contrats/${target.contrat.id}`, payload)
        : await api.post('/facturation/contrats', payload)
      toast.success(data.message)
      onSaved()
    } catch (err) { toast.error(errMsg(err, "Erreur lors de l'enregistrement.")) }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={!!target} onClose={() => !saving && onClose()} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 800 }}>{target?.contrat ? 'Modifier le contrat' : 'Nouveau contrat'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={1.75} sx={{ pt: 1 }}>
          <Grid item xs={12} sm={7}>
            <TextField select fullWidth size="small" label="Client" value={form.client_id || ''} disabled={!!target?.contrat}
              onChange={e => setForm(f => ({ ...f, client_id: Number(e.target.value) }))}>
              {clients.map(c => <MenuItem key={c.id} value={c.id}>{c.raison_sociale || c.nom}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={5}>
            <TextField fullWidth size="small" label="Société de facturation" value={form.societe} onChange={e => setForm(f => ({ ...f, societe: e.target.value }))} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth size="small" label="Prestation" value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} />
          </Grid>
          <Grid item xs={12} sm={5}>
            <TextField select fullWidth size="small" label="Rémunération" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as TypeContrat }))}>
              {(Object.keys(TYPES) as TypeContrat[]).map(t => <MenuItem key={t} value={t}>{TYPES[t].label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={7} sm={4}>
            <TextField fullWidth size="small" label={form.type === 'mission' ? 'Montant de la mission HT' : 'Montant HT par période'}
              value={form.montant_ht} inputProps={{ inputMode: 'decimal' }}
              onChange={e => /^[\d\s]*[.,]?\d*$/.test(e.target.value) && setForm(f => ({ ...f, montant_ht: e.target.value }))}
              helperText={mois > 1 && montant > 0 ? `soit ${fmt(montant / mois)} / mois` : ' '} />
          </Grid>
          <Grid item xs={5} sm={3}>
            <TextField select fullWidth size="small" label="TVA" value={form.taux_tva} onChange={e => setForm(f => ({ ...f, taux_tva: Number(e.target.value) }))}>
              {[0, 7, 13, 19].map(t => <MenuItem key={t} value={t}>{t} %</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" type="date" label="Date de début" InputLabelProps={{ shrink: true }} value={form.date_debut}
              onChange={e => setForm(f => ({ ...f, date_debut: e.target.value }))} />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" type="date" label="Date de fin" InputLabelProps={{ shrink: true }} value={form.date_fin}
              onChange={e => setForm(f => ({ ...f, date_fin: e.target.value }))}
              helperText={form.type === 'mission' ? 'Date de facturation de la mission' : 'Vide = sans fin (dernière période au prorata)'} />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel control={<Switch checked={form.actif} onChange={e => setForm(f => ({ ...f, actif: e.target.checked }))} />}
              label={<Typography fontSize={13}>Contrat actif (génère des préfactures)</Typography>} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: 'none' }}>Annuler</Button>
        <Button variant="contained" onClick={save} disabled={saving || !form.client_id} sx={{ textTransform: 'none', fontWeight: 700 }}>Enregistrer</Button>
      </DialogActions>
    </Dialog>
  )
}
