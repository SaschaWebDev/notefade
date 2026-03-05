import type { IconProps } from './types'

export function IconReadCount({ size = 12, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 12 12' fill='none' {...props}>
      <rect
        x='1.5'
        y='3'
        width='9'
        height='6'
        rx='1'
        stroke='currentColor'
        strokeWidth='1.1'
      />
      <rect
        x='2.5'
        y='1.5'
        width='7'
        height='4'
        rx='1'
        stroke='currentColor'
        strokeWidth='0.8'
        opacity='0.4'
      />
    </svg>
  )
}
