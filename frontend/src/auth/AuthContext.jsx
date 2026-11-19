import { createContext, useContext, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { api, getCsrfCookie, setUnauthorizedHandler } from '@/lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return (await api.get('/auth/me')).data
      } catch (e) {
        if (e.response?.status === 401) return null
        throw e
      }
    },
    staleTime: Infinity,
    retry: false,
  })

  // Session expired anywhere in the app → back to login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      qc.setQueryData(['me'], null)
      navigate('/login', { replace: true })
    })
  }, [qc, navigate])

  const login = async (email, password) => {
    await getCsrfCookie()
    const { data } = await api.post('/auth/login', { email, password })
    qc.clear()
    qc.setQueryData(['me'], data)
    return data
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } finally {
      qc.clear()
      qc.setQueryData(['me'], null)
      navigate('/login', { replace: true })
    }
  }

  return <AuthContext.Provider value={{ user, isLoading, login, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
