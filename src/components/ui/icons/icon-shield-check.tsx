import type { IconProps } from './types'

export function IconShieldCheck({ size = 12, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 12 12' fill='none' {...props}>
      <path
        d='M6 1L1.5 3v3.5c0 2.5 2 4.5 4.5 5 2.5-.5 4.5-2.5 4.5-5V3L6 1z'
        stroke='currentColor'
        strokeWidth='1.1'
        strokeLinejoin='round'
      />
      <path
        d='M4 6l1.5 1.5L8 5'
        stroke='currentColor'
        strokeWidth='1.1'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  )
}
