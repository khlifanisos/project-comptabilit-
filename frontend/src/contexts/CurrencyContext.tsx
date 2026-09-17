import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import api from '../api/axios'

export interface CurrencyOption { code: string; label: string }

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: 'TND', label: 'Dinar tunisien (TND)' },
  { code: 'MAD', label: 'Dirham marocain (MAD)' },
  { code: 'DZD', label: 'Dinar algérien (DZD)' },
  { code: 'EUR', label: 'Euro (EUR)' },
  { code: 'USD', label: 'Dollar américain (USD)' },
  { code: 'GBP', label: 'Livre sterling (GBP)' },
]

const DEFAULT_DEVISE = 'TND'

interface CurrencyContextType {
  devise: string
  setDevise: (code: string) => Promise<void>
  formatMoney: (value: number | string | null | undefined) => string
  whatsapp: string | null
  setWhatsapp: (number: string) => Promise<void>
  loading: boolean
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined)

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [devise, setDeviseState]     = useState(DEFAULT_DEVISE)
  const [whatsapp, setWhatsappState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/parametres')
      .then((r: { data: { devise?: string; whatsapp?: string | null } }) => {
        if (r.data?.devise) setDeviseState(r.data.devise)
        setWhatsappState(r.data?.whatsapp ?? null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const setDevise = useCallback(async (code: string) => {
    const previous = devise
    setDeviseState(code)
    try {
      await api.put('/parametres', { devise: code })
    } catch (e) {
      setDeviseState(previous)
      throw e
    }
  }, [devise])

  const setWhatsapp = useCallback(async (number: string) => {
    const previous = whatsapp
    setWhatsappState(number)
    try {
      await api.put('/parametres', { whatsapp: number })
    } catch (e) {
      setWhatsappState(previous)
      throw e
    }
  }, [whatsapp])

  const formatMoney = useCallback((value: number | string | null | undefined) => {
    const n = value == null || value === '' ? 0 : Number(value)
    return `${n.toFixed(2)} ${devise}`
  }, [devise])

  return (
    <CurrencyContext.Provider value={{ devise, setDevise, formatMoney, whatsapp, setWhatsapp, loading }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext)
  if (!ctx) throw new Error('useCurrency must be used within a CurrencyProvider')
  return ctx
}
