import { useState, useEffect, useRef } from 'react'
import {
  Box, Typography, Card, CardContent, Alert, Chip, Button, TextField,
  Accordion, AccordionSummary, AccordionDetails, List, ListItem, ListItemText,
  IconButton, Tooltip, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogActions, Divider,
} from '@mui/material'
import ExpandMoreIcon    from '@mui/icons-material/ExpandMore'
import MenuBookIcon      from '@mui/icons-material/MenuBook'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import ReceiptLongIcon   from '@mui/icons-material/ReceiptLong'
import GroupsIcon        from '@mui/icons-material/Groups'
import BusinessIcon      from '@mui/icons-material/Business'
import GavelIcon         from '@mui/icons-material/Gavel'
import PublicIcon        from '@mui/icons-material/Public'
import PictureAsPdfIcon  from '@mui/icons-material/PictureAsPdf'
import UploadFileIcon    from '@mui/icons-material/UploadFile'
import AddIcon           from '@mui/icons-material/Add'
import VisibilityIcon    from '@mui/icons-material/Visibility'
import DeleteIcon        from '@mui/icons-material/Delete'
import CloseIcon         from '@mui/icons-material/Close'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import PdfFlipBook from '../../components/common/PdfFlipBook'
import PdfThumbnail from '../../components/common/PdfThumbnail'

interface Category {
  key: string
  title: string
  icon: React.ReactNode
  color: string
  items: { label: string; detail: string }[]
}

const CATEGORIES: Category[] = [
  {
    key: 'normes',
    title: 'Normes comptables',
    icon: <AccountBalanceIcon />,
    color: '#1565C0',
    items: [
      { label: 'Système Comptable des Entreprises (SCE)', detail: "Loi n°96-112 du 30 décembre 1996, socle du référentiel comptable tunisien — cadre conceptuel et normes comptables tunisiennes (NCT 01 à NCT 41)." },
      { label: 'Norme comptable générale (NCT 01)', detail: "Fixe les principes comptables fondamentaux : image fidèle, prudence, continuité d'exploitation, indépendance des exercices, permanence des méthodes." },
      { label: 'Normes sectorielles', detail: "Normes spécifiques à certains secteurs (banques, assurances, associations, PME…) qui complètent le référentiel général." },
    ],
  },
  {
    key: 'fiscalite',
    title: 'Fiscalité',
    icon: <ReceiptLongIcon />,
    color: '#E65100',
    items: [
      { label: "Code de l'IRPP et de l'IS", detail: "Impôt sur le revenu des personnes physiques et impôt sur les sociétés — barèmes, régimes réel/forfaitaire, avantages fiscaux." },
      { label: 'Code de la TVA', detail: "Taxe sur la valeur ajoutée — taux standard et taux réduits, régimes de suspension, TVA sur les importations." },
      { label: 'Code des droits et procédures fiscaux (CDPF)', detail: "Contrôle fiscal, droits et obligations du contribuable, contentieux et voies de recours." },
      { label: 'Droit de timbre et autres droits', detail: "Droits d'enregistrement, de timbre et taxes annexes applicables aux actes et documents." },
      { label: 'Loi de finances annuelle', detail: "Actualisée chaque année (loi de finances + éventuelle loi de finances complémentaire) — modifie taux, avantages et obligations. Toujours vérifier la version en vigueur." },
    ],
  },
  {
    key: 'social',
    title: 'Droit social',
    icon: <GroupsIcon />,
    color: '#7B1FA2',
    items: [
      { label: 'Code du travail', detail: "Contrats de travail, durée du travail, congés, rupture — cadre général des relations employeur/salarié." },
      { label: 'Législation CNSS', detail: "Caisse Nationale de Sécurité Sociale — cotisations patronales et salariales, régimes RSNA/RSA, déclarations trimestrielles." },
      { label: 'Convention collective sectorielle', detail: "Chaque secteur d'activité peut avoir sa propre convention collective précisant grilles de salaires et avantages." },
    ],
  },
  {
    key: 'societes',
    title: 'Droit des sociétés',
    icon: <BusinessIcon />,
    color: '#2E7D32',
    items: [
      { label: 'Code des sociétés commerciales (CSC)', detail: "Constitution, gouvernance, augmentation/réduction de capital, fusion, dissolution des sociétés (SARL, SA, SUARL…)." },
      { label: "Registre National des Entreprises (RNE)", detail: "Immatriculation, dépôt des actes et publicité légale des entreprises." },
    ],
  },
  {
    key: 'ressources',
    title: 'Ressources officielles',
    icon: <PublicIcon />,
    color: '#0288D1',
    items: [
      { label: 'Journal Officiel de la République Tunisienne (JORT)', detail: "Publication officielle des lois, décrets et arrêtés — référence unique pour vérifier un texte en vigueur." },
      { label: 'Direction Générale des Impôts (DGI)', detail: "Circulaires, notes communes et prises de position fiscales du Ministère des Finances." },
      { label: 'Ordre des Experts Comptables de Tunisie (OECT)', detail: "Guides, normes professionnelles et actualités de la profession comptable." },
    ],
  },
]

interface TexteLoiDoc {
  id: number
  titre: string
  description: string | null
  fichier: string
  taille: number | null
  created_at: string
  admin?: { nom: string } | null
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

export default function AdminTextesLois() {
  const [expanded, setExpanded] = useState<string | false>('normes')

  // ── Library ──────────────────────────────────────────────────────────────
  const [docs, setDocs]       = useState<TexteLoiDoc[]>([])
  const [loadingDocs, setLoadingDocs] = useState(true)

  const loadDocs = () => {
    setLoadingDocs(true)
    api.get('/textes-lois')
      .then((r: { data: TexteLoiDoc[] }) => setDocs(r.data))
      .catch(() => toast.error('Impossible de charger les documents.'))
      .finally(() => setLoadingDocs(false))
  }
  useEffect(loadDocs, [])

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false)
  const [titre, setTitre]           = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile]             = useState<File | null>(null)
  const [uploading, setUploading]   = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const openUpload  = () => { setUploadOpen(true); setTitre(''); setDescription(''); setFile(null) }
  const closeUpload = () => { setUploadOpen(false) }

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.type !== 'application/pdf') { toast.error('Seuls les fichiers PDF sont acceptés.'); return }
    if (f.size > 20 * 1024 * 1024) { toast.error('Fichier trop volumineux (max 20 Mo).'); return }
    setFile(f)
    if (!titre) setTitre(f.name.replace(/\.pdf$/i, ''))
  }

  const handleUpload = async () => {
    if (!file || !titre.trim()) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('titre', titre.trim())
      if (description.trim()) fd.append('description', description.trim())
      fd.append('fichier', file)
      const res = await api.post('/textes-lois', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setDocs(prev => [res.data, ...prev])
      toast.success('Document ajouté.')
      closeUpload()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || "Erreur lors de l'ajout du document.")
    } finally {
      setUploading(false)
    }
  }

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<TexteLoiDoc | null>(null)
  const [deleting, setDeleting] = useState(false)
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/textes-lois/${deleteTarget.id}`)
      setDocs(prev => prev.filter(d => d.id !== deleteTarget.id))
      toast.success('Document supprimé.')
      setDeleteTarget(null)
    } catch { toast.error('Erreur lors de la suppression.') }
    finally { setDeleting(false) }
  }

  // Flipbook viewer
  const [viewTarget, setViewTarget] = useState<TexteLoiDoc | null>(null)

  return (
    <Box className="fade-in">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Box sx={{
          width: 48, height: 48, borderRadius: 2.5,
          background: 'linear-gradient(135deg,#1565C0,#0D47A1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <GavelIcon sx={{ color: 'white', fontSize: 26 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="h5" fontWeight={800} color="#1a1a2e" fontSize={{ xs: 17, md: 22 }}>
            Textes et lois
          </Typography>
          <Typography color="text.secondary" fontSize={14}>
            Repères réglementaires et bibliothèque de documents
          </Typography>
        </Box>
      </Box>

      {/* ── Document library ── */}
      <Card sx={{ borderRadius: 3, mb: 3 }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <MenuBookIcon sx={{ color: '#1565C0' }} />
            <Typography fontWeight={700} fontSize={16}>Bibliothèque de documents</Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />

          {loadingDocs ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>
          ) : (
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)', xl: 'repeat(5, 1fr)' },
              gap: 2,
            }}>
              {docs.map(doc => (
                <Card key={doc.id}
                  onClick={() => setViewTarget(doc)}
                  sx={{
                    borderRadius: 3, cursor: 'pointer', overflow: 'hidden',
                    transition: 'all .18s ease',
                    '&:hover': { boxShadow: '0 10px 26px rgba(21,101,192,0.18)', transform: 'translateY(-3px)' },
                    '&:hover .doc-card-overlay': { opacity: 1 },
                  }}>
                  <Box sx={{ position: 'relative', aspectRatio: '3 / 4', borderBottom: '1px solid #EEF1F6' }}>
                    <PdfThumbnail fileUrl={`/textes-lois/${doc.id}/fichier`} alt={doc.titre} />

                    <Box className="doc-card-overlay" sx={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: 'rgba(10,22,40,0.45)', opacity: 0,
                      transition: 'opacity .18s ease',
                      pointerEvents: 'none',
                    }}>
                      <VisibilityIcon sx={{ color: 'white', fontSize: 34 }} />
                    </Box>
                  </Box>

                  <CardContent sx={{ p: 1.5, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 0.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                        <PictureAsPdfIcon sx={{ color: '#C62828', fontSize: 15, flexShrink: 0 }} />
                        <Typography fontWeight={700} fontSize={12.5} noWrap>{doc.titre}</Typography>
                      </Box>
                      <Typography fontSize={10.5} color="text.secondary" mt={0.3}>
                        {formatSize(doc.taille)} · {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                      </Typography>
                    </Box>

                    <Tooltip title="Supprimer">
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(doc) }}
                        sx={{ color: '#C62828', flexShrink: 0, '&:hover': { bgcolor: '#FFEBEE' } }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </CardContent>
                </Card>
              ))}

              {/* Add-document placeholder card — always last */}
              <Card
                onClick={openUpload}
                sx={{
                  borderRadius: 3, cursor: 'pointer', overflow: 'hidden',
                  border: '2px dashed #90CAF9', boxShadow: 'none',
                  transition: 'all .18s ease',
                  '&:hover': { bgcolor: '#F0F7FF', borderColor: '#1565C0', transform: 'translateY(-3px)' },
                }}>
                <Box sx={{
                  aspectRatio: '3 / 4', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 1, color: '#1565C0',
                }}>
                  <AddIcon sx={{ fontSize: 40 }} />
                  <Typography fontWeight={700} fontSize={12.5} textAlign="center" px={1}>
                    Ajouter un document
                  </Typography>
                </Box>
              </Card>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* ── Reference categories ── */}
      {CATEGORIES.map(cat => (
        <Accordion
          key={cat.key}
          expanded={expanded === cat.key}
          onChange={(_, isExp) => setExpanded(isExp ? cat.key : false)}
          disableGutters
          sx={{
            mb: 1.5, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            '&:before': { display: 'none' },
            overflow: 'hidden',
          }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2.5, py: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{
                width: 36, height: 36, borderRadius: 2, flexShrink: 0,
                bgcolor: `${cat.color}18`, color: cat.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {cat.icon}
              </Box>
              <Typography fontWeight={700} fontSize={15}>{cat.title}</Typography>
              <Chip label={cat.items.length} size="small"
                sx={{ bgcolor: `${cat.color}18`, color: cat.color, fontWeight: 700, fontSize: 11, ml: 0.5 }} />
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2.5, pb: 2, pt: 0 }}>
            <List disablePadding>
              {cat.items.map((it, i) => (
                <ListItem key={it.label} disableGutters sx={{ alignItems: 'flex-start', py: 1, borderTop: i > 0 ? '1px solid #F0F4F8' : 'none' }}>
                  <ListItemText
                    primary={<Typography fontWeight={700} fontSize={13.5}>{it.label}</Typography>}
                    secondary={<Typography fontSize={12.5} color="text.secondary" mt={0.3}>{it.detail}</Typography>}
                  />
                </ListItem>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      ))}

      {/* ── Upload Dialog ── */}
      <Dialog open={uploadOpen} onClose={closeUpload} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Typography fontWeight={700} fontSize={16}>Ajouter un document</Typography>
          <IconButton size="small" onClick={closeUpload}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2.5 }}>
          <Box
            component="input"
            ref={fileRef}
            type="file"
            accept="application/pdf"
            sx={{ display: 'none' }}
            onChange={handleFilePick}
          />
          <Box
            onClick={() => fileRef.current?.click()}
            sx={{
              border: '2px dashed #90CAF9', borderRadius: 3, p: 3, textAlign: 'center',
              cursor: 'pointer', bgcolor: '#F0F7FF', transition: 'all 0.2s',
              '&:hover': { bgcolor: '#E3F0FF', borderColor: '#1565C0' },
            }}>
            <PictureAsPdfIcon sx={{ color: '#C62828', fontSize: 36, mb: 1 }} />
            <Typography fontWeight={600} color="#1565C0" fontSize={14}>
              {file ? file.name : 'Cliquer pour sélectionner un PDF'}
            </Typography>
            <Typography color="text.secondary" fontSize={12} mt={0.5}>PDF uniquement — max 20 Mo</Typography>
          </Box>

          <TextField label="Titre" value={titre} onChange={(e) => setTitre(e.target.value)}
            fullWidth size="small" required />
          <TextField label="Description (facultatif)" value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth size="small" multiline rows={2} />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button onClick={closeUpload} disabled={uploading} color="inherit">Annuler</Button>
          <Button variant="contained" onClick={handleUpload}
            disabled={uploading || !file || !titre.trim()}
            startIcon={uploading ? <CircularProgress size={16} color="inherit" /> : <UploadFileIcon />}>
            {uploading ? 'Envoi…' : 'Ajouter'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography fontWeight={700} fontSize={16}>Confirmer la suppression</Typography>
          <IconButton size="small" onClick={() => setDeleteTarget(null)}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 1 }}>
            Le document <strong>{deleteTarget?.titre}</strong> sera définitivement supprimé.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting} color="inherit">Annuler</Button>
          <Button variant="contained" color="error" onClick={handleDelete}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}>
            {deleting ? 'Suppression…' : 'Supprimer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Flipbook viewer ── */}
      <Dialog open={!!viewTarget} onClose={() => setViewTarget(null)} maxWidth="lg" fullWidth
        PaperProps={{ sx: { bgcolor: '#FBFDFF', borderRadius: 4, overflow: 'hidden' } }}>
        <DialogTitle sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          bgcolor: 'rgba(21,101,192,0.04)', borderBottom: '1px solid rgba(21,101,192,0.08)',
        }}>
          <Typography fontWeight={700} fontSize={16} color="#1a1a2e">{viewTarget?.titre}</Typography>
          <IconButton size="small" onClick={() => setViewTarget(null)} sx={{ color: '#64748B' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {viewTarget && (
            <PdfFlipBook fileUrl={`/textes-lois/${viewTarget.id}/fichier`} title={viewTarget.titre} />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  )
}
