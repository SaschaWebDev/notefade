import type { IconProps } from './types'

export function IconSun({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 16 16' fill='none' {...props}>
      <circle cx='8' cy='8' r='3' fill='currentColor' />
      <line x1='8' y1='1' x2='8' y2='3' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' />
      <line x1='8' y1='13' x2='8' y2='15' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' />
      <line x1='1' y1='8' x2='3' y2='8' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' />
      <line x1='13' y1='8' x2='15' y2='8' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' />
      <line x1='3.05' y1='3.05' x2='4.46' y2='4.46' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' />
      <line x1='11.54' y1='11.54' x2='12.95' y2='12.95' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' />
      <line x1='3.05' y1='12.95' x2='4.46' y2='11.54' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' />
      <line x1='11.54' y1='4.46' x2='12.95' y2='3.05' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' />
    </svg>
  )
}
