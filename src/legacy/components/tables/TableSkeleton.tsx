// @ts-nocheck
import React from 'react'

export default function TableSkeleton(){
  return (
    <div className="animate-pulse">
      <div className="h-6 bg-slate-200 rounded w-1/3 mb-2"></div>
      <div className="space-y-2">
        <div className="h-8 bg-slate-200 rounded"></div>
        <div className="h-8 bg-slate-200 rounded"></div>
        <div className="h-8 bg-slate-200 rounded"></div>
      </div>
    </div>
  )
}
