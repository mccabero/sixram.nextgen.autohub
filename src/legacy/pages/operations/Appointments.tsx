// @ts-nocheck
import React, { useState, useRef } from 'react'
import AppointmentCalendar from '../../components/operations/AppointmentCalendar'
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function Appointments(){
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const calendarRef = useRef<any>(null)
  const [selectedView, setSelectedView] = useState<'dayGridMonth'|'timeGridWeek'|'timeGridDay'>('dayGridMonth')
  const navigate = useNavigate()

  const isPast = selectedDate ? (() => {
    const parts = selectedDate.split('-').map(Number)
    if (parts.length < 3) return false
    const sel = new Date(parts[0], parts[1]-1, parts[2])
    const today = new Date()
    today.setHours(0,0,0,0)
    sel.setHours(0,0,0,0)
    return sel < today
  })() : false

  function handleAdd(){
    if (!selectedDate) return
    navigate('/operations/appointments/new', { state: { selectedDate } })
  }

  function goToday(){
    try{ calendarRef.current?.getApi().today() }catch{}
  }
  function gotoPrev(){ try{ calendarRef.current?.getApi().prev() }catch{} }
  function gotoNext(){ try{ calendarRef.current?.getApi().next() }catch{} }
  function changeView(view:'dayGridMonth'|'timeGridWeek'|'timeGridDay'){
    try{ calendarRef.current?.getApi().changeView(view); setSelectedView(view) }catch{}
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Appointments</h1>
          {isPast ? (
            <div className="text-sm text-red-600">Selected: {selectedDate} — previous date (cannot add)</div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2">
            <button onClick={()=>changeView('dayGridMonth')} className={`px-3 py-2 rounded-md border text-sm flex items-center gap-2 ${selectedView === 'dayGridMonth' ? 'bg-slate-100' : 'bg-white hover:bg-gray-50'}`}><CalendarIcon size={16}/>Month</button>
            <button onClick={()=>changeView('timeGridWeek')} className={`px-3 py-2 rounded-md border text-sm flex items-center gap-2 ${selectedView === 'timeGridWeek' ? 'bg-slate-100' : 'bg-white hover:bg-gray-50'}`}><CalendarIcon size={16}/>Week</button>
            <button onClick={()=>changeView('timeGridDay')} className={`px-3 py-2 rounded-md border text-sm flex items-center gap-2 ${selectedView === 'timeGridDay' ? 'bg-slate-100' : 'bg-white hover:bg-gray-50'}`}><CalendarIcon size={16}/>Day</button>
          </div>
          <button onClick={goToday} className="px-3 py-2 rounded-md border text-sm bg-white hover:bg-gray-50 flex items-center gap-2"><CalendarIcon size={16}/>Today</button>
          <button onClick={gotoPrev} className="p-2 rounded-md border text-sm hover:bg-gray-50"><ChevronLeft size={16} /></button>
          <button onClick={gotoNext} className="p-2 rounded-md border text-sm hover:bg-gray-50"><ChevronRight size={16} /></button>
          <button onClick={handleAdd} disabled={!selectedDate || isPast} title={isPast ? 'Selected date is in the past' : ''} className={`ml-2 px-4 py-2 rounded-md text-sm font-medium ${(!selectedDate || isPast) ? 'bg-gray-100 text-slate-400 cursor-not-allowed' : 'bg-bosch-blue text-white'}`}>
            <Plus size={14} className="inline-block mr-2"/>Add Appointment
          </button>
        </div>
      </div>

      <div>
        <AppointmentCalendar calendarRef={calendarRef} onDateSelect={(d)=> setSelectedDate(d)} onEventClick={(ev)=>{
          const id = ev.id || ev.extendedProps?.id
          if (id) navigate(`/operations/appointments/${id}`, { state: { event: ev } })
        }} />
      </div>
    </div>
  )
}
