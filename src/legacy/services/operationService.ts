// @ts-nocheck
async function sendJson(path: string, method: string, body?: Record<string, unknown>) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text().catch(() => '')
  if (!res.ok) {
    let message = text.trim()
    if (message) {
      try {
        const parsed = JSON.parse(message)
        if (typeof parsed === 'string' && parsed.trim()) message = parsed.trim()
        else if (parsed && typeof parsed === 'object') message = String((parsed as any).message ?? (parsed as any).Message ?? message)
      } catch {
        // keep the raw text when the response is not JSON
      }
    }
    throw new Error(message || `HTTP ${res.status}`)
  }
  if (!text) return null
  try { return JSON.parse(text) } catch { return text }
}

export const saveInspection = (body: Record<string, unknown>) =>
  sendJson('/api/operations/inspections', 'POST', body)

export const updateInspection = (id: string, body: Record<string, unknown>) =>
  sendJson(`/api/operations/inspections/${id}`, 'PUT', body)

export const getInspectionById = (id: string) =>
  sendJson(`/api/operations/inspections/${id}`, 'GET')

export const getNextInspectionReferenceNo = () =>
  sendJson('/api/operations/inspections/next-reference', 'GET')

export const deleteInspection = (id: string | number) =>
  sendJson(`/api/operations/inspections/${id}`, 'DELETE')

export const voidOperationRecord = (type: string, id: string | number, code: string) =>
  sendJson(`/api/operations/${encodeURIComponent(type)}/${id}/void`, 'POST', { code })

export const unlockJobOrderEditing = (id: string | number, code: string) =>
  sendJson(`/api/operations/joborders/${id}/unlock-editing`, 'POST', { code })

export const getInspectionsSummary = () =>
  sendJson('/api/operations/inspections/summary', 'GET')

export const getInspectionChecklistTemplate = () =>
  sendJson('/api/operations/inspections/checklist-template', 'GET')

async function openPdfInNewTab(path: string, loadingTitle: string, loadingMessage: string): Promise<void> {
  const target = window.open('', '_blank')
  if (!target) throw new Error('Popup blocked. Please allow popups to open the PDF report.')

  try {
    target.document.title = loadingTitle
    target.document.body.innerHTML = `<p style="font-family:Arial,sans-serif;padding:16px">${loadingMessage}</p>`

    const res = await fetch(path, {
      headers: {
        ...authHeaders(),
        Accept: 'application/pdf,text/html'
      }
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}${text ? ` - ${text}` : ''}`)
    }

    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('text/html')) {
      const html = await res.text()
      target.document.open()
      target.document.write(html)
      target.document.close()
      return
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(new Blob([blob], { type: contentType || 'application/pdf' }))
    target.location.href = url
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (error) {
    target.close()
    throw error
  }
}

export async function openInspectionFormPdf(id: string | number): Promise<void> {
  await openPdfInNewTab(
    `/api/operations/inspections/${id}/print`,
    'Loading inspection form...',
    'Generating inspection form...'
  )
}

export const getNextEstimateReferenceNo = () =>
  sendJson('/api/operations/estimates/next-reference', 'GET')

export const getNextJobOrderReferenceNo = () =>
  sendJson('/api/operations/joborders/next-reference', 'GET')

export const getNextInvoiceNo = () =>
  sendJson('/api/operations/invoices/next-reference', 'GET')

export const getNextPaymentReferenceNo = () =>
  sendJson('/api/operations/payments/next-reference', 'GET')

export const getNextQuickSaleReferenceNo = () =>
  sendJson('/api/operations/quicksales/next-reference', 'GET')

export const getNextExpenseReferenceNo = () =>
  sendJson('/api/operations/expenses/next-reference', 'GET')

export const getCameraEvents = (params?: { take?: number; eventType?: string; eventState?: string; start?: string; end?: string; capturedStart?: string; capturedEnd?: string }) => {
  const query = new URLSearchParams()
  if (params?.take) query.set('take', String(params.take))
  if (params?.eventType) query.set('eventType', params.eventType)
  if (params?.eventState) query.set('eventState', params.eventState)
  if (params?.start) query.set('start', params.start)
  if (params?.end) query.set('end', params.end)
  if (params?.capturedStart) query.set('capturedStart', params.capturedStart)
  if (params?.capturedEnd) query.set('capturedEnd', params.capturedEnd)
  const suffix = query.toString() ? `?${query}` : ''
  return sendJson(`/api/camera/hikvision/events${suffix}`, 'GET')
}

export const getCameraEventSummary = (params?: { eventType?: string; eventState?: string; start?: string; end?: string; capturedStart?: string; capturedEnd?: string }) => {
  const query = new URLSearchParams()
  if (params?.eventType) query.set('eventType', params.eventType)
  if (params?.eventState) query.set('eventState', params.eventState)
  if (params?.start) query.set('start', params.start)
  if (params?.end) query.set('end', params.end)
  if (params?.capturedStart) query.set('capturedStart', params.capturedStart)
  if (params?.capturedEnd) query.set('capturedEnd', params.capturedEnd)
  const suffix = query.toString() ? `?${query}` : ''
  return sendJson(`/api/camera/hikvision/summary${suffix}`, 'GET')
}

export const clearCameraEvents = () =>
  sendJson('/api/camera/hikvision/events', 'DELETE')

export const getInvoicesSummary = () =>
  sendJson('/api/operations/invoices/summary', 'GET')

export const getPaymentsSummary = () =>
  sendJson('/api/operations/payments/summary', 'GET')

export const getAccountsReceivableSummary = (start?: string, end?: string) => {
  const params = new URLSearchParams()
  if (start) params.set('start', start)
  if (end) params.set('end', end)
  const query = params.toString()
  return sendJson(`/api/operations/accounts-receivable/summary${query ? `?${query}` : ''}`, 'GET')
}

export const getDailySalesReport = (start: string, end: string) =>
  sendJson(`/api/operations/reports/daily-sales?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, 'GET')

export async function openDailySalesReportPdf(start: string, end: string): Promise<void> {
  await openPdfInNewTab(
    `/api/operations/reports/daily-sales/print?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    'Loading daily sales report...',
    'Generating daily sales report...'
  )
}

export async function openMonthlySalesSummaryPdf(start: string, end: string): Promise<void> {
  await openPdfInNewTab(
    `/api/operations/reports/monthly-sales-summary/print?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    'Loading monthly sales summary...',
    'Generating monthly sales summary...'
  )
}

export async function openCreditCardPaymentReportPdf(start: string, end: string): Promise<void> {
  await openPdfInNewTab(
    `/api/operations/reports/credit-card-payment/print?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    'Loading credit card payment report...',
    'Generating credit card payment report...'
  )
}

export async function openAccountsReceivableDailyReportPdf(start: string, end: string): Promise<void> {
  await openPdfInNewTab(
    `/api/operations/reports/accounts-receivable-daily/print?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    'Loading accounts receivable daily report...',
    'Generating accounts receivable daily report...'
  )
}

export async function openAccountsReceivableMonthlyReportPdf(start: string, end: string): Promise<void> {
  await openPdfInNewTab(
    `/api/operations/reports/accounts-receivable-monthly/print?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    'Loading accounts receivable monthly report...',
    'Generating accounts receivable monthly report...'
  )
}

export async function openPaymentTypeReportPdf(paymentTypeId: string | number, start: string, end: string, paymentTypeName?: string): Promise<void> {
  const params = new URLSearchParams({
    paymentTypeId: String(paymentTypeId),
    start,
    end,
  })
  const label = paymentTypeName?.trim() || 'payment type'
  await openPdfInNewTab(
    `/api/operations/reports/payment-type/print?${params.toString()}`,
    `Loading ${label} payment report...`,
    `Generating ${label} payment report...`
  )
}

export async function openPettyCashVoucherReportPdf(start: string, end: string): Promise<void> {
  await openPdfInNewTab(
    `/api/operations/reports/petty-cash-voucher/print?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    'Loading petty cash voucher report...',
    'Generating petty cash voucher report...'
  )
}

export async function openCommissionsSAReportPdf(start: string, end: string): Promise<void> {
  await openPdfInNewTab(
    `/api/operations/reports/commissions-sa/print?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    'Loading commissions SA report...',
    'Generating commissions SA report...'
  )
}

export async function openCommissionsTechReportPdf(start: string, end: string): Promise<void> {
  await openPdfInNewTab(
    `/api/operations/reports/commissions-tech/print?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    'Loading commissions technician report...',
    'Generating commissions technician report...'
  )
}

export async function openIncentivesSAReportPdf(start: string, end: string): Promise<void> {
  await openPdfInNewTab(
    `/api/operations/reports/incentives-sa/print?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    'Loading incentives SA report...',
    'Generating incentives SA report...'
  )
}

export async function openIncentivesTechReportPdf(start: string, end: string): Promise<void> {
  await openPdfInNewTab(
    `/api/operations/reports/incentives-tech/print?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    'Loading incentives technician report...',
    'Generating incentives technician report...'
  )
}

export const deleteInvoice = (id: string | number) =>
  sendJson(`/api/operations/invoices/${id}`, 'DELETE')

export const saveEstimate = (body: Record<string, unknown>) =>
  sendJson('/api/operations/estimates', 'POST', body)

export const updateEstimate = (id: string, body: Record<string, unknown>) =>
  sendJson(`/api/operations/estimates/${id}`, 'PUT', body)

export const deleteEstimate = (id: string | number) =>
  sendJson(`/api/operations/estimates/${id}`, 'DELETE')

export const getEstimateById = (id: string) =>
  sendJson(`/api/operations/estimates/${id}`, 'GET')

export const getEstimatesSummary = () =>
  sendJson('/api/operations/estimates/summary', 'GET')

export async function openEstimateFormPdf(id: string | number): Promise<void> {
  await openPdfInNewTab(
    `/api/operations/estimates/${id}/print`,
    'Loading estimate form...',
    'Generating estimate form...'
  )
}

export async function openJobOrderFormPdf(id: string | number): Promise<void> {
  await openPdfInNewTab(
    `/api/operations/joborders/${id}/print`,
    'Loading job order form...',
    'Generating job order form...'
  )
}

export async function openInvoiceReportPdf(id: string | number): Promise<void> {
  await openPdfInNewTab(
    `/api/operations/invoices/${id}/print`,
    'Loading invoice report...',
    'Generating invoice report...'
  )
}

export async function openPaymentReceiptPdf(id: string | number): Promise<void> {
  await openPdfInNewTab(
    `/api/operations/payments/${id}/receipt`,
    'Loading payment receipt...',
    'Generating payment receipt...'
  )
}

export async function openPaymentGatePassPdf(id: string | number): Promise<void> {
  await openPdfInNewTab(
    `/api/operations/payments/${id}/gate-pass`,
    'Loading gate pass...',
    'Generating gate pass...'
  )
}

export const saveJobOrder = (body: Record<string, unknown>) =>
  sendJson('/api/operations/joborders', 'POST', body)

export const completeJobOrder = (id: string | number, body?: Record<string, unknown>) =>
  sendJson(`/api/operations/joborders/${id}/complete`, 'POST', body)

export const deleteJobOrder = (id: string | number) =>
  sendJson(`/api/operations/joborders/${id}`, 'DELETE')

export const getJobOrdersSummary = () =>
  sendJson('/api/operations/joborders/summary', 'GET')

export const getJobOrdersByServiceId = (serviceId: string | number) =>
  sendJson(`/api/operations/joborders/by-service/${serviceId}`, 'GET')

export const getJobOrdersByProductId = (productId: string | number) =>
  sendJson(`/api/operations/joborders/by-product/${productId}`, 'GET')

export const getJobOrderById = (id: string | number) =>
  sendJson(`/api/operations/joborders/${id}`, 'GET')

export const getInvoiceById = (id: string) =>
  sendJson(`/api/operations/invoices/${id}`, 'GET')

export const proceedInvoiceToPayment = (id: string | number, body: Record<string, unknown>) =>
  sendJson(`/api/operations/invoices/${id}/proceed-to-payment`, 'POST', body)

export const getPaymentById = (id: string | number) =>
  sendJson(`/api/operations/payments/${id}`, 'GET')

export const deletePayment = (id: string | number) =>
  sendJson(`/api/operations/payments/${id}`, 'DELETE')

export const savePayment = (body: Record<string, unknown>) =>
  sendJson('/api/operations/payments', 'POST', body)

export const updatePayment = (id: string | number, body: Record<string, unknown>) =>
  sendJson(`/api/operations/payments/${id}`, 'PUT', body)

export const saveExpense = (body: Record<string, unknown>) =>
  sendJson('/api/operations/expenses', 'POST', body)

export const updateExpense = (id: string, body: Record<string, unknown>) =>
  sendJson(`/api/operations/expenses/${id}`, 'PUT', body)

export const getExpenseById = (id: string) =>
  sendJson(`/api/operations/expenses/${id}`, 'GET')

export const deleteExpense = (id: string | number) =>
  sendJson(`/api/operations/expenses/${id}`, 'DELETE')

export const saveQuickSale = (body: Record<string, unknown>) =>
  sendJson('/api/operations/quicksales', 'POST', body)

export const updateQuickSale = (id: string, body: Record<string, unknown>) =>
  sendJson(`/api/operations/quicksales/${id}`, 'PUT', body)

export const getQuickSaleById = (id: string) =>
  sendJson(`/api/operations/quicksales/${id}`, 'GET')

export const deleteQuickSale = (id: string | number) =>
  sendJson(`/api/operations/quicksales/${id}`, 'DELETE')

export const saveDeposit = (body: Record<string, unknown>) =>
  sendJson('/api/operations/deposits', 'POST', body)

export const updateDeposit = (id: string, body: Record<string, unknown>) =>
  sendJson(`/api/operations/deposits/${id}`, 'PUT', body)

export const deleteDeposit = (id: string | number) =>
  sendJson(`/api/operations/deposits/${id}`, 'DELETE')

export const getPettyCash = () =>
  sendJson('/api/operations/pettycashvouchers', 'GET')

export const getPettyCashById = (id: string) =>
  sendJson(`/api/operations/pettycashvouchers/${id}`, 'GET')

export const savePettyCash = (body: Record<string, unknown>) =>
  sendJson('/api/operations/pettycashvouchers', 'POST', body)

export const updatePettyCash = (id: string, body: Record<string, unknown>) =>
  sendJson(`/api/operations/pettycashvouchers/${id}`, 'PUT', body)

export const deletePettyCash = (id: string) =>
  sendJson(`/api/operations/pettycashvouchers/${id}`, 'DELETE')

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function uploadInspectionPhoto(id: string | number, file: File): Promise<{ filename: string; url: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`/api/operations/inspections/${id}/photos`, { method: 'POST', headers: authHeaders(), body: formData })
  const text = await res.text().catch(() => '')
  if (!res.ok) throw new Error(`HTTP ${res.status}${text ? ` - ${text}` : ''}`)
  return JSON.parse(text)
}

export async function fetchInspectionPhotos(id: string | number): Promise<Array<{ filename: string; url: string }>> {
  const res = await fetch(`/api/operations/inspections/${id}/photos`, { headers: authHeaders() })
  if (!res.ok) return []
  const data = await res.json().catch(() => [])
  return Array.isArray(data) ? data : []
}

export async function deleteInspectionPhoto(id: string | number, filename: string): Promise<void> {
  const res = await fetch(`/api/operations/inspections/${id}/photos/${encodeURIComponent(filename)}`, { method: 'DELETE', headers: authHeaders() })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}${text ? ` - ${text}` : ''}`)
  }
}
