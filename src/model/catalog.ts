import type { OpeningKind } from './types'

/** Keys into the glyph registry (see editor/glyphs.tsx). */
export type GlyphKey =
  | 'box'
  | 'bed'
  | 'sofa'
  | 'sectional'
  | 'armchair'
  | 'chair'
  | 'stool'
  | 'tableRect'
  | 'tableRound'
  | 'desk'
  | 'deskL'
  | 'nightstand'
  | 'dresser'
  | 'wardrobe'
  | 'bookcase'
  | 'tv'
  | 'lamp'
  | 'plant'
  | 'rug'
  | 'piano'
  | 'crib'
  | 'fridge'
  | 'range'
  | 'dishwasher'
  | 'microwave'
  | 'sink'
  | 'counter'
  | 'island'
  | 'toilet'
  | 'tub'
  | 'shower'
  | 'vanity'
  | 'washer'
  | 'dryer'
  | 'waterHeater'
  | 'stairs'
  | 'column'
  | 'fireplace'
  | 'image'

export type CategoryId =
  | 'living'
  | 'bedroom'
  | 'kitchen'
  | 'bath'
  | 'dining'
  | 'office'
  | 'laundry'
  | 'structure'

export interface Category {
  id: CategoryId
  label: string
  tint: string
}

export const CATEGORIES: readonly Category[] = [
  { id: 'living', label: 'Living', tint: '#e7ecf6' },
  { id: 'bedroom', label: 'Bedroom', tint: '#ece8f6' },
  { id: 'kitchen', label: 'Kitchen', tint: '#e4efe9' },
  { id: 'dining', label: 'Dining', tint: '#f5eddd' },
  { id: 'bath', label: 'Bath', tint: '#e3eef6' },
  { id: 'office', label: 'Office', tint: '#ebeef2' },
  { id: 'laundry', label: 'Laundry', tint: '#eef0f5' },
  { id: 'structure', label: 'Structure', tint: '#e9e9ec' },
]

export interface ItemTemplate {
  id: string
  name: string
  /** Omitted by ad-hoc templates that aren't browsable, e.g. user images. */
  category?: CategoryId
  /** Default footprint in inches (local X extent). */
  width: number
  /** Default footprint in inches (local Y extent). */
  depth: number
  glyph: GlyphKey
  color?: string
  /** Fixtures that read best when pushed flush against a wall. */
  wallMounted?: boolean
  /** Set by image templates; see Item.imageId. */
  imageId?: string
}

function tintOf(category: CategoryId | undefined): string {
  return CATEGORIES.find((c) => c.id === category)?.tint ?? '#eceef2'
}

const RAW_ITEMS: readonly ItemTemplate[] = [
  // Living -----------------------------------------------------------------
  { id: 'sofa', name: 'Sofa', category: 'living', width: 84, depth: 36, glyph: 'sofa', wallMounted: true },
  { id: 'loveseat', name: 'Loveseat', category: 'living', width: 60, depth: 36, glyph: 'sofa', wallMounted: true },
  { id: 'sectional', name: 'Sectional', category: 'living', width: 102, depth: 66, glyph: 'sectional' },
  { id: 'armchair', name: 'Armchair', category: 'living', width: 34, depth: 34, glyph: 'armchair' },
  { id: 'coffee-table', name: 'Coffee table', category: 'living', width: 48, depth: 24, glyph: 'tableRect' },
  { id: 'side-table', name: 'Side table', category: 'living', width: 22, depth: 22, glyph: 'tableRound' },
  { id: 'tv-stand', name: 'TV stand', category: 'living', width: 60, depth: 18, glyph: 'dresser', wallMounted: true },
  { id: 'tv', name: 'TV', category: 'living', width: 52, depth: 4, glyph: 'tv', wallMounted: true },
  { id: 'bookcase', name: 'Bookcase', category: 'living', width: 36, depth: 12, glyph: 'bookcase', wallMounted: true },
  { id: 'floor-lamp', name: 'Floor lamp', category: 'living', width: 16, depth: 16, glyph: 'lamp' },
  { id: 'plant', name: 'Plant', category: 'living', width: 20, depth: 20, glyph: 'plant' },
  { id: 'rug', name: 'Rug', category: 'living', width: 96, depth: 60, glyph: 'rug' },
  { id: 'piano', name: 'Upright piano', category: 'living', width: 58, depth: 26, glyph: 'piano', wallMounted: true },

  // Bedroom ----------------------------------------------------------------
  { id: 'bed-twin', name: 'Twin bed', category: 'bedroom', width: 39, depth: 75, glyph: 'bed', wallMounted: true },
  { id: 'bed-twin-xl', name: 'Twin XL bed', category: 'bedroom', width: 39, depth: 80, glyph: 'bed', wallMounted: true },
  { id: 'bed-full', name: 'Full bed', category: 'bedroom', width: 54, depth: 75, glyph: 'bed', wallMounted: true },
  { id: 'bed-queen', name: 'Queen bed', category: 'bedroom', width: 60, depth: 80, glyph: 'bed', wallMounted: true },
  { id: 'bed-king', name: 'King bed', category: 'bedroom', width: 76, depth: 80, glyph: 'bed', wallMounted: true },
  { id: 'bed-california-king', name: 'California king', category: 'bedroom', width: 72, depth: 84, glyph: 'bed', wallMounted: true },
  { id: 'nightstand', name: 'Nightstand', category: 'bedroom', width: 20, depth: 18, glyph: 'nightstand', wallMounted: true },
  { id: 'dresser', name: 'Dresser', category: 'bedroom', width: 60, depth: 20, glyph: 'dresser', wallMounted: true },
  { id: 'wardrobe', name: 'Wardrobe', category: 'bedroom', width: 48, depth: 24, glyph: 'wardrobe', wallMounted: true },
  { id: 'crib', name: 'Crib', category: 'bedroom', width: 52, depth: 28, glyph: 'crib', wallMounted: true },

  // Kitchen ----------------------------------------------------------------
  { id: 'fridge', name: 'Refrigerator', category: 'kitchen', width: 36, depth: 32, glyph: 'fridge', wallMounted: true },
  { id: 'range', name: 'Range', category: 'kitchen', width: 30, depth: 26, glyph: 'range', wallMounted: true },
  { id: 'wall-oven', name: 'Wall oven', category: 'kitchen', width: 30, depth: 24, glyph: 'range', wallMounted: true },
  { id: 'dishwasher', name: 'Dishwasher', category: 'kitchen', width: 24, depth: 24, glyph: 'dishwasher', wallMounted: true },
  { id: 'kitchen-sink', name: 'Kitchen sink', category: 'kitchen', width: 33, depth: 22, glyph: 'sink', wallMounted: true },
  { id: 'counter', name: 'Counter run', category: 'kitchen', width: 60, depth: 25, glyph: 'counter', wallMounted: true },
  { id: 'island', name: 'Island', category: 'kitchen', width: 72, depth: 36, glyph: 'island' },
  { id: 'microwave', name: 'Microwave', category: 'kitchen', width: 24, depth: 16, glyph: 'microwave', wallMounted: true },
  { id: 'pantry', name: 'Pantry', category: 'kitchen', width: 30, depth: 24, glyph: 'wardrobe', wallMounted: true },

  // Dining -----------------------------------------------------------------
  { id: 'dining-table', name: 'Dining table', category: 'dining', width: 72, depth: 40, glyph: 'tableRect' },
  { id: 'dining-round', name: 'Round table', category: 'dining', width: 54, depth: 54, glyph: 'tableRound' },
  { id: 'dining-chair', name: 'Chair', category: 'dining', width: 18, depth: 20, glyph: 'chair' },
  { id: 'bar-stool', name: 'Bar stool', category: 'dining', width: 16, depth: 16, glyph: 'stool' },
  { id: 'buffet', name: 'Buffet', category: 'dining', width: 60, depth: 18, glyph: 'dresser', wallMounted: true },

  // Bath -------------------------------------------------------------------
  { id: 'toilet', name: 'Toilet', category: 'bath', width: 20, depth: 28, glyph: 'toilet', wallMounted: true },
  { id: 'bathtub', name: 'Bathtub', category: 'bath', width: 60, depth: 32, glyph: 'tub', wallMounted: true },
  { id: 'shower', name: 'Shower', category: 'bath', width: 36, depth: 36, glyph: 'shower', wallMounted: true },
  { id: 'vanity', name: 'Vanity', category: 'bath', width: 36, depth: 21, glyph: 'vanity', wallMounted: true },
  { id: 'vanity-double', name: 'Double vanity', category: 'bath', width: 60, depth: 21, glyph: 'vanity', wallMounted: true },
  { id: 'pedestal-sink', name: 'Pedestal sink', category: 'bath', width: 24, depth: 20, glyph: 'sink', wallMounted: true },

  // Office -----------------------------------------------------------------
  { id: 'desk', name: 'Desk', category: 'office', width: 60, depth: 30, glyph: 'desk', wallMounted: true },
  { id: 'desk-l', name: 'L-desk', category: 'office', width: 66, depth: 66, glyph: 'deskL' },
  { id: 'office-chair', name: 'Office chair', category: 'office', width: 26, depth: 26, glyph: 'armchair' },
  { id: 'filing-cabinet', name: 'Filing cabinet', category: 'office', width: 18, depth: 24, glyph: 'nightstand', wallMounted: true },

  // Laundry ----------------------------------------------------------------
  { id: 'washer', name: 'Washer', category: 'laundry', width: 27, depth: 30, glyph: 'washer', wallMounted: true },
  { id: 'dryer', name: 'Dryer', category: 'laundry', width: 27, depth: 30, glyph: 'dryer', wallMounted: true },
  { id: 'laundry-sink', name: 'Utility sink', category: 'laundry', width: 24, depth: 22, glyph: 'sink', wallMounted: true },
  { id: 'water-heater', name: 'Water heater', category: 'laundry', width: 22, depth: 22, glyph: 'waterHeater' },

  // Structure --------------------------------------------------------------
  { id: 'stairs', name: 'Stairs', category: 'structure', width: 36, depth: 108, glyph: 'stairs', wallMounted: true },
  { id: 'fireplace', name: 'Fireplace', category: 'structure', width: 60, depth: 18, glyph: 'fireplace', wallMounted: true },
  { id: 'column', name: 'Column', category: 'structure', width: 12, depth: 12, glyph: 'column' },
  { id: 'closet', name: 'Closet', category: 'structure', width: 60, depth: 26, glyph: 'wardrobe', wallMounted: true },
]

export const ITEM_TEMPLATES: readonly ItemTemplate[] = RAW_ITEMS.map((template) => ({
  ...template,
  color: template.color ?? tintOf(template.category),
}))

/**
 * Images are items too, but they aren't browsable: the library builds a template
 * on the fly from whichever file the user picked. `IMAGE_TEMPLATE_ID` lets the
 * canvas recognise them without a catalog entry per image.
 */
export const IMAGE_TEMPLATE_ID = 'image'

const IMAGE_TEMPLATE: ItemTemplate = {
  id: IMAGE_TEMPLATE_ID,
  name: 'Image',
  width: 72,
  depth: 72,
  glyph: 'image',
  color: '#ffffff',
}

/** Longest side of a freshly placed image, in inches. */
const IMAGE_DEFAULT_SPAN = 72

/** Sizes an image to a sane footprint that preserves its pixel aspect ratio. */
export function createImageTemplate(image: {
  id: string
  name: string
  pixelWidth: number
  pixelHeight: number
}): ItemTemplate {
  const longest = Math.max(image.pixelWidth, image.pixelHeight) || 1
  const scale = IMAGE_DEFAULT_SPAN / longest
  return {
    ...IMAGE_TEMPLATE,
    name: image.name || IMAGE_TEMPLATE.name,
    width: round(Math.max(2, image.pixelWidth * scale)),
    depth: round(Math.max(2, image.pixelHeight * scale)),
    imageId: image.id,
  }
}

const round = (value: number) => Math.round(value * 2) / 2

const TEMPLATES_BY_ID = new Map(
  [...ITEM_TEMPLATES, IMAGE_TEMPLATE].map((template) => [template.id, template]),
)

export function getItemTemplate(id: string): ItemTemplate | undefined {
  return TEMPLATES_BY_ID.get(id)
}

export function itemsByCategory(category: CategoryId): ItemTemplate[] {
  return ITEM_TEMPLATES.filter((template) => template.category === category)
}

// ---------------------------------------------------------------------------
// Openings
// ---------------------------------------------------------------------------

export interface OpeningTemplate {
  kind: OpeningKind
  name: string
  width: number
  /** Windows and archways have no swinging leaf. */
  hinged: boolean
}

export const OPENING_TEMPLATES: readonly OpeningTemplate[] = [
  { kind: 'door', name: 'Door', width: 32, hinged: true },
  { kind: 'double-door', name: 'Double door', width: 60, hinged: true },
  { kind: 'sliding-door', name: 'Sliding door', width: 72, hinged: false },
  { kind: 'pocket-door', name: 'Pocket door', width: 32, hinged: false },
  { kind: 'archway', name: 'Archway', width: 40, hinged: false },
  { kind: 'window', name: 'Window', width: 36, hinged: false },
  { kind: 'bay-window', name: 'Bay window', width: 72, hinged: false },
]

const OPENINGS_BY_KIND = new Map(OPENING_TEMPLATES.map((template) => [template.kind, template]))

export function getOpeningTemplate(kind: OpeningKind): OpeningTemplate {
  return OPENINGS_BY_KIND.get(kind) ?? OPENING_TEMPLATES[0]!
}

export const isDoorKind = (kind: OpeningKind): boolean => kind !== 'window' && kind !== 'bay-window'
