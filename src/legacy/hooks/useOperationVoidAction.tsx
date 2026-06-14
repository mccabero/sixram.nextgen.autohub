// @ts-nocheck
import React, { useCallback, useState } from 'react'
import PinVerificationModal from '../components/operations/PinVerificationModal'
import type { RowActionDef } from '../components/lists'
import { useToast } from '../contexts/toast'
import { voidOperationRecord } from '../services/operationService'
import { canVoidStatus } from '../utils/statusRules'

type VoidableRow = {
  id: number
  status?: string | null
}

type UseOperationVoidActionOptions<T extends VoidableRow> = {
  operationType: string
  setRows: React.Dispatch<React.SetStateAction<T[]>>
  setLoading?: React.Dispatch<React.SetStateAction<boolean>>
  onVoided?: () => void
}

export function useOperationVoidAction<T extends VoidableRow>({
  operationType,
  setRows,
  setLoading,
  onVoided,
}: UseOperationVoidActionOptions<T>) {
  const { showToast } = useToast()
  const [showVoidConfirm, setShowVoidConfirm] = useState(false)
  const [voidTargetId, setVoidTargetId] = useState<number | null>(null)
  const [isVoiding, setIsVoiding] = useState(false)

  function requestVoid(row: T) {
    if (!canVoidStatus(row.status)) {
      showToast('This transaction is already closed for voiding.', 'error')
      return
    }

    setVoidTargetId(row.id)
    setShowVoidConfirm(true)
  }

  const confirmVoid = useCallback(async (code: string) => {
    if (voidTargetId == null) return
    if (!/^\d{6}$/.test(code)) {
      showToast('Please enter a 6-digit code', 'error')
      return
    }

    setIsVoiding(true)
    setLoading?.(true)
    try {
      await voidOperationRecord(operationType, voidTargetId, code)
      setRows(current => current.map(row => row.id === voidTargetId ? ({ ...row, status: 'VOID' } as T) : row))
      showToast('Transaction marked as VOID', 'success')
      onVoided?.()
      setShowVoidConfirm(false)
      setVoidTargetId(null)
    } catch (error: any) {
      showToast('Void failed: ' + (error?.message || 'Unknown'), 'error')
    } finally {
      setIsVoiding(false)
      setLoading?.(false)
    }
  }, [operationType, voidTargetId, setRows, setLoading, onVoided, showToast])

  function getVoidAction(row: T): RowActionDef {
    return {
      kind: 'void',
      onClick: () => requestVoid(row),
      label: `void-${row.id}`,
      disabled: !canVoidStatus(row.status),
    }
  }

  const voidConfirmModal = (
    <PinVerificationModal
      isOpen={showVoidConfirm}
      title="Void Code Required"
      description="Enter a valid one-time 6-digit void code to mark this transaction as VOID. The code expires automatically and cannot be reused."
      label="Void Code"
      digitAriaLabelPrefix="Code digit"
      confirmLabel="Void Transaction"
      cancelLabel="Cancel"
      onConfirm={confirmVoid}
      onCancel={() => { setShowVoidConfirm(false); setVoidTargetId(null) }}
      loading={isVoiding}
    />
  )

  return { getVoidAction, voidConfirmModal }
}
