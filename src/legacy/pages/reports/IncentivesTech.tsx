// @ts-nocheck
import React from 'react'
import { openIncentivesTechReportPdf } from '../../services/operationService'
import OpenDateRangePdfReport from './OpenDateRangePdfReport'

export default function IncentivesTech() {
  return (
    <OpenDateRangePdfReport
      title="Incentives Technician"
      launchKey="incentives-tech"
      openPdf={openIncentivesTechReportPdf}
    />
  )
}
