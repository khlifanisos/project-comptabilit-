export interface FactureAchat {
  id: number; numero: string; fournisseur: string
  date: string; montant_ht: number; tva: number; montant_ttc: number; statut: string
}

export interface FactureVente {
  id: number; numero: string; client_nom: string
  date: string; echeance: string; montant_ttc: number; statut_reglement: string
}

export interface ReleveBancaire {
  id: number; date: string; libelle: string
  debit: number; credit: number; solde: number; rapproche: boolean
}

export interface LeasingContrat {
  id: number; contrat_ref: string; bien: string; bailleur: string
  mensualite: number; option_achat: number; prochaine_echeance: string
  statut: string; date_debut?: string; date_fin?: string; progression?: number
}

export const initialAchatsRows: FactureAchat[] = [
  { id: 1, numero: 'ACH-001', fournisseur: 'Fournitures Pro', date: '2026-06-01', montant_ht: 10000, tva: 2000, montant_ttc: 12000, statut: 'validee'    },
  { id: 2, numero: 'ACH-002', fournisseur: 'Tech Supplies',   date: '2026-06-03', montant_ht: 5500,  tva: 1100, montant_ttc: 6600,  statut: 'en_attente' },
  { id: 3, numero: 'ACH-003', fournisseur: 'Bureau Maroc',    date: '2026-06-05', montant_ht: 3200,  tva: 640,  montant_ttc: 3840,  statut: 'validee'    },
]

export const initialVentesRows: FactureVente[] = [
  { id: 1, numero: 'VTE-001', client_nom: 'Alpha SARL', date: '2026-06-01', echeance: '2026-07-01', montant_ttc: 15000, statut_reglement: 'regle'     },
  { id: 2, numero: 'VTE-002', client_nom: 'Beta Corp',  date: '2026-06-04', echeance: '2026-07-04', montant_ttc: 9800,  statut_reglement: 'partiel'   },
  { id: 3, numero: 'VTE-003', client_nom: 'Gamma Ltd',  date: '2026-06-06', echeance: '2026-07-06', montant_ttc: 25200, statut_reglement: 'non_regle' },
]

export const relevesBancairesData: ReleveBancaire[] = [
  { id: 1, date: '2026-06-01', libelle: 'Virement client Alpha SARL', debit: 0,    credit: 15000, solde: 85000, rapproche: true  },
  { id: 2, date: '2026-06-02', libelle: 'Loyer bureau juin',          debit: 8000, credit: 0,     solde: 77000, rapproche: true  },
  { id: 3, date: '2026-06-03', libelle: 'Facture fournisseur Tech',   debit: 6600, credit: 0,     solde: 70400, rapproche: false },
  { id: 4, date: '2026-06-05', libelle: 'Virement client Beta Corp',  debit: 0,    credit: 9800,  solde: 80200, rapproche: false },
  { id: 5, date: '2026-06-07', libelle: 'Frais bancaires',            debit: 250,  credit: 0,     solde: 79950, rapproche: true  },
]

export const leasingData: LeasingContrat[] = [
  { id: 1, contrat_ref: 'LEA-001', bien: 'Véhicule Dacia Duster',  bailleur: 'CIH Leasing',  mensualite: 3200,  option_achat: 28000,  prochaine_echeance: '2026-07-01', statut: 'actif', progression: 42 },
  { id: 2, contrat_ref: 'LEA-002', bien: 'Matériel informatique',  bailleur: 'Wafabail',      mensualite: 1800,  option_achat: 5000,   prochaine_echeance: '2026-07-01', statut: 'actif', progression: 90 },
  { id: 3, contrat_ref: 'LEA-003', bien: 'Local commercial',       bailleur: 'BMCE Leasing',  mensualite: 12000, option_achat: 480000, prochaine_echeance: '2026-07-01', statut: 'actif', progression: 40 },
]

// Module-level mutable store — components write, chatbot reads synchronously
let _achats:   FactureAchat[]    = [...initialAchatsRows]
let _ventes:   FactureVente[]    = [...initialVentesRows]
let _releves:  ReleveBancaire[]  = [...relevesBancairesData]
let _leasing:  LeasingContrat[]  = [...leasingData]

export const platformStore = {
  getAchats:  (): FactureAchat[]   => _achats,
  getVentes:  (): FactureVente[]   => _ventes,
  setAchats:  (rows: FactureAchat[])   => { _achats  = rows },
  setVentes:  (rows: FactureVente[])   => { _ventes  = rows },
  getRelevesBancaires: (): ReleveBancaire[]  => _releves,
  setRelevesBancaires: (rows: ReleveBancaire[]) => { _releves = rows },
  getLeasing:  (): LeasingContrat[]  => _leasing,
  setLeasing:  (rows: LeasingContrat[]) => { _leasing = rows },
  getSoldeActuel:  () => _releves.length ? _releves[_releves.length - 1].solde : 0,
  getTotalCredits: () => _releves.reduce((s, r) => s + r.credit, 0),
  getTotalDebits:  () => _releves.reduce((s, r) => s + r.debit, 0),
}