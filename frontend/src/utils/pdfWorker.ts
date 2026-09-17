// Shared pdf.js setup — configures the worker exactly once, wherever pdf.js
// is first imported from (the flipbook viewer or a thumbnail).
import * as pdfjsLib from 'pdfjs-dist'
// @ts-ignore – Vite resolves this to the built worker's URL
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export default pdfjsLib
