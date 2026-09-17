import { createTheme, alpha } from '@mui/material/styles'

const PRIMARY   = '#1565C0'
const PRIMARY_D = '#0D47A1'
const SUCCESS   = '#16A34A'
const ERROR     = '#DC2626'
const WARNING   = '#EA580C'

const theme = createTheme({
  palette: {
    primary:    { main: PRIMARY, dark: PRIMARY_D, light: '#1976D2' },
    secondary:  { main: '#0891B2' },
    error:      { main: ERROR },
    warning:    { main: WARNING },
    success:    { main: SUCCESS },
    background: { default: '#F0F4F8', paper: '#FFFFFF' },
    text: {
      primary:   '#0F172A',
      secondary: '#64748B',
      disabled:  '#94A3B8',
    },
    divider: 'rgba(0,0,0,0.07)',
  },

  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    h4: { fontWeight: 800, letterSpacing: '-0.02em', color: '#0F172A' },
    h5: { fontWeight: 700, letterSpacing: '-0.01em', color: '#0F172A' },
    h6: { fontWeight: 700, color: '#0F172A' },
    subtitle1: { fontWeight: 600, color: '#0F172A' },
    body1:  { color: '#1E293B', lineHeight: 1.6 },
    body2:  { color: '#475569', lineHeight: 1.5 },
    button: { fontWeight: 600, textTransform: 'none', letterSpacing: '0.01em' },
    caption:{ color: '#64748B', fontSize: '0.75rem' },
  },

  shape: { borderRadius: 10 },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { background: '#F0F4F8' },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          boxShadow: '0 1px 2px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.08)',
          border: '1px solid rgba(0,0,0,0.05)',
          backgroundImage: 'none',
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        elevation1: { boxShadow: '0 1px 2px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.08)' },
        elevation8: { boxShadow: '0 8px 30px rgba(15,23,42,0.12)' },
      },
    },

    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '9px 20px',
          fontWeight: 600,
          fontSize: '0.875rem',
          letterSpacing: '0.01em',
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
        containedPrimary: {
          background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_D} 100%)`,
          boxShadow: `0 2px 8px ${alpha(PRIMARY, 0.35)}`,
          '&:hover': {
            background: `linear-gradient(135deg, #1976D2 0%, ${PRIMARY} 100%)`,
            boxShadow: `0 4px 12px ${alpha(PRIMARY, 0.4)}`,
          },
        },
        outlined: {
          borderColor: 'rgba(0,0,0,0.15)',
          '&:hover': { borderColor: PRIMARY, bgcolor: alpha(PRIMARY, 0.04) },
        },
      },
    },

    MuiTextField: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            backgroundColor: '#FAFAFA',
            '& fieldset': { borderColor: 'rgba(0,0,0,0.12)' },
            '&:hover fieldset': { borderColor: PRIMARY },
            '&.Mui-focused fieldset': { borderColor: PRIMARY, borderWidth: 1.5 },
          },
        },
      },
    },

    MuiInputBase: {
      styleOverrides: {
        root: { fontSize: '0.875rem' },
      },
    },

    MuiTableContainer: {
      styleOverrides: {
        root: { borderRadius: 0 },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
          fontSize: '0.7rem',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: '#64748B',
          backgroundColor: '#F8FAFC',
          borderBottom: '1px solid #E2E8F0',
          padding: '12px 16px',
          whiteSpace: 'nowrap',
        },
        body: {
          fontSize: '0.875rem',
          color: '#1E293B',
          borderBottom: '1px solid #F1F5F9',
          padding: '13px 16px',
        },
      },
    },

    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:last-child td': { borderBottom: 'none' },
          transition: 'background 0.12s',
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 600,
          fontSize: '0.72rem',
          height: 24,
          letterSpacing: '0.01em',
        },
        sizeSmall: { height: 22, fontSize: '0.68rem' },
      },
    },

    MuiDivider: {
      styleOverrides: {
        root: { borderColor: 'rgba(0,0,0,0.06)' },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#0F172A',
          fontSize: '0.75rem',
          borderRadius: 6,
        },
        arrow: { color: '#0F172A' },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(15,23,42,0.2)',
        },
      },
    },

    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          '&.Mui-selected': {
            backgroundColor: alpha(PRIMARY, 0.08),
            color: PRIMARY,
          },
        },
      },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 4, height: 6 },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
  },
})

export default theme