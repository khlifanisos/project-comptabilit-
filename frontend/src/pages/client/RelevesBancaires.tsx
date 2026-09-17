import { useState, useEffect, useRef } from 'react'
import {
  Box, Typography, Card, CardContent, Button, Table, TableBody,
  TableCell, TableHead, TableRow, Chip, TextField, InputAdornment,
  Grid, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogActions, LinearProgress, Alert, IconButton, Tooltip, Checkbox,
  Divider
} from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import SearchIcon from '@mui/icons-material/Search'
import TableChartIcon from '@mui/icons-material/TableChart'
import DeleteIcon from '@mui/icons-material/Delete'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import StatCard from '../../components/common/StatCard'
import api from '../../api/axios'
import { useCurrency } from '../../contexts/CurrencyContext'
import { platformStore } from '../../utils/platformStore'
import toast from 'react-hot-toast'

interface ReleveBancaire {
  id: number
  date: string
  libelle: string
  debit: number
  credit: number
  solde: number
  rapproche: boolean
}

export default function RelevesBancaires() {
  const { devise } = useCurrency()
  const [rows, setRows]             = useState<ReleveBancaire[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteIds, setDeleteIds]   = useState<Set<number>>(new Set())
  const [deleting, setDeleting]     = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [banque, setBanque]         = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting]   = useState(false)
  const [importError, setImportError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = () => {
    setLoading(true)
    api.get('/releves-bancaires')
      .then(r => {
        const data: ReleveBancaire[] = r.data?.data ?? r.data
        setRows(data)
        platformStore.setRelevesBancaires(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = rows.filter(r =>
    r.libelle.toLowerCase().includes(search.toLowerCase())
  )

  const solde        = rows.length ? Number(rows[rows.length - 1].solde) : 0
  const totalCredits = rows.reduce((s, r) => s + Number(r.credit), 0)
  const totalDebits  = rows.reduce((s, r) => s + Number(r.debit), 0)

  const fmt = (n: number) =>
    n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const handleExportExcel = () => {
    const tid = toast.loading('Génération Excel en cours…')
    api.get('/releves-bancaires/export-excel', { responseType: 'blob', timeout: 60000 })
      .then((res: { data: Blob }) => {
        const url = URL.createObjectURL(res.data)
        const a   = document.createElement('a')
        a.href = url
        a.download = 'releves_bancaires.xlsx'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast.success('Excel téléchargé !', { id: tid })
      })
      .catch(async (err: any) => {
        let msg = "Erreur lors de l'export Excel"
        try {
          if (err.response?.data instanceof Blob) {
            const text = await (err.response.data as Blob).text()
            const json = JSON.parse(text)
            if (json.message) msg = json.message
          }
        } catch {}
        toast.error(msg, { id: tid })
      })
  }

  const openDeleteDialog = () => {
    setDeleteIds(new Set())
    setDeleteOpen(true)
  }

  const toggleAll = (checked: boolean) => {
    setDeleteIds(checked ? new Set(rows.map(r => r.id)) : new Set())
  }

  const toggleOne = (id: number) => {
    setDeleteIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleDeleteConfirm = async () => {
    if (deleteIds.size === 0) return
    setDeleting(true)
    let ok = 0
    for (const id of deleteIds) {
      try { await api.delete(`/releves-bancaires/${id}`); ok++ } catch {}
    }
    setDeleting(false)
    setDeleteOpen(false)
    setDeleteIds(new Set())
    toast.success(`${ok} mouvement(s) supprimé(s).`)
    load()
  }

  const handleImport = async () => {
    if (!banque.trim()) { setImportError('Veuillez saisir le nom de la banque.'); return }
    if (!importFile)    { setImportError('Veuillez sélectionner un fichier.'); return }
    setImportError('')
    setImporting(true)

    const form = new FormData()
    form.append('banque', banque.trim())
    form.append('file', importFile)

    try {
      const token = sessionStorage.getItem('token')
      const res = await fetch('/api/releves-bancaires/import-file', {
        method: 'POST',
        body: form,
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "Erreur lors de l'import.")
      setImportOpen(false)
      setImportFile(null)
      setBanque('')
      toast.success(`${data.imported} mouvement(s) importé(s) avec succès.`, { duration: 5000 })
      load()
    } catch (e: any) {
      setImportError(e?.message || "Erreur lors de l'import.")
    } finally {
      setImporting(false)
    }
  }

  const allChecked  = rows.length > 0 && deleteIds.size === rows.length
  const someChecked = deleteIds.size > 0 && deleteIds.size < rows.length

  return (
    <Box className="fade-in">
      <Box sx={{
        display: 'flex', justifyContent: 'space-between',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'flex-start', sm: 'center' },
        gap: 1.5, mb: 3,
      }}>
        <Box>
          <Typography variant="h5" fontWeight={800} color="#1a1a2e" fontSize={{ xs: 17, md: 22 }}>
            Relevés bancaires
          </Typography>
          <Typography color="text.secondary" fontSize={14}>Import et rapprochement des mouvements</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
          <Button variant="outlined" startIcon={<TableChartIcon />} onClick={handleExportExcel}
            sx={{ borderRadius: 2.5, fontWeight: 600, borderColor: '#217346', color: '#217346', '&:hover': { bgcolor: '#F0FFF4', borderColor: '#1a5c38' } }}>
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Exporter Excel</Box>
          </Button>
          <Button variant="contained" startIcon={<UploadFileIcon />} onClick={() => setImportOpen(true)}
            sx={{ borderRadius: 2.5, fontWeight: 600, bgcolor: '#1565C0', '&:hover': { bgcolor: '#0D47A1' } }}>
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Importer un relevé</Box>
          </Button>
        </Box>
      </Box>

      <Grid container spacing={2.5} mb={3}>
        <Grid item xs={12} sm={4}>
          <StatCard title="Solde actuel" value={`${fmt(solde)} ${devise}`} icon={<AccountBalanceIcon />} color="#1565C0" subtitle="Tous mouvements" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard title="Total crédits" value={`${fmt(totalCredits)} ${devise}`} icon={<AccountBalanceIcon />} color="#2E7D32" subtitle="Tous mouvements" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard title="Total débits" value={`${fmt(totalDebits)} ${devise}`} icon={<AccountBalanceIcon />} color="#C62828" subtitle="Tous mouvements" />
        </Grid>
      </Grid>

      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
            <TextField placeholder="Rechercher un libellé…" value={search} onChange={e => setSearch(e.target.value)}
              size="small" sx={{ width: { xs: '100%', sm: 300 } }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }} />
            <Tooltip title="Supprimer des mouvements">
              <IconButton onClick={openDeleteDialog} disabled={rows.length === 0}
                sx={{ color: '#EF5350', '&:hover': { bgcolor: '#FFEBEE' }, '&.Mui-disabled': { color: '#ccc' } }}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={32} />
            </Box>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table sx={{ minWidth: 500 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Libellé</TableCell>
                    <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Débit</TableCell>
                    <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Crédit</TableCell>
                    <TableCell align="right">Solde</TableCell>
                    <TableCell>Statut</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 5, color: '#94A3B8' }}>
                        Aucun mouvement bancaire enregistré.
                      </TableCell>
                    </TableRow>
                  ) : filtered.map(row => (
                    <TableRow key={row.id} sx={{ '&:hover': { bgcolor: '#f8f9ff' } }}>
                      <TableCell>{new Date(row.date).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell>{row.libelle}</TableCell>
                      <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' }, color: row.debit ? '#C62828' : '#ccc', fontWeight: row.debit ? 700 : 400 }}>
                        {row.debit ? row.debit.toLocaleString('fr-FR') : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' }, color: row.credit ? '#2E7D32' : '#ccc', fontWeight: row.credit ? 700 : 400 }}>
                        {row.credit ? row.credit.toLocaleString('fr-FR') : '—'}
                      </TableCell>
                      <TableCell align="right"><Typography fontWeight={700} fontSize={13}>{row.solde.toLocaleString('fr-FR')}</Typography></TableCell>
                      <TableCell>
                        <Chip size="small" label={row.rapproche ? 'Validé' : 'Non validé'}
                          sx={{ fontSize: 11, fontWeight: 700,
                            bgcolor: row.rapproche ? '#E8F5E9' : '#FFF3E0',
                            color:   row.rapproche ? '#2E7D32' : '#E65100' }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 17, pb: 1 }}>
          Supprimer des mouvements
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {/* Select all */}
          <Box sx={{ display: 'flex', alignItems: 'center', px: 3, py: 1, bgcolor: '#F8FAFC' }}>
            <Checkbox
              checked={allChecked}
              indeterminate={someChecked}
              onChange={e => toggleAll(e.target.checked)}
              disabled={deleting}
              size="small"
            />
            <Typography fontSize={13} fontWeight={700} color="#475569">
              {allChecked ? 'Tout désélectionner' : 'Sélectionner tout'}
            </Typography>
            {deleteIds.size > 0 && (
              <Typography fontSize={12} color="#EF5350" fontWeight={700} ml="auto">
                {deleteIds.size} sélectionné(s)
              </Typography>
            )}
          </Box>
          <Divider />

          {/* Row list */}
          <Box sx={{ maxHeight: 360, overflowY: 'auto' }}>
            {rows.map(row => (
              <Box key={row.id}
                onClick={() => !deleting && toggleOne(row.id)}
                sx={{
                  display: 'flex', alignItems: 'center', px: 2, py: 0.75,
                  cursor: deleting ? 'default' : 'pointer',
                  bgcolor: deleteIds.has(row.id) ? '#FFF5F5' : 'transparent',
                  '&:hover': deleting ? {} : { bgcolor: deleteIds.has(row.id) ? '#FFE4E4' : '#F8FAFC' },
                  borderBottom: '1px solid #F1F5F9',
                }}>
                <Checkbox checked={deleteIds.has(row.id)} size="small" disabled={deleting}
                  onChange={() => toggleOne(row.id)} onClick={e => e.stopPropagation()}
                  sx={{ color: '#EF5350', '&.Mui-checked': { color: '#EF5350' } }} />
                <Box sx={{ flex: 1, ml: 1, minWidth: 0 }}>
                  <Typography fontSize={13} fontWeight={600} noWrap>{row.libelle}</Typography>
                  <Typography fontSize={11} color="text.secondary">
                    {new Date(row.date).toLocaleDateString('fr-FR')}
                    {row.debit  ? `  ·  −${row.debit.toLocaleString('fr-FR')} ${devise}`  : ''}
                    {row.credit ? `  ·  +${row.credit.toLocaleString('fr-FR')} ${devise}` : ''}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>

          {deleting && (
            <Box sx={{ px: 3, pt: 1 }}>
              <LinearProgress color="error" sx={{ borderRadius: 2, height: 5 }} />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 2, gap: 1 }}>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleting}
            sx={{ fontWeight: 600, color: '#64748B' }}>
            Annuler
          </Button>
          <Button variant="contained" onClick={handleDeleteConfirm}
            disabled={deleting || deleteIds.size === 0}
            startIcon={deleting ? <CircularProgress size={14} color="inherit" /> : <DeleteIcon />}
            sx={{ fontWeight: 700, borderRadius: 2, bgcolor: '#EF5350', '&:hover': { bgcolor: '#C62828' } }}>
            {deleting ? 'Suppression…' : `Supprimer${deleteIds.size > 0 ? ` (${deleteIds.size})` : ''}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importOpen} onClose={() => !importing && setImportOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 17 }}>
          Importer un relevé bancaire
        </DialogTitle>
        <DialogContent>
          {importError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{importError}</Alert>
          )}

          <TextField
            fullWidth label="Nom de la banque *" value={banque}
            onChange={e => setBanque(e.target.value)}
            placeholder="ex: Banque Nationale, BNA, STB…"
            sx={{ mb: 2 }} size="small" disabled={importing}
          />

          <Box
            component="input"
            ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.gif"
            aria-label="Sélectionner un PDF ou une image"
            sx={{ display: 'none' }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setImportFile(e.target.files?.[0] ?? null); setImportError('') }}
          />
          <Box
            onClick={() => !importing && fileInputRef.current?.click()}
            sx={{
              border: '2px dashed', borderColor: importFile ? '#1565C0' : '#CBD5E1',
              borderRadius: 2, p: 3, textAlign: 'center', cursor: importing ? 'default' : 'pointer',
              bgcolor: importFile ? '#EFF6FF' : '#F8FAFC',
              '&:hover': importing ? {} : { borderColor: '#1565C0', bgcolor: '#EFF6FF' },
              transition: 'all 0.2s',
            }}
          >
            <UploadFileIcon sx={{ fontSize: 32, color: importFile ? '#1565C0' : '#94A3B8', mb: 0.5 }} />
            <Typography fontSize={13} fontWeight={600} color={importFile ? '#1565C0' : '#64748B'}>
              {importFile ? importFile.name : 'Cliquez pour sélectionner un PDF ou une image'}
            </Typography>
            {importFile && (
              <Typography fontSize={11} color="#94A3B8">
                {(importFile.size / 1024).toFixed(1)} Ko
              </Typography>
            )}
          </Box>

          {importing && (
            <Box sx={{ mt: 2 }}>
              <Typography fontSize={12} color="text.secondary" mb={0.5}>
                Analyse IA en cours, veuillez patienter…
              </Typography>
              <LinearProgress sx={{ borderRadius: 2, height: 6 }} />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setImportOpen(false)} disabled={importing}
            sx={{ fontWeight: 600, color: '#64748B' }}>
            Annuler
          </Button>
          <Button variant="contained" onClick={handleImport} disabled={importing || !importFile || !banque.trim()}
            startIcon={importing ? <CircularProgress size={14} color="inherit" /> : <UploadFileIcon />}
            sx={{ fontWeight: 700, borderRadius: 2, bgcolor: '#1565C0', '&:hover': { bgcolor: '#0D47A1' } }}>
            {importing ? 'Analyse en cours…' : 'Importer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
