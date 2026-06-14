// @ts-nocheck
import React from 'react'
import { APP } from '../../config/app'

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-100 dark:border-[#2b3845] bg-white/50 dark:bg-transparent">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-12 py-3 flex items-center justify-between text-sm text-slate-500">
        <div>Copyright © {APP.COPYRIGHT_YEAR} {APP.COMPANY}. All rights reserved.</div>
        <div>Version {APP.VERSION} | Build {APP.BUILD_NUMBER}</div>
      </div>
    </footer>
  )
}
