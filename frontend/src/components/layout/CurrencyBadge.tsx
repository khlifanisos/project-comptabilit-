import { useState } from 'react'
import { Box, Typography, Menu, MenuItem, Tooltip, CircularProgress } from '@mui/material'
import PaymentsIcon from '@mui/icons-material/Payments'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { useCurrency, CURRENCY_OPTIONS } from '../../contexts/CurrencyContext'

export default function CurrencyBadge() {
  const { user } = useAuth()
  const { devise, setDevise } = useCurrency()
  const isAdmin = user?.role === 'admin'

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [saving, setSaving]     = useState(false)

  const handlePick = async (code: string) => {
    setAnchorEl(null)
    if (code === devise) return
    setSaving(true)
    try {
      await setDevise(code)
      toast.success('Devise mise à jour !')
    } catch {
      toast.error('Erreur lors de la mise à jour de la devise.')
    } finally {
      setSaving(false)
    }
  }

  const chip = (
    <Box
      onClick={isAdmin ? (e) => setAnchorEl(e.currentTarget) : undefined}
      sx={{
        display: 'flex', alignItems: 'center', gap: 0.6,
        bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 20,
        px: 1.4, py: 0.6,
        border: '1px solid rgba(255,255,255,0.12)',
        cursor: isAdmin ? 'pointer' : 'default',
        '&:hover': isAdmin ? { bgcolor: 'rgba(255,255,255,0.13)' } : undefined,
      }}>
      {saving ? <CircularProgress size={13} sx={{ color: 'rgba(255,255,255,0.7)' }} /> : (
        <PaymentsIcon sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 16 }} />
      )}
      <Typography sx={{ color: 'white', fontSize: 12.5, fontWeight: 700 }}>{devise}</Typography>
    </Box>
  )

  return (
    <>
      <Tooltip title={isAdmin ? 'Changer la devise' : `Devise : ${devise}`}>
        {chip}
      </Tooltip>
      {isAdmin && (
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          slotProps={{ paper: { sx: { mt: 1, minWidth: 200, borderRadius: 3 } } }}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}>
          {CURRENCY_OPTIONS.map(opt => (
            <MenuItem key={opt.code} selected={opt.code === devise} onClick={() => handlePick(opt.code)}>
              {opt.label}
            </MenuItem>
          ))}
        </Menu>
      )}
    </>
  )
}
