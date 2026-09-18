import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Box, Typography, Card, CardContent, TextField, InputAdornment,
  CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, Button, Divider,
  FormControl, InputLabel, Select, MenuItem,
  Checkbox, FormControlLabel, LinearProgress, Chip,
  Avatar, IconButton, Tooltip,
} from '@mui/material'
import SearchIcon      from '@mui/icons-material/Search'
import FolderOpenIcon  from '@mui/icons-material/FolderOpen'
import TableChartIcon  from '@mui/icons-material/TableChart'
import ArrowBackIcon   from '@mui/icons-material/ArrowBack'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import DocumentsTable from '../../components/admin/DocumentsTable'
import { downloadDocExcel, writeFallbackExcel } from '../../utils/documentExcel'
import { useCurrency } from '../../contexts/CurrencyContext'
import {
  DocRow, DocStatut, DOC_SOURCES, SOURCE_API, FILE_SUB, TYPE_LABEL, STATUS_MAP,
  resolveStatut, resolveFichier, resolveClient, resolveDate, getClientId,
} from '../../utils/documentSources'

interface ClientGroup {
  key:   string
  label: string
  rows:  DocRow[]
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AdminDocuments() {
  const { devise } = useCurrency()
  const [allDocs, setAllDocs]   = useState<DocRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState<DocStatut | ''>('')

  // Bulk export modal
  const [bulkOpen, setBulkOpen]           = useState(false)
  const [selectedKeys, setSelectedKeys]   = useState<Set<string>>(new Set())
  const [exporting, setExporting]         = useState(false)
  const [exportProgress, setExportProgress] = useState(0)

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    const results = await Promise.allSettled(
      DOC_SOURCES.map(s => api.get(`/${SOURCE_API[s]}`))
    )
    const rows: DocRow[] = []
    results.forEach((res, i) => {
      if (res.status !== 'fulfilled') return
      const src = DOC_SOURCES[i]
      const items: Record<string, unknown>[] = Array.isArray(res.value.data)
        ? res.value.data
        : (res.value.data as { data?: unknown[] })?.data ?? []

      items.forEach(item => {
        rows.push({
          key:      `${src}-${item.id}`,
          sourceId: Number(item.id),
          source:   src,
          client:   resolveClient(item),
          type:     TYPE_LABEL[src],
          fichier:  resolveFichier(item, src),
          date:     resolveDate(item),
          statut:   resolveStatut(item, src),
          rawItem:  item,
        })
      })
    })
    const statusOrder: Record<DocStatut, number> = { rejetee: 0, validee: 1, en_attente: 2 }
    rows.sort((a, b) => {
      const sd = statusOrder[a.statut] - statusOrder[b.statut]
      if (sd !== 0) return sd
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })
    setAllDocs(rows)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const updateRow = (key: string, patch: Partial<DocRow>) =>
    setAllDocs(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r))

  // ── Bulk export modal ─────────────────────────────────────────────────────

  const openBulkExport = (rows: DocRow[]) => {
    setSelectedKeys(new Set(rows.map(r => r.key)))
    setBulkOpen(true)
  }

  const allSelected  = (rows: DocRow[]) => rows.length > 0 && rows.every(r => selectedKeys.has(r.key))
  const someSelected = (rows: DocRow[]) => rows.some(r => selectedKeys.has(r.key)) && !allSelected(rows)

  const toggleAll = (rows: DocRow[]) =>
    setSelectedKeys(allSelected(rows) ? new Set() : new Set(rows.map(r => r.key)))

  const toggleOne = (key: string) =>
    setSelectedKeys(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })

  const handleConfirmBulkExport = async (filtered: DocRow[]) => {
    const chosen = filtered.filter(d => selectedKeys.has(d.key))
    if (!chosen.length) { toast.error('Sélectionnez au moins un document.'); return }

    setExporting(true)
    setExportProgress(0)
    const tid = toast.loading(`Export de ${chosen.length} document(s) en cours…`)

    let errors = 0
    try {
      for (let i = 0; i < chosen.length; i++) {
        try {
          await downloadDocExcel(chosen[i], devise)
        } catch {
          // If one fails, fall back to data Excel for that doc
          writeFallbackExcel(chosen[i], devise)
          errors++
        }
        setExportProgress(Math.round(((i + 1) / chosen.length) * 100))
        // Small delay between downloads so the browser doesn't block them
        if (i < chosen.length - 1) await new Promise(r => setTimeout(r, 400))
      }

      const msg = errors > 0
        ? `${chosen.length - errors} exporté(s) avec IA, ${errors} sans IA.`
        : `${chosen.length} document(s) exportés avec analyse IA !`
      toast.success(msg, { id: tid })
      setBulkOpen(false)
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur lors de l\'export', { id: tid })
    } finally {
      setExporting(false)
      setExportProgress(0)
    }
  }

  // ── Filter ────────────────────────────────────────────────────────────────

  const filtered = allDocs.filter(r => {
    const matchText = !search ||
      r.client.toLowerCase().includes(search.toLowerCase()) ||
      r.fichier.toLowerCase().includes(search.toLowerCase()) ||
      r.type.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || r.statut === statusFilter
    return matchText && matchStatus
  })

  const pending = allDocs.filter(r => r.statut === 'en_attente').length

  // ── Group by client ──────────────────────────────────────────────────────

  const clientGroups: ClientGroup[] = useMemo(() => {
    const map = new Map<string, ClientGroup>()
    filtered.forEach(r => {
      const id  = getClientId(r.rawItem)
      const key = id !== null ? `c${id}` : `n-${r.client}`
      if (!map.has(key)) map.set(key, { key, label: r.client, rows: [] })
      map.get(key)!.rows.push(r)
    })
    return Array.from(map.values())
      .sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }))
  }, [filtered])

  const [selectedClient, setSelectedClient] = useState<string | null>(null)
  const selectedGroup = clientGroups.find(g => g.key === selectedClient) ?? null

  // If the selected client disappears from the filtered set (search/status
  // filter changed, or it had no more matching docs), fall back to the grid.
  useEffect(() => {
    if (selectedClient && !clientGroups.some(g => g.key === selectedClient)) {
      setSelectedClient(null)
    }
  }, [clientGroups, selectedClient])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box className="fade-in">
      {/* Header */}
      <Box sx={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: { xs: 'flex-start', sm: 'center' },
        flexDirection: { xs: 'column', sm: 'row' },
        gap: 1.5, mb: 3,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{
            width: 48, height: 48, borderRadius: 2.5,
            background: 'linear-gradient(135deg,#1565C0,#0D47A1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FolderOpenIcon sx={{ color: 'white', fontSize: 26 }} />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={800} color="#1a1a2e" fontSize={{ xs: 17, md: 22 }}>
              Documents clients
            </Typography>
            <Typography color="text.secondary" fontSize={14}>
              Supervision et validation des documents importés
            </Typography>
          </Box>
        </Box>
        {!loading && pending > 0 && (
          <Chip label={`${pending} en attente`}
            sx={{ bgcolor: '#FFF3E0', color: '#E65100', fontWeight: 700,
              fontSize: 13, px: 1, border: '1px solid #FFCC80', flexShrink: 0 }} />
        )}
      </Box>

      <Card sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5, flexWrap: 'wrap' }}>
            <TextField
              placeholder="Rechercher par client, fichier ou type…"
              value={search} onChange={e => setSearch(e.target.value)}
              size="small" sx={{ width: { xs: '100%', sm: 340 } }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'text.disabled' }} /></InputAdornment> }}
            />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Statut</InputLabel>
              <Select
                value={statusFilter}
                label="Statut"
                onChange={e => setStatusFilter(e.target.value as DocStatut | '')}>
                <MenuItem value="">Tous</MenuItem>
                <MenuItem value="en_attente">En attente</MenuItem>
                <MenuItem value="validee">Validé</MenuItem>
                <MenuItem value="rejetee">Rejeté</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="contained"
              size="small"
              startIcon={<TableChartIcon />}
              disabled={filtered.length === 0}
              onClick={() => openBulkExport(filtered)}
              sx={{ bgcolor: '#1565C0', '&:hover': { bgcolor: '#0D47A1' }, fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              Exporter Excel
            </Button>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
          ) : clientGroups.length === 0 ? (
            <DocumentsTable
              rows={[]}
              updateRow={updateRow}
              emptyMessage={search ? 'Aucun résultat.' : 'Aucun document enregistré.'}
            />
          ) : selectedGroup === null ? (
            // ── Row of client cards ──────────────────────────────────────────
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
              gap: 2,
            }}>
              {clientGroups.map(group => {
                const groupPending = group.rows.filter(r => r.statut === 'en_attente').length
                return (
                  <Card key={group.key}
                    onClick={() => setSelectedClient(group.key)}
                    sx={{
                      borderRadius: 3, cursor: 'pointer', transition: 'all .15s',
                      boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
                      '&:hover': { boxShadow: '0 6px 20px rgba(21,101,192,0.15)', transform: 'translateY(-2px)' },
                    }}>
                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2.5 }}>
                      <Avatar sx={{ width: 40, height: 40, bgcolor: '#1565C0', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>
                        {group.label.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography fontWeight={700} fontSize={14} noWrap>{group.label}</Typography>
                        <Typography fontSize={12} color="text.secondary">
                          {group.rows.length} document{group.rows.length > 1 ? 's' : ''}
                        </Typography>
                      </Box>
                      {groupPending > 0 && (
                        <Chip label={groupPending} size="small"
                          sx={{ bgcolor: '#FFF3E0', color: '#E65100', fontWeight: 700, fontSize: 11, flexShrink: 0 }} />
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </Box>
          ) : (
            // ── Drill-down: one client's documents ──────────────────────────
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Tooltip title="Retour à la liste des clients">
                  <IconButton size="small" onClick={() => setSelectedClient(null)}>
                    <ArrowBackIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Avatar sx={{ width: 30, height: 30, bgcolor: '#1565C0', fontSize: 13, fontWeight: 700 }}>
                  {selectedGroup.label.charAt(0).toUpperCase()}
                </Avatar>
                <Typography fontWeight={700} fontSize={15}>{selectedGroup.label}</Typography>
              </Box>
              <DocumentsTable rows={selectedGroup.rows} updateRow={updateRow} minWidth={560} />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* ── Bulk Export Modal ─────────────────────────────────────────────────── */}
      <Dialog open={bulkOpen} onClose={() => !exporting && setBulkOpen(false)}
        maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 17, display: 'flex', alignItems: 'center', gap: 1 }}>
          <TableChartIcon sx={{ color: '#2E7D32', fontSize: 20 }} />
          Exporter en Excel
        </DialogTitle>

        <DialogContent sx={{ pb: 1 }}>
          <Typography fontSize={13} color="text.secondary" mb={1.5}>
            Sélectionnez les documents à inclure. Les factures (achat / vente) seront analysées par IA.
          </Typography>

          {/* Select all */}
          <Box sx={{ px: 1, py: 0.5, bgcolor: '#F0F7FF', borderRadius: 2, mb: 1 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={allSelected(filtered)}
                  indeterminate={someSelected(filtered)}
                  onChange={() => toggleAll(filtered)}
                  size="small"
                  sx={{ color: '#1565C0', '&.Mui-checked': { color: '#1565C0' } }}
                />
              }
              label={
                <Typography fontSize={13} fontWeight={700} color="#1565C0">
                  Tout sélectionner ({filtered.length})
                </Typography>
              }
            />
          </Box>

          <Divider sx={{ mb: 1 }} />

          {/* Document list */}
          <Box sx={{ maxHeight: 340, overflowY: 'auto' }}>
            {filtered.map(doc => {
              const s       = STATUS_MAP[doc.statut]
              const hasFile = !!(FILE_SUB[doc.source] && doc.rawItem.fichier)
              return (
                <Box key={doc.key} onClick={() => toggleOne(doc.key)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    px: 1.5, py: 1, borderRadius: 2, cursor: 'pointer',
                    bgcolor: selectedKeys.has(doc.key) ? '#F0F7FF' : 'transparent',
                    '&:hover': { bgcolor: '#F5F9FF' },
                    borderBottom: '1px solid #F0F4F8',
                  }}>
                  <Checkbox
                    checked={selectedKeys.has(doc.key)}
                    onChange={() => toggleOne(doc.key)}
                    onClick={e => e.stopPropagation()}
                    size="small"
                    sx={{ p: 0.5, color: '#1565C0', '&.Mui-checked': { color: '#1565C0' } }}
                  />
                  <Typography fontWeight={700} fontSize={13} color="#1565C0" sx={{ minWidth: 90 }}>
                    {doc.fichier}
                  </Typography>
                  <Typography fontSize={12} color="text.secondary" sx={{ flex: 1 }} noWrap>{doc.type}</Typography>
                  <Typography fontSize={12} color="text.secondary" sx={{ minWidth: 80 }}>
                    {doc.date ? new Date(doc.date).toLocaleDateString('fr-FR') : '—'}
                  </Typography>
                  {hasFile && (
                    <Chip label="IA" size="small"
                      sx={{ bgcolor: '#E8F5E9', color: '#2E7D32', fontWeight: 700, fontSize: 10, minWidth: 36 }} />
                  )}
                  <Chip label={s.label} size="small"
                    sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: 10, minWidth: 70 }} />
                </Box>
              )
            })}
          </Box>

          {exporting && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress variant="determinate" value={exportProgress}
                sx={{ borderRadius: 1, height: 6, bgcolor: '#E3F2FD', '& .MuiLinearProgress-bar': { bgcolor: '#1565C0' } }} />
              <Typography fontSize={11} color="text.secondary" mt={0.5}>
                {exportProgress}% — analyse en cours…
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1.5, gap: 1, borderTop: '1px solid #F0F4F8' }}>
          <Typography fontSize={13} color="text.secondary" sx={{ flex: 1 }}>
            {selectedKeys.size} / {filtered.length} sélectionné(s)
          </Typography>
          <Button onClick={() => setBulkOpen(false)} disabled={exporting}
            sx={{ borderRadius: 2, fontWeight: 600 }}>
            Annuler
          </Button>
          <Button variant="contained" onClick={() => handleConfirmBulkExport(filtered)}
            disabled={exporting || selectedKeys.size === 0}
            startIcon={exporting ? <CircularProgress size={14} color="inherit" /> : <TableChartIcon />}
            sx={{ fontWeight: 700, borderRadius: 2, bgcolor: '#2E7D32', '&:hover': { bgcolor: '#1B5E20' } }}>
            {exporting ? 'Export en cours…' : "Confirmer l'export"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
