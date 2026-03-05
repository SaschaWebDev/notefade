import type { IconProps } from './types'

export function IconChevronDown({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 16 16' fill='none' {...props}>
      <path
        d='M4 6l4 4 4-4'
        stroke='currentColor'
        strokeWidth='1.5'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  )
}
