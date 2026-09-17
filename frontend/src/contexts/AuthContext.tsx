import { createContext, useContext, useState, ReactNode } from 'react'
import { User, UserRole } from '../types'
import api from '../api/axios'

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, password: string, role?: UserRole) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
  loading: boolean
  updateUser: (patch: Partial<User>) => void
}

interface RegisterData {
  nom: string
  email: string
  password: string
  password_confirmation: string
  entreprise?: string
  telephone?: string
  adresse?: string
  role: UserRole
  code: string
  avatar?: string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = sessionStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('token'))
  const [loading, setLoading] = useState(false)

  const login = async (email: string, password: string, role?: UserRole) => {
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password, role })
      setToken(data.token)
      setUser(data.user)
      sessionStorage.setItem('token', data.token)
      sessionStorage.setItem('user', JSON.stringify(data.user))
      sessionStorage.setItem('real_role', data.user.role)
    } finally {
      setLoading(false)
    }
  }

  const register = async (formData: RegisterData) => {
    setLoading(true)
    try {
      const { data } = await api.post('/auth/register', formData)
      setToken(data.token)
      setUser(data.user)
      sessionStorage.setItem('token', data.token)
      sessionStorage.setItem('user', JSON.stringify(data.user))
      sessionStorage.setItem('real_role', data.user.role)
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    api.post('/auth/logout').catch(() => {})
    setToken(null)
    setUser(null)
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
    sessionStorage.removeItem('real_role')
  }

  const updateUser = (patch: Partial<User>) => {
    if (!user) return
    const updated = { ...user, ...patch }
    setUser(updated)
    sessionStorage.setItem('user', JSON.stringify(updated))
  }

  return (
    <AuthContext.Provider value={{
      user, token, login, register, logout,
      isAuthenticated: !!token && !!user,
      loading, updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
