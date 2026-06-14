// @ts-nocheck
import React, { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react'
import { Loader2, MessageCircle, Send, X } from 'lucide-react'

type ChatRole = 'user' | 'assistant'

interface ChatMessage {
  role: ChatRole
  content: string
}

const WELCOME_MESSAGE = 'Hi, I am Rapide AI. How can I help?'

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message
  return 'Chat is unavailable right now.'
}

async function readJson(response: Response) {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export default function ChatBox() {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: WELCOME_MESSAGE }
  ])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!open) return
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
    inputRef.current?.focus()
  }, [messages, open])

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault()
    const content = draft.trim()
    if (!content || sending) return

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content }]
    setMessages(nextMessages)
    setDraft('')
    setError(null)
    setSending(true)

    try {
      const payloadMessages = nextMessages
        .filter(message => message.content !== WELCOME_MESSAGE)
        .slice(-12)

      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(typeof window !== 'undefined' && localStorage.getItem('auth_token')
            ? { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
            : {})
        },
        body: JSON.stringify({ messages: payloadMessages })
      })
      const data = await readJson(response)

      if (!response.ok) {
        throw new Error(data?.error || data?.message || 'Chat is unavailable right now.')
      }

      const reply = String(data?.message || '').trim()
      if (!reply) throw new Error('Chat returned an empty reply.')

      setMessages([...nextMessages, { role: 'assistant', content: reply }])
    } catch (err) {
      const message = getErrorMessage(err)
      setError(message)
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Open Rapide AI"
        aria-label="Open Rapide AI"
        className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-bosch-blue text-white shadow-lg shadow-sky-900/20 transition hover:bg-sky-600 focus:outline-none focus:ring-4 focus:ring-sky-200 dark:focus:ring-sky-900 sm:bottom-6 sm:right-6"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    )
  }

  return (
    <section className="fixed bottom-4 right-4 z-50 flex h-[min(620px,calc(100vh-2rem))] w-[calc(100vw-2rem)] max-w-[390px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 dark:border-slate-700 dark:bg-slate-800 sm:bottom-6 sm:right-6">
      <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-700">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-sky-100 text-bosch-blue dark:bg-sky-900/40 dark:text-sky-300">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">Rapide AI</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{sending ? 'Thinking...' : 'Ready'}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          title="Close"
          aria-label="Close Rapide AI"
          className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white dark:focus:ring-sky-900"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4 dark:bg-slate-900">
        {messages.map((message, index) => {
          const isUser = message.role === 'user'
          return (
            <div key={`${message.role}-${index}`} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[82%] rounded-lg px-3 py-2 text-sm leading-6 shadow-sm ${
                  isUser
                    ? 'bg-bosch-blue text-white'
                    : 'border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
              </div>
            </div>
          )
        })}
        {sending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Thinking</span>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={sendMessage} className="flex-shrink-0 border-t border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
        {error && <div className="mb-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">{error}</div>}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            maxLength={2000}
            placeholder="Ask Rapide AI"
            className="max-h-28 min-h-[42px] flex-1 resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-bosch-blue focus:ring-2 focus:ring-sky-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-sky-900"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            title="Send"
            aria-label="Send message"
            className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-md bg-bosch-blue text-white transition hover:bg-sky-600 focus:outline-none focus:ring-4 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:focus:ring-sky-900 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </div>
      </form>
    </section>
  )
}
