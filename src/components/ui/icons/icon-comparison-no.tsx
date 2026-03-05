import type { IconProps } from './types'

export function IconComparisonNo({ size = 14, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 14 14' fill='none' {...props}>
      <path
        d='M4 5.5l6 6M10 5.5l-6 6'
        stroke='#f87171'
        strokeWidth='1.5'
        strokeLinecap='round'
      />
    </svg>
  )
}
