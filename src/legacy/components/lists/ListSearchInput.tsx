// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'

export interface ListSearchInputProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  debounceMs?: number
}

export default function ListSearchInput({ value, onChange, placeholder = 'Search...', className = '', debounceMs = 250 }: ListSearchInputProps){
  const [inputValue, setInputValue] = useState(value)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    setInputValue(value)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [value])

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [])

  function updateValue(nextValue: string, immediate = false) {
    setInputValue(nextValue)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    if (immediate || debounceMs <= 0) {
      onChangeRef.current(nextValue)
      return
    }

    timeoutRef.current = setTimeout(() => {
      onChangeRef.current(nextValue)
      timeoutRef.current = null
    }, debounceMs)
  }

  return (
    <div className={`relative flex-1 lg:flex-none ${className}`}>
      <input
        value={inputValue}
        onChange={e => updateValue(e.target.value)}
        placeholder={placeholder}
        className="w-full lg:w-80 pl-10 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300 transition"
      />
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        <Search size={16} />
      </div>
      {inputValue && (
        <button
          type="button"
          aria-label="clear-search"
          onClick={() => updateValue('', true)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
