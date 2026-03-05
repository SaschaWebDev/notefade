import type { IconProps } from './types'

export function IconComparisonSome({ size = 14, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 14 14' fill='none' {...props}>
      <path
        d='M3 8.5c1.5-2 3.5-2 4 0s2.5 2 4 0'
        stroke='#f59e0b'
        strokeWidth='1.5'
        strokeLinecap='round'
      />
    </svg>
  )
}
