import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { UserRole } from '../../types'

interface Props {
  children: React.ReactNode
  allowedRole?: UserRole
}

export default function ProtectedRoute({ children, allowedRole }: Props) {
  const { isAuthenticated, user } = useAuth()

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (allowedRole && user?.role !== allowedRole) {
    return <Navigate to={user?.role === 'admin' ? '/admin/clients' : '/releves'} replace />
  }
  return <>{children}</>
}
