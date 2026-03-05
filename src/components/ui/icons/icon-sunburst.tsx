import type { IconProps } from './types'

export function IconSunburst({ size = 12, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 12 12' fill='none' {...props}>
      <path
        d='M6 1v2M6 9v2M1 6h2M9 6h2M2.5 2.5l1.4 1.4M8.1 8.1l1.4 1.4M9.5 2.5L8.1 3.9M3.9 8.1L2.5 9.5'
        stroke='currentColor'
        strokeWidth='1.1'
        strokeLinecap='round'
      />
    </svg>
  )
}
