import type { IconProps } from './types'

export function IconLockSmall({ size = 12, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 12 12' fill='none' {...props}>
      <rect
        x='2'
        y='5'
        width='8'
        height='6'
        rx='1.5'
        stroke='currentColor'
        strokeWidth='1.1'
      />
      <path
        d='M4 5V3.5a2 2 0 014 0V5'
        stroke='currentColor'
        strokeWidth='1.1'
        strokeLinecap='round'
      />
    </svg>
  )
}
