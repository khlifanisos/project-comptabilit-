import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Box, Typography, Card, CardContent, Grid, Button, IconButton,
  CircularProgress, Chip, Table, TableBody, TableCell, TableHead, TableRow,
  Tooltip,
} from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import DeleteIcon from '@mui/icons-material/Delete'
import DownloadIcon from '@mui/icons-material/Download'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import toast from 'react-hot-toast'
import api from '../../api/axios'

type BalanceType = 'n' | 'n_1' | 'grand_livre'

interface ImportInfo {
  id: number
  label: string
  nom_fichier: string
  nb_lignes: number
  uploaded_at: string
}

interface ConsolidationRow {
  compte: string
  libelle: string | null
  solde_n_1: number
  solde_n: number
  variation: number
  statut: string
}

interface BalancesResponse {
  imports: Record<BalanceType, ImportInfo | null>
  consolidation: ConsolidationRow[]
  ecarts: ConsolidationRow[]
}

const ZONES: { type: BalanceType; title: string; subtitle: string }[] = [
  { type: 'n_1',         title: 'Balance N-1',  subtitle: 'Exercice précédent' },
  { type: 'n',           title: 'Balance N',     subtitle: 'Exercice en cours' },
  { type: 'grand_livre', title: 'Grand livre',   subtitle: 'Optionnel — pièces comptables' },
]

function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
}

function statutColor(statut: string): { bg: string; color: string } {
  if (statut.includes('deux')) return { bg: '#E8F5E9', color: '#2E7D32' }
  return { bg: '#FFF3E0', color: '#E65100' }
}

interface Props {
  /** The client this admin is managing balances for — every request is scoped to them. */
  clientId: number
}

export default function BalanceConsolidation({ clientId }: Props) {
  const [imports, setImports] = useState<Record<BalanceType, ImportInfo | null>>({ n: null, n_1: null, grand_livre: null })
  const [consolidation, setConsolidation] = useState<ConsolidationRow[]>([])
  const [ecarts, setEcarts] = useState<ConsolidationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<Record<BalanceType, boolean>>({ n: false, n_1: false, grand_livre: false })
  const [exporting, setExporting] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const fileRefs = {
    n: useRef<HTMLInputElement>(null),
    n_1: useRef<HTMLInputElement>(null),
    grand_livre: useRef<HTMLInputElement>(null),
  }

  const load = useCallback(() => {
    setLoading(true)
    api.get('/audit/balances', { params: { client_id: clientId } })
      .then((r: { data: BalancesResponse }) => {
        setImports(r.data.imports)
        setConsolidation(r.data.consolidation)
        setEcarts(r.data.ecarts)
      })
      .catch(() => toast.error('Impossible de charger les balances.'))
      .finally(() => setLoading(false))
  }, [clientId])

  useEffect(() => { load() }, [load])

  const handleUpload = async (type: BalanceType, file: File) => {
    setUploading(prev => ({ ...prev, [type]: true }))
    try {
      const fd = new FormData()
      fd.append('fichier', file)
      fd.append('client_id', String(clientId))
      const { data } = await api.post(`/audit/balances/${type}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success(data.message)
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Erreur lors de l'import.")
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }))
    }
  }

  const handleDelete = async (type: BalanceType) => {
    try {
      await api.delete(`/audit/balances/${type}`, { params: { client_id: clientId } })
      toast.success('Import supprimé.')
      load()
    } catch {
      toast.error('Erreur lors de la suppression.')
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await api.get('/audit/balances-export', { params: { client_id: clientId }, responseType: 'blob' })
      const url = window.URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = 'consolidation_balances.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Impossible de générer l'export.")
    } finally {
      setExporting(false)
    }
  }

  const canConsolidate = !!imports.n && !!imports.n_1
  const rowsToShow = showAll ? consolidation : ecarts

  return (
    <Card sx={{ borderRadius: 3, mb: 3 }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <AccountBalanceIcon sx={{ color: '#1565C0', fontSize: 21 }} />
          <Typography fontWeight={700} fontSize={16} color="#1a1a2e">Consolidation des balances</Typography>
        </Box>
        <Typography fontSize={12.5} color="text.secondary" mb={2.5}>
          Importez la balance N et la balance N-1 pour générer automatiquement la comparaison compte par compte (équivalent de la macro de consolidation).
        </Typography>

        <Grid container spacing={2}>
          {ZONES.map(({ type, title, subtitle }) => {
            const info = imports[type]
            const busy = uploading[type]
            return (
              <Grid item xs={12} sm={4} key={type}>
                <input ref={fileRefs[type]} type="file" hidden accept=".xlsx,.xls,.csv"
                  onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleUpload(type, f) }} />

                {info ? (
                  <Box sx={{
                    border: '1px solid #E2E8F0', borderRadius: 3, p: 2,
                    bgcolor: '#F8FAFC', height: '100%',
                  }}>
                    <Typography fontSize={12} fontWeight={700} color="#1565C0" mb={0.3}>{title}</Typography>
                    <Typography fontSize={10.5} color="text.secondary" mb={1}>{subtitle}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <InsertDriveFileIcon sx={{ fontSize: 18, color: '#1565C0', flexShrink: 0 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography fontSize={12} fontWeight={600} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {info.nom_fichier}
                        </Typography>
                        <Typography fontSize={10.5} color="text.secondary">{info.nb_lignes} lignes</Typography>
                      </Box>
                      <Tooltip title="Remplacer">
                        <IconButton size="small" disabled={busy} onClick={() => fileRefs[type].current?.click()}>
                          {busy ? <CircularProgress size={14} /> : <UploadFileIcon fontSize="small" sx={{ fontSize: 16 }} />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Supprimer">
                        <IconButton size="small" onClick={() => handleDelete(type)}>
                          <DeleteIcon fontSize="small" sx={{ fontSize: 16, color: '#C62828' }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                ) : (
                  <Box
                    onClick={() => !busy && fileRefs[type].current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleUpload(type, f) }}
                    sx={{
                      border: '2px dashed #CBD5E1', borderRadius: 3, p: 2.2, textAlign: 'center',
                      bgcolor: '#FAFAFA', cursor: busy ? 'default' : 'pointer', height: '100%',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.6,
                      '&:hover': busy ? {} : { borderColor: '#1565C0', bgcolor: '#F0F7FF' },
                      transition: 'all 0.15s',
                    }}>
                    {busy ? <CircularProgress size={22} /> : <UploadFileIcon sx={{ fontSize: 26, color: '#94A3B8' }} />}
                    <Typography fontSize={12.5} fontWeight={700} color="#1a1a2e">{title}</Typography>
                    <Typography fontSize={10.5} color="text.secondary">{subtitle}</Typography>
                    <Typography fontSize={10} color="#94A3B8">Glissez un fichier ou cliquez (.xlsx, .xls, .csv)</Typography>
                  </Box>
                )}
              </Grid>
            )
          })}
        </Grid>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={22} /></Box>
        ) : canConsolidate ? (
          <Box sx={{ mt: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
              <Chip label={`${consolidation.length} comptes consolidés`} size="small"
                sx={{ bgcolor: '#E3F0FF', color: '#1565C0', fontWeight: 700 }} />
              <Chip label={`${ecarts.length} écart(s)`} size="small"
                sx={{ bgcolor: ecarts.length > 0 ? '#FFF3E0' : '#E8F5E9', color: ecarts.length > 0 ? '#E65100' : '#2E7D32', fontWeight: 700 }} />
              <Button size="small" variant="outlined" startIcon={exporting ? <CircularProgress size={14} /> : <DownloadIcon />}
                disabled={exporting} onClick={handleExport}
                sx={{ ml: 'auto', textTransform: 'none', fontWeight: 600, borderRadius: 2 }}>
                Télécharger (.xlsx)
              </Button>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography fontSize={13} fontWeight={700} color="#1a1a2e">
                {showAll ? 'Tous les comptes' : 'Écarts entre les deux balances'}
              </Typography>
              <Button size="small" onClick={() => setShowAll(s => !s)}
                endIcon={showAll ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                sx={{ textTransform: 'none', fontSize: 12, fontWeight: 600 }}>
                {showAll ? 'Voir uniquement les écarts' : 'Voir tous les comptes'}
              </Button>
            </Box>

            {rowsToShow.length === 0 ? (
              <Typography fontSize={12.5} color="#2E7D32" fontWeight={600}>
                ✓ Aucun écart — les deux balances concordent parfaitement.
              </Typography>
            ) : (
              <Box sx={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Compte</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Libellé</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Solde N-1</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Solde N</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Variation</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Statut</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rowsToShow.map(row => {
                      const sc = statutColor(row.statut)
                      return (
                        <TableRow key={row.compte} hover>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{row.compte}</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{row.libelle}</TableCell>
                          <TableCell align="right" sx={{ fontSize: 12 }}>{formatNumber(row.solde_n_1)}</TableCell>
                          <TableCell align="right" sx={{ fontSize: 12 }}>{formatNumber(row.solde_n)}</TableCell>
                          <TableCell align="right" sx={{ fontSize: 12, fontWeight: 700, color: row.variation === 0 ? 'inherit' : (row.variation > 0 ? '#2E7D32' : '#C62828') }}>
                            {formatNumber(row.variation)}
                          </TableCell>
                          <TableCell>
                            <Chip label={row.statut} size="small" sx={{ bgcolor: sc.bg, color: sc.color, fontWeight: 600, fontSize: 10.5 }} />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Box>
        ) : (
          <Typography fontSize={12.5} color="text.secondary" mt={2.5}>
            Importez la balance N et la balance N-1 ci-dessus pour lancer la consolidation automatique.
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}
