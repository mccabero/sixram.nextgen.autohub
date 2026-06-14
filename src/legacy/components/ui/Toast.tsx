// @ts-nocheck
import React from 'react'

export type ToastType = 'success' | 'error' | 'info'

export default function Toast({ message, type = 'info', onClose }: { message: string, type?: ToastType, onClose?: () => void }){
  const bg = type === 'success' ? 'bg-emerald-100 border-emerald-200 text-emerald-800' : type === 'error' ? 'bg-rose-100 border-rose-200 text-rose-800' : 'bg-sky-100 border-sky-200 text-sky-800'
  return (
    <div className={`flex items-center justify-between px-4 py-2 rounded border ${bg} shadow-sm`}> 
      <div className="text-sm">{message}</div>
      {onClose && <button onClick={onClose} className="ml-4 text-sm underline">Dismiss</button>}
    </div>
  )
}
