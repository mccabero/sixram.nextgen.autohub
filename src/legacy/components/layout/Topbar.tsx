// @ts-nocheck
import React from 'react'
import { Menu } from 'lucide-react'
import ThemeToggle from '../ui/ThemeToggle'
import ProfileMenu from './ProfileMenu'

export default function Topbar({ onMenu }: { onMenu?: ()=>void }) {
  return (
    <header className="sticky top-0 z-20 bg-white dark:bg-[#1a2028] border-b border-gray-100 dark:border-[#2b3845]">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-12 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="md:hidden p-2" onClick={onMenu}><Menu /></button>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <ProfileMenu />
        </div>
      </div>
    </header>
  )
}
