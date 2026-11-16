import GavelOutlinedIcon        from '@mui/icons-material/GavelOutlined'
import DescriptionOutlinedIcon  from '@mui/icons-material/DescriptionOutlined'
import HandshakeOutlinedIcon    from '@mui/icons-material/HandshakeOutlined'
import Inventory2OutlinedIcon   from '@mui/icons-material/Inventory2Outlined'
import FolderOpenOutlinedIcon   from '@mui/icons-material/FolderOpenOutlined'

export type CategorieKey = 'lois_finances' | 'notes_communes' | 'conventions' | 'recueils' | 'autre'

export interface CategorieDef {
  key: CategorieKey
  slug: string // used in the URL: /documentation/<slug>
  label: string
  Icon: typeof GavelOutlinedIcon
}

export const CATEGORIES: CategorieDef[] = [
  { key: 'lois_finances',  slug: 'lois-de-finances', label: 'Lois de finances',                      Icon: GavelOutlinedIcon },
  { key: 'notes_communes', slug: 'notes-communes',   label: 'Notes communes',                        Icon: DescriptionOutlinedIcon },
  { key: 'conventions',    slug: 'conventions',      label: 'Conventions de non double imposition',  Icon: HandshakeOutlinedIcon },
  { key: 'recueils',       slug: 'recueils',         label: 'Recueils de textes fiscaux',            Icon: Inventory2OutlinedIcon },
  { key: 'autre',          slug: 'autre',            label: 'Autre documentation utile',             Icon: FolderOpenOutlinedIcon },
]

export const categorieBySlug = (slug?: string) => CATEGORIES.find(c => c.slug === slug)
export const categorieByKey  = (key: string)   => CATEGORIES.find(c => c.key === key)

export interface DocumentFiscal {
  id: number
  categorie: CategorieKey
  annee: number | null
  sous_categorie: string | null
  titre: string
  description: string | null
  nom_original: string | null
  taille: number | null
  created_at: string
}

export function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}
