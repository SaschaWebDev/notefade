import type { IconProps } from './types'

export function IconVideo({ size = 14, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 14 14' fill='none' {...props}>
      <rect
        x='1.5'
        y='3.5'
        width='8'
        height='7'
        rx='1.2'
        stroke='currentColor'
        strokeWidth='1.2'
      />
      <path
        d='M10 6.2 L12.5 4.5 L12.5 9.5 L10 7.8 Z'
        stroke='currentColor'
        strokeWidth='1.2'
        strokeLinejoin='round'
        fill='none'
      />
    </svg>
  )
}
