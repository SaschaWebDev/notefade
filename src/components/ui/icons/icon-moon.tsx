import type { IconProps } from './types'

export function IconMoon({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 16 16' fill='none' {...props}>
      <path d='M13.5 9.5a5.5 5.5 0 01-7-7 5.5 5.5 0 107 7z' stroke='currentColor' strokeWidth='1.3' strokeLinecap='round' strokeLinejoin='round' />
    </svg>
  )
}
