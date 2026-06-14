// @ts-nocheck
let count = 0
const listeners = new Set<(c:number)=>void>()

export function increment(){
  count = count + 1
  for (const l of listeners) l(count)
}

export function decrement(){
  count = Math.max(0, count - 1)
  for (const l of listeners) l(count)
}

export function getCount(){ return count }

export function subscribe(fn: (c:number)=>void){
  listeners.add(fn)
  // notify immediately
  fn(count)
  return () => listeners.delete(fn)
}

export function reset(){ count = 0; for (const l of listeners) l(count) }
