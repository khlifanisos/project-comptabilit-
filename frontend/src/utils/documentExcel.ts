// Excel export logic shared by the admin "Documents clients" table and the
// per-client dossier view — builds a styled workbook for one document, with
// an AI-analysis path (invoice detail + summary sheets) and a plain data path.

// @ts-ignore – xlsx-js-style adds cell-style support over SheetJS
import * as XLSX from 'xlsx-js-style'
import api from '../api/axios'
import { DocRow, FILE_SUB, SOURCE_API, STATUS_MAP } from './documentSources'

export function buildRichExcel(doc: DocRow, ai?: Record<string, any>, devise: string = 'TND') {
  const raw   = doc.rawItem
  const wb    = XLSX.utils.book_new()
  const now   = new Date().toLocaleDateString('fr-FR') + ' ' +
                new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const fmt   = (d: string) => { try { return new Date(d).toLocaleDateString('fr-FR') } catch { return d } }
  const money = (v: any) => `${v != null && v !== '' ? Number(v).toFixed(2) : '0.00'} ${devise}`

  // ── Shared style constants ────────────────────────────────────────────
  const BLUE = '1565C0'; const WHITE = 'FFFFFF'; const LBLUE = 'D6E8FB'
  const sBlueHdr  = { fill: { patternType: 'solid', fgColor: { rgb: BLUE } },
                      font: { color: { rgb: WHITE }, bold: true, sz: 11 },
                      alignment: { horizontal: 'center', vertical: 'center' } }
  const sBlueCell = { fill: { patternType: 'solid', fgColor: { rgb: BLUE } },
                      font: { color: { rgb: WHITE }, bold: true },
                      alignment: { horizontal: 'right', vertical: 'center' } }
  const sBold     = { font: { bold: true } }
  const sRight    = { alignment: { horizontal: 'right' } }
  const sBoldR    = { font: { bold: true }, alignment: { horizontal: 'right' } }
  const sEven     = { fill: { patternType: 'solid', fgColor: { rgb: LBLUE } }, alignment: { horizontal: 'left' } }
  const sEvenR    = { fill: { patternType: 'solid', fgColor: { rgb: LBLUE } }, alignment: { horizontal: 'right' } }
  const c = (v: any, s?: any) => ({ v: v ?? '', t: typeof v === 'number' ? 'n' : 's', s: s ?? {} })

  if (ai) {
    // ── Sheet 1: Invoice detail (named by invoice number) ──────────────
    const supplier   = ai.fournisseur || doc.client
    const invoiceNum = String(ai.numero_facture || doc.fichier)
    const dateStr    = ai.date || (doc.date ? fmt(doc.date) : '—')
    const lignes: any[]     = ai.lignes  || []
    const resumeRows: any[] = ai.resume  || []

    const rows: any[][] = []

    // Row 0: company name (merged A:E)
    rows.push([
      c(supplier, { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center', vertical: 'center' } }),
      null, null, null, null,
    ])
    // Row 1: meta
    rows.push([
      c(`N° Facture : ${invoiceNum}`, { font: { italic: true, sz: 10 } }),
      null,
      c(`Date : ${dateStr}`, { font: { italic: true, sz: 10 }, alignment: { horizontal: 'center' } }),
      null,
      c(`Généré le : ${now}`, { font: { italic: true, sz: 10 }, alignment: { horizontal: 'right' } }),
    ])
    // Row 2: empty
    rows.push([null, null, null, null, null])
    // Row 3: column headers
    rows.push([
      c('N°', sBlueHdr), c('DÉSIGNATION', sBlueHdr),
      c('QTÉ', sBlueHdr), c('PRIX U.', sBlueHdr), c('TOTAL HT', sBlueHdr),
    ])
    // Rows 4+: line items
    lignes.forEach((l, i) => {
      const even = i % 2 === 0
      const sL = even ? sEven  : { alignment: { horizontal: 'left'  } }
      const sR = even ? sEvenR : sRight
      rows.push([
        c(l.numero || '', sL),
        c(l.designation || '', sL),
        c(l.qte != null ? Number(l.qte) : 0, sR),
        c(money(l.prix_u), sR),
        c(money(l.total_ht), sR),
      ])
    })
    // Separator
    rows.push([null, null, null, null, null])
    // Totals
    const lastIdx = resumeRows.length - 1
    resumeRows.forEach((row, i) => {
      const isLast = i === lastIdx
      rows.push([
        null, null, null,
        c(row.label || '', isLast ? sBlueCell : sBoldR),
        c(String(row.valeur ?? ''), isLast ? sBlueCell : sRight),
      ])
    })

    const ws: any = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols']   = [{ wch: 8 }, { wch: 35 }, { wch: 10 }, { wch: 26 }, { wch: 15 }]
    ws['!rows']   = [{ hpt: 30 }, { hpt: 16 }, { hpt: 6 }, { hpt: 22 }]
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }]

    const sheetName = invoiceNum.replace(/[:\\/?*[\]]/g, '').substring(0, 31)
    XLSX.utils.book_append_sheet(wb, ws, sheetName)

    // ── Sheet 2: Résumé ──────────────────────────────────────────────────
    const resAOA: any[][] = [
      [c('RÉSUMÉ DE LA FACTURE', { fill: { patternType: 'solid', fgColor: { rgb: BLUE } },
          font: { color: { rgb: WHITE }, bold: true, sz: 13 },
          alignment: { horizontal: 'center', vertical: 'center' } }), null],
      [c('Fournisseur', sBold),   c(supplier)],
      [c('N° Facture',  sBold),   c(invoiceNum)],
      [c('Date',        sBold),   c(dateStr)],
      [c('Montant HT',  sBold),   c(money(ai.montant_ht))],
      [c('TVA',         sBold),   c(money(ai.tva))],
      [c('Montant TTC', sBold),   c(money(ai.montant_ttc))],
      [c('Lignes extraites', sBold), c(lignes.length)],
      [c('Généré le',   sBold),   c(now)],
    ]
    const ws2: any = XLSX.utils.aoa_to_sheet(resAOA)
    ws2['!cols']   = [{ wch: 22 }, { wch: 32 }]
    ws2['!rows']   = [{ hpt: 28 }]
    ws2['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }]
    XLSX.utils.book_append_sheet(wb, ws2, 'Résumé')

  } else {
    // ── No-AI path: formatted data sheet ─────────────────────────────────
    const fields: [string, string][] = [
      ['Client',    doc.client],
      ['Type',      doc.type],
      ['Référence', doc.fichier],
      ['Date',      doc.date ? fmt(doc.date) : '—'],
      ['Statut',    STATUS_MAP[doc.statut].label],
    ]
    if (doc.source === 'releve') {
      fields.push(
        ['Banque',        String(raw.banque        ?? '—')],
        ['Période début', String(raw.date_debut    ?? '—')],
        ['Période fin',   String(raw.date_fin      ?? '—')],
        ['Solde initial', String(raw.solde_initial ?? '—')],
        ['Solde final',   String(raw.solde_final   ?? '—')],
      )
    } else if (doc.source === 'fiscale') {
      fields.push(
        ["Type d'impôt",  String(raw.type       ?? '—')],
        ['Période',       String(raw.periode     ?? '—')],
        ['Date limite',   raw.date_limite ? fmt(String(raw.date_limite)) : '—'],
        ['Montant',       money(raw.montant)],
        ['Notes',         String(raw.notes       ?? '')],
      )
    } else if (doc.source === 'sociale') {
      fields.push(
        ['Type',     String(raw.type      ?? '—')],
        ['Période',  String(raw.periode   ?? '—')],
        ['Organisme',String(raw.organisme ?? '—')],
        ['Montant',  money(raw.montant)],
      )
    } else if (doc.source === 'leasing') {
      fields.push(
        ['Bien',         String(raw.bien            ?? '—')],
        ['Réf contrat',  String(raw.contrat_ref     ?? '—')],
        ['Date début',   String(raw.date_debut      ?? '—')],
        ['Date fin',     String(raw.date_fin        ?? '—')],
        ['Mensualité',   money(raw.montant_mensuel)],
        ['Loyer restant',money(raw.loyer_restant)],
      )
    }

    const aoa: any[][] = [
      [c(doc.type.toUpperCase(), { fill: { patternType: 'solid', fgColor: { rgb: BLUE } },
          font: { color: { rgb: WHITE }, bold: true, sz: 13 },
          alignment: { horizontal: 'center', vertical: 'center' } }), null],
      ...fields.map(([k, v], i) => {
        const even = i % 2 === 0
        return [
          c(k, even ? { ...sEven, ...sBold } : sBold),
          c(v, even ? sEven : {}),
        ]
      }),
      [null, null],
      [c(`Généré le : ${now}`, { font: { italic: true, sz: 9 }, alignment: { horizontal: 'right' } }), null],
    ]

    const ws: any = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols']   = [{ wch: 24 }, { wch: 36 }]
    ws['!rows']   = [{ hpt: 28 }]
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
      { s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: 1 } },
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'Résumé')
  }

  return wb
}

// Core download logic — shared by the row icon and bulk export
export async function downloadDocExcel(doc: DocRow, devise: string = 'TND'): Promise<void> {
  const sub     = FILE_SUB[doc.source]
  const safe    = `${doc.type.replace(/\s+/g, '_')}_${doc.fichier.replace(/\s+/g, '_')}`
  const hasFile = sub && doc.rawItem.fichier

  if (!hasFile) {
    const wb = buildRichExcel(doc, undefined, devise)
    XLSX.writeFile(wb, `${safe}.xlsx`)
    return
  }

  // Fetch file → AI analyze → PhpSpreadsheet Excel
  const fileRes = await api.get(
    `/${SOURCE_API[doc.source]}/${doc.sourceId}/${sub}`,
    { responseType: 'blob' }
  )
  const blob = fileRes.data as Blob
  const ext  = blob.type.includes('pdf') ? 'pdf' : 'jpg'

  const fd = new FormData()
  fd.append('file', blob, `document.${ext}`)
  const { data: ai } = await api.post('/factures-achats/analyze', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

  const excelRes = await api.post('/factures-achats/excel', {
    fournisseur:    ai.fournisseur    || doc.client,
    numero_facture: ai.numero_facture || doc.fichier,
    date:           ai.date           || doc.date || new Date().toISOString().slice(0, 10),
    montant_ht:     ai.montant_ht     ?? 0,
    tva:            ai.tva            ?? 0,
    montant_ttc:    ai.montant_ttc    ?? 0,
    lignes:         ai.lignes         || [],
    resume:         ai.resume         || [],
  }, { responseType: 'blob' })

  const url = URL.createObjectURL(excelRes.data as Blob)
  const a   = document.createElement('a')
  a.href = url; a.download = `${safe}_IA.xlsx`
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Fallback used when downloadDocExcel fails (e.g. AI analysis error) — writes
// the plain data sheet instead so the admin still gets a file.
export function writeFallbackExcel(doc: DocRow, devise: string = 'TND'): void {
  const safe = `${doc.type.replace(/\s+/g, '_')}_${doc.fichier.replace(/\s+/g, '_')}`
  XLSX.writeFile(buildRichExcel(doc, undefined, devise), `${safe}.xlsx`)
}
