import type { IconProps } from './types'

export function IconEyeOff({ size = 14, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 14 14' fill='none' {...props}>
      <path
        d='M2 2l10 10M5.6 5.7a1.8 1.8 0 002.7 2.6'
        stroke='currentColor'
        strokeWidth='1.2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      <path
        d='M4 4.3C2.7 5.2 1.5 7 1.5 7s2.2 3.5 5.5 3.5c1 0 1.9-.3 2.7-.8M9.5 9.2c1.5-1 2.9-2.7 3-2.7s-2.2-3.5-5.5-3.5c-.6 0-1.2.1-1.7.3'
        stroke='currentColor'
        strokeWidth='1.2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  )
}
