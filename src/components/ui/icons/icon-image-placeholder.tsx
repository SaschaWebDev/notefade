import type { IconProps } from './types'

export function IconImagePlaceholder({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none' {...props}>
      <rect x='3' y='3' width='18' height='18' rx='3' stroke='currentColor' strokeWidth='1.5' />
      <circle cx='8.5' cy='8.5' r='2' stroke='currentColor' strokeWidth='1.2' />
      <path d='M3 16l5-5 3.5 3.5L15 11l6 6' stroke='currentColor' strokeWidth='1.2' strokeLinecap='round' strokeLinejoin='round' />
    </svg>
  )
}
