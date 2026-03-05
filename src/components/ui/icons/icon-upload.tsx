import type { IconProps } from './types'

export function IconUpload({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 16 16' fill='none' {...props}>
      <path
        d='M8 10V3M5.5 5.5L8 3l2.5 2.5'
        stroke='currentColor'
        strokeWidth='1.2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      <path
        d='M2.5 10v2.5a1 1 0 001 1h9a1 1 0 001-1V10'
        stroke='currentColor'
        strokeWidth='1.2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  )
}
