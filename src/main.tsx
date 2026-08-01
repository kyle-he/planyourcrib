import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { hydrateImageAssets } from './state/imageAssets'
import './styles/index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element')

// Images stream in from IndexedDB and repaint their items on arrival, so the
// editor never waits on them to draw.
void hydrateImageAssets()

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
