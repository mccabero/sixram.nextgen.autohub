// @ts-nocheck
import React from 'react'

export interface ReferenceLinkButtonProps {
  value?: React.ReactNode
  onClick: () => void
  title?: string
}

export default function ReferenceLinkButton({ value, onClick, title }: ReferenceLinkButtonProps) {
  const displayValue = value == null || value === '' ? '-' : value

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="text-left font-medium text-sky-600 transition-colors hover:text-sky-700 hover:underline dark:text-sky-400 dark:hover:text-sky-300"
    >
      {displayValue}
    </button>
  )
}
