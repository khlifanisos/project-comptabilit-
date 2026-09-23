import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Box, useMediaQuery, useTheme } from '@mui/material'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import Chatbot from '../common/Chatbot'
import WhatsAppButton from '../common/WhatsAppButton'

const SIDEBAR_W = 248

// The Messagerie pages are themselves a full chat UI — the floating chat
// bubbles would just overlap the composer, so hide them there.
const HIDE_FLOATING_ON = ['/messages', '/admin/messages']

interface Props { children: React.ReactNode }

export default function DashboardLayout({ children }: Props) {
  const theme    = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const showFloating = !HIDE_FLOATING_ON.includes(location.pathname)

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default', transition: 'background-color 0.3s ease' }}>
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <Box sx={{
        flex: 1,
        ml: isMobile ? 0 : `${SIDEBAR_W}px`,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        transition: 'margin 0.25s',
      }}>
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <Box
          component="main"
          className="fade-in"
          sx={{
            flex: 1,
            p: { xs: 1.5, sm: 2, md: 3 },
            pt: { xs: '72px', md: '80px' },
            minHeight: '100vh',
          }}>
          {children}
        </Box>
      </Box>

      {showFloating && (
        <>
          <Chatbot />
          <WhatsAppButton />
        </>
      )}
    </Box>
  )
}
