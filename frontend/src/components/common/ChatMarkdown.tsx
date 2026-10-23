import { Fragment, ReactNode } from 'react'
import { Box, Typography } from '@mui/material'

// Minimal Markdown for chatbot replies: headings, bullet/numbered lists, **bold**, *italic*, `code`.
// Builds React elements directly (no dangerouslySetInnerHTML), so model output can never inject HTML.

function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('**')) parts.push(<strong key={m.index}>{tok.slice(2, -2)}</strong>)
    else if (tok.startsWith('`')) parts.push(
      <Box key={m.index} component="code" sx={{
        fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '0.92em',
        bgcolor: 'rgba(21,101,192,0.08)', px: 0.5, py: 0.1, borderRadius: 0.75,
      }}>{tok.slice(1, -1)}</Box>
    )
    else parts.push(<em key={m.index}>{tok.slice(1, -1)}</em>)
    last = m.index + tok.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

type Block =
  | { kind: 'p'; text: string }
  | { kind: 'h'; text: string }
  | { kind: 'ul' | 'ol'; items: string[] }

function parse(src: string): Block[] {
  const blocks: Block[] = []
  let para: string[] = []
  const flush = () => { if (para.length) { blocks.push({ kind: 'p', text: para.join(' ') }); para = [] } }

  for (const raw of src.replace(/\r/g, '').split('\n')) {
    const line = raw.trim()
    const h  = line.match(/^#{1,6}\s+(.*)$/)
    const ul = line.match(/^[-*•]\s+(.*)$/)
    const ol = line.match(/^\d+[.)]\s+(.*)$/)
    const prev = blocks[blocks.length - 1]

    if (!line) { flush(); continue }
    if (h) { flush(); blocks.push({ kind: 'h', text: h[1] }); continue }
    if (ul || ol) {
      flush()
      const kind = ul ? 'ul' : 'ol'
      const item = (ul ?? ol)![1]
      if (prev && prev.kind === kind) prev.items.push(item)
      else blocks.push({ kind, items: [item] })
      continue
    }
    para.push(line)
  }
  flush()
  return blocks
}

export default function ChatMarkdown({ text }: { text: string }) {
  return (
    <Box sx={{ fontSize: 13, lineHeight: 1.6, '& > *:first-of-type': { mt: 0 }, '& > *:last-child': { mb: 0 } }}>
      {parse(text).map((b, i) => {
        if (b.kind === 'h') return (
          <Typography key={i} sx={{ fontWeight: 700, fontSize: 13.5, mt: 1.2, mb: 0.4 }}>{renderInline(b.text)}</Typography>
        )
        if (b.kind === 'p') return (
          <Typography key={i} component="p" sx={{ fontSize: 'inherit', lineHeight: 'inherit', my: 0.6 }}>{renderInline(b.text)}</Typography>
        )
        return (
          <Box key={i} component={b.kind} sx={{ my: 0.6, pl: 2.2, '& li': { mb: 0.3, pl: 0.3 } }}>
            {b.items.map((it, j) => <li key={j}><Fragment>{renderInline(it)}</Fragment></li>)}
          </Box>
        )
      })}
    </Box>
  )
}
