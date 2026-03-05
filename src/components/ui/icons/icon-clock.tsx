import type { IconProps } from './types'

export function IconClock({ size = 12, ...props }: IconProps) {
  return (
    <svg className={props.className} width={size} height={size} viewBox='0 0 12 12' fill='none' {...props}>
      <circle
        cx='6'
        cy='6'
        r='5'
        stroke='currentColor'
        strokeWidth='1.2'
      />
      <path
        d='M6 3.5V6l2 1.5'
        stroke='currentColor'
        strokeWidth='1.2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  )
}
