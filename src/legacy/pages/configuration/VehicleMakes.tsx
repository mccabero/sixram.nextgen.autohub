// @ts-nocheck
import React, { useEffect, useState } from 'react'
import PageLayout from '../../components/layout/PageLayout'
import VehicleMakesTable from '../../components/tables/VehicleMakesTable'
import { getVehicleMakes } from '../../services/configService'

export default function VehicleMakes(){
  const [items, setItems] = useState<any[]>([])
  useEffect(()=>{
    let mounted = true
    getVehicleMakes().then((d:any)=>{ if (mounted && Array.isArray(d)) setItems(d) }).catch(()=>{})
    return ()=>{ mounted = false }
  },[])

  return (
    <div>
      <div className="mt-4">
        <VehicleMakesTable items={items} />
      </div>
    </div>
  )
}
