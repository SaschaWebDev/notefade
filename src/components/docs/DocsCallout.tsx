import type { ReactNode } from 'react'
import styles from './DocsCallout.module.css'

type CalloutVariant = 'note' | 'warning' | 'caveat' | 'danger'

interface DocsCalloutProps {
  variant?: CalloutVariant
  children: ReactNode
}

const LABELS: Record<CalloutVariant, string> = {
  note: 'Note',
  warning: 'Warning',
  caveat: 'Caveat',
  danger: 'Important',
}

export function DocsCallout({ variant = 'note', children }: DocsCalloutProps) {
  return (
    <div className={`${styles.callout} ${styles[variant]}`}>
      <span className={styles.label}>{LABELS[variant]}</span>
      <div className={styles.body}>{children}</div>
    </div>
  )
}
