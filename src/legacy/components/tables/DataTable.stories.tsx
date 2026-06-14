// @ts-nocheck
import React from 'react'
import DataTable from './DataTable'

export default { title: 'Tables/DataTable', component: DataTable }

const cols = [{key:'id', title:'ID'},{key:'name', title:'Name'}]
const data = Array.from({length:18}).map((_,i)=>({id:i+1, name:`User ${i+1}`}))

export const Default = () => <DataTable columns={cols as any} data={data as any} onAction={(a,r)=>alert(`${a} ${r.id}`)} />
