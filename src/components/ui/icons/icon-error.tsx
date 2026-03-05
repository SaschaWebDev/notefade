import type { IconProps } from './types'

export function IconError({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 20 20' fill='none' {...props}>
      <circle cx='10' cy='10' r='10' fill='rgba(248,113,113,0.12)' />
      <path
        d='M10 6v5M10 13.5v.5'
        stroke='#f87171'
        strokeWidth='1.5'
        strokeLinecap='round'
      />
    </svg>
  )
}
