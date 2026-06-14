// @ts-nocheck
import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import BcsManageInspection from './BcsManageInspection'
import LegacyManageInspection from './LegacyManageInspection'
import { getInspectionById } from '../services/operationService'
import { BCS_INSPECTION_LAYOUT_KEY } from '../utils/bcsInspectionChecklist'

type InspectionFormVersion = 'loading' | 'legacy' | 'bcs'

function getSavedLayoutKey(inspection: any): string {
  const detailsRaw = inspection?.inspectionDetails ?? inspection?.InspectionDetails
  if (!detailsRaw) return ''

  try {
    const parsed = typeof detailsRaw === 'string' ? JSON.parse(detailsRaw) : detailsRaw
    const layoutKey =
      parsed?.layoutKey
      ?? parsed?.LayoutKey
      ?? parsed?.template?.layoutKey
      ?? parsed?.template?.LayoutKey
      ?? parsed?.Template?.layoutKey
      ?? parsed?.Template?.LayoutKey
    return String(layoutKey ?? '').trim()
  } catch {
    return ''
  }
}

export default function ManageInspection() {
  const params = useParams()
  const routeId = params.id
  const isAdd = !routeId || routeId === 'add'
  const [version, setVersion] = useState<InspectionFormVersion>(isAdd ? 'bcs' : 'loading')

  useEffect(() => {
    if (isAdd || !routeId) {
      setVersion('bcs')
      return
    }

    let mounted = true
    setVersion('loading')

    getInspectionById(routeId)
      .then(data => {
        if (!mounted) return
        setVersion(getSavedLayoutKey(data) === BCS_INSPECTION_LAYOUT_KEY ? 'bcs' : 'legacy')
      })
      .catch(() => {
        if (!mounted) return
        setVersion('legacy')
      })

    return () => { mounted = false }
  }, [isAdd, routeId])

  if (version === 'loading') {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
        Loading inspection form...
      </div>
    )
  }

  return version === 'bcs' ? <BcsManageInspection /> : <LegacyManageInspection />
}
