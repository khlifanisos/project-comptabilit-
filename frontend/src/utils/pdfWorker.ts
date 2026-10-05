// Shared pdf.js setup — configures the worker exactly once, wherever pdf.js
// is first imported from (the flipbook viewer or a thumbnail).
import * as pdfjsLib from 'pdfjs-dist'
// @ts-ignore – Vite resolves this to the built worker's URL
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export default pdfjsLib

/**
 * Renders the first page of a local PDF File to a JPEG data URL — used to
 * preview a freshly-picked PDF before it's uploaded anywhere (an <img> tag
 * can't display a PDF data URI directly, so callers need an actual raster
 * image instead of the raw file).
 */
export async function renderPdfFirstPageThumbnail(file: File, maxWidth = 500): Promise<string> {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 1 })
  const scale = maxWidth / viewport.width
  const scaledViewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = scaledViewport.width
  canvas.height = scaledViewport.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Impossible de créer le contexte canvas')

  await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise
  return canvas.toDataURL('image/jpeg', 0.85)
}
