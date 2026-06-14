// @ts-nocheck
import React, { useEffect, useState } from 'react'
import PageLayout from '../../components/layout/PageLayout'
import ProductGroupsTable from '../../components/tables/ProductGroupsTable'
import { getProductGroups } from '../../services/configService'

export default function ProductGroups(){
  const [items, setItems] = useState<any[]>([])
  useEffect(()=>{
    let mounted = true
    getProductGroups().then((d:any)=>{ if (mounted && Array.isArray(d)) setItems(d) }).catch(()=>{})
    return ()=>{ mounted = false }
  },[])

  return (
    <div>
      <div className="mt-4">
        <ProductGroupsTable items={items} />
      </div>
    </div>
  )
}
