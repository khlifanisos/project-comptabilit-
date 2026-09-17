import { useState, useEffect } from 'react'
import { Fab, Tooltip } from '@mui/material'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import { useCurrency } from '../../contexts/CurrencyContext'
import { onChatbotOpenChange } from '../../utils/chatbotState'

// Floating WhatsApp button, stacked directly above the Chatbot bubble.
// Hidden while the chatbot panel is open so it doesn't float over it.
export default function WhatsAppButton() {
  const { whatsapp } = useCurrency()
  const digits = (whatsapp ?? '').replace(/\D/g, '')
  const [chatbotOpen, setChatbotOpenState] = useState(false)

  useEffect(() => onChatbotOpenChange(setChatbotOpenState), [])

  if (!digits || chatbotOpen) return null

  return (
    <Tooltip title="Discuter sur WhatsApp" placement="left">
      <Fab
        component="a"
        href={`https://wa.me/${digits}`}
        target="_blank"
        rel="noopener"
        sx={{
          position: 'fixed',
          bottom: { xs: 84, md: 92 },
          right:  { xs: 16, md: 24 },
          zIndex: 200,
          bgcolor: '#25D366',
          color: 'white',
          boxShadow: '0 8px 24px rgba(37,211,102,0.5)',
          '&:hover': { bgcolor: '#1EBE5A', transform: 'scale(1.08)' },
          transition: 'transform 0.2s',
        }}>
        <WhatsAppIcon />
      </Fab>
    </Tooltip>
  )
}
