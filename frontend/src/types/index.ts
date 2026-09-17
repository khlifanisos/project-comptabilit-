export type UserRole = 'admin' | 'client'

export interface User {
  id: number
  nom: string
  email: string
  role: UserRole
  entreprise?: string
  telephone?: string
  adresse?: string
  avatar?: string
  created_at?: string
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
}

export interface Notification {
  id: number
  titre: string
  message: string
  type: 'facture' | 'echeance' | 'info' | 'alert' | 'warning' | 'success' | 'navigation' | string
  lu: boolean
  created_at: string
}

export interface FactureAchat {
  id: number
  client_id: number
  numero: string
  fournisseur: string
  date: string
  montant_ht: number
  tva: number
  montant_ttc: number
  statut: 'en_attente' | 'validee' | 'rejetee'
  fichier?: string
  created_at: string
}

export interface FactureVente {
  id: number
  client_id: number
  numero: string
  client_nom: string
  date: string
  echeance: string
  montant_ht: number
  tva: number
  montant_ttc: number
  statut_reglement: 'non_regle' | 'partiel' | 'regle'
  created_at: string
}

export interface ReleveBancaire {
  id: number
  client_id: number
  banque: string
  compte: string
  date: string
  libelle: string
  debit: number
  credit: number
  solde: number
  rapproche: boolean
  created_at: string
}

export interface DeclarationFiscale {
  id: number
  client_id: number
  type: 'TVA' | 'IS' | 'IR' | 'autre'
  periode: string
  date_limite: string
  montant: number
  statut: 'a_declarer' | 'deposee' | 'validee'
  fichier?: string
  created_at: string
}

export interface DeclarationSociale {
  id: number
  client_id: number
  type: 'CNSS' | 'CIMR' | 'AMO' | 'autre'
  periode: string
  date_limite: string
  montant: number
  statut: 'a_declarer' | 'deposee' | 'validee'
  created_at: string
}

export interface EcheancierLeasing {
  id: number
  client_id: number
  contrat_ref: string
  bien: string
  bailleur: string
  date_debut: string
  date_fin: string
  mensualite: number
  option_achat: number
  prochaine_echeance: string
  statut: 'actif' | 'solde' | 'en_retard'
  created_at: string
}

export interface DashboardStats {
  total_ventes: number
  total_achats: number
  solde: number
  nb_factures: number
  echeances_proches: number
  factures_impayees: number
}
