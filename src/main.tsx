import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { hydrateImageAssets } from './state/imageAssets'
import './styles/index.css'

const itemWorkshopEnabled =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_ITEM_WORKSHOP === 'true'
const showItemWorkshop =
  itemWorkshopEnabled && new URLSearchParams(window.location.search).has('item-workshop')
const ItemWorkshop = itemWorkshopEnabled
  ? lazy(() => import('./dev/ItemWorkshop').then((module) => ({ default: module.ItemWorkshop })))
  : null

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element')

// Images stream in from IndexedDB and repaint their items on arrival, so the
// editor never waits on them to draw.
void hydrateImageAssets()

createRoot(container).render(
  <StrictMode>
    {showItemWorkshop && ItemWorkshop ? (
      <Suspense fallback={null}>
        <ItemWorkshop />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
