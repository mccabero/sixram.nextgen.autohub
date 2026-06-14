// @ts-nocheck
import React, { createContext, useContext, useState, useCallback } from 'react'
import Toast from '../components/ui/Toast'

type ToastItem = { id: string, message: string, type?: 'success'|'error'|'info' }

type ToastContextType = {
  showToast: (message: string, type?: ToastItem['type']) => void
}

const ctx = createContext<ToastContextType | null>(null)

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, type: ToastItem['type'] = 'info') => {
    const msg = (message ?? '').toString().trim()
    if (!msg) return
    setToasts(prev => {
      // prevent showing duplicate concurrent toast messages of same text+type
      if (prev.some(x => x.message === msg && x.type === type)) return prev
      const id = String(Date.now()) + Math.random().toString(36).slice(2,7)
      const item = { id, message: msg, type }
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
      return [...prev, item]
    })
  }, [])

  const dismiss = (id: string) => setToasts(t => t.filter(x => x.id !== id))

  return (
    <ctx.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 w-full max-w-xs">
        {toasts.map(t => (
          <div key={t.id}><Toast message={t.message} type={t.type} onClose={() => dismiss(t.id)} /></div>
        ))}
      </div>
    </ctx.Provider>
  )
}

export function useToast(){
  const c = useContext(ctx)
  if (!c) throw new Error('useToast must be used within ToastProvider')
  return c
}
