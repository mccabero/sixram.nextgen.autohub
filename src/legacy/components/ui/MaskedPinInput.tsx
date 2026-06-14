// @ts-nocheck
import React, { useEffect, useRef } from 'react'

const DEFAULT_PIN_LENGTH = 6
// The rendered value is never the real digit, which avoids mobile password reveal.
const PIN_MASK = '*'

export function createEmptyPinDigits(length = DEFAULT_PIN_LENGTH) {
  return Array(length).fill('') as string[]
}

type MaskedPinInputProps = {
  value: string[]
  onChange: (digits: string[]) => void
  ariaLabelPrefix: string
  disabled?: boolean
  autoFocusFirst?: boolean
  className?: string
  inputClassName?: string
}

const defaultInputClassName = `
  h-12 w-full rounded-lg border border-slate-200 bg-slate-50
  text-center text-lg font-semibold text-slate-800
  outline-none transition
  focus:border-bosch-blue focus:ring-2 focus:ring-bosch-blue/15
  disabled:opacity-60
`

export default function MaskedPinInput({
  value,
  onChange,
  ariaLabelPrefix,
  disabled = false,
  autoFocusFirst = false,
  className = 'grid grid-cols-6 gap-2',
  inputClassName = defaultInputClassName,
}: MaskedPinInputProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])
  const pinLength = value.length || DEFAULT_PIN_LENGTH

  useEffect(() => {
    if (!autoFocusFirst || disabled) return
    window.setTimeout(() => inputRefs.current[0]?.focus(), 0)
  }, [autoFocusFirst, disabled])

  function focusDigit(index: number) {
    window.setTimeout(() => inputRefs.current[index]?.focus(), 0)
  }

  function applyDigits(startIndex: number, rawValue: string, replaceAll = false) {
    const digits = rawValue.replace(/\D/g, '').split('')
    if (!digits.length) return

    const next = replaceAll ? createEmptyPinDigits(pinLength) : [...value]
    let cursor = Math.min(Math.max(startIndex, 0), pinLength - 1)

    for (const digit of digits) {
      if (cursor >= pinLength) break
      next[cursor] = digit
      cursor += 1
    }

    onChange(next)
    focusDigit(Math.min(cursor, pinLength - 1))
  }

  function clearDigit(index: number) {
    const next = [...value]

    if (next[index]) {
      next[index] = ''
      onChange(next)
      focusDigit(index)
      return
    }

    if (index > 0) focusDigit(index - 1)
  }

  function handleBeforeInput(index: number, e: React.FormEvent<HTMLInputElement>) {
    if (disabled) return

    const nativeEvent = e.nativeEvent as InputEvent
    const inputType = nativeEvent.inputType || ''

    if (inputType.startsWith('insert')) {
      e.preventDefault()
      applyDigits(index, nativeEvent.data || '')
      return
    }

    if (inputType === 'deleteContentBackward') {
      e.preventDefault()
      clearDigit(index)
    }
  }

  function handleChange(index: number, rawValue: string) {
    if (disabled) return

    if (!rawValue) {
      clearDigit(index)
      return
    }

    applyDigits(index, rawValue)
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return

    if (/^\d$/.test(e.key)) {
      e.preventDefault()
      applyDigits(index, e.key)
      return
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      return
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      clearDigit(index)
      return
    }

    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault()
      focusDigit(index - 1)
      return
    }

    if (e.key === 'ArrowRight' && index < pinLength - 1) {
      e.preventDefault()
      focusDigit(index + 1)
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    if (disabled) return

    e.preventDefault()
    applyDigits(0, e.clipboardData.getData('text'), true)
  }

  return (
    <div className={className}>
      {Array.from({ length: pinLength }).map((_, index) => (
        <input
          key={index}
          ref={el => { inputRefs.current[index] = el }}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value[index] ? PIN_MASK : ''}
          disabled={disabled}
          onBeforeInput={e => handleBeforeInput(index, e)}
          onChange={e => handleChange(index, e.target.value)}
          onKeyDown={e => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={e => e.currentTarget.select()}
          autoComplete="off"
          autoFocus={autoFocusFirst && index === 0}
          data-form-type="other"
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
          aria-label={`${ariaLabelPrefix} ${index + 1}`}
          className={inputClassName}
        />
      ))}
    </div>
  )
}
