import type { IconProps } from './types'

export function IconComparisonCheck({ size = 14, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 14 14' fill='none' {...props}>
      <path
        d='M3 7.5L5.5 10L11 4'
        stroke='#34d399'
        strokeWidth='1.5'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  )
}
