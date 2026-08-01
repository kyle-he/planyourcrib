import { useCallback, useState } from 'react'
import { useEditorStore } from '@/state/store'
import { useCanRedo, useCanUndo } from '@/state/selectors'
import { pruneImageAssets } from '@/state/imageAssets'
import { downloadPlanArchive, pickPlanFile, referencedImageIds } from '@/state/persistence'
import { Button, IconButton } from './components/Button'
import { SettingsMenu } from './SettingsMenu'

export interface TopbarProps {
  onShowShortcuts: () => void
}

export function Topbar({ onShowShortcuts }: TopbarProps) {
  const [showSettings, setShowSettings] = useState(false)
  const closeSettings = useCallback(() => setShowSettings(false), [])
  const undo = useEditorStore((state) => state.undo)
  const redo = useEditorStore((state) => state.redo)
  const newPlan = useEditorStore((state) => state.newPlan)
  const loadPlan = useEditorStore((state) => state.loadPlan)
  const canUndo = useCanUndo()
  const canRedo = useCanRedo()

  /** Loading a document orphans the previous plan's images, so drop them. */
  const replacePlan = (next: Parameters<typeof loadPlan>[0]) => {
    loadPlan(next)
    void pruneImageAssets(referencedImageIds(next))
  }

  const handleOpen = async () => {
    const plan = await pickPlanFile()
    if (plan) replacePlan(plan)
  }

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <img className="topbar__logo" src="/nerd.webp" alt="" />
        Plan Your Crib
      </div>
      <div className="topbar__spacer" />
      <IconButton
        icon="undo"
        label="Undo (⌘Z)"
        variant="ghost"
        disabled={!canUndo}
        onClick={undo}
      />
      <IconButton
        icon="redo"
        label="Redo (⇧⌘Z)"
        variant="ghost"
        disabled={!canRedo}
        onClick={redo}
      />
      <div className="divider-v" />
      <Button
        icon="file"
        onClick={() => {
          if (window.confirm('Start a new empty plan? Your current plan will be discarded.')) {
            newPlan()
            void pruneImageAssets([])
          }
        }}
      >
        New
      </Button>
      <Button icon="upload" title="Open a plan archive (.zip)" onClick={handleOpen}>
        Open
      </Button>
      <Button
        icon="download"
        variant="primary"
        title="Download the plan and its images as a .zip"
        onClick={() => void downloadPlanArchive(useEditorStore.getState().plan)}
      >
        Export
      </Button>
      <div className="topbar__settings" onPointerDown={(event) => event.stopPropagation()}>
        <IconButton
          icon="settings"
          label="Settings"
          variant="ghost"
          active={showSettings}
          aria-expanded={showSettings}
          onClick={() => setShowSettings((open) => !open)}
        />
        {showSettings && (
          <SettingsMenu onClose={closeSettings} onShowShortcuts={onShowShortcuts} />
        )}
      </div>
    </header>
  )
}
