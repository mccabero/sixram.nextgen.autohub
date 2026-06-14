// @ts-nocheck
export const customers = Array.from({length:12}).map((_,i)=>({ id: i+1, name: `Customer ${i+1}`, phone: `555-01${i+10}`, email: `cust${i+1}@example.com` }))
