import type { IconProps } from './types'

export function IconGrid({ size = 12, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 12 12' fill='none' {...props}>
      <path
        d='M2 4h8M2 8h8M4 2v8M8 2v8'
        stroke='currentColor'
        strokeWidth='1.1'
        strokeLinecap='round'
        opacity='0.6'
      />
      <path
        d='M1 6h10'
        stroke='currentColor'
        strokeWidth='1.1'
        strokeLinecap='round'
      />
    </svg>
  )
}
