import type { IconProps } from './types'

export function IconTimeLockClock({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 20 20' fill='none' {...props}>
      <circle cx='10' cy='10' r='10' fill='rgba(79,143,247,0.12)' />
      <circle
        cx='10'
        cy='10'
        r='5'
        stroke='#4f8ff7'
        strokeWidth='1.2'
        fill='none'
      />
      <path
        d='M10 7v3l2 1.5'
        stroke='#4f8ff7'
        strokeWidth='1.2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  )
}
