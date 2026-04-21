import type { IconProps } from './types'

export function IconMic({ size = 14, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 14 14' fill='none' {...props}>
      <rect
        x='5'
        y='1.5'
        width='4'
        height='7'
        rx='2'
        stroke='currentColor'
        strokeWidth='1.2'
      />
      <path
        d='M3 7a4 4 0 008 0'
        stroke='currentColor'
        strokeWidth='1.2'
        strokeLinecap='round'
      />
      <line
        x1='7'
        y1='11'
        x2='7'
        y2='12.5'
        stroke='currentColor'
        strokeWidth='1.2'
        strokeLinecap='round'
      />
      <line
        x1='5'
        y1='12.5'
        x2='9'
        y2='12.5'
        stroke='currentColor'
        strokeWidth='1.2'
        strokeLinecap='round'
      />
    </svg>
  )
}
