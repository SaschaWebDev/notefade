import type { IconProps } from './types'

export function IconDocs({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 20 20' fill='none' {...props}>
      <path
        d='M4 3.5h8l4 4V16a.5.5 0 01-.5.5H4a.5.5 0 01-.5-.5V4a.5.5 0 01.5-.5z'
        stroke='currentColor'
        strokeWidth='1.5'
        strokeLinejoin='round'
      />
      <path
        d='M12 3.5V7.5h4'
        stroke='currentColor'
        strokeWidth='1.5'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      <path
        d='M7 11h6M7 13.5h4'
        stroke='currentColor'
        strokeWidth='1.5'
        strokeLinecap='round'
      />
    </svg>
  )
}
