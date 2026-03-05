import type { IconProps } from './types'

export function IconClose({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none' {...props}>
      <path
        d='M18 6L6 18M6 6l12 12'
        stroke='currentColor'
        strokeWidth='1.5'
        strokeLinecap='round'
      />
    </svg>
  )
}
