import { useState, type ReactNode } from 'react'
import { Icon } from './Icon'

export interface CollapsibleProps {
  title: string
  defaultOpen?: boolean
  right?: ReactNode
  children: ReactNode
}

export function Collapsible({ title, defaultOpen = true, right, children }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="collapsible">
      <button type="button" className="collapsible__trigger" onClick={() => setOpen(!open)}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon
            name="chevronRight"
            size={13}
            className={`collapsible__chevron${open ? ' is-open' : ''}`}
          />
          {title}
        </span>
        {right}
      </button>
      {open && <div className="collapsible__body">{children}</div>}
    </div>
  )
}
