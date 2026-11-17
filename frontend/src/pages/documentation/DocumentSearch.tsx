import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, CircularProgress, ClickAwayListener, InputBase, List, ListItemButton, Paper, Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon  from '@mui/icons-material/Close'
import api from '../../api/axios'
import { DocumentFiscal, categorieByKey, docUrl } from './categories'

/** Big search field with instant results across the whole library. */
export default function DocumentSearch() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<DocumentFiscal[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const reqId = useRef(0)

  // Debounced search
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setResults([]); setLoading(false); return }
    setLoading(true)
    const id = ++reqId.current
    const t = setTimeout(() => {
      api.get('/documents-fiscaux', { params: { q: term, limit: 12 } })
        .then((r: { data: DocumentFiscal[] }) => { if (id === reqId.current) { setResults(r.data); setActive(0) } })
        .catch(() => { if (id === reqId.current) setResults([]) })
        .finally(() => { if (id === reqId.current) setLoading(false) })
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  const go = (d: DocumentFiscal) => navigate(docUrl(d))
  const showPanel = open && q.trim().length >= 2

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!showPanel || results.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    if (e.key === 'Enter')     { e.preventDefault(); go(results[active]) }
    if (e.key === 'Escape')    setOpen(false)
  }

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box sx={{ position: 'relative', width: '100%', maxWidth: 640 }}>
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          bgcolor: 'background.paper', borderRadius: 3, px: 2, height: 56,
          boxShadow: '0 10px 30px rgba(2, 12, 38, 0.25)',
        }}>
          <SearchIcon sx={{ color: 'text.secondary' }} />
          <InputBase
            value={q}
            onChange={e => { setQ(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Rechercher un texte : « TVA », « note commune 15 », « France »…"
            inputProps={{ 'aria-label': 'Rechercher dans la documentation fiscale' }}
            sx={{ flex: 1, fontSize: 15, color: 'text.primary' }}
          />
          {loading && <CircularProgress size={18} />}
          {q && !loading && (
            <Box component="button" type="button" onClick={() => { setQ(''); setResults([]) }} aria-label="Effacer"
              sx={{ all: 'unset', cursor: 'pointer', display: 'flex', color: 'text.secondary', '&:hover': { color: 'text.primary' } }}>
              <CloseIcon fontSize="small" />
            </Box>
          )}
        </Box>

        {showPanel && (
          <Paper elevation={8} sx={{
            position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 20,
            borderRadius: 3, overflow: 'hidden', maxHeight: 420, overflowY: 'auto',
          }}>
            {!loading && results.length === 0 ? (
              <Typography color="text.secondary" fontSize={14} sx={{ p: 2.5 }}>
                Aucun document ne correspond à « {q.trim()} ».
              </Typography>
            ) : (
              <List disablePadding>
                {results.map((d, i) => {
                  const cat = categorieByKey(d.categorie)!
                  return (
                    <ListItemButton key={d.id} selected={i === active}
                      onMouseEnter={() => setActive(i)} onClick={() => go(d)}
                      sx={{ gap: 1.5, py: 1.2, alignItems: 'flex-start' }}>
                      <Box sx={{
                        width: 32, height: 32, borderRadius: 1.5, flexShrink: 0, mt: 0.2,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        bgcolor: alpha(cat.color, 0.12), color: cat.color,
                      }}>
                        <cat.Icon sx={{ fontSize: 18 }} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography fontSize={14} fontWeight={500} sx={{
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>
                          {d.titre}
                        </Typography>
                        <Typography fontSize={12} color="text.secondary" mt={0.3}>
                          {cat.short}{d.annee ? ` · ${d.annee}` : d.sous_categorie ? ` · ${d.sous_categorie}` : ''}
                        </Typography>
                      </Box>
                    </ListItemButton>
                  )
                })}
              </List>
            )}
          </Paper>
        )}
      </Box>
    </ClickAwayListener>
  )
}
