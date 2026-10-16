import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Dialog, Box, Typography, IconButton, Button, Checkbox, FormControlLabel, Radio, RadioGroup,
  CircularProgress, MenuItem, Select, InputBase,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import CheckIcon from '@mui/icons-material/Check'
import ClearIcon from '@mui/icons-material/Clear'
import AddIcon from '@mui/icons-material/Add'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import toast from 'react-hot-toast'
import api from '../../api/axios'

type StatutFacture = 'en_instance' | 'facture' | 'reg_client'

interface Ligne {
  designation: string
  debours: boolean
  qt: number
  pu_ht: number
  tva: number
  remise: number
}

interface FactureForm {
  numero: string
  date_facture: string
  societe: string
  client_code: string
  client_nom: string
  observation: string
  exercice: string
  statut: StatutFacture
  mode_paiement: string
  duplicata: boolean
  tampon: boolean
  sans_en_tete: boolean
  lignes: Ligne[]
  remise_acc_taux: number
  timbre: number
}

export interface FactureSummary { id: number; ticket_id: number; numero: string; statut: StatutFacture; net_facture: number }

const TAUX_TVA = [0, 7, 13, 19]
const MODES_PAIEMENT = ['Espèces', 'Chèque', 'Virement', 'Traite', 'Carte bancaire']
const emptyLigne = (): Ligne => ({ designation: '', debours: false, qt: 0, pu_ht: 0, tva: 19, remise: 0 })

const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const lineNet = (l: Ligne) => l.qt * l.pu_ht * (1 - (l.remise || 0) / 100)

/**
 * "250,5", "250.5", "1 000,500" and "1.000,500" are all accepted: when a comma
 * is present it is the decimal mark and dots are thousands separators.
 */
const parseNum = (raw: string) => {
  let t = raw.replace(/\s/g, '')
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  else if ((t.match(/\./g) ?? []).length > 1) t = t.replace(/\./g, '')
  return Number(t)
}

/**
 * Text field for amounts: keeps the raw text while typing so "1,5" or "12."
 * aren't wiped out mid-entry (a type="number" input reports "" for those),
 * accepts comma or dot as decimal separator, and selects all on focus so
 * typing replaces the default 0.
 */
function NumField({ value, onValue, max, sx, placeholder }: { value: number; onValue: (n: number) => void; max?: number; sx?: object; placeholder?: string }) {
  const display = (n: number) => (n ? String(n).replace('.', ',') : '')
  const [text, setText] = useState(display(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => { if (!focused) setText(display(value)) }, [value, focused])

  return (
    <InputBase
      value={text}
      placeholder={placeholder}
      inputProps={{ inputMode: 'decimal' }}
      onFocus={e => { setFocused(true); e.target.select() }}
      onBlur={() => { setFocused(false); setText(display(value)) }}
      onChange={e => {
        const raw = e.target.value
        if (!/^[\d\s.]*(,\d*)?$/.test(raw)) return
        setText(raw)
        const n = parseNum(raw)
        onValue(Number.isFinite(n) ? (max !== undefined ? Math.min(max, n) : n) : 0)
      }}
      sx={sx}
    />
  )
}

/** Same rules as TicketFactureController::computeTotals — the server recomputes on save. */
function computeTotals(lignes: Ligne[], remiseAccTaux: number, timbre: number) {
  const bases: Record<number, number> = { 0: 0, 7: 0, 13: 0, 19: 0 }
  let debours = 0
  for (const l of lignes) {
    if (l.debours) debours += lineNet(l)
    else bases[l.tva] = (bases[l.tva] ?? 0) + lineNet(l)
  }
  const brut = Object.values(bases).reduce((a, b) => a + b, 0)
  const remiseAcc = brut * remiseAccTaux / 100
  const ht = brut - remiseAcc
  let tva = 0
  for (const t of TAUX_TVA) {
    bases[t] = bases[t] * (1 - remiseAccTaux / 100)
    tva += bases[t] * t / 100
  }
  const ttc = ht + tva + debours + timbre
  return { bases, brut, remiseAcc, ht, tva, debours, ttc }
}

// ── Desktop-form look ("Bon d'Intervention") ─────────────────────────────────
const C = {
  window: '#DCE8F5', panel: '#C9DCF0', border: '#9DB7D5', label: '#1F3A5F', red: '#D32F2F',
  green: '#7BC043', greenDark: '#5E9E2F', orange: '#F5A623', gridHead: '#3B4148', stripe: '#E7F0FA',
  readonly: '#FFF8D6',
}

const fieldSx = {
  bgcolor: '#fff', border: `1px solid ${C.border}`, borderRadius: '3px', px: 0.75, height: 24, fontSize: 12,
  '& input': { p: 0 },
}
const readonlySx = { ...fieldSx, bgcolor: C.readonly, fontWeight: 700, '& input': { p: 0, textAlign: 'center' } }
const lbl = (color = C.label) => ({ fontSize: 12, fontWeight: 600, color, whiteSpace: 'nowrap' as const })
const greenBtn = {
  minWidth: 0, height: 26, px: 1.5, fontSize: 11.5, fontWeight: 700, textTransform: 'none', color: '#fff',
  background: `linear-gradient(${C.green}, ${C.greenDark})`, border: '1px solid #4E8A22', borderRadius: '3px',
  '&:hover': { background: C.greenDark },
} as const
const orangeBtn = { ...greenBtn, background: `linear-gradient(#FFC04D, ${C.orange})`, border: '1px solid #D48806', color: '#5A3500' } as const
const amountBox = { ...fieldSx, bgcolor: '#E9EEF3', '& input': { p: 0, textAlign: 'right' } }

interface Props {
  ticketId: number | null
  onClose: () => void
  onSaved: (summary: FactureSummary) => void
}

export default function TicketFactureDialog({ ticketId, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FactureForm | null>(null)
  const [exists, setExists] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    if (!ticketId) return
    setForm(null)
    setSelected(0)
    setLoading(true)
    api.get(`/tickets/${ticketId}/facturation`)
      .then(({ data }) => {
        const f = data.facture
        setForm({ ...f, date_facture: String(f.date_facture).slice(0, 10), mode_paiement: f.mode_paiement ?? '', observation: f.observation ?? '', exercice: f.exercice ?? '', client_code: f.client_code ?? '', societe: f.societe ?? '' })
        setExists(data.existe)
      })
      .catch(err => { toast.error(err?.response?.data?.message ?? 'Impossible de charger la facturation.'); onClose() })
      .finally(() => setLoading(false))
  }, [ticketId, onClose])

  const totals = useMemo(
    () => form ? computeTotals(form.lignes, form.remise_acc_taux || 0, form.timbre || 0) : null,
    [form],
  )

  const set = <K extends keyof FactureForm>(k: K, v: FactureForm[K]) => setForm(f => f && { ...f, [k]: v })
  const setLigne = (i: number, patch: Partial<Ligne>) =>
    setForm(f => f && { ...f, lignes: f.lignes.map((l, j) => (j === i ? { ...l, ...patch } : l)) })
  const addLigne = (l: Ligne = emptyLigne()) =>
    setForm(f => { if (!f) return f; setSelected(f.lignes.length); return { ...f, lignes: [...f.lignes, l] } })
  const removeLigne = () =>
    setForm(f => f && { ...f, lignes: f.lignes.filter((_, j) => j !== selected) })
  const moveLigne = (dir: -1 | 1) => setForm(f => {
    if (!f) return f
    const to = selected + dir
    if (to < 0 || to >= f.lignes.length) return f
    const lignes = [...f.lignes];
    [lignes[selected], lignes[to]] = [lignes[to], lignes[selected]]
    setSelected(to)
    return { ...f, lignes }
  })

  const save = useCallback(async (): Promise<boolean> => {
    if (!form || !ticketId) return false
    const lignes = form.lignes.filter(l => l.designation.trim())
    if (lignes.length === 0) { toast.error('Ajoutez au moins une ligne avec une désignation.'); return false }
    if (!form.date_facture) { toast.error('La date est obligatoire.'); return false }
    if (!form.client_nom.trim()) { toast.error('Le client est obligatoire.'); return false }
    setSaving(true)
    try {
      const { data } = await api.post(`/tickets/${ticketId}/facturation`, { ...form, lignes })
      toast.success(data.message)
      setExists(true)
      setForm(f => f && { ...f, numero: data.facture.numero, lignes })
      onSaved(data.facture)
      return true
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Erreur lors de l'enregistrement.")
      return false
    } finally {
      setSaving(false)
    }
  }, [form, ticketId, onSaved])

  const downloadPdf = async () => {
    if (!ticketId || !form) return
    if (!(await save())) return
    setDownloading(true)
    try {
      const res = await api.get(`/tickets/${ticketId}/facturation/pdf`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `Facture_${form.numero}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error('Impossible de générer le PDF.')
    } finally {
      setDownloading(false)
    }
  }

  // F10 = OK, as on the desktop form.
  useEffect(() => {
    if (!ticketId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F10') { e.preventDefault(); save().then(ok => ok && onClose()) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ticketId, save, onClose])

  const [numPrefix, numSeq] = (form?.numero ?? '').split('-')

  return (
    <Dialog open={!!ticketId} onClose={() => !saving && onClose()} maxWidth="lg" fullWidth
      PaperProps={{ sx: { bgcolor: C.window, borderRadius: 1.5, border: `1px solid ${C.border}` } }}>
      {/* Title bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, py: 0.5, bgcolor: '#F3F6FA', borderBottom: `1px solid ${C.border}` }}>
        <Typography fontSize={13} fontWeight={600} color="#333">Bon d'Intervention</Typography>
        {form && (
          <Typography fontSize={11} color="#555" sx={{ ml: 3 }}>
            {exists ? 'Facture enregistrée' : 'Nouvelle facture'} — {form.societe}
          </Typography>
        )}
        <IconButton size="small" sx={{ ml: 'auto' }} onClick={onClose} disabled={saving}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      {loading || !form || !totals ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress size={26} /></Box>
      ) : (
        <Box sx={{ p: 1.25, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {/* ── Header panel ─────────────────────────────────────────────── */}
          <Box sx={{ bgcolor: C.panel, border: `1px solid ${C.border}`, borderRadius: 1, p: 1.25, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ flex: 1, minWidth: 320, display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'center', columnGap: 1.25, rowGap: 0.75 }}>
              <Typography sx={lbl(C.red)}>Date</Typography>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                <InputBase type="date" value={form.date_facture} onChange={e => set('date_facture', e.target.value)} sx={{ ...fieldSx, width: 140 }} />
                <Typography sx={lbl()}>Société</Typography>
                <InputBase value={form.societe} onChange={e => set('societe', e.target.value)} sx={{ ...readonlySx, width: 180 }} />
                <Typography sx={lbl()}>Numéro</Typography>
                <InputBase value={numPrefix ?? ''} readOnly sx={{ ...readonlySx, width: 40 }} />
                <InputBase value={numSeq ?? ''} readOnly sx={{ ...readonlySx, width: 80 }} />
              </Box>

              <Typography sx={lbl(C.red)}>Client</Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <InputBase value={form.client_code} onChange={e => set('client_code', e.target.value)} sx={{ ...fieldSx, width: 90 }} />
                <InputBase value={form.client_nom} onChange={e => set('client_nom', e.target.value)} sx={{ ...fieldSx, flex: 1 }} />
              </Box>

              <Typography sx={lbl()}>Obs.</Typography>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                <InputBase value={form.observation} onChange={e => set('observation', e.target.value)} sx={{ ...fieldSx, flex: 1 }} />
                <Typography sx={lbl()}>Exercice</Typography>
                <InputBase value={form.exercice} onChange={e => set('exercice', e.target.value)} sx={{ ...fieldSx, width: 80 }} />
              </Box>
            </Box>

            <Box sx={{ border: `1px solid ${C.border}`, bgcolor: '#fff', borderRadius: 1, px: 1, py: 0.25, alignSelf: 'center' }}>
              <RadioGroup value={form.statut} onChange={e => set('statut', e.target.value as StatutFacture)}>
                {([['en_instance', 'En instance'], ['facture', 'Facturé'], ['reg_client', 'Rég. Client']] as const).map(([v, l]) => (
                  <FormControlLabel key={v} value={v} control={<Radio size="small" sx={{ p: 0.25 }} />}
                    label={<Typography fontSize={11.5}>{l}</Typography>} sx={{ m: 0 }} />
                ))}
              </RadioGroup>
            </Box>

            <Box sx={{ alignSelf: 'center', bgcolor: '#E53935', color: '#fff', px: 3, py: 1.25, borderRadius: 1, minWidth: 170, textAlign: 'right', boxShadow: 'inset 0 -2px 0 rgba(0,0,0,.15)' }}>
              <Typography fontSize={22} fontWeight={700} lineHeight={1}>{fmt(totals.ttc)}</Typography>
            </Box>
          </Box>

          {/* ── Toolbar ──────────────────────────────────────────────────── */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', px: 0.5 }}>
            <Button sx={greenBtn} onClick={() => moveLigne(-1)}><KeyboardArrowUpIcon sx={{ fontSize: 18 }} /></Button>
            <Button sx={greenBtn} onClick={() => moveLigne(1)}><KeyboardArrowDownIcon sx={{ fontSize: 18 }} /></Button>
            <Button sx={{ ...greenBtn, ml: 2 }} onClick={() => addLigne()} startIcon={<AddIcon sx={{ fontSize: 16 }} />}>Ligne</Button>
            <Button sx={greenBtn} onClick={() => { set('lignes', [emptyLigne()]); setSelected(0) }}>Supp Tout</Button>
            <Button sx={greenBtn} onClick={removeLigne} disabled={form.lignes.length === 0}>Supp ligne</Button>

            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={lbl()}>N° Facture</Typography>
              <InputBase value={form.numero} readOnly sx={{ ...readonlySx, width: 110 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
                {([['duplicata', 'Duplicata'], ['tampon', 'Tampon'], ['sans_en_tete', 'Sans En Tête']] as const).map(([k, l]) => (
                  <FormControlLabel key={k} sx={{ m: 0, height: 17 }}
                    control={<Checkbox size="small" sx={{ p: 0.1, '& svg': { fontSize: 15 } }} checked={form[k]} onChange={e => set(k, e.target.checked)} />}
                    label={<Typography fontSize={10.5}>{l}</Typography>} />
                ))}
              </Box>
              <Button sx={greenBtn} disabled={saving} onClick={() => save().then(ok => ok && onClose())}
                endIcon={saving ? <CircularProgress size={13} sx={{ color: '#fff' }} /> : <CheckIcon sx={{ fontSize: 16 }} />}>
                OK (F10)
              </Button>
              <Button sx={orangeBtn} onClick={onClose} disabled={saving} endIcon={<ClearIcon sx={{ fontSize: 16, color: C.red }} />}>Annuler</Button>
            </Box>
          </Box>

          {/* ── Lines grid ───────────────────────────────────────────────── */}
          <Box sx={{ border: `1px solid ${C.border}`, bgcolor: '#fff', maxHeight: 290, minHeight: 200, overflow: 'auto' }}>
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', '& td, & th': { borderRight: '1px solid #C5D3E3', fontSize: 12 } }}>
              <Box component="thead" sx={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  {[['N°', 44], ['Désignation', undefined], ['Déb', 44], ['QT', 70], ['PU HT', 110], ['TVA', 70], ['Remise', 70], ['Total Net HT', 120]].map(([h, w]) => (
                    <Box component="th" key={h as string} sx={{ bgcolor: C.gridHead, color: '#fff', fontWeight: 700, py: 0.6, px: 0.75, width: w, textAlign: h === 'Désignation' ? 'center' : 'right' }}>{h}</Box>
                  ))}
                </tr>
              </Box>
              <tbody>
                {form.lignes.map((l, i) => {
                  // Editable cells look like input boxes so it's obvious where to type.
                  const cellInput = {
                    width: 'calc(100% - 6px)', m: '2px 3px', fontSize: 12, bgcolor: '#fff',
                    border: '1px solid #B9CCE2', borderRadius: '3px',
                    '&.Mui-focused': { borderColor: '#1565C0', boxShadow: '0 0 0 2px #1565C033' },
                    '& input': { p: '3px 6px', textAlign: 'right' },
                    '& input::placeholder': { color: '#94A3B8', opacity: 1 },
                  }
                  return (
                    <Box component="tr" key={i} onClick={() => setSelected(i)}
                      sx={{ bgcolor: i === selected ? '#FFF3C4' : i % 2 ? C.stripe : '#fff', borderBottom: '1px dashed #B9CCE2' }}>
                      <Box component="td" sx={{ textAlign: 'right', px: 0.75, color: '#555' }}>{i + 1}</Box>
                      <td><InputBase value={l.designation} onChange={e => setLigne(i, { designation: e.target.value })} sx={{ ...cellInput, '& input': { p: '3px 6px' } }} placeholder="Désignation de la prestation…" /></td>
                      <Box component="td" sx={{ textAlign: 'center' }}>
                        <Checkbox size="small" sx={{ p: 0.25 }} checked={l.debours} onChange={e => setLigne(i, { debours: e.target.checked })} />
                      </Box>
                      <td><NumField value={l.qt} onValue={qt => setLigne(i, { qt })} sx={cellInput} placeholder="0" /></td>
                      <td><NumField value={l.pu_ht} onValue={pu_ht => setLigne(i, { pu_ht })} sx={cellInput} placeholder="0,000" /></td>
                      <td>
                        <Select variant="standard" disableUnderline value={l.tva} disabled={l.debours}
                          onChange={e => setLigne(i, { tva: Number(e.target.value) })}
                          sx={{ width: '100%', fontSize: 12, '& .MuiSelect-select': { py: '3px', pr: '18px !important', textAlign: 'right' } }}>
                          {TAUX_TVA.map(t => <MenuItem key={t} value={t} sx={{ fontSize: 12 }}>{t} %</MenuItem>)}
                        </Select>
                      </td>
                      <td><NumField value={l.remise} max={100} onValue={remise => setLigne(i, { remise })} sx={cellInput} placeholder="0 %" /></td>
                      <Box component="td" sx={{ textAlign: 'right', px: 0.75, fontWeight: 600 }}>{fmt(lineNet(l))}</Box>
                    </Box>
                  )
                })}
              </tbody>
            </Box>
          </Box>

          {/* ── Footer: TVA bases + totals ───────────────────────────────── */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Box sx={{ flex: 1, minWidth: 330, bgcolor: C.panel, border: `1px solid ${C.border}`, borderRadius: 1, p: 1.25 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.75 }}>
                {TAUX_TVA.map(t => (
                  <Box key={t}>
                    <Typography sx={{ ...lbl(), fontSize: 11 }}>{t === 0 ? 'Base Exo' : `Base ${t}%`}</Typography>
                    <InputBase readOnly value={fmt(totals.bases[t])} sx={amountBox} />
                    <InputBase readOnly value={fmt(totals.bases[t] * t / 100)} sx={{ ...amountBox, mt: 0.5 }} />
                  </Box>
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 2, mt: 1.25, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  <Button sx={orangeBtn} onClick={() => addLigne()}>Ajouter TimeSheet</Button>
                  <Button sx={orangeBtn} onClick={() => addLigne({ ...emptyLigne(), debours: true, tva: 0 })}>Ajouter Dépense</Button>
                </Box>
                <Box sx={{ flex: 1, minWidth: 160 }}>
                  <Typography sx={{ ...lbl(), fontSize: 11 }}>Mode de Paiement</Typography>
                  <Select size="small" fullWidth displayEmpty value={form.mode_paiement} onChange={e => set('mode_paiement', e.target.value)}
                    sx={{ bgcolor: '#fff', height: 26, fontSize: 12 }}>
                    <MenuItem value="" sx={{ fontSize: 12 }}><em>—</em></MenuItem>
                    {MODES_PAIEMENT.map(m => <MenuItem key={m} value={m} sx={{ fontSize: 12 }}>{m}</MenuItem>)}
                  </Select>
                </Box>
              </Box>
            </Box>

            <Box sx={{ flex: 1.2, minWidth: 380, bgcolor: C.panel, border: `1px solid ${C.border}`, borderRadius: 1, p: 1.25, display: 'grid', gridTemplateColumns: 'auto 1fr auto 1fr', columnGap: 1.25, rowGap: 0.75, alignItems: 'center' }}>
              <Typography sx={lbl()}>Mnt Brut</Typography>
              <InputBase readOnly value={fmt(totals.brut)} sx={amountBox} />
              <Typography sx={lbl()}>Mnt TVA</Typography>
              <InputBase readOnly value={fmt(totals.tva)} sx={amountBox} />

              <Typography sx={lbl()}>Remise Acc. %</Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <NumField value={form.remise_acc_taux} max={100} onValue={v => set('remise_acc_taux', v)}
                  sx={{ ...fieldSx, width: 70, '& input': { p: 0, textAlign: 'right' } }} />
                <InputBase readOnly value={fmt(totals.remiseAcc)} sx={{ ...amountBox, flex: 1 }} />
              </Box>
              <Typography sx={lbl()}>Timbre</Typography>
              <NumField value={form.timbre} onValue={v => set('timbre', v)} placeholder="0,000"
                sx={{ ...fieldSx, '& input': { p: 0, textAlign: 'right' } }} />

              <Typography sx={lbl()}>Mnt Débours</Typography>
              <InputBase readOnly value={fmt(totals.debours)} sx={amountBox} />
              <Typography sx={lbl()}>Mnt TTC</Typography>
              <InputBase readOnly value={fmt(totals.ttc)} sx={amountBox} />

              <Typography sx={lbl()}>Mnt HT</Typography>
              <InputBase readOnly value={fmt(totals.ht)} sx={amountBox} />
              <Typography sx={lbl()}>Net Facture</Typography>
              <InputBase readOnly value={fmt(totals.ttc)} sx={{ ...amountBox, fontWeight: 700 }} />

              <Box sx={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
                <Button variant="contained" disabled={saving || downloading} onClick={downloadPdf}
                  startIcon={downloading ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <PictureAsPdfIcon />}
                  sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#1F4E78', '&:hover': { bgcolor: '#173B5B' } }}>
                  Enregistrer & télécharger le PDF
                </Button>
              </Box>
            </Box>
          </Box>
        </Box>
      )}
    </Dialog>
  )
}
