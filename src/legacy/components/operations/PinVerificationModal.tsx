// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react'
import MaskedPinInput, { createEmptyPinDigits } from '../ui/MaskedPinInput'

type PinVerificationModalProps = {
  isOpen: boolean
  title?: string
  description?: string
  label?: string
  digitAriaLabelPrefix?: string
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  onConfirm: (pin: string) => void | Promise<void>
  onCancel: () => void
}

export default function PinVerificationModal({
  isOpen,
  title = 'PIN Verification Required',
  description = 'Enter an authorized user PIN to continue.',
  label = 'PIN',
  digitAriaLabelPrefix = 'PIN digit',
  confirmLabel = 'Verify',
  cancelLabel = 'Cancel',
  loading = false,
  onConfirm,
  onCancel,
}: PinVerificationModalProps) {
  const [pinDigits, setPinDigits] = useState<string[]>(createEmptyPinDigits)
  const lastAutoPinRef = useRef('')

  useEffect(() => {
    if (!isOpen) return
    setPinDigits(createEmptyPinDigits())
    lastAutoPinRef.current = ''
  }, [isOpen])

  useEffect(() => {
    const pin = pinDigits.join('')
    if (!isOpen || loading || !/^\d{6}$/.test(pin)) return
    if (lastAutoPinRef.current === pin) return
    lastAutoPinRef.current = pin
    void onConfirm(pin)
  }, [pinDigits, isOpen, loading, onConfirm])

  if (!isOpen) return null

  function updatePinDigits(next: string[]) {
    setPinDigits(next)
    if (!next.every(Boolean)) lastAutoPinRef.current = ''
  }

  function handleCancel() {
    if (loading) return
    onCancel()
  }

  function handleConfirm() {
    void onConfirm(pinDigits.join(''))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="pin-verification-title">
      <div className="absolute inset-0 bg-black/40" onClick={handleCancel} />
      <div className="relative z-10 w-full max-w-md rounded-xl bg-white shadow-xl overflow-hidden">
        <div className="bg-gray-100 px-4 py-3 border-b">
          <div id="pin-verification-title" className="text-sm font-semibold text-slate-700">{title}</div>
          {description && <div className="mt-1 text-xs text-slate-500">{description}</div>}
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 text-center">{label}</label>
            <MaskedPinInput
              value={pinDigits}
              onChange={updatePinDigits}
              disabled={loading}
              ariaLabelPrefix={digitAriaLabelPrefix}
              autoFocusFirst
              className="mt-2 grid grid-cols-6 gap-2"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t bg-slate-50 px-4 py-3">
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="px-4 py-2 rounded border bg-white text-slate-700 text-sm hover:bg-slate-50 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 rounded bg-bosch-blue text-white text-sm hover:opacity-90 disabled:opacity-70"
          >
            {loading ? 'Verifying...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
