// @ts-nocheck
import React from 'react'

export default function ConfirmModal({
  isOpen,
  title = 'Confirm',
  message,
  confirmLabel = 'Proceed',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  loading = false,
}: {
  isOpen: boolean,
  title?: string,
  message?: string,
  confirmLabel?: string,
  cancelLabel?: string,
  onConfirm?: ()=>void | Promise<void>,
  onCancel?: ()=>void,
  loading?: boolean,
}){
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-slate-800 rounded shadow-lg w-full max-w-md p-6">
        <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100">{title}</h3>
        {message && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{message}</p>}
        <div className="mt-4 flex items-center justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 border rounded">{cancelLabel}</button>
          <button onClick={onConfirm} disabled={loading} className="px-4 py-2 bg-bosch-blue text-white rounded">
            {loading ? confirmLabel + '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
