// @ts-nocheck
import React, { useEffect, useState } from 'react'
import PageLayout from '../../components/layout/PageLayout'
import UnitOfMeasuresTable from '../../components/tables/UnitOfMeasuresTable'
import { getUnitOfMeasures } from '../../services/configService'

export default function UnitOfMeasures(){
  const [items, setItems] = useState<any[]>([])
  useEffect(()=>{
    let mounted = true
    getUnitOfMeasures().then((d:any)=>{ if (mounted && Array.isArray(d)) setItems(d) }).catch(()=>{})
    return ()=>{ mounted = false }
  },[])

  return (
    <div>
      <div className="mt-4">
        <UnitOfMeasuresTable items={items} />
      </div>
    </div>
  )
}
