// @ts-nocheck
import React, { useEffect, useState } from 'react'
import PageLayout from '../../components/layout/PageLayout'
import ParameterGroupsTable from '../../components/tables/ParameterGroupsTable'
import { getParameterGroups } from '../../services/configService'

export default function ParameterGroups(){
  const [items, setItems] = useState<any[]>([])
  useEffect(()=>{
    let mounted = true
    getParameterGroups().then((d:any)=>{ if (mounted && Array.isArray(d)) setItems(d) }).catch(()=>{})
    return ()=>{ mounted = false }
  },[])

  return (
    <div>
      <div className="mt-4">
        <ParameterGroupsTable items={items} />
      </div>
    </div>
  )
}
