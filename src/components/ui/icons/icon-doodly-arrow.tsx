import type { IconProps } from './types'

export function IconDoodlyArrow({ size = 48, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size * 0.65}
      viewBox='0 0 60 39'
      fill='none'
      {...props}
    >
      <path
        d='M4 6 C10 3, 22 2, 32 8 C38 12, 44 20, 50 30'
        stroke='currentColor'
        strokeWidth='1.6'
        strokeLinecap='round'
        strokeLinejoin='round'
        fill='none'
      />
      <path
        d='M49 23 L50 30 L44 26'
        stroke='currentColor'
        strokeWidth='1.6'
        strokeLinecap='round'
        strokeLinejoin='round'
        fill='none'
      />
    </svg>
  )
}
