import type { IconProps } from './types'

export function IconClipboard({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill='none' {...props}>
      {size === 14 ? (
        <>
          <rect
            x='4.5'
            y='4.5'
            width='7'
            height='7'
            rx='1.5'
            stroke='currentColor'
            strokeWidth='1.2'
          />
          <path
            d='M9.5 4.5V3a1.5 1.5 0 00-1.5-1.5H3A1.5 1.5 0 001.5 3v5A1.5 1.5 0 003 9.5h1.5'
            stroke='currentColor'
            strokeWidth='1.2'
          />
        </>
      ) : (
        <>
          <rect
            x='5.5'
            y='5.5'
            width='7'
            height='7'
            rx='1.5'
            stroke='currentColor'
            strokeWidth='1.2'
          />
          <path
            d='M10.5 5.5V4a1.5 1.5 0 00-1.5-1.5H4A1.5 1.5 0 002.5 4v5A1.5 1.5 0 004 10.5h1.5'
            stroke='currentColor'
            strokeWidth='1.2'
          />
        </>
      )}
    </svg>
  )
}
