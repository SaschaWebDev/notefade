import type { IconProps } from './types'

export function IconEye({ size = 14, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 14 14' fill='none' {...props}>
      <path
        d='M1.5 7s2.2-3.5 5.5-3.5S12.5 7 12.5 7s-2.2 3.5-5.5 3.5S1.5 7 1.5 7z'
        stroke='currentColor'
        strokeWidth='1.2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      <circle
        cx='7'
        cy='7'
        r='1.8'
        stroke='currentColor'
        strokeWidth='1.2'
      />
    </svg>
  )
}
