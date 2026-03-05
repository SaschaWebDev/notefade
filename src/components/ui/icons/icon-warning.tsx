import type { IconProps } from './types'

export function IconWarning({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none' {...props}>
      <path
        d='M12 9v4M12 17h.01'
        stroke='#f59e0b'
        strokeWidth='1.5'
        strokeLinecap='round'
      />
      <path
        d='M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z'
        stroke='#f59e0b'
        strokeWidth='1.5'
        strokeLinecap='round'
        strokeLinejoin='round'
        fill='rgba(245,158,11,0.08)'
      />
    </svg>
  )
}
