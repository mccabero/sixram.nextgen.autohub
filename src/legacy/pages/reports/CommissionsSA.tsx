// @ts-nocheck
import React from 'react'
import { openCommissionsSAReportPdf } from '../../services/operationService'
import OpenDateRangePdfReport from './OpenDateRangePdfReport'

export default function CommissionsSA() {
  return (
    <OpenDateRangePdfReport
      title="Commissions Service Advisor"
      launchKey="commissions-sa"
      openPdf={openCommissionsSAReportPdf}
    />
  )
}
