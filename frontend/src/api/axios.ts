import axios from 'axios'

// In local dev, '/api' is proxied to the Laravel backend by vite.config.ts.
// That proxy only exists for `vite dev` — a production build (e.g. on Vercel)
// has no backend behind its own domain, so VITE_API_URL must point at the
// deployed backend's public URL (e.g. https://api.example.com/api).
const baseURL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  withCredentials: true,
  timeout: 5000,
})

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('token')
      sessionStorage.removeItem('user')
      sessionStorage.removeItem('real_role')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
