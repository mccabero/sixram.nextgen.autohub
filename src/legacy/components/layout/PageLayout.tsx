// @ts-nocheck
import React, { useState } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import Breadcrumbs from './Breadcrumbs'
import Footer from './Footer'
import LoadingOverlay from './LoadingOverlay'
import PageAccessGuard from '../../routes/PageAccessGuard'
import ChatBox from '../chat/ChatBox'
import { useCanUseChatbotPermission } from '../../hooks/useCanUseChatbotPermission'

export default function PageLayout() {
  const [open, setOpen] = useState(false)
  const canUseChatbot = useCanUseChatbotPermission()

  return (
    <div className="min-h-screen flex bg-background-DEFAULT dark:bg-[#14181c]">
      <Sidebar mobileOpen={open} onClose={() => setOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenu={() => setOpen(v => !v)} />
        <LoadingOverlay />
        <main className="flex min-h-0 flex-1 flex-col w-full mx-auto px-4 py-4 sm:px-6 lg:px-12">
          <Breadcrumbs />
          <div className="mt-4 min-h-0 flex-1">
            <PageAccessGuard />
          </div>
        </main>
        <Footer />
      </div>
      {canUseChatbot && <ChatBox />}
    </div>
  )
}
