// Shared taxonomy for the six client document/record categories, used by the
// admin "Documents clients" table and the per-client dossier view so both
// stay in sync with a single source of truth.

export type DocSource = 'achat' | 'vente' | 'releve' | 'fiscale' | 'sociale' | 'leasing'
export type DocStatut = 'en_attente' | 'validee' | 'rejetee'

export interface DocRow {
  key:      string
  sourceId: number
  source:   DocSource
  client:   string
  type:     string
  fichier:  string
  date:     string
  statut:   DocStatut
  rawItem:  Record<string, unknown>
}

export const DOC_SOURCES: DocSource[] = ['achat', 'vente', 'releve', 'fiscale', 'sociale', 'leasing']

export const SOURCE_API: Record<DocSource, string> = {
  achat:   'factures-achats',
  vente:   'factures-ventes',
  releve:  'releves-bancaires',
  fiscale: 'declarations-fiscales',
  sociale: 'declarations-sociales',
  leasing: 'echeanciers-leasing',
}

export const FILE_SUB: Record<DocSource, string | null> = {
  achat:   'image',
  vente:   'image',
  releve:  null,
  fiscale: null,
  sociale: 'fichier',
  leasing: null,
}

// Which DB field holds the status for each source
export const STAT_FIELD: Record<DocSource, string> = {
  achat:   'statut',
  vente:   'statut_reglement',
  releve:  'rapproche',
  fiscale: 'statut',
  sociale: 'statut',
  leasing: 'statut',
}

// Which DB field holds the editable reference/name
export const REF_FIELD: Record<DocSource, string> = {
  achat:   'numero',
  vente:   'numero',
  releve:  'banque',
  fiscale: 'periode',
  sociale: 'periode',
  leasing: 'contrat_ref',
}

export const REF_LABEL: Record<DocSource, string> = {
  achat:   'Numéro de facture',
  vente:   'Numéro de facture',
  releve:  'Banque / Libellé',
  fiscale: 'Période',
  sociale: 'Période',
  leasing: 'Référence contrat',
}

export const STATUS_OPTIONS: Record<DocSource, { value: string; label: string }[]> = {
  achat:   [{ value: 'validee',   label: 'Validé' }, { value: 'rejetee',  label: 'Rejeté'     }, { value: 'en_attente', label: 'En attente' }],
  vente:   [{ value: 'regle',     label: 'Validé' }, { value: 'rejetee',  label: 'Rejeté'     }, { value: 'non_regle',  label: 'En attente' }],
  releve:  [{ value: 'true',      label: 'Validé' }, { value: 'false',    label: 'En attente' }],
  fiscale: [{ value: 'validee',   label: 'Validé' }, { value: 'rejetee',  label: 'Rejeté'     }, { value: 'a_declarer', label: 'En attente' }],
  sociale: [{ value: 'deposee',   label: 'Validé' }, { value: 'rejetee',  label: 'Rejeté'     }, { value: 'a_declarer', label: 'En attente' }],
  leasing: [{ value: 'solde',     label: 'Validé' }, { value: 'en_retard', label: 'Rejeté'    }, { value: 'actif',      label: 'En attente' }],
}

// Raw DB status value sent when admin clicks Validate / Reject
export const VALIDATE_RAW: Record<DocSource, string> = {
  achat:   'validee',
  vente:   'regle',
  releve:  'true',
  fiscale: 'validee',
  sociale: 'deposee',
  leasing: 'solde',
}

export const REJECT_RAW: Record<DocSource, string> = {
  achat:   'rejetee',
  vente:   'rejetee',
  releve:  'false',
  fiscale: 'rejetee',
  sociale: 'rejetee',
  leasing: 'en_retard',
}

export const TYPE_LABEL: Record<DocSource, string> = {
  achat:   'Facture achat',
  vente:   'Facture vente',
  releve:  'Relevé bancaire',
  fiscale: 'Déclaration fiscale',
  sociale: 'Déclaration sociale',
  leasing: 'Échéancier leasing',
}

// Folder labels/order mirroring the client sidebar menu
export const FOLDER_LABEL: Record<DocSource, string> = {
  releve:  'Relevés bancaires',
  fiscale: 'Déclarations fiscales',
  achat:   "Factures d'achats",
  vente:   'Factures de ventes',
  sociale: 'Déclarations sociales',
  leasing: 'Échéancier leasing',
}

export const FOLDER_ORDER: DocSource[] = ['releve', 'fiscale', 'achat', 'vente', 'sociale', 'leasing']

export const STATUS_MAP: Record<DocStatut, { label: string; color: string; bg: string }> = {
  validee:    { label: 'Validé',     color: '#2E7D32', bg: '#E8F5E9' },
  en_attente: { label: 'En attente', color: '#E65100', bg: '#FFF3E0' },
  rejetee:    { label: 'Rejeté',     color: '#C62828', bg: '#FFEBEE' },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function resolveStatut(item: Record<string, unknown>, source: DocSource): DocStatut {
  if (source === 'releve') return item.rapproche ? 'validee' : 'en_attente'

  const rawStatut = source === 'vente'
    ? String(item.statut_reglement ?? '')
    : String(item.statut ?? '')

  if (['validee', 'deposee', 'regle', 'exportee', 'solde'].includes(rawStatut)) return 'validee'
  if (['rejetee', 'en_retard'].includes(rawStatut)) return 'rejetee'
  return 'en_attente'
}

export function resolveFichier(item: Record<string, unknown>, source: DocSource): string {
  if (source === 'achat' || source === 'vente')
    return String(item.numero ?? item.id ?? '')
  if (source === 'releve')
    return String(item.banque ?? item.libelle ?? item.id ?? '')
  if (source === 'fiscale')
    return String((item.type ?? '') + ' ' + (item.periode ?? '')).trim() || String(item.id)
  if (source === 'sociale')
    return String((item.type ?? '') + ' ' + (item.periode ?? '')).trim() || String(item.id)
  if (source === 'leasing')
    return String(item.contrat_ref ?? item.bien ?? item.id ?? '')
  return String(item.id ?? '')
}

export function resolveClient(item: Record<string, unknown>): string {
  const c = item.client as Record<string, unknown> | null
  if (c) return String(c.nom ?? c.email ?? c.id ?? '—')
  return String(item.client_nom ?? item.client_id ?? '—')
}

export function resolveDate(item: Record<string, unknown>): string {
  return String(item.date ?? item.date_debut ?? item.date_limite ?? item.created_at ?? '')
}

export function getClientId(item: Record<string, unknown>): number | null {
  if (item.client_id) return Number(item.client_id)
  const c = item.client as Record<string, unknown> | null
  if (c?.id) return Number(c.id)
  return null
}
