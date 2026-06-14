// @ts-nocheck
import React from 'react'

export default function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-bosch-blue/10 text-bosch-blue">{children}</span>
}
