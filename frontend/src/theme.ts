import { createTheme, alpha } from '@mui/material/styles'
import type { PaletteMode } from '@mui/material'

const PRIMARY   = '#1565C0'
const PRIMARY_D = '#0D47A1'
const SUCCESS   = '#16A34A'
const ERROR     = '#DC2626'
const WARNING   = '#EA580C'

export function getTheme(mode: PaletteMode) {
  const isDark = mode === 'dark'

  return createTheme({
    palette: {
      mode,
      primary:    { main: PRIMARY, dark: PRIMARY_D, light: isDark ? '#42A5F5' : '#1976D2' },
      secondary:  { main: '#0891B2' },
      error:      { main: ERROR },
      warning:    { main: WARNING },
      success:    { main: SUCCESS },
      background: {
        default: isDark ? '#0B1220' : '#F0F4F8',
        paper:   isDark ? '#131B2C' : '#FFFFFF',
      },
      text: {
        primary:   isDark ? '#E2E8F0' : '#0F172A',
        secondary: isDark ? '#94A3B8' : '#64748B',
        disabled:  isDark ? '#5B6B82' : '#94A3B8',
      },
      divider: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)',
    },

    typography: {
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      h4: { fontWeight: 800, letterSpacing: '-0.02em' },
      h5: { fontWeight: 700, letterSpacing: '-0.01em' },
      h6: { fontWeight: 700 },
      subtitle1: { fontWeight: 600 },
      body1:  { lineHeight: 1.6 },
      body2:  { lineHeight: 1.5 },
      button: { fontWeight: 600, textTransform: 'none', letterSpacing: '0.01em' },
      caption:{ fontSize: '0.75rem' },
    },

    shape: { borderRadius: 10 },

    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 14,
            boxShadow: isDark
              ? '0 1px 2px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.45)'
              : '0 1px 2px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.08)',
            border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.05)',
            backgroundImage: 'none',
            transition: 'background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
          },
        },
      },

      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none', transition: 'background-color 0.3s ease, border-color 0.3s ease' },
          elevation1: {
            boxShadow: isDark
              ? '0 1px 2px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.45)'
              : '0 1px 2px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.08)',
          },
          elevation8: {
            boxShadow: isDark ? '0 8px 30px rgba(0,0,0,0.5)' : '0 8px 30px rgba(15,23,42,0.12)',
          },
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
            borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)',
            '&:hover': { borderColor: PRIMARY, bgcolor: alpha(PRIMARY, isDark ? 0.12 : 0.04) },
          },
        },
      },

      MuiTextField: {
        defaultProps: { size: 'small' },
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 8,
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FAFAFA',
              '& fieldset': { borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' },
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
            color: isDark ? '#94A3B8' : '#64748B',
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
            borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E2E8F0',
            padding: '12px 16px',
            whiteSpace: 'nowrap',
          },
          body: {
            fontSize: '0.875rem',
            color: isDark ? '#E2E8F0' : '#1E293B',
            borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #F1F5F9',
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
          root: { borderColor: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)' },
        },
      },

      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: isDark ? '#1E293B' : '#0F172A',
            fontSize: '0.75rem',
            borderRadius: 6,
          },
          arrow: { color: isDark ? '#1E293B' : '#0F172A' },
        },
      },

      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 16,
            boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.55)' : '0 20px 60px rgba(15,23,42,0.2)',
          },
        },
      },

      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            '&.Mui-selected': {
              backgroundColor: alpha(PRIMARY, isDark ? 0.16 : 0.08),
              color: isDark ? '#64B5F6' : PRIMARY,
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
}

// Kept as the default export for any code still importing the static theme —
// prefer `getTheme(mode)` from `ThemeModeContext`-driven code going forward.
export default getTheme('light')
