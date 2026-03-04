import type { ReactNode } from 'react';
import styles from './MetaPill.module.css';

export function MetaPill({ icon, children, href }: { icon: ReactNode; children: ReactNode; href?: string }) {
  const Tag = href ? 'a' : 'span';
  const linkProps = href ? { href, target: '_blank' as const, rel: 'noopener noreferrer' } : {};
  return (
    <Tag className={styles.pill} {...linkProps}>
      <span className={styles.pillIcon}>{icon}</span>
      {children}
    </Tag>
  );
}
