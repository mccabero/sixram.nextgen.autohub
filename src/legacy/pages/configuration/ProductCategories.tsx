// @ts-nocheck
import React, { useEffect, useState } from 'react'
import PageLayout from '../../components/layout/PageLayout'
import ProductCategoriesTable from '../../components/tables/ProductCategoriesTable'
import { getProductCategories } from '../../services/configService'

export default function ProductCategories(){
  const [items, setItems] = useState<any[]>([])
  useEffect(()=>{
    let mounted = true
    getProductCategories().then((d:any)=>{ if (mounted && Array.isArray(d)) setItems(d) }).catch(()=>{})
    return ()=>{ mounted = false }
  },[])

  return (
    <div>
      <div className="mt-4">
        <ProductCategoriesTable items={items} />
      </div>
    </div>
  )
}
