// @ts-nocheck
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../contexts/toast'
import { forgotPin } from '../services/authService'
import MaskedPinInput, { createEmptyPinDigits } from '../components/ui/MaskedPinInput'

type PinBoxesProps = {
  label: string
  value: string[]
  disabled: boolean
  onChange: (digits: string[]) => void
}

function PinBoxes({ label, value, disabled, onChange }: PinBoxesProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <MaskedPinInput
        value={value}
        onChange={onChange}
        disabled={disabled}
        ariaLabelPrefix={`${label} digit`}
        className="mt-2 grid grid-cols-6 gap-2"
      />
    </div>
  )
}

export default function ForgotPin() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [newPinDigits, setNewPinDigits] = useState<string[]>(createEmptyPinDigits)
  const [confirmPinDigits, setConfirmPinDigits] = useState<string[]>(createEmptyPinDigits)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const cleanUsername = username.trim()
    const newPin = newPinDigits.join('')
    const confirmPin = confirmPinDigits.join('')

    if (!cleanUsername) { showToast('Please enter your username', 'error'); return }
    if (!password) { showToast('Please enter your password', 'error'); return }
    if (!/^\d{6}$/.test(newPin)) { showToast('PIN must be exactly 6 numbers', 'error'); return }
    if (newPin !== confirmPin) { showToast('PIN and Confirm PIN do not match', 'error'); return }

    setLoading(true)
    try {
      await forgotPin({
        username: cleanUsername,
        password,
        newPin,
        confirmPin,
      })
      showToast('PIN updated successfully', 'success')
      setPassword('')
      setNewPinDigits(createEmptyPinDigits())
      setConfirmPinDigits(createEmptyPinDigits())
      navigate('/login')
    } catch (error: any) {
      showToast(error?.message || 'Failed to update PIN', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <div className="mb-6">
          <div className="text-2xl font-semibold text-slate-800">Reset PIN</div>
          <div className="text-sm text-slate-500">Confirm your account and choose a new PIN.</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div>
            <label className="text-sm font-medium text-slate-700">Username</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              disabled={loading}
              autoComplete="off"
              data-form-type="other"
              data-lpignore="true"
              data-1p-ignore="true"
              data-bwignore="true"
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-bosch-blue focus:ring-2 focus:ring-bosch-blue/15"
              placeholder="Username or email"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Password</label>
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
              type="password"
              autoComplete="new-password"
              data-form-type="other"
              data-lpignore="true"
              data-1p-ignore="true"
              data-bwignore="true"
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-bosch-blue focus:ring-2 focus:ring-bosch-blue/15"
              placeholder="Password"
            />
          </div>

          <PinBoxes label="New PIN" value={newPinDigits} disabled={loading} onChange={setNewPinDigits} />
          <PinBoxes label="Confirm PIN" value={confirmPinDigits} disabled={loading} onChange={setConfirmPinDigits} />

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-bosch-blue py-2.5 text-sm font-semibold text-white shadow-md shadow-bosch-blue/20 transition hover:bg-sky-500 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save PIN'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => navigate('/login')}
            disabled={loading}
            className="w-full text-center text-xs text-bosch-blue transition hover:text-sky-500 disabled:opacity-60"
          >
            Back to sign in
          </button>
        </form>
      </div>
    </div>
  )
}
