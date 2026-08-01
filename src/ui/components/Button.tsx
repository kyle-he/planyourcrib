import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

type Variant = 'default' | 'primary' | 'ghost' | 'danger'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  active?: boolean
  block?: boolean
  icon?: IconName
  children?: ReactNode
}

const VARIANT_CLASS: Record<Variant, string> = {
  default: '',
  primary: 'btn--primary',
  ghost: 'btn--ghost',
  danger: 'btn--danger',
}

export function Button({
  variant = 'default',
  active = false,
  block = false,
  icon,
  children,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    VARIANT_CLASS[variant],
    active ? 'is-active' : '',
    block ? 'btn--block' : '',
    children === undefined ? 'btn--icon' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button type={type} className={classes} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  )
}

export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'icon'> {
  icon: IconName
  label: string
}

export function IconButton({ icon, label, ...rest }: IconButtonProps) {
  return <Button icon={icon} aria-label={label} title={label} {...rest} />
}
