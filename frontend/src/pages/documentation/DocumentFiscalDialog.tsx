import { useEffect, useRef, useState } from 'react'
import {
  Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, TextField, Typography,
} from '@mui/material'
import CloseIcon        from '@mui/icons-material/Close'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import UploadFileIcon   from '@mui/icons-material/UploadFile'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import { CATEGORIES, CategorieKey, DocumentFiscal } from './categories'

const MAX_MB = 50

interface Props {
  open: boolean
  onClose: () => void
  onSaved: (doc: DocumentFiscal) => void
  /** Document to edit; when absent the dialog uploads a new one. */
  doc?: DocumentFiscal | null
  defaultCategorie: CategorieKey
}

/** Admin dialog: upload a PDF, or edit an existing document's details. */
export default function DocumentFiscalDialog({ open, onClose, onSaved, doc, defaultCategorie }: Props) {
  const isEdit = !!doc
  const [categorie, setCategorie] = useState<CategorieKey>(defaultCategorie)
  const [annee, setAnnee] = useState('')
  const [sousCategorie, setSousCategorie] = useState('')
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setCategorie(doc?.categorie ?? defaultCategorie)
    setAnnee(doc ? (doc.annee ? String(doc.annee) : '') : String(new Date().getFullYear()))
    setSousCategorie(doc?.sous_categorie ?? '')
    setTitre(doc?.titre ?? '')
    setDescription(doc?.description ?? '')
    setFile(null)
  }, [open, doc, defaultCategorie])

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.type !== 'application/pdf') { toast.error('Seuls les fichiers PDF sont acceptés.'); return }
    if (f.size > MAX_MB * 1024 * 1024) { toast.error(`Fichier trop volumineux (max ${MAX_MB} Mo).`); return }
    setFile(f)
    if (!titre) setTitre(f.name.replace(/\.pdf$/i, ''))
  }

  const anneeValid = annee === '' || /^\d{4}$/.test(annee)
  const canSave = !saving && titre.trim() !== '' && anneeValid && (isEdit || !!file)

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      let res
      if (isEdit) {
        res = await api.put(`/documents-fiscaux/${doc!.id}`, {
          categorie, titre: titre.trim(),
          annee: annee ? Number(annee) : null,
          sous_categorie: sousCategorie.trim() || null,
          description: description.trim() || null,
        })
      } else {
        const fd = new FormData()
        fd.append('categorie', categorie)
        fd.append('titre', titre.trim())
        if (annee) fd.append('annee', annee)
        if (sousCategorie.trim()) fd.append('sous_categorie', sousCategorie.trim())
        if (description.trim()) fd.append('description', description.trim())
        fd.append('fichier', file!)
        res = await api.post('/documents-fiscaux', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 0, // large PDFs can take a while to upload
        })
      }
      toast.success(isEdit ? 'Document modifié.' : 'Document ajouté.')
      onSaved(res.data)
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || "Erreur lors de l'enregistrement.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography component="span" fontWeight={700} fontSize={16}>
          {isEdit ? 'Modifier le document' : 'Ajouter un document fiscal'}
        </Typography>
        <IconButton size="small" onClick={onClose} disabled={saving} aria-label="Fermer">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2.5 }}>
        {!isEdit && (
          <>
            <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={pickFile} />
            <Box
              role="button" tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click() }}
              sx={{
                border: '2px dashed', borderColor: 'primary.light', borderRadius: 3, p: 3,
                textAlign: 'center', cursor: 'pointer', transition: 'background-color .2s',
                '&:hover': { bgcolor: 'action.hover' },
              }}>
              <PictureAsPdfIcon sx={{ color: '#C62828', fontSize: 36, mb: 1 }} />
              <Typography fontWeight={600} color="primary.main" fontSize={14} sx={{ wordBreak: 'break-all' }}>
                {file ? file.name : 'Cliquer pour sélectionner un PDF'}
              </Typography>
              <Typography color="text.secondary" fontSize={12} mt={0.5}>PDF uniquement — max {MAX_MB} Mo</Typography>
            </Box>
          </>
        )}

        <TextField select label="Catégorie" value={categorie} size="small" fullWidth
          onChange={e => setCategorie(e.target.value as CategorieKey)}>
          {CATEGORIES.map(c => <MenuItem key={c.key} value={c.key}>{c.label}</MenuItem>)}
        </TextField>

        <TextField label="Titre" value={titre} onChange={e => setTitre(e.target.value)}
          size="small" fullWidth required placeholder="Ex. Loi de finances 2025" />

        <TextField label="Année" value={annee} size="small" fullWidth
          onChange={e => setAnnee(e.target.value.replace(/\D/g, '').slice(0, 4))}
          error={!anneeValid}
          helperText={anneeValid ? 'Les documents sont classés par année. Laissez vide si non applicable.' : 'Année sur 4 chiffres.'}
          inputProps={{ inputMode: 'numeric' }} />

        <TextField label="Sous-catégorie (facultatif)" value={sousCategorie} size="small" fullWidth
          onChange={e => setSousCategorie(e.target.value)}
          placeholder="Ex. France, Code de la TVA…"
          helperText="Utilisée pour classer les documents sans année (pays, code…)." />

        <TextField label="Description (facultatif)" value={description}
          onChange={e => setDescription(e.target.value)}
          size="small" fullWidth multiline rows={2} />
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} disabled={saving} color="inherit">Annuler</Button>
        <Button variant="contained" onClick={save} disabled={!canSave}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : (isEdit ? null : <UploadFileIcon />)}>
          {saving ? 'Enregistrement…' : (isEdit ? 'Enregistrer' : 'Ajouter')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
