import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'default' | 'primary' | 'ghost'
export type ButtonSize = 'default' | 'small' | 'large'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant
  readonly size?: ButtonSize
  readonly children: ReactNode
}

export function Button({
  variant = 'default',
  size = 'default',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className="nx-button"
      data-variant={variant}
      data-size={size}
      {...rest}
    >
      {children}
    </button>
  )
}
