// @ts-nocheck
import React, { useRef, useState, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'

type Props = {
  onDateSelect?: (dateStr: string | null)=>void
  calendarRef?: any
  fullscreen?: boolean
  onEventClick?: (event:any)=>void
}

export default function AppointmentCalendar({ onDateSelect, calendarRef, fullscreen = false, onEventClick } : Props){
  const [events, setEvents] = useState<any[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)
  const ref = useRef<any>(null)

  function handleDateClick(arg:any){
    onDateSelect?.(arg.dateStr)
  }

  async function loadEvents(){
    setFetchError(null)
    try{
      const res = await fetch('/api/appointments')
      if (!res.ok){ setFetchError('Failed to load appointments'); setEvents([]); return }
      const list = await res.json()
      const mapped = (Array.isArray(list) ? list : []).map((it:any) => ({ id: it.id, title: `${it.firstName} ${it.lastName}`, start: it.start, end: it.end, extendedProps: it }))
      setEvents(mapped)
    }catch(e){ setFetchError('Unable to reach appointments service'); setEvents([]) }
  }

  useEffect(()=>{
    loadEvents()
    const onFocus = () => loadEvents()
    window.addEventListener('focus', onFocus)
    return ()=>{ window.removeEventListener('focus', onFocus) }
  }, [])

  return (
    <div className={fullscreen ? 'fixed inset-0 bg-white p-4 z-50' : 'bg-white shadow-sm rounded-md p-4'}>
      {fetchError && <div className="mb-3 px-3 py-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded">{fetchError}</div>}
      <FullCalendar
        ref={calendarRef || ref}
        plugins={[ dayGridPlugin, interactionPlugin, timeGridPlugin ]}
        initialView="dayGridMonth"
        headerToolbar={{ left: '', center: 'title', right: '' }}
        events={events}
        selectable
        dateClick={handleDateClick}
        eventClick={(info:any)=>{
          if (info && info.event){
            onEventClick?.(info.event)
          }
        }}
        dayMaxEvents={3}
        className="fc-modern"
        height={fullscreen ? '100%' : 'auto'}
        eventContent={(arg:any) => {
          const ev = arg.event
          const props = ev.extendedProps || {}
          const start = ev.start
          const timeStr = start ? start.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' }) : ''
          const status = (props.status || '').toString()

          const statusClasses: Record<string,string> = {
            'Scheduled': 'bg-yellow-200 border-yellow-300 text-yellow-900',
            'Confirmed': 'bg-sky-200 border-sky-300 text-sky-900',
            'Cancelled': 'bg-rose-200 border-rose-300 text-rose-900',
            'Completed': 'bg-emerald-200 border-emerald-300 text-emerald-900'
          }
          const cls = statusClasses[status] || 'bg-bosch-blue/10 border-bosch-blue/20 text-slate-800'

          return (
            <div className="w-full">
              <div className={`w-full px-2 py-1 rounded border text-left ${cls}`}>
                <div className="text-sm font-medium truncate">{ev.title}</div>
                <div className="text-xs mt-1 opacity-90">{timeStr}{status ? ` (${status})` : ''}</div>
              </div>
            </div>
          )
        }}
      />
    </div>
  )
}
