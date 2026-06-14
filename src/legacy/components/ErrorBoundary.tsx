// @ts-nocheck
import React from 'react'
import { isChunkLoadError, requestChunkLoadRecovery } from '../utils/chunkLoadRecovery'

type State = { hasError: boolean, error?: Error }

export default class ErrorBoundary extends React.Component<{children: React.ReactNode}, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: any) {
    console.error('ErrorBoundary caught:', error, info)
    requestChunkLoadRecovery(error)
  }

  render() {
    if (this.state.hasError) {
      const chunkLoadError = isChunkLoadError(this.state.error)

      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
          <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold">{chunkLoadError ? 'Refreshing the app' : 'Something went wrong'}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {chunkLoadError
                ? 'A newer app version is available. Refresh this page to load the latest files.'
                : 'The app hit an unexpected error. Refreshing the page may resolve it.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Refresh page
            </button>
            {!chunkLoadError && (
              <pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-slate-100 p-3 text-xs text-red-700 dark:bg-slate-950 dark:text-red-300">
                {String(this.state.error)}
              </pre>
            )}
          </div>
        </div>
      )
    }
    return this.props.children as any
  }
}
