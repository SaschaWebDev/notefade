import type { IconProps } from './types'

export function IconText({ size = 14, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 14 14' fill='none' {...props}>
      <line
        x1='2.5'
        y1='4'
        x2='11.5'
        y2='4'
        stroke='currentColor'
        strokeWidth='1.2'
        strokeLinecap='round'
      />
      <line
        x1='2.5'
        y1='7'
        x2='11.5'
        y2='7'
        stroke='currentColor'
        strokeWidth='1.2'
        strokeLinecap='round'
      />
      <line
        x1='2.5'
        y1='10'
        x2='8.5'
        y2='10'
        stroke='currentColor'
        strokeWidth='1.2'
        strokeLinecap='round'
      />
    </svg>
  )
}
