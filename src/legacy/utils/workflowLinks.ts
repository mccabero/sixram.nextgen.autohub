// @ts-nocheck
export type WorkflowRecord = Record<string, any>

export function workflowKey(value: unknown): string {
  if (value == null) return ''
  const key = String(value).trim()
  return key && key !== '0' ? key : ''
}

export function pickWorkflowValue(record: WorkflowRecord | null | undefined, keys: string[]): unknown {
  if (!record) return undefined
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && String(record[key]).trim() !== '') {
      return record[key]
    }
  }
  return undefined
}

export function pickWorkflowId(record: WorkflowRecord | null | undefined): string {
  return workflowKey(pickWorkflowValue(record, ['id', 'Id', 'ID']))
}

export function pickWorkflowReference(record: WorkflowRecord | null | undefined): string {
  return String(pickWorkflowValue(record, [
    'referenceNo',
    'ReferenceNo',
    'invoiceNo',
    'InvoiceNo',
    'jobOrderNo',
    'JobOrderNo',
    'paymentNo',
    'PaymentNo',
  ]) ?? '').trim()
}

export function findLinkedWorkflowRecord(
  records: WorkflowRecord[] | null | undefined,
  sourceId: unknown,
  linkKeys: string[],
): WorkflowRecord | null {
  const sourceKey = workflowKey(sourceId)
  if (!sourceKey || !Array.isArray(records)) return null
  return records.find(record =>
    linkKeys.some(key => workflowKey(record?.[key]) === sourceKey)
  ) ?? null
}

export function findPaymentLinkedToInvoice(
  records: WorkflowRecord[] | null | undefined,
  invoiceId: unknown,
): WorkflowRecord | null {
  const invoiceKey = workflowKey(invoiceId)
  if (!invoiceKey || !Array.isArray(records)) return null

  return records.find(record => {
    const details = record?.paymentDetails ?? record?.PaymentDetails
    if (!Array.isArray(details)) return false
    return details.some((detail: WorkflowRecord) =>
      workflowKey(detail?.invoiceId ?? detail?.InvoiceId) === invoiceKey
    )
  }) ?? null
}
