import type { IconProps } from './types'

export function IconAliveCheck({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 20 20' fill='none' {...props}>
      <circle cx='10' cy='10' r='10' fill='rgba(79,143,247,0.12)' />
      <path
        d='M6 10.5L8.5 13L14 7.5'
        stroke='#4f8ff7'
        strokeWidth='1.5'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  )
}
