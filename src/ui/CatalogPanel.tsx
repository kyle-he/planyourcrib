import { useMemo, useState } from 'react'
import { pickFile } from '@/core/files'
import {
  CATEGORIES,
  createImageTemplate,
  IMAGE_TEMPLATE_ID,
  ITEM_TEMPLATES,
  OPENING_TEMPLATES,
  type ItemTemplate,
} from '@/model/catalog'
import { addImageAsset, IMAGE_ACCEPT } from '@/state/imageAssets'
import { useEditorStore } from '@/state/store'
import { Collapsible } from './components/Collapsible'
import { Icon } from './components/Icon'
import { ItemArt } from './ItemArt'

export interface CatalogPanelProps {
  onCollapse: () => void
}

export function CatalogPanel({ onCollapse }: CatalogPanelProps) {
  const [query, setQuery] = useState('')
  const [importing, setImporting] = useState(false)
  const tool = useEditorStore((state) => state.tool)
  const activeTemplateId = useEditorStore((state) => state.itemTemplate?.id ?? null)
  const openingKind = useEditorStore((state) => state.openingKind)
  const startPlacingItem = useEditorStore((state) => state.startPlacingItem)
  const startPlacingOpening = useEditorStore((state) => state.startPlacingOpening)
  const setTool = useEditorStore((state) => state.setTool)

  /** Pick a picture, then arm the item tool so the next canvas click drops it. */
  const addImage = async () => {
    const file = await pickFile(IMAGE_ACCEPT)
    if (!file) return
    setImporting(true)
    try {
      startPlacingItem(createImageTemplate(await addImageAsset(file)))
    } finally {
      setImporting(false)
    }
  }

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return null
    return ITEM_TEMPLATES.filter((template) => template.name.toLowerCase().includes(needle))
  }, [query])

  return (
    <aside className="panel panel--left">
      <div className="panel__header">
        <span className="panel__title">Library</span>
        <button
          type="button"
          className="panel__collapse"
          aria-label="Hide library"
          title="Hide library"
          onClick={onCollapse}
        >
          <Icon name="chevronRight" size={15} />
        </button>
      </div>
      <div className="search">
        <Icon name="search" size={14} />
        <input
          value={query}
          placeholder="Search furniture…"
          spellCheck={false}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="panel__scroll">
        {matches ? (
          matches.length > 0 ? (
            <div className="section">
              <div className="section__title">
                <span>{matches.length} results</span>
              </div>
              <Grid
                templates={matches}
                activeId={tool === 'item' ? activeTemplateId : null}
                onPick={startPlacingItem}
              />
            </div>
          ) : (
            <div className="empty-state">
              <span className="empty-state__title">Nothing found</span>
              <span>Try “sofa”, “sink” or “bed”.</span>
            </div>
          )
        ) : (
          <>
            <div className="section">
              <button
                type="button"
                className={`btn btn--block${
                  tool === 'item' && activeTemplateId === IMAGE_TEMPLATE_ID ? ' is-active' : ''
                }`}
                disabled={importing}
                title="Pick an image, then click on the plan to place it"
                onClick={addImage}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="image" size={15} />
                  {importing ? 'Loading image…' : 'Add image'}
                </span>
              </button>
            </div>

            <Collapsible title="Doors & windows" defaultOpen={false}>
              <div className="stack">
                {OPENING_TEMPLATES.map((template) => (
                  <button
                    key={template.kind}
                    type="button"
                    className={`btn btn--block${
                      tool === 'opening' && openingKind === template.kind ? ' is-active' : ''
                    }`}
                    onClick={() => startPlacingOpening(template.kind)}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Icon name={template.hinged ? 'door' : 'window'} size={15} />
                      {template.name}
                    </span>
                  </button>
                ))}
              </div>
            </Collapsible>

            <Collapsible title="Walls" defaultOpen={false}>
              <div className="stack">
                <button
                  type="button"
                  className={`btn btn--block${tool === 'wall' ? ' is-active' : ''}`}
                  title="Click and drag on the plan to make a wall"
                  onClick={() => setTool('wall')}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="wall" size={15} />
                    Create Wall
                  </span>
                </button>
                <p className="catalog-help">Click and drag to make wall</p>
              </div>
            </Collapsible>

            {CATEGORIES.map((category, index) => (
              <Collapsible
                key={category.id}
                title={category.label}
                defaultOpen={index < 2}
              >
                <Grid
                  templates={ITEM_TEMPLATES.filter((item) => item.category === category.id)}
                  activeId={tool === 'item' ? activeTemplateId : null}
                  onPick={startPlacingItem}
                />
              </Collapsible>
            ))}
          </>
        )}
      </div>
    </aside>
  )
}

function Grid({
  templates,
  activeId,
  onPick,
}: {
  templates: readonly ItemTemplate[]
  activeId: string | null
  onPick: (template: ItemTemplate) => void
}) {
  return (
    <div className="catalog-grid">
      {templates.map((template) => (
        <button
          key={template.id}
          type="button"
          title={`${template.name} — click, then click on the plan to place`}
          className={`catalog-card${template.id === activeId ? ' is-active' : ''}`}
          onClick={() => onPick(template)}
        >
          <ItemArt template={template} />
          <span className="catalog-card__name">{template.name}</span>
        </button>
      ))}
    </div>
  )
}
