// @ts-nocheck
import React, { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

function getInitialDark(): boolean {
  try {
    const stored = localStorage.getItem('theme')
    if (stored === 'dark') return true
    if (stored === 'light') return false
  } catch {}
  return false
}

export default function ThemeToggle() {
  const [dark, setDark] = useState<boolean>(getInitialDark)

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark')
      try { localStorage.setItem('theme', 'dark') } catch {}
    } else {
      document.documentElement.classList.remove('dark')
      try { localStorage.setItem('theme', 'light') } catch {}
    }
  }, [dark])

  return (
    <button
      onClick={() => setDark(d => !d)}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="p-2 rounded-lg bg-slate-100 dark:bg-[#232d38] text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#2b3845] transition-colors"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
