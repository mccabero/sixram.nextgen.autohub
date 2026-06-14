// @ts-nocheck
import React, { useEffect, useState } from 'react'
import PageLayout from '../../components/layout/PageLayout'
import ParametersTable from '../../components/tables/ParametersTable'
import { getParameters } from '../../services/configService'

export default function Parameters(){
  const [items, setItems] = useState<any[]>([])
  useEffect(()=>{
    let mounted = true
    getParameters().then((d:any)=>{ if (mounted && Array.isArray(d)) setItems(d) }).catch(()=>{})
    return ()=>{ mounted = false }
  },[])

  return (
    <div>
      <div className="mt-4">
        <ParametersTable items={items} />
      </div>
    </div>
  )
}
