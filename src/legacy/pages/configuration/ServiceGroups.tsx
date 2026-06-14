// @ts-nocheck
import React, { useEffect, useState } from 'react'
import PageLayout from '../../components/layout/PageLayout'
import ServiceGroupsTable from '../../components/tables/ServiceGroupsTable'
import { getServiceGroups } from '../../services/configService'

export default function ServiceGroups(){
  const [items, setItems] = useState<any[]>([])
  useEffect(()=>{
    let mounted = true
    getServiceGroups().then((d:any)=>{ if (mounted && Array.isArray(d)) setItems(d) }).catch(()=>{})
    return ()=>{ mounted = false }
  },[])

  return (
    <div>
      <div className="mt-4">
        <ServiceGroupsTable items={items} />
      </div>
    </div>
  )
}
