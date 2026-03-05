import type { IconProps } from './types'

export function IconTelegram({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 16 16' fill='none' {...props}>
      <path
        d='M14.3 1.7L1.4 6.8c-.5.2-.5.6 0 .7l3.3 1 1.3 4c.1.4.2.5.5.5s.3-.1.4-.2l1.8-1.8 3.3 2.4c.4.2.7.1.8-.4L14.9 2.5c.1-.6-.2-.9-.6-.8zM5.3 8.2l6.3-3.9-4.8 4.4-.2 2.1-1.3-2.6z'
        fill='currentColor'
      />
    </svg>
  )
}
