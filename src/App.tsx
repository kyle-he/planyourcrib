import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@/editor/Canvas'
import { useKeyboardShortcuts } from '@/editor/interactions/useKeyboardShortcuts'
import { AboutModal } from '@/ui/AboutModal'
import { CatalogPanel } from '@/ui/CatalogPanel'
import { Inspector } from '@/ui/inspector/Inspector'
import { ShortcutsModal } from '@/ui/ShortcutsModal'
import { StatusBar } from '@/ui/StatusBar'
import { Topbar } from '@/ui/Topbar'
import { ToolStrip } from '@/ui/ToolStrip'
import { ViewportControls } from '@/ui/ViewportControls'
import { Icon } from '@/ui/components/Icon'

export function App() {
  const [showAbout, setShowAbout] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const shouldAutoCollapseSidebar = useMediaQuery('(max-width: 1024px)')
  const isMobile = useMediaQuery('(max-width: 640px)')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(shouldAutoCollapseSidebar)
  const [mobileNoticeDismissed, setMobileNoticeDismissed] = useState(false)
  const toggleShortcuts = useCallback(() => setShowShortcuts((open) => !open), [])

  useEffect(() => {
    if (shouldAutoCollapseSidebar) setSidebarCollapsed(true)
  }, [shouldAutoCollapseSidebar])

  useKeyboardShortcuts({ onToggleShortcuts: toggleShortcuts })
  useCursorLockDuringPointerDown()

  return (
    <div className="app">
      <Topbar onShowAbout={() => setShowAbout(true)} onShowShortcuts={toggleShortcuts} />
      <div className="app__body">
        {!sidebarCollapsed && <CatalogPanel onCollapse={() => setSidebarCollapsed(true)} />}
        <div className={`app__center${sidebarCollapsed ? '' : ' app__center--sidebar-open'}`}>
          <Canvas />
          <Inspector />
          {sidebarCollapsed && (
            <div className="canvas-overlay canvas-overlay--top-left">
              <button
                type="button"
                className="sidebar-toggle"
                title="Show library"
                onClick={() => setSidebarCollapsed(false)}
              >
                <Icon name="chevronRight" size={15} />
                <span>Library</span>
              </button>
            </div>
          )}
          <div
            className={`canvas-overlay canvas-overlay--bottom-left${
              sidebarCollapsed ? '' : ' canvas-overlay--sidebar-open'
            }`}
          >
            <ToolStrip />
          </div>
          <ViewportControls />
        </div>
      </div>
      <StatusBar />
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      {isMobile && !mobileNoticeDismissed && (
        <div className="mobile-notice-backdrop" role="presentation">
          <div
            className="mobile-notice"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-notice-title"
          >
            <div id="mobile-notice-title" className="mobile-notice__message">
              for the best experience please use a computer thx
            </div>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setMobileNoticeDismissed(true)}
            >
              Continue anyway
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setMatches(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])

  return matches
}

/**
 * Keep a drag's cursor stable even when its pointer crosses a different
 * control. This is registered at the document level so every app surface
 * follows the same rule, not just the canvas.
 */
function useCursorLockDuringPointerDown() {
  const activePointerId = useRef<number | null>(null)

  useEffect(() => {
    const clear = () => {
      activePointerId.current = null
      document.body.removeAttribute('data-pointer-dragging')
      document.documentElement.style.removeProperty('--pointer-drag-cursor')
    }

    const lock = (event: PointerEvent) => {
      if (activePointerId.current !== null || event.button !== 0 || event.pointerType === 'touch') return
      const target = event.target instanceof Element ? event.target : document.body
      const cursor = window.getComputedStyle(target).cursor || 'default'
      activePointerId.current = event.pointerId
      document.documentElement.style.setProperty('--pointer-drag-cursor', cursor)
      document.body.setAttribute('data-pointer-dragging', 'true')
    }

    const release = (event: PointerEvent) => {
      if (activePointerId.current === event.pointerId) clear()
    }

    document.addEventListener('pointerdown', lock, true)
    document.addEventListener('pointerup', release, true)
    document.addEventListener('pointercancel', release, true)
    window.addEventListener('blur', clear)
    return () => {
      document.removeEventListener('pointerdown', lock, true)
      document.removeEventListener('pointerup', release, true)
      document.removeEventListener('pointercancel', release, true)
      window.removeEventListener('blur', clear)
      clear()
    }
  }, [])
}
