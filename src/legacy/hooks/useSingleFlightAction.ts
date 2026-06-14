// @ts-nocheck
import { useCallback, useRef, useState } from 'react'

export function useSingleFlightAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
) {
  const runningRef = useRef(false)
  const [running, setRunning] = useState(false)

  const run = useCallback(async (...args: TArgs): Promise<TResult | undefined> => {
    if (runningRef.current) return undefined
    runningRef.current = true
    setRunning(true)
    try {
      return await action(...args)
    } finally {
      runningRef.current = false
      setRunning(false)
    }
  }, [action])

  return { run, running }
}
