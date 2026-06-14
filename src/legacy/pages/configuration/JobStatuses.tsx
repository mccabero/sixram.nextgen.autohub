// @ts-nocheck
import React, { useEffect, useState } from 'react'
import PageLayout from '../../components/layout/PageLayout'
import JobStatusesTable from '../../components/tables/JobStatusesTable'
import { getJobStatuses } from '../../services/configService'

export default function JobStatuses(){
  const [items, setItems] = useState<any[]>([])
  useEffect(()=>{
    let mounted = true
    getJobStatuses().then((d:any)=>{ if (mounted && Array.isArray(d)) setItems(d) }).catch(()=>{})
    return ()=>{ mounted = false }
  },[])

  return (
    <div>
      <div className="mt-4">
        <JobStatusesTable items={items} />
      </div>
    </div>
  )
}
