// @ts-nocheck
import React, { useEffect, useState } from 'react'
import PageLayout from '../../components/layout/PageLayout'
import ServiceCategoriesTable from '../../components/tables/ServiceCategoriesTable'
import { getServiceCategories } from '../../services/configService'

export default function ServiceCategories(){
  const [items, setItems] = useState<any[]>([])
  useEffect(()=>{
    let mounted = true
    getServiceCategories().then((d:any)=>{ if (mounted && Array.isArray(d)) setItems(d) }).catch(()=>{})
    return ()=>{ mounted = false }
  },[])

  return (
    <div>
      <div className="mt-4">
        <ServiceCategoriesTable items={items} fetchOnMount={false} />
      </div>
    </div>
  )
}
