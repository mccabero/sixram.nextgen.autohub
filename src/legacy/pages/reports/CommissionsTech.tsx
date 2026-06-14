// @ts-nocheck
import React from 'react'
import { openCommissionsTechReportPdf } from '../../services/operationService'
import OpenDateRangePdfReport from './OpenDateRangePdfReport'

export default function CommissionsTech() {
  return (
    <OpenDateRangePdfReport
      title="Commissions Technician"
      launchKey="commissions-tech"
      openPdf={openCommissionsTechReportPdf}
    />
  )
}
