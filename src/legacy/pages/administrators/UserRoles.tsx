// @ts-nocheck
import React from 'react'
import RoleListTable from '../../components/tables/RoleListTable'

export default function UserRoles(){
  return (
    <div>
      <h1 className="text-2xl font-semibold">User Roles</h1>
      <div className="mt-4">
        <RoleListTable />
      </div>
    </div>
  )
}
