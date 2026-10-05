import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Typography, Card, CardContent, Avatar, Chip,
  CircularProgress, IconButton, Tooltip, Button,
  Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material'
import ArrowBackIcon       from '@mui/icons-material/ArrowBack'
import AccountBalanceIcon  from '@mui/icons-material/AccountBalance'
import ReceiptIcon         from '@mui/icons-material/Receipt'
import ShoppingCartIcon    from '@mui/icons-material/ShoppingCart'
import GavelIcon           from '@mui/icons-material/Gavel'
import GroupsIcon          from '@mui/icons-material/Groups'
import CalendarTodayIcon   from '@mui/icons-material/CalendarToday'
import FolderIcon          from '@mui/icons-material/Folder'
import TableChartIcon      from '@mui/icons-material/TableChart'
import DownloadIcon        from '@mui/icons-material/Download'
import DeleteOutlineIcon   from '@mui/icons-material/DeleteOutline'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import DocumentsTable from '../../components/admin/DocumentsTable'
import {
  DocRow, DocSource, DOC_SOURCES, SOURCE_API, TYPE_LABEL,
  FOLDER_LABEL, FOLDER_ORDER,
  resolveStatut, resolveFichier, resolveClient, resolveDate, getClientId,
} from '../../utils/documentSources'

interface ClientInfo {
  id: number
  nom: string
  email: string
  entreprise: string | null
  avatar?: string | null
}

interface ExcelExportRow {
  id: number
  source: 'achat' | 'vente'
  reference: string
  devise: string | null
  taille: number | null
  created_at: string
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

const FOLDER_ICON: Record<DocSource, React.ReactNode> = {
  releve:  <AccountBalanceIcon />,
  fiscale: <GavelIcon />,
  achat:   <ShoppingCartIcon />,
  vente:   <ReceiptIcon />,
  sociale: <GroupsIcon />,
  leasing: <CalendarTodayIcon />,
}

export default function AdminClientDossier() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const clientId = Number(id)

  const [client, setClient]   = useState<ClientInfo | null>(null)
  const [docs, setDocs]       = useState<DocRow[]>([])
  const [loading, setLoading] = useState(true)
  const [folder, setFolder]   = useState<DocSource | 'excel' | null>(null)

  const [excelExports, setExcelExports]   = useState<ExcelExportRow[]>([])
  const [excelDeletingId, setExcelDeletingId] = useState<number | null>(null)

  const loadExcelExports = useCallback(() => {
    api.get('/excel-exports', { params: { client_id: clientId } })
      .then((r: { data: ExcelExportRow[] }) => setExcelExports(r.data))
      .catch(() => {})
  }, [clientId])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const clientsRes = await api.get('/admin/clients')
      const found = (clientsRes.data as ClientInfo[]).find(c => c.id === clientId) ?? null
      setClient(found)
    } catch { toast.error('Impossible de charger le client.') }

    loadExcelExports()

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

      items
        .filter(item => getClientId(item) === clientId)
        .forEach(item => {
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
    rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    setDocs(rows)
    setLoading(false)
  }, [clientId, loadExcelExports])

  useEffect(() => { load() }, [load])

  const updateRow = (key: string, patch: Partial<DocRow>) =>
    setDocs(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r))

  const folderRows = (src: DocSource) => docs.filter(d => d.source === src)

  const handleDownloadExport = async (row: ExcelExportRow) => {
    try {
      const res = await api.get(`/excel-exports/${row.id}/fichier`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${row.reference.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Impossible de télécharger ce fichier.')
    }
  }

  const handleDeleteExport = async (row: ExcelExportRow) => {
    setExcelDeletingId(row.id)
    try {
      await api.delete(`/excel-exports/${row.id}`)
      setExcelExports(prev => prev.filter(e => e.id !== row.id))
      toast.success('Fichier supprimé.')
    } catch {
      toast.error('Erreur lors de la suppression.')
    } finally {
      setExcelDeletingId(null)
    }
  }

  if (loading) {
    return (
      <Box className="fade-in" sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box className="fade-in">
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/admin/clients')}
        size="small"
        sx={{ mb: 2, color: '#1565C0', fontWeight: 600, textTransform: 'none' }}
      >
        Retour à la liste des clients
      </Button>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Avatar sx={{ width: 52, height: 52, bgcolor: '#1565C0', fontSize: 20, fontWeight: 700 }}
          src={client?.avatar ?? undefined}>
          {!client?.avatar && (client?.nom.charAt(0).toUpperCase() ?? '?')}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800} color="#1a1a2e" fontSize={{ xs: 17, md: 22 }}>
            {client ? `Dossier de ${client.nom}` : 'Dossier client'}
          </Typography>
          <Typography color="text.secondary" fontSize={14}>
            {client?.email}{client?.entreprise ? ` — ${client.entreprise}` : ''}
          </Typography>
        </Box>
      </Box>

      {folder === null ? (
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          gap: 2,
        }}>
          {FOLDER_ORDER.map(src => {
            const rows    = folderRows(src)
            const pending = rows.filter(r => r.statut === 'en_attente').length
            return (
              <Card key={src}
                onClick={() => setFolder(src)}
                sx={{
                  borderRadius: 3, cursor: 'pointer', transition: 'all .15s',
                  '&:hover': { boxShadow: '0 6px 20px rgba(21,101,192,0.15)', transform: 'translateY(-2px)' },
                }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2.5 }}>
                  <Box sx={{
                    width: 48, height: 48, borderRadius: 2.5, flexShrink: 0,
                    background: 'linear-gradient(135deg,#1565C0,#0D47A1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', '& svg': { fontSize: 24 },
                  }}>
                    {FOLDER_ICON[src]}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={700} fontSize={14} noWrap>{FOLDER_LABEL[src]}</Typography>
                    <Typography fontSize={12} color="text.secondary">
                      {rows.length} élément{rows.length !== 1 ? 's' : ''}
                    </Typography>
                  </Box>
                  {pending > 0 && (
                    <Chip label={pending} size="small"
                      sx={{ bgcolor: '#FFF3E0', color: '#E65100', fontWeight: 700, fontSize: 11 }} />
                  )}
                </CardContent>
              </Card>
            )
          })}

          {/* Fichiers Excel — analyses de factures converties, archivées automatiquement */}
          <Card
            onClick={() => setFolder('excel')}
            sx={{
              borderRadius: 3, cursor: 'pointer', transition: 'all .15s',
              '&:hover': { boxShadow: '0 6px 20px rgba(46,125,50,0.15)', transform: 'translateY(-2px)' },
            }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2.5 }}>
              <Box sx={{
                width: 48, height: 48, borderRadius: 2.5, flexShrink: 0,
                background: 'linear-gradient(135deg,#2E7D32,#1B5E20)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', '& svg': { fontSize: 24 },
              }}>
                <TableChartIcon />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography fontWeight={700} fontSize={14} noWrap>Fichiers Excel</Typography>
                <Typography fontSize={12} color="text.secondary">
                  {excelExports.length} élément{excelExports.length !== 1 ? 's' : ''}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>
      ) : folder === 'excel' ? (
        <Card sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
              <Tooltip title="Retour aux dossiers">
                <IconButton size="small" onClick={() => setFolder(null)}>
                  <ArrowBackIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <TableChartIcon sx={{ color: '#2E7D32', fontSize: 20 }} />
              <Typography fontWeight={700} fontSize={16}>Fichiers Excel</Typography>
            </Box>

            {excelExports.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <TableChartIcon sx={{ fontSize: 52, color: '#ddd' }} />
                <Typography color="text.secondary" mt={1} fontSize={14}>
                  Aucun fichier Excel généré pour ce client.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ overflowX: 'auto' }}>
                <Table sx={{ minWidth: 520 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Référence</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Taille</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {excelExports.map(row => (
                      <TableRow key={row.id} sx={{ '&:hover': { bgcolor: '#f8f9ff' } }}>
                        <TableCell>
                          <Typography fontSize={13} color="#1565C0" fontWeight={500}>{row.reference}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={row.source === 'achat' ? 'Achat' : 'Vente'} size="small"
                            sx={{
                              bgcolor: row.source === 'achat' ? '#FFF3E0' : '#E3F2FD',
                              color: row.source === 'achat' ? '#E65100' : '#1565C0',
                              fontWeight: 700, fontSize: 11,
                            }} />
                        </TableCell>
                        <TableCell sx={{ fontSize: 13, color: '#555' }}>
                          {new Date(row.created_at).toLocaleDateString('fr-FR')}
                        </TableCell>
                        <TableCell sx={{ fontSize: 13, color: '#555' }}>{formatSize(row.taille)}</TableCell>
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                          <Tooltip title="Télécharger">
                            <IconButton size="small" sx={{ color: '#2E7D32' }}
                              onClick={() => handleDownloadExport(row)}>
                              <DownloadIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Supprimer">
                            <span>
                              <IconButton size="small" sx={{ color: '#C62828' }}
                                disabled={excelDeletingId === row.id}
                                onClick={() => handleDeleteExport(row)}>
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
              <Tooltip title="Retour aux dossiers">
                <IconButton size="small" onClick={() => setFolder(null)}>
                  <ArrowBackIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <FolderIcon sx={{ color: '#1565C0', fontSize: 20 }} />
              <Typography fontWeight={700} fontSize={16}>{FOLDER_LABEL[folder]}</Typography>
            </Box>
            <DocumentsTable
              rows={folderRows(folder)}
              updateRow={updateRow}
              emptyMessage="Aucun document dans ce dossier."
              minWidth={560}
            />
          </CardContent>
        </Card>
      )}
    </Box>
  )
}
