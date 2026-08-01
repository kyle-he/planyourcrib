import { unzip, zip, type Unzipped, type Zippable } from 'fflate'
import { downloadBlob, pickFile, slugify } from '@/core/files'
import type { Plan } from '@/model/types'
import {
  extensionFor,
  getImageAsset,
  mimeFromPath,
  putImageAsset,
  type ImageAsset,
} from './imageAssets'

const FILE_VERSION = 1
const PLAN_ENTRY = 'plan.json'
const IMAGE_DIR = 'images/'

export const PLAN_ACCEPT = '.zip,.json,application/zip,application/json'

/**
 * Plans are distributed as a zip so the images they reference travel with them:
 *
 *   plan.json          the document (images referenced by id only)
 *   images/<id>.<ext>  one file per referenced image, named after its asset id
 */
export async function downloadPlanArchive(plan: Plan): Promise<void> {
  const document = JSON.stringify({ ...plan, version: FILE_VERSION }, null, 2)
  const files: Zippable = {
    // Text compresses well; the bitmaps below are already compressed formats.
    [PLAN_ENTRY]: [new TextEncoder().encode(document), { level: 9 }],
  }
  for (const asset of usedImages(plan)) {
    const bytes = new Uint8Array(await asset.blob.arrayBuffer())
    files[`${IMAGE_DIR}${asset.id}.${extensionFor(asset)}`] = [bytes, { level: 0 }]
  }
  const archive = await new Promise<Uint8Array>((resolve, reject) => {
    zip(files, (error, data) => (error ? reject(error) : resolve(data)))
  })
  downloadBlob(new Blob([archive as BlobPart], { type: 'application/zip' }), fileName(plan, 'zip'))
}

/**
 * Prompts for a plan archive and restores it, registering any bundled images.
 * Bare .json files from older exports still load (without images).
 */
export async function pickPlanFile(): Promise<Plan | null> {
  const file = await pickFile(PLAN_ACCEPT)
  if (!file) return null
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    return isZip(bytes) ? await readArchive(bytes) : parsePlan(JSON.parse(await file.text()))
  } catch {
    return null
  }
}

async function readArchive(bytes: Uint8Array): Promise<Plan | null> {
  const entries = await new Promise<Unzipped>((resolve, reject) => {
    unzip(bytes, (error, data) => (error ? reject(error) : resolve(data)))
  })

  const document = entries[PLAN_ENTRY] ?? findPlanEntry(entries)
  if (!document) return null
  const plan = parsePlan(JSON.parse(new TextDecoder().decode(document)))
  if (!plan) return null

  // Images must be in place before the plan renders, so await them all.
  await Promise.all(
    Object.entries(entries)
      .filter(([path]) => path.startsWith(IMAGE_DIR) && entries[path]!.length > 0)
      .map(([path, data]) => {
        const name = path.slice(IMAGE_DIR.length)
        const id = name.replace(/\.[^.]+$/, '')
        return putImageAsset({
          id,
          name: id,
          blob: new Blob([data as BlobPart], { type: mimeFromPath(name) }),
        })
      }),
  )
  return plan
}

export function parsePlan(value: unknown): Plan | null {
  if (typeof value !== 'object' || value === null) return null
  const candidate = value as Partial<Plan>
  if (!Array.isArray(candidate.rooms) || !Array.isArray(candidate.items)) return null
  return {
    version: 1,
    name: typeof candidate.name === 'string' ? candidate.name : 'Imported plan',
    rooms: candidate.rooms,
    items: candidate.items,
    openings: Array.isArray(candidate.openings) ? candidate.openings : [],
  }
}

/** Ids of every image the plan still refers to. */
export function referencedImageIds(plan: Plan): Set<string> {
  return new Set(plan.items.flatMap((item) => (item.imageId ? [item.imageId] : [])))
}

function usedImages(plan: Plan): ImageAsset[] {
  return [...referencedImageIds(plan)].flatMap((id) => {
    const asset = getImageAsset(id)
    return asset ? [asset] : []
  })
}

/** A plan saved without any nesting directory still imports cleanly. */
function findPlanEntry(entries: Unzipped): Uint8Array | undefined {
  const path = Object.keys(entries).find((name) => name.endsWith('.json'))
  return path ? entries[path] : undefined
}

const isZip = (bytes: Uint8Array) => bytes[0] === 0x50 && bytes[1] === 0x4b

const fileName = (plan: Plan, extension: string) =>
  `${slugify(plan.name) || 'floor-plan'}.${extension}`
