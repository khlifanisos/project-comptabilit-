import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Box } from '@mui/material'
import SiteHeader from './SiteHeader'
import SiteFooter from './SiteFooter'
import PageHero, { HEADER_H } from './PageHero'
import { pageMeta } from './navigation'
import { useAuth } from '../../contexts/AuthContext'
import Chatbot from '../common/Chatbot'
import WhatsAppButton from '../common/WhatsAppButton'

// The Messagerie pages are themselves a full chat UI — the floating chat
// bubbles would just overlap the composer, so hide them there.
const HIDE_FLOATING_ON = ['/messages', '/admin/messages']

// Pages that render their own full-width hero (they get the whole width, no container)
const CUSTOM_HERO = ['/accueil', '/documentation']
// Pages that need the full screen height: no banner, compact header
const NO_HERO = ['/messages', '/admin/messages']

interface Props { children: React.ReactNode }

/** Website-style shell: glass header over a page banner, centered content, footer. */
export default function DashboardLayout({ children }: Props) {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const showFloating = !HIDE_FLOATING_ON.includes(pathname)

  const custom = CUSTOM_HERO.includes(pathname)
  const meta = custom || NO_HERO.includes(pathname) || pathname.startsWith('/documentation/')
    ? undefined
    : pageMeta(pathname, user?.role === 'admin')
  const overHero = custom || !!meta

  // New page → start at the top (the browser keeps the old scroll position otherwise)
  useEffect(() => { window.scrollTo({ top: 0 }) }, [pathname])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default', transition: 'background-color 0.3s ease' }}>
      <SiteHeader overHero={overHero} />

      {meta && (
        <PageHero
          title={meta.label}
          subtitle={meta.intro ?? meta.description}
          eyebrow={meta.group ?? 'Espace ' + (user?.role === 'admin' ? 'cabinet' : 'client')}
          icon={meta.icon}
          accent={meta.color}
          crumbs={[{ label: 'Accueil', path: '/accueil' }, ...(meta.group ? [{ label: meta.group }] : []), { label: meta.label }]}
        />
      )}

      {custom ? (
        <Box component="main" sx={{ flex: 1, width: '100%' }}>{children}</Box>
      ) : (
        <Box component="main" className="fade-in" sx={{
          flex: 1, width: '100%', maxWidth: 1320, mx: 'auto', position: 'relative',
          px: { xs: 1.5, sm: 2, md: 3 },
          pt: meta ? { xs: 1, md: 2 } : { xs: `${HEADER_H + 12}px`, md: `${HEADER_H + 24}px` },
          pb: { xs: 2, md: 4 },
        }}>
          {children}
        </Box>
      )}

      <SiteFooter />

      {showFloating && (
        <>
          <Chatbot />
          <WhatsAppButton />
        </>
      )}
    </Box>
  )
}
