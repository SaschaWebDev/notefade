import type { IconProps } from './types'

export function IconXCircleOutlined({ size = 36, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 36 36' fill='none' {...props}>
      <circle cx='18' cy='18' r='16' stroke='var(--error-text)' strokeWidth='2' opacity='0.3' />
      <path d='M13 13l10 10M23 13l-10 10' stroke='var(--error-text)' strokeWidth='2' strokeLinecap='round' />
    </svg>
  )
}
