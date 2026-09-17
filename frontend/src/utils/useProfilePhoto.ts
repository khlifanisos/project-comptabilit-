import { useState, useEffect, useCallback } from 'react'
import api from '../api/axios'

const lsKey = (email: string) => `profile_photo_${email}`

// ── local cache helpers ──────────────────────────────────────────
export function getProfilePhoto(email: string): string | null {
  if (!email) return null
  return localStorage.getItem(lsKey(email))
}

function saveLocal(email: string, base64: string) {
  localStorage.setItem(lsKey(email), base64)
  window.dispatchEvent(new Event('profile_photo_changed'))
}

function removeLocal(email: string) {
  localStorage.removeItem(lsKey(email))
  window.dispatchEvent(new Event('profile_photo_changed'))
}

// ── API helpers ─────────────────────────────────────────────────
// Returns the server URL of the saved photo (or null on failure)
export async function setProfilePhoto(email: string, base64: string): Promise<string | null> {
  saveLocal(email, base64)  // instant local display
  try {
    const res = await api.post('/profile/photo', { avatar: base64 })
    const url: string | null = res.data?.avatar ?? null
    // If server returned a file URL, cache it locally too
    if (url) saveLocal(email, url)
    return url
  } catch {
    return null
  }
}

export async function clearProfilePhoto(email: string): Promise<void> {
  removeLocal(email)
  try {
    await api.post('/profile/photo', { avatar: null })
  } catch { /* ignore */ }
}

// ── hook ─────────────────────────────────────────────────────────
export function useProfilePhoto(email: string, serverAvatar?: string | null) {
  const read = useCallback(() =>
    // prefer server avatar, fallback to localStorage
    serverAvatar ?? getProfilePhoto(email),
  [email, serverAvatar])

  const [photo, setPhoto] = useState<string | null>(read)

  useEffect(() => {
    setPhoto(read())
    const onCustom  = () => setPhoto(read())
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === lsKey(email)) setPhoto(read())
    }
    window.addEventListener('profile_photo_changed', onCustom)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('profile_photo_changed', onCustom)
      window.removeEventListener('storage', onStorage)
    }
  }, [email, read])

  return photo
}
