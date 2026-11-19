import HomeIcon           from '@mui/icons-material/HomeOutlined'
import AccountBalanceIcon from '@mui/icons-material/AccountBalanceOutlined'
import ReceiptIcon        from '@mui/icons-material/ReceiptOutlined'
import ShoppingCartIcon   from '@mui/icons-material/ShoppingCartOutlined'
import GavelIcon          from '@mui/icons-material/GavelOutlined'
import GroupsIcon         from '@mui/icons-material/GroupsOutlined'
import CalendarTodayIcon  from '@mui/icons-material/CalendarTodayOutlined'
import PeopleIcon         from '@mui/icons-material/PeopleOutlined'
import FolderIcon         from '@mui/icons-material/FolderOutlined'
import ReceiptLongIcon    from '@mui/icons-material/ReceiptLongOutlined'
import SecurityIcon       from '@mui/icons-material/SecurityOutlined'
import MenuBookIcon       from '@mui/icons-material/MenuBookOutlined'
import ForumIcon          from '@mui/icons-material/ForumOutlined'
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumberOutlined'
import LibraryBooksIcon   from '@mui/icons-material/LibraryBooksOutlined'
import SettingsIcon       from '@mui/icons-material/SettingsOutlined'
import PersonIcon         from '@mui/icons-material/PersonOutline'

export interface NavLink {
  label: string
  /** Compact label for the top menu (defaults to label). */
  short?: string
  path: string
  icon: React.ReactNode
  /** One-liner shown in dropdowns. */
  description?: string
  /** Longer sentence shown in the page banner. */
  intro?: string
  color?: string
}

/** A top-level menu entry: either a direct link or a dropdown with sub-links. */
export type NavEntry =
  | (NavLink & { children?: undefined })
  | { label: string; short?: string; children: NavLink[]; path?: undefined; icon?: undefined }

const home: NavLink = { label: 'Accueil', path: '/accueil', icon: <HomeIcon /> }

export const clientNav: NavEntry[] = [
  home,
  { label: 'Messagerie', path: '/messages', icon: <ForumIcon /> },
  {
    label: 'Comptabilité',
    children: [
      { label: 'Relevés bancaires', path: '/releves', icon: <AccountBalanceIcon />, color: '#1565C0',
        description: 'Vos relevés et leur traitement',
        intro: 'Déposez vos relevés bancaires et suivez leur rapprochement par votre comptable.' },
      { label: "Factures d'achats", path: '/achats', icon: <ShoppingCartIcon />, color: '#0891B2',
        description: 'Factures fournisseurs',
        intro: 'Centralisez vos factures fournisseurs : lecture automatique, TVA récupérable et suivi.' },
      { label: 'Factures de ventes', path: '/ventes', icon: <ReceiptIcon />, color: '#059669',
        description: 'Factures clients',
        intro: 'Vos factures clients, leur TVA collectée et leur état d’encaissement.' },
      { label: 'Échéancier leasing', path: '/leasing', icon: <CalendarTodayIcon />, color: '#7C3AED',
        description: 'Contrats et échéances',
        intro: 'Vos contrats de leasing et toutes leurs échéances, mois par mois.' },
    ],
  },
  {
    label: 'Déclarations',
    children: [
      { label: 'Déclarations fiscales', path: '/fiscales', icon: <GavelIcon />, color: '#D97706',
        description: 'TVA, acomptes, IS…',
        intro: 'Déclarations mensuelles et annuelles, échéances et documents déposés.' },
      { label: 'Déclarations sociales', path: '/sociales', icon: <GroupsIcon />, color: '#DB2777',
        description: 'CNSS et charges sociales',
        intro: 'Déclarations CNSS trimestrielles et charges sociales de votre entreprise.' },
    ],
  },
  { label: 'Audit intelligent', path: '/audit', icon: <SecurityIcon />, color: '#DC2626',
    intro: 'Une analyse automatique de vos comptes pour repérer anomalies et risques.' },
  { label: 'Documentation fiscale', short: 'Documentation', path: '/documentation', icon: <LibraryBooksIcon />, color: '#0D47A1',
    intro: 'Lois de finances, notes communes, conventions et codes fiscaux.' },
]

export const adminNav: NavEntry[] = [
  home,
  {
    label: 'Cabinet',
    children: [
      { label: 'Messagerie', path: '/admin/messages', icon: <ForumIcon />, description: 'Échanges avec les clients' },
      { label: 'Tickets', path: '/admin/tickets', icon: <ConfirmationNumberIcon />, color: '#D97706',
        description: 'Demandes de support',
        intro: 'Toutes les demandes de vos clients, leur priorité et leur avancement.' },
      { label: 'Facturation', path: '/admin/facturation', icon: <ReceiptLongIcon />, color: '#059669',
        description: 'Honoraires et paiements',
        intro: 'Honoraires du cabinet, factures émises et paiements reçus.' },
    ],
  },
  {
    label: 'Comptabilité',
    children: [
      { label: 'Clients', path: '/admin/clients', icon: <PeopleIcon />, color: '#1565C0',
        description: 'Dossiers clients',
        intro: 'Le portefeuille du cabinet : fiches clients, dossiers et accès.' },
      { label: 'Documents', path: '/admin/documents', icon: <FolderIcon />, color: '#0891B2',
        description: 'Pièces déposées',
        intro: 'Toutes les pièces déposées par vos clients, à traiter et à classer.' },
    ],
  },
  { label: 'Audit intelligent', path: '/audit', icon: <SecurityIcon />, color: '#DC2626',
    intro: 'Le score d’audit de chaque client et les anomalies détectées.' },
  {
    label: 'Textes et lois',
    short: 'Textes & lois',
    children: [
      { label: 'Textes et lois', path: '/admin/textes-lois', icon: <MenuBookIcon />, color: '#7C3AED',
        description: 'Veille réglementaire',
        intro: 'Votre veille réglementaire : textes publiés et résumés.' },
      { label: 'Documentation fiscale', path: '/documentation', icon: <LibraryBooksIcon />, color: '#0D47A1',
        description: 'Lois de finances, notes communes…' },
    ],
  },
]

// Pages reachable from the account menu (not in the top menu) but still given a banner
const extraPages: NavLink[] = [
  { label: 'Mon profil', path: '/profil', icon: <PersonIcon />, intro: 'Vos informations personnelles, votre entreprise et vos préférences.' },
  { label: 'Paramètres', path: '/admin/settings', icon: <SettingsIcon />, intro: 'Configuration du cabinet, des notifications et des intégrations.' },
]

/** Sections with sub-pages (e.g. /documentation/notes-communes) keep their entry highlighted. */
export const isActivePath = (current: string, path: string) =>
  current === path || current.startsWith(path + '/')

export const entryIsActive = (current: string, e: NavEntry) =>
  e.children ? e.children.some(c => isActivePath(current, c.path)) : isActivePath(current, e.path)

export interface PageMeta extends NavLink { group?: string }

/** Finds the menu link (and its group) for the current URL, to build the page banner. */
export function pageMeta(pathname: string, isAdmin: boolean): PageMeta | undefined {
  const entries = isAdmin ? adminNav : clientNav
  let best: PageMeta | undefined
  const consider = (l: NavLink, group?: string) => {
    if (isActivePath(pathname, l.path) && (!best || l.path.length > best.path.length)) best = { ...l, group }
  }
  for (const e of entries) {
    if (e.children) e.children.forEach(c => consider(c, e.label))
    else consider(e)
  }
  extraPages.forEach(l => consider(l))
  return best
}
