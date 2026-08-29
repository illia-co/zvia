import type { ReactNode, ButtonHTMLAttributes, AnchorHTMLAttributes } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary'
  children: ReactNode
}

export function Button({ variant = 'primary', className = '', children, ...props }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center rounded-panel px-4 py-2 text-sm font-medium transition-colors duration-default'
  const variants = {
    primary: 'bg-text text-bg hover:opacity-90',
    secondary:
      'border border-divider bg-bg text-text hover:bg-bg-secondary'
  }

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}

type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: 'primary' | 'secondary'
  children: ReactNode
}

export function LinkButton({
  variant = 'primary',
  className = '',
  children,
  ...props
}: LinkButtonProps) {
  const base =
    'inline-flex items-center justify-center rounded-panel px-4 py-2 text-sm font-medium transition-colors duration-default no-underline'
  const variants = {
    primary: 'bg-text text-bg hover:opacity-90',
    secondary:
      'border border-divider bg-bg text-text hover:bg-bg-secondary'
  }

  return (
    <a className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </a>
  )
}
