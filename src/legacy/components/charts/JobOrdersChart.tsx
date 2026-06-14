// @ts-nocheck
import React from 'react'
import { Pie } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

export default function JobOrdersChart({ data }: { data: { label: string, value: number }[] }){
  const chartData = {
    labels: data.map(d=>d.label),
    datasets: [{ data: data.map(d=>d.value), backgroundColor: ['#0EA5E9','#22C55E','#E11D48','#FFC20E'] }]
  }
  return (
    <div className="card p-4 rounded-xl shadow-card dark:shadow-none border border-border-DEFAULT dark:border-slate-700">
      <div className="text-sm text-slate-600 dark:text-slate-200 mb-2">Job Orders Status</div>
      <div style={{ height: 240 }}>
        <Pie data={chartData} />
      </div>
    </div>
  )
}
