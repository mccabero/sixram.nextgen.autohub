// @ts-nocheck
import React from 'react'
import { Search, List, Layout, Filter } from 'lucide-react'

export default function JobsBoardMenu(){
  return (
    <div className="bg-white rounded shadow-sm p-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <button className="px-2 py-1 rounded bg-gray-100">Kanban</button>
          <button className="px-2 py-1 rounded hover:bg-gray-100">List</button>
        </div>

        <div className="ml-4 flex-1 flex items-center gap-2">
          <input placeholder="Search" className="w-full border rounded px-3 py-2 text-sm" />
        </div>

        <div className="flex items-center gap-2">
          <select className="border rounded px-3 py-2 text-sm">
            <option>Authorization</option>
            <option>All</option>
          </select>
          <select className="border rounded px-3 py-2 text-sm">
            <option>Technicians</option>
            <option>All</option>
          </select>
          <select className="border rounded px-3 py-2 text-sm">
            <option>Aging</option>
            <option>1-3 days</option>
          </select>
          <button className="px-3 py-2 border rounded text-sm">+ Add Filter</button>
        </div>
      </div>
    </div>
  )
}
