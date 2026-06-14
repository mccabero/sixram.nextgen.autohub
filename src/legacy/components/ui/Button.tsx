// @ts-nocheck
import React from 'react'

export default function Button({ children, onClick, className }: { children: React.ReactNode, onClick?: ()=>void, className?: string }){
  return <button onClick={onClick} className={`px-3 py-2 rounded-md bg-bosch-blue text-white text-sm ${className||''}`}>{children}</button>
}
