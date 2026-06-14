// @ts-nocheck
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { subscribe as subscribeLoading, getCount, increment as globalIncrement, decrement as globalDecrement } from '../config/loadingManager'

type LoadingContextType = {
  loading: boolean
  show: () => void
  hide: () => void
}

const LoadingContext = createContext<LoadingContextType | null>(null)

export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(false)
  const show = useCallback(() => { try{ globalIncrement() }catch{} }, [])
  const hide = useCallback(() => { try{ globalDecrement() }catch{} }, [])
  const value = useMemo(() => ({ loading, show, hide }), [loading, show, hide])
  useEffect(()=>{
    // initialize from current count and subscribe to changes
    setLoading(getCount() > 0)
    const unsub = subscribeLoading((c)=> setLoading(c > 0))
    return unsub
  },[])
  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  )
}

export function useLoading(){
  const c = useContext(LoadingContext)
  if (!c) throw new Error('useLoading must be used within LoadingProvider')
  return c
}

export default LoadingContext
