// @ts-nocheck
import React, { useEffect, useState } from 'react'
import PageLayout from '../../components/layout/PageLayout'
import VehicleModelsTable from '../../components/tables/VehicleModelsTable'
import { getVehicleModels } from '../../services/configService'

export default function VehicleModels(){
  const [items, setItems] = useState<any[]>([])
  useEffect(()=>{
    let mounted = true
    getVehicleModels().then((d:any)=>{ if (mounted && Array.isArray(d)) setItems(d) }).catch(()=>{})
    return ()=>{ mounted = false }
  },[])

  return (
    <div>
      <div className="mt-4">
        <VehicleModelsTable items={items} />
      </div>
    </div>
  )
}
