import type { IconProps } from './types'

export function IconCheck({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill='none' {...props}>
      <path
        d={size === 14 ? 'M3 7.5L5.5 10L11 4.5' : 'M3.5 8.5L6 11L12.5 4.5'}
        stroke='#22c55e'
        strokeWidth='1.5'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  )
}
