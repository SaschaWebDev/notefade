import type { IconProps } from './types'

export function IconPadlock({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none' {...props}>
      <rect
        x='5'
        y='11'
        width='14'
        height='10'
        rx='2'
        stroke='rgba(255,255,255,0.4)'
        strokeWidth='1.5'
        fill='rgba(255,255,255,0.03)'
      />
      <path
        d='M8 11V8a4 4 0 018 0v3'
        stroke='rgba(255,255,255,0.4)'
        strokeWidth='1.5'
        strokeLinecap='round'
        fill='none'
      />
      <circle cx='12' cy='16' r='1.5' fill='rgba(255,255,255,0.3)' />
    </svg>
  )
}
