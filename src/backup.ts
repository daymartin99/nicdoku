// Backup / restore, private family data and photo pieces.
// Everything lives on her phone: localStorage (nd:*) + IndexedDB (solves, kv).

import { signal } from '@preact/signals'
import { addSolve, allSolves, kvDel, kvGet, kvKeys, kvSet, localDay, type SolveRecord } from './db'
import { settings, updateSettings, type Settings } from './state/settings'
import type { FamilyData, FamilyMember, SpecialDate } from './themes/types'
import { isIos } from './pwa'

export type Backup = {
  app: 'nicdoku'
  version: 1
  exportedAt: string
  settings: Settings
  /** raw localStorage values (JSON strings) for every nd:* key */
  progress: Record<string, string>
  solves: SolveRecord[]
  kv: Record<string, unknown>
}

export type ImportSummary = {
  solvesAdded: number
  solvesTotal: number
  kvRestored: number
  keysRestored: number
  familyMembers: number
  photos: number
  exportedAt: string
}

/** Device-specific keys that shouldn't travel between phones. */
const LS_SKIP = new Set(['nd:persisted', 'nd:persistAsked', 'nd:installHintDismissed'])

/** Bumped whenever family data or photos change so screens can re-read. */
export const familyVersion = signal(0)
export const photosVersion = signal(0)

// ---------------------------------------------------------------- export

function progressKeys(): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith('nd:') || LS_SKIP.has(k)) continue
      const v = localStorage.getItem(k)
      if (v != null) out[k] = v
    }
  } catch {
    /* storage blocked */
  }
  return out
}

export async function buildBackup(): Promise<Backup> {
  const kv: Record<string, unknown> = {}
  for (const k of await kvKeys()) kv[k] = await kvGet(k)
  return {
    app: 'nicdoku',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: settings.value,
    progress: progressKeys(),
    solves: await allSolves(),
    kv,
  }
}

export type ExportResult = 'shared' | 'downloaded' | 'cancelled'

export async function exportBackup(): Promise<ExportResult> {
  const data = await buildBackup()
  const name = `nicdoku-backup-${localDay()}.json`
  const file = new File([JSON.stringify(data)], name, { type: 'application/json' })

  if (isIos() && typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Nicdoku backup' })
      updateSettings({ lastBackupAt: Date.now() })
      return 'shared'
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'cancelled'
      // otherwise fall through to a normal download
    }
  }

  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  updateSettings({ lastBackupAt: Date.now() })
  return 'downloaded'
}

/** Nudge after a month without a backup, once there's something worth saving. */
export async function backupDue(): Promise<boolean> {
  const last = settings.value.lastBackupAt || 0
  if (Date.now() - last < 30 * 24 * 60 * 60 * 1000) return false
  try {
    return (await allSolves()).length >= 10
  } catch {
    return false
  }
}

// ---------------------------------------------------------------- import

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isSolve(v: unknown): v is SolveRecord {
  return isObj(v) && typeof v.at === 'number' && typeof v.day === 'string' && typeof v.n === 'number'
}

export async function importBackup(file: File): Promise<ImportSummary> {
  let data: unknown
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw new Error("That file isn't a Nicdoku backup (couldn't read it).")
  }
  if (!isObj(data) || data.app !== 'nicdoku') throw new Error("That file isn't a Nicdoku backup.")
  if (data.version !== 1) throw new Error('This backup is from a newer version of Nicdoku.')

  // Solves: merge by finish timestamp, never duplicate.
  const existing = await allSolves()
  const seen = new Set(existing.map((s) => s.at))
  let solvesAdded = 0
  const incoming = Array.isArray(data.solves) ? data.solves.filter(isSolve) : []
  incoming.sort((a, b) => a.at - b.at)
  for (const s of incoming) {
    if (seen.has(s.at)) continue
    seen.add(s.at)
    const rest: SolveRecord = { ...s }
    delete rest.id
    await addSolve(rest)
    solvesAdded++
  }

  // kv (family, photos, anything else)
  let kvRestored = 0
  let photos = 0
  let familyMembers = 0
  if (isObj(data.kv)) {
    for (const [k, v] of Object.entries(data.kv)) {
      if (k === 'family') {
        const fam = validateFamily(v)
        if (!fam) continue
        familyMembers = fam.members.length
        await kvSet(k, fam)
      } else if (k.startsWith('photo:')) {
        if (typeof v !== 'string' || !v.startsWith('data:image/')) continue
        photos++
        await kvSet(k, v)
      } else {
        await kvSet(k, v)
      }
      kvRestored++
    }
  }

  // localStorage progress keys
  let keysRestored = 0
  if (isObj(data.progress)) {
    for (const [k, v] of Object.entries(data.progress)) {
      if (!k.startsWith('nd:') || typeof v !== 'string' || LS_SKIP.has(k) || k === 'nd:settings') continue
      try {
        JSON.parse(v)
        localStorage.setItem(k, v)
        keysRestored++
      } catch {
        /* skip bad value */
      }
    }
  }

  // Settings go through the signal so the in-memory copy doesn't overwrite them.
  if (isObj(data.settings)) {
    const s = data.settings as Partial<Settings>
    updateSettings({
      ...s,
      lastBackupAt: Math.max(settings.value.lastBackupAt || 0, Number(s.lastBackupAt) || 0),
    })
  }

  familyVersion.value++
  photosVersion.value++
  return {
    solvesAdded,
    solvesTotal: existing.length + solvesAdded,
    kvRestored,
    keysRestored,
    familyMembers,
    photos,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '',
  }
}

// ---------------------------------------------------------------- family

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const MM_DD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

function cleanEmoji(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, 8) : undefined
}

export function isIsoDate(s: string): boolean {
  return ISO_DATE.test(s)
}

/** Returns a cleaned copy, or null if the shape is wrong. */
export function validateFamily(v: unknown): FamilyData | null {
  if (!isObj(v)) return null
  const rawMembers = v.members ?? []
  const rawSpecials = v.specials ?? []
  if (!Array.isArray(rawMembers) || !Array.isArray(rawSpecials)) return null
  const members: FamilyMember[] = []
  for (const m of rawMembers) {
    if (!isObj(m) || typeof m.name !== 'string' || !m.name.trim()) return null
    if (typeof m.birthday !== 'string' || !ISO_DATE.test(m.birthday)) return null
    const emoji = cleanEmoji(m.emoji)
    members.push({ name: m.name.trim(), birthday: m.birthday, ...(emoji ? { emoji } : {}) })
  }
  const specials: SpecialDate[] = []
  for (const s of rawSpecials) {
    if (!isObj(s) || typeof s.date !== 'string' || !MM_DD.test(s.date)) return null
    if (typeof s.title !== 'string' || typeof s.message !== 'string') return null
    const emoji = cleanEmoji(s.emoji)
    specials.push({ date: s.date, title: s.title, message: s.message, ...(emoji ? { emoji } : {}) })
  }
  return { members, specials }
}

const FAMILY_FILE_ERR = "That isn't a Nicdoku family file. Ask David to send it again."

export async function importFamily(file: File): Promise<FamilyData> {
  let raw: unknown
  try {
    raw = JSON.parse(await file.text())
  } catch {
    throw new Error(FAMILY_FILE_ERR)
  }
  const data = validateFamily(raw)
  if (!data) {
    throw new Error(FAMILY_FILE_ERR)
  }
  await setFamily(data)
  return data
}

export async function getFamily(): Promise<FamilyData | null> {
  try {
    const v = await kvGet<FamilyData>('family')
    return v ? validateFamily(v) : null
  } catch {
    return null
  }
}

/** Save (or clear, when empty/null) the family data. */
export async function setFamily(data: FamilyData | null): Promise<void> {
  if (data && (data.members.length || data.specials.length)) await kvSet('family', data)
  else await kvDel('family')
  familyVersion.value++
}

// ---------------------------------------------------------------- photos

export type Photo = { id: string; url: string }

const PHOTO_PX = 256

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Couldn't open that picture."))
    }
    img.src = url
  })
}

/** Centre-crops to a square, shrinks to 256×256 and stores it as `photo:<id>`. Returns the id. */
export async function savePhoto(file: File): Promise<string> {
  const img = await loadImage(file)
  const w = img.naturalWidth
  const h = img.naturalHeight
  const side = Math.min(w, h)
  const canvas = document.createElement('canvas')
  canvas.width = PHOTO_PX
  canvas.height = PHOTO_PX
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error("Couldn't process that picture.")
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, PHOTO_PX, PHOTO_PX)
  const url = canvas.toDataURL('image/jpeg', 0.86)
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  await kvSet(`photo:${id}`, url)
  photosVersion.value++
  return id
}

/** Data URL for a stored photo, or null. */
export async function getPhoto(id: string): Promise<string | null> {
  const v = await kvGet<string>(`photo:${id}`)
  return typeof v === 'string' ? v : null
}

export async function listPhotos(): Promise<Photo[]> {
  const out: Photo[] = []
  for (const k of await kvKeys()) {
    if (!k.startsWith('photo:')) continue
    const url = await kvGet<string>(k)
    if (typeof url === 'string') out.push({ id: k.slice(6), url })
  }
  return out.sort((a, b) => a.id.localeCompare(b.id))
}

export async function deletePhoto(id: string): Promise<void> {
  await kvDel(`photo:${id}`)
  if (settings.value.photoPiece === id) updateSettings({ photoPiece: null })
  photosVersion.value++
}
