// @ts-nocheck
import React, { useCallback, useEffect, useState } from 'react'
import PettyCashTable, { PettyCashRow } from '../../components/tables/PettyCashTable'
import { getPettyCash } from '../../services/operationService'
import { useToast } from '../../contexts/toast'

function mapRow(r: any): PettyCashRow {
  return {
    id: Number(r.id ?? r.Id ?? 0),
    isChangan: !!(r.isChangan ?? r.IsChangan),
    pcNo: r.pcNo ?? r.PCNo ?? '',
    transactionDateTime: r.transactionDateTime ?? r.TransactionDateTime ?? '',
    payTo: r.payTo ?? r.PayTo ?? '',
    particulars: r.particulars ?? r.Particulars ?? '',
    cashIn: Number(r.cashIn ?? r.CashIn ?? 0),
    cashOut: Number(r.cashOut ?? r.CashOut ?? 0),
    balance: Number(r.balance ?? r.Balance ?? 0),
    status: r.status ?? r.Status ?? r.jobStatus?.name ?? r.JobStatus?.Name ?? 'OPEN',
  }
}

export default function PettyCash() {
  const { showToast } = useToast()
  const [rows, setRows] = useState<PettyCashRow[]>([])

  const load = useCallback(async () => {
    try {
      const data: any = await getPettyCash()
      const list = Array.isArray(data) ? data : []
      const mapped = list.map(mapRow).sort((a, b) => {
        const ad = new Date(a.transactionDateTime).getTime()
        const bd = new Date(b.transactionDateTime).getTime()
        if (ad !== bd) return bd - ad
        return b.id - a.id
      })
      setRows(mapped)
    } catch (e: any) {
      showToast(e?.message || 'Failed to load petty cash records', 'error')
    }
  }, [showToast])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6 w-full">
      <PettyCashTable items={rows} onChanged={load} />
    </div>
  )
}
