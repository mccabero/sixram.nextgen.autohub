// @ts-nocheck
import React, { useEffect, useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import configService from '../../services/configService'


export default function Breadcrumbs() {
  const loc = useLocation()
  const parts = loc.pathname.split('/').filter(Boolean)
  const [loadedNames, setLoadedNames] = useState<Record<string, string>>({})
  const LABELS: Record<string, string> = {
    dashboard: 'Dashboard',
    customers: 'Customers',
    customer: 'Customer',
    vehicles: 'Vehicles',
    operations: 'Operations',
    management: 'Management',
    reports: 'Reports',
    configuration: 'Configuration',
    administrators: 'Administrators',
  }

  function prettify(segment: string) {
    return segment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  function toTitleCase(s: string) {
    if (!s) return s
    return s.split(/\s+/).map(w => {
      if (!w) return ''
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    }).join(' ')
  }

  let acc = ''
  const SKIP_TOP_LEVEL = new Set(['operations', 'management', 'reports', 'configuration', 'administrators'])
  const crumbs: Array<{ path: string; label: string; isLast: boolean }> = []

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    acc += `/${p}`
    const isLast = i === parts.length - 1

    // If top-level is a section we want to hide (Operations, Management, etc.), skip adding it
    if (i === 0 && SKIP_TOP_LEVEL.has(p)) {
      // continue but keep acc so subsequent crumbs build correct paths
      continue
    }

    // Special-case customer routes: first segment should be 'Customers' and link to /customers
    if (i === 0 && (p === 'customers' || p === 'customer')) {
      crumbs.push({ path: '/customers', label: 'Customers', isLast })
      continue
    }

    // Special-case administrators/company: show Company Information link at second segment
    if (i === 1 && parts[0] === 'administrators' && p === 'company') {
      crumbs.push({ path: '/administrators/company-information', label: 'Company Information', isLast })
      continue
    }

    // When on /administrators/company/:id, show the raw id
    if (i === 2 && parts[0] === 'administrators' && parts[1] === 'company') {
      const id = p
      crumbs.push({ path: acc, label: id, isLast })
      continue
    }

    // Second segment under customers: show Add or Edit
    if (i === 1 && (parts[0] === 'customers' || parts[0] === 'customer')) {
      const second = parts[1]
      let label = ''
      if (second === 'add') label = 'Add'
      else if (/^\d+$/.test(second)) label = second
      else label = LABELS[second] || prettify(second)
      crumbs.push({ path: acc, label, isLast })
      continue
    }

    // Configuration resources: when path is /configuration/{resource}/{id}, show the resource name
    // Accept non-numeric ids (GUIDs) but skip the 'add' sentinel
    if (parts[0] === 'configuration' && i === 2 && p !== 'add') {
      const id = p
      if (!loadedNames[id]) {
        ;(async ()=>{
          try{
            const resource = parts[1]
            let data: any = null
            switch(resource) {
              case 'parameters': data = await configService.getParameter(id); break
              case 'parameter-groups': data = await configService.getParameterGroup(id); break
              case 'vehicle-makes': data = await configService.getVehicleMake(id); break
              case 'vehicle-models': data = await configService.getVehicleModel(id); break
              case 'unit-of-measures': data = await configService.getUnitOfMeasure(id); break
              case 'job-statuses': data = await configService.getJobStatus(id); break
              case 'inspection-templates': data = await configService.getInspectionChecklistTemplate(id); break
              case 'product-groups': data = await configService.getProductGroup(id); break
              case 'product-categories': data = await configService.getProductCategory(id); break
              case 'service-categories': data = await configService.getServiceCategory(id); break
              case 'service-groups': data = await configService.getServiceGroup(id); break
              default: data = null
            }
            let name: any = null
            if (resource === 'parameters') {
              // show the parameter's group name when available
              name = data?.parameterGroup?.name || data?.name || data?.code || data?.title || data?.description
            } else {
              name = data?.name || data?.parameterGroup?.name || data?.code || data?.title || data?.description
            }
            if (name) setLoadedNames(s => ({ ...s, [id]: toTitleCase(String(name)) }))
          }catch(e){ /* ignore */ }
        })()
      }
      const labelForId = id
      crumbs.push({ path: acc, label: labelForId, isLast })
      continue
    }

    let label = LABELS[p] || prettify(p)
    // Special-case: under administrators, the company page should link to company-information
    let pathForCrumb = acc
    if (p === 'company' && parts[0] === 'administrators') {
      label = 'Company Information'
      pathForCrumb = '/administrators/company-information'
    }
    crumbs.push({ path: pathForCrumb, label, isLast })
  }

  return (
    <nav className="text-sm text-slate-500">
      <Link to="/dashboard" className="text-slate-400">Home</Link>
      {crumbs.map((c, i) => (
        <span key={i} className="ml-2">
          <span className="text-slate-400">/</span>&nbsp;
          {c.isLast ? (
            <span className="capitalize text-slate-700">{c.label}</span>
          ) : (
            <Link to={c.path} className="text-slate-500">{c.label}</Link>
          )}
        </span>
      ))}
    </nav>
  )
}
