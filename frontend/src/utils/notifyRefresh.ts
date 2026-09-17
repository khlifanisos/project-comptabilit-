const REFRESH_EVENT = 'notification-refresh'
const ADD_EVENT     = 'notification-add'

export function notifyRefresh(): void {
  window.dispatchEvent(new CustomEvent(REFRESH_EVENT))
}

export function onNotifyRefresh(cb: () => void): () => void {
  window.addEventListener(REFRESH_EVENT, cb)
  return () => window.removeEventListener(REFRESH_EVENT, cb)
}

export function addLocalNotification(titre: string, message: string, type = 'info'): void {
  window.dispatchEvent(new CustomEvent(ADD_EVENT, { detail: { titre, message, type } }))
}

export function onLocalNotification(
  cb: (n: { titre: string; message: string; type: string }) => void
): () => void {
  const handler = (e: Event) => cb((e as CustomEvent).detail)
  window.addEventListener(ADD_EVENT, handler)
  return () => window.removeEventListener(ADD_EVENT, handler)
}