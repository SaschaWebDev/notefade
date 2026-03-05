import type { IconProps } from './types'

export function IconCheckCircle({ size = 36, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 36 36' fill='none' {...props}>
      <circle cx='18' cy='18' r='16' stroke='var(--accent)' strokeWidth='2' opacity='0.3' />
      <path d='M12 18.5l4 4 8-9' stroke='var(--accent)' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
    </svg>
  )
}
