import type { IconProps } from './types'

export function IconImage({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 16 16' fill='none' {...props}>
      <rect
        x='2'
        y='2'
        width='12'
        height='12'
        rx='2'
        stroke='currentColor'
        strokeWidth='1.2'
      />
      <circle
        cx='5.5'
        cy='5.5'
        r='1.25'
        stroke='currentColor'
        strokeWidth='1'
      />
      <path
        d='M2 11l3.5-3.5L8 10l2.5-3L14 11'
        stroke='currentColor'
        strokeWidth='1'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  )
}
