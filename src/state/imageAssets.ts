import { useSyncExternalStore } from 'react'
import { createId } from '@/core/id'

/**
 * Bitmaps dropped into a plan live here rather than in the plan document: they
 * are far too large for the localStorage autosave, and keeping them out of the
 * undo history means deleting an image item and undoing never loses the pixels.
 * Plans only ever reference an asset by id.
 */
export interface ImageAsset {
  id: string
  name: string
  mime: string
  /** Natural pixel size, used to derive a sensible default footprint. */
  pixelWidth: number
  pixelHeight: number
  blob: Blob
  /** Object URL, valid for the lifetime of this page. */
  url: string
}

const DB_NAME = 'roomplanner'
const DB_VERSION = 1
const STORE = 'images'

/** Stored shape: everything but the per-session object URL. */
type ImageRecord = Omit<ImageAsset, 'url'>

const registry = new Map<string, ImageAsset>()
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function register(record: ImageRecord): ImageAsset {
  const previous = registry.get(record.id)
  if (previous) URL.revokeObjectURL(previous.url)
  const asset: ImageAsset = { ...record, url: URL.createObjectURL(record.blob) }
  registry.set(asset.id, asset)
  emit()
  return asset
}

export function getImageAsset(id: string | null | undefined): ImageAsset | undefined {
  return id ? registry.get(id) : undefined
}

/** Subscribes to the asset registry so items repaint once pixels arrive. */
export function useImageAsset(id: string | null | undefined): ImageAsset | undefined {
  return useSyncExternalStore(subscribe, () => getImageAsset(id))
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// ---------------------------------------------------------------- public api

/** Reads every saved image back into memory. Safe to call more than once. */
export async function hydrateImageAssets(): Promise<void> {
  const records = await withStore('readonly', (store) => store.getAll() as IDBRequest<ImageRecord[]>)
  for (const record of records ?? []) {
    if (!registry.has(record.id)) register(record)
  }
}

/** Measures, stores and registers a user-picked image file. */
export async function addImageAsset(file: File): Promise<ImageAsset> {
  const blob = file.slice(0, file.size, file.type || mimeFromPath(file.name))
  return saveImage({ id: createId('img'), name: stripExtension(file.name) || 'Image', blob })
}

/** Restores an image that came out of a plan archive, keeping its id. */
export async function putImageAsset(input: {
  id: string
  name: string
  blob: Blob
}): Promise<ImageAsset> {
  return saveImage(input)
}

async function saveImage({ id, name, blob }: { id: string; name: string; blob: Blob }) {
  const size = await measure(blob)
  if (!size) throw new Error(`Unreadable image: ${name}`)
  const { pixelWidth, pixelHeight } = size
  const record: ImageRecord = { id, name, mime: blob.type, pixelWidth, pixelHeight, blob }
  await withStore('readwrite', (store) => store.put(record))
  return register(record)
}

/** Drops assets no longer referenced by the document, e.g. after an import. */
export async function pruneImageAssets(usedIds: Iterable<string>): Promise<void> {
  const keep = new Set(usedIds)
  const stale = [...registry.keys()].filter((id) => !keep.has(id))
  if (stale.length === 0) return
  for (const id of stale) {
    const asset = registry.get(id)
    if (asset) URL.revokeObjectURL(asset.url)
    registry.delete(id)
  }
  await Promise.all(stale.map((id) => withStore('readwrite', (store) => store.delete(id))))
  emit()
}

/** File extension to use when writing this asset into a zip archive. */
export function extensionFor(asset: ImageAsset): string {
  return MIME_TO_EXT[asset.mime] ?? 'png'
}

// -------------------------------------------------------------- indexeddb

let connection: Promise<IDBDatabase | null> | null = null

function open(): Promise<IDBDatabase | null> {
  connection ??= new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
  })
  return connection
}

/**
 * Runs one request against the image store. Storage failures (private mode,
 * quota) degrade to an in-memory-only session rather than breaking the editor.
 */
async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  const db = await open()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE, mode)
      const request = run(transaction.objectStore(STORE))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      transaction.onabort = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

// ------------------------------------------------------------------ helpers

/** Natural pixel size, or null when the browser can't decode the file. */
async function measure(blob: Blob): Promise<{ pixelWidth: number; pixelHeight: number } | null> {
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return {
      pixelWidth: image.naturalWidth || 1,
      pixelHeight: image.naturalHeight || 1,
    }
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
}

const EXT_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml',
}

/** Comma-separated accept list for the file picker. */
export const IMAGE_ACCEPT = Object.keys(EXT_TO_MIME)
  .map((ext) => `.${ext}`)
  .concat('image/*')
  .join(',')

/** Best-effort mime type from a file name or archive entry path. */
export function mimeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return EXT_TO_MIME[ext] ?? 'image/png'
}

function stripExtension(name: string): string {
  return name.replace(/\.[^./\\]+$/, '')
}
