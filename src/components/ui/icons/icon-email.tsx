import type { IconProps } from './types'

export function IconEmail({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 16 16' fill='none' {...props}>
      <rect
        x='2'
        y='3.5'
        width='12'
        height='9'
        rx='1.5'
        stroke='currentColor'
        strokeWidth='1.2'
      />
      <path
        d='M2.5 4L8 8.5 13.5 4'
        stroke='currentColor'
        strokeWidth='1.2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  )
}
