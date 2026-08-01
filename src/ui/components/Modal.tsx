import { useEffect, type ReactNode } from 'react'
import { IconButton } from './Button'

export interface ModalProps {
  title: string
  className?: string
  showHeader?: boolean
  onClose: () => void
  children: ReactNode
}

export function Modal({ title, className, showHeader = true, onClose, children }: ModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [onClose])

  return (
    <div className="modal-backdrop" onPointerDown={onClose} role="presentation">
      <div
        className={`modal${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {showHeader ? (
          <header className="modal__header">
            <h2 className="modal__title">{title}</h2>
            <IconButton icon="close" label="Close" variant="ghost" onClick={onClose} />
          </header>
        ) : (
          <IconButton
            className="modal__close"
            icon="close"
            label="Close"
            variant="ghost"
            onClick={onClose}
          />
        )}
        <div className="modal__body">{children}</div>
      </div>
    </div>
  )
}
