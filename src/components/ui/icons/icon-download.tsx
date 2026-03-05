import type { IconProps } from './types'

export function IconDownload({ size = 12, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 12 12' fill='none' {...props}>
      <path
        d='M6 1.5v6M3.5 5L6 7.5 8.5 5'
        stroke='currentColor'
        strokeWidth='1.2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      <path
        d='M2 9.5h8'
        stroke='currentColor'
        strokeWidth='1.2'
        strokeLinecap='round'
      />
    </svg>
  )
}
