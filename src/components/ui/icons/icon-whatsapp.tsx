import type { IconProps } from './types'

export function IconWhatsApp({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 16 16' fill='none' {...props}>
      <path
        d='M13.6 2.3A7.4 7.4 0 002.3 12.3L1 15l2.8-1.3a7.4 7.4 0 009.8-9.4zM8 14a6 6 0 01-3.2-.9l-.2-.1-2.2 1 1-2.1-.2-.3A6 6 0 118 14zm3.3-4.5c-.2-.1-1-.5-1.2-.6s-.3-.1-.4.1-.5.6-.6.7-.2.1-.4 0a5.4 5.4 0 01-2.5-2.2c-.2-.3.2-.3.5-1 0-.1 0-.2 0-.3l-.5-1c-.1-.3-.3-.2-.4-.2h-.3a.7.7 0 00-.5.2 1.9 1.9 0 00-.6 1.4c0 .9.6 1.7.7 1.8s1.2 1.9 3 2.6a9 9 0 001 .4 2.4 2.4 0 001.1.1c.3-.1 1-.4 1.2-.8s.1-.7.1-.8l-.4-.2z'
        fill='currentColor'
      />
    </svg>
  )
}
