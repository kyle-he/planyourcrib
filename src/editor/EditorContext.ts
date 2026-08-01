import { createContext, useContext } from 'react'
import type { SceneHandlers } from './interactions/types'

const noop = () => {}

const FALLBACK: SceneHandlers = {
  startMove: noop,
  startItemResize: noop,
  startItemRotate: noop,
  startVertexDrag: noop,
  startVertexInsert: noop,
  removeVertex: noop,
  startWallDrag: noop,
  startWallEndpointDrag: noop,
  startOpeningDrag: noop,
  startOpeningResize: noop,
  insertVertex: noop,
  hover: noop,
}

/**
 * Scene shapes reach their gesture handlers through context so layers stay
 * simple presentational components.
 */
export const SceneContext = createContext<SceneHandlers>(FALLBACK)

export const useScene = (): SceneHandlers => useContext(SceneContext)
