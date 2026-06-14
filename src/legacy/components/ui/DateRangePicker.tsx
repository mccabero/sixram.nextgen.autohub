// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react'
import { DateRange } from 'react-date-range'
import 'react-date-range/dist/styles.css'
import 'react-date-range/dist/theme/default.css'

type RangeValue = { start?: string; end?: string } | null

function toLocalISO(d?: Date | null) {
  if (!d) return undefined
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function fromLocalISO(s?: string | null){
  if (!s) return undefined
  const parts = s.split('-').map(p=>Number(p))
  if (parts.length < 3 || parts.some(isNaN)) return undefined
  const [y,m,d] = parts
  return new Date(y, m-1, d)
}

function fmtDisplay(iso?: string){ if (!iso) return ''; const dt = fromLocalISO(iso); if (!dt) return ''; const mm = String(dt.getMonth()+1).padStart(2,'0'); const dd = String(dt.getDate()).padStart(2,'0'); const yy = dt.getFullYear(); return `${mm}/${dd}/${yy}` }

export default function DateRangePicker({ value, onChange }: { value?: RangeValue, onChange?: (v:RangeValue)=>void }){
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [buttonWidth, setButtonWidth] = useState<number | null>(null)
  const [range, setRange] = useState({ startDate: fromLocalISO(value?.start) ?? new Date(), endDate: fromLocalISO(value?.end) ?? new Date(), key: 'selection' })

  useEffect(()=>{
    setRange({ startDate: fromLocalISO(value?.start) ?? new Date(), endDate: fromLocalISO(value?.end) ?? new Date(), key: 'selection' })
  },[value])

  useEffect(()=>{
    function onDocClick(e: MouseEvent){ if (!wrapperRef.current) return; if (e.target instanceof Node && !wrapperRef.current.contains(e.target)) setOpen(false) }
    function onKey(e: KeyboardEvent){ if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onKey)
    return ()=>{ document.removeEventListener('click', onDocClick); document.removeEventListener('keydown', onKey) }
  }, [])

  useEffect(()=>{
    function updateWidth(){
      try{
        const card = document.querySelector('.card') as HTMLElement | null
        if (card) setButtonWidth(Math.round(card.getBoundingClientRect().width))
        else setButtonWidth(null)
      }catch{}
    }
    updateWidth()
    window.addEventListener('resize', updateWidth)
    return ()=>window.removeEventListener('resize', updateWidth)
  }, [])

  const displayText = (value?.start || value?.end) ? `${fmtDisplay(value?.start)} — ${fmtDisplay(value?.end)}` : 'Select date range'

  const currentYear = new Date().getFullYear()
  const maxDate = new Date(currentYear, 11, 31)
  const minDate = new Date(currentYear - 10, 0, 1)

  const handleRangeChange = (ranges: any) => {
    const r = ranges.selection
    setRange(r)
    onChange?.({ start: toLocalISO(r.startDate), end: toLocalISO(r.endDate) })
  }

  const clear = ()=>{ setRange({ startDate: new Date(), endDate: new Date(), key: 'selection' }); onChange?.(null); setOpen(false) }

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <button type="button" onClick={()=>setOpen(o=>!o)} aria-label="Select date range" className="w-full px-3 py-2 border rounded text-left bg-white shadow-sm hover:shadow focus:outline-none flex items-center justify-between gap-2 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:shadow-none">
        <span className={`text-sm truncate ${displayText === 'Select date range' ? 'text-slate-400 dark:text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>{displayText}</span>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><path d="M16 2v4M8 2v4M3 10h18"/></svg>
      </button>
      {open && (
        <div className="absolute z-40 mt-2 left-0 bg-white shadow rounded p-2 dark:bg-slate-800 dark:shadow-none dark:border dark:border-slate-700 max-w-[calc(100vw-2rem)] overflow-x-auto">
          <div className="flex gap-2 mb-2">
            <button type="button" onClick={()=>{ const endD = new Date(); const startD = new Date(); startD.setDate(endD.getDate()-6); const r = { startDate: startD, endDate: endD, key: 'selection' }; setRange(r); onChange?.({ start: toLocalISO(startD), end: toLocalISO(endD) }); setOpen(false) }} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200">Last 7</button>
            <button type="button" onClick={()=>{ const endD = new Date(); const startD = new Date(); startD.setDate(endD.getDate()-29); const r = { startDate: startD, endDate: endD, key: 'selection' }; setRange(r); onChange?.({ start: toLocalISO(startD), end: toLocalISO(endD) }); setOpen(false) }} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200">Last 30</button>
            <button type="button" onClick={()=>{ const endD = new Date(); const startD = new Date(); startD.setDate(endD.getDate()-89); const r = { startDate: startD, endDate: endD, key: 'selection' }; setRange(r); onChange?.({ start: toLocalISO(startD), end: toLocalISO(endD) }); setOpen(false) }} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200">Last 90</button>
            <button type="button" onClick={()=>{ const today = new Date(); const startD = new Date(today.getFullYear(),0,1); const r = { startDate: startD, endDate: today, key: 'selection' }; setRange(r); onChange?.({ start: toLocalISO(startD), end: toLocalISO(today) }); setOpen(false) }} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200">This year</button>
            <button type="button" onClick={()=>{ const today = new Date(); const prev = today.getFullYear()-1; const startD = new Date(prev,0,1); const endD = new Date(prev,11,31); const r = { startDate: startD, endDate: endD, key: 'selection' }; setRange(r); onChange?.({ start: toLocalISO(startD), end: toLocalISO(endD) }); setOpen(false) }} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200">Previous year</button>
          </div>

          <div>
            <DateRange
              ranges={[range as any]}
              onChange={handleRangeChange}
              moveRangeOnFirstSelection={false}
              editableDateInputs={true}
              months={1}
              direction="horizontal"
              weekdayDisplayFormat="EE"
              maxDate={maxDate}
              minDate={minDate}
            />
          </div>

          <div className="mt-2 flex items-center justify-end gap-2">
            <button type="button" onClick={clear} className="px-3 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200">Clear</button>
          </div>
        </div>
      )}
    </div>
  )
}
