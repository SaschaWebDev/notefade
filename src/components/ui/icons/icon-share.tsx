import type { IconProps } from './types'

export function IconShare({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 16 16' fill='none' {...props}>
      <path
        d='M4 10V12a1 1 0 001 1h6a1 1 0 001-1V10M8 2v7.5M5.5 4.5L8 2l2.5 2.5'
        stroke='currentColor'
        strokeWidth='1.2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  )
}
