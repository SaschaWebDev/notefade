import type { IconProps } from './types'

export function IconFade({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 20 20' fill='none' {...props}>
      <circle cx='10' cy='10' r='10' fill='rgba(255,255,255,0.05)' />
      <path
        d='M6 10h8'
        stroke='rgba(255,255,255,0.3)'
        strokeWidth='1.5'
        strokeLinecap='round'
      />
    </svg>
  )
}
