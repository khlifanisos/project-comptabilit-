const EVENT = 'chatbot-open-change'

export function setChatbotOpen(open: boolean): void {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { open } }))
}

export function onChatbotOpenChange(cb: (open: boolean) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent).detail.open)
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
