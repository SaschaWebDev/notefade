import type { IconProps } from './types'

export function IconDraw({ size = 14, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 14 14' fill='none' {...props}>
      {/* pencil shaft */}
      <path
        d='M2.5 11.5 L9.5 4.5 L11 6 L4 13 L2 13 L2 11 Z'
        stroke='currentColor'
        strokeWidth='1.2'
        strokeLinecap='round'
        strokeLinejoin='round'
        transform='translate(0 -1.5)'
      />
      {/* tip highlight */}
      <line
        x1='8.8'
        y1='3.3'
        x2='10.3'
        y2='4.8'
        stroke='currentColor'
        strokeWidth='1.2'
        strokeLinecap='round'
      />
    </svg>
  )
}
