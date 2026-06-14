// @ts-nocheck
import React from 'react'
import CompanyInfoTable from '../../components/tables/CompanyInfoTable'

export default function CompanyInformation(){
  return (
    <div>
      <h1 className="text-2xl font-semibold">Company Information</h1>
      <div className="mt-4">
        <CompanyInfoTable />
      </div>
    </div>
  )
}
