import { Box, Card, CardContent, Typography, useTheme } from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import Reveal from './Reveal'

interface Props {
  title: string
  value: string | number
  icon: React.ReactNode
  color: string
  trend?: number
  subtitle?: string
  /** Stagger delay (ms) when several StatCards mount together in a grid. */
  delay?: number
}

export default function StatCard({ title, value, icon, color, trend, subtitle, delay = 0 }: Props) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Reveal delay={delay} observe={false}>
      <Card sx={{
        transition: 'box-shadow 0.2s, transform 0.2s, background-color 0.3s ease, border-color 0.3s ease',
        overflow: 'hidden',
        '&:hover': {
          boxShadow: isDark ? '0 10px 28px rgba(0,0,0,0.5)' : '0 6px 20px rgba(15,23,42,0.1)',
          transform: 'translateY(-2px)',
        },
      }}>
        {/* Top accent stripe */}
        <Box sx={{ height: 3, background: `linear-gradient(90deg, ${color}, ${color}88)` }} />

        <CardContent sx={{ p: 2.5, pt: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{
                fontSize: '0.68rem', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.09em',
                color: 'text.secondary', mb: 0.8,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {title}
              </Typography>

              <Typography variant="h5" className="stat-number" sx={{
                fontWeight: 800, color: 'text.primary',
                lineHeight: 1.1, letterSpacing: '-0.02em',
                fontSize: '1.4rem',
              }}>
                {value}
              </Typography>

              {subtitle && (
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.4 }}>
                  {subtitle}
                </Typography>
              )}

              {trend !== undefined && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, mt: 0.6 }}>
                  <Box sx={{
                    display: 'flex', alignItems: 'center', gap: 0.3,
                    px: 0.8, py: 0.2, borderRadius: '4px',
                    bgcolor: trend >= 0
                      ? (isDark ? 'rgba(22,163,74,0.18)' : '#F0FDF4')
                      : (isDark ? 'rgba(220,38,38,0.18)' : '#FEF2F2'),
                  }}>
                    {trend >= 0
                      ? <TrendingUpIcon sx={{ fontSize: 12, color: '#16A34A' }} />
                      : <TrendingDownIcon sx={{ fontSize: 12, color: '#DC2626' }} />}
                    <Typography sx={{
                      fontSize: '0.7rem', fontWeight: 700,
                      color: trend >= 0 ? '#16A34A' : '#DC2626',
                    }}>
                      {trend >= 0 ? '+' : ''}{trend}%
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>ce mois</Typography>
                </Box>
              )}
            </Box>

            {/* Icon */}
            <Box sx={{
              width: 44, height: 44, flexShrink: 0,
              borderRadius: '10px',
              background: `${color}14`,
              border: `1px solid ${color}22`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: color,
              '& svg': { fontSize: 22 },
            }}>
              {icon}
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Reveal>
  )
}
