import type { ReactNode } from 'react'
import styles from './DocsSection.module.css'

interface DocsSectionProps {
  id: string
  title: string
  children: ReactNode
}

export function DocsSection({ id, title, children }: DocsSectionProps) {
  return (
    <section id={id} className={styles.section}>
      <h2 className={styles.title}>{title}</h2>
      {children}
    </section>
  )
}
