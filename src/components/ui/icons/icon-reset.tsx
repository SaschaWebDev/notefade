import type { IconProps } from './types'

export function IconReset({ size = 14, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 14 14' fill='none' {...props}>
      <path
        d='M1.5 1.5v4h4'
        stroke='currentColor'
        strokeWidth='1.3'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      <path
        d='M2.1 8.5a5 5 0 108.4-4.6A5 5 0 002.1 5.5L1.5 5.5'
        stroke='currentColor'
        strokeWidth='1.3'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  )
}
