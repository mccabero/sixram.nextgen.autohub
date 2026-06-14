// @ts-nocheck
import React from 'react'
import { openIncentivesSAReportPdf } from '../../services/operationService'
import OpenDateRangePdfReport from './OpenDateRangePdfReport'

export default function IncentivesSA() {
  return (
    <OpenDateRangePdfReport
      title="Incentives Service Advisor"
      launchKey="incentives-sa"
      openPdf={openIncentivesSAReportPdf}
    />
  )
}
