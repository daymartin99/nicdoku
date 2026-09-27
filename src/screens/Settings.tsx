import { useEffect, useState } from 'preact/hooks'
import { go } from '../router'
import { settings, updateSettings } from '../state/settings'
import { BackIcon, CloseIcon, InfoIcon, PencilIcon } from '../components/Icons'
import { Toggle } from '../components/Toggle'
import { isIos, isStandalone, storagePersisted, checkPersistence, requestPersistence, updateReady, applyUpdate } from '../pwa'
import {
  exportBackup, importBackup, importFamily, getFamily, setFamily, isIsoDate,
  savePhoto, listPhotos, deletePhoto, familyVersion, photosVersion, type Photo,
} from '../backup'
import type { FamilyData, FamilyMember } from '../themes/types'
import './Settings.css'

type Msg = { text: string; err?: boolean; reload?: boolean } | null

function fmtBirthday(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtWhen(ms: number): string {
  if (!ms) return 'Never'
  const days = Math.floor((Date.now() - ms) / 86_400_000)
  const date = new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  if (days <= 0) return `Today (${date})`
  if (days === 1) return `Yesterday (${date})`
  return `${date} · ${days} days ago`
}

/** Reads the chosen file then clears the input so the same file can be picked again. */
function takeFile(e: Event): File | null {
  const input = e.currentTarget as HTMLInputElement
  const f = input.files?.[0] ?? null
  input.value = ''
  return f
}

export function SettingsScreen() {
  const s = settings.value
  const [msg, setMsg] = useState<Msg>(null)
  const [busy, setBusy] = useState(false)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [family, setFam] = useState<FamilyData | null>(null)

  const pv = photosVersion.value
  const fv = familyVersion.value
  useEffect(() => { listPhotos().then(setPhotos).catch(() => setPhotos([])) }, [pv])
  useEffect(() => { getFamily().then(setFam) }, [fv])
  useEffect(() => { void checkPersistence() }, [])

  const say = (text: string, err = false, reload = false) => setMsg({ text, err, reload })

  const run = async (fn: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    setMsg(null)
    try {
      await fn()
    } catch (e) {
      say((e as Error)?.message || 'Something went wrong.', true)
    } finally {
      setBusy(false)
    }
  }

  // ---- photos
  const onPhotoFile = (e: Event) => {
    const f = takeFile(e)
    if (!f) return
    void run(async () => {
      const id = await savePhoto(f)
      updateSettings({ photoPiece: id })
      say('Photo added. It will be your piece on the board.')
    })
  }
  const togglePhoto = (on: boolean) => {
    if (!on) return updateSettings({ photoPiece: null })
    if (photos.length) updateSettings({ photoPiece: photos[photos.length - 1].id })
    else say('Add a photo first, using the button below.')
  }
  const removePhoto = (id: string) => {
    if (!confirm('Delete this photo?')) return
    void run(() => deletePhoto(id))
  }

  // ---- data
  const onExport = () =>
    run(async () => {
      const r = await exportBackup()
      if (r === 'cancelled') return
      say(
        r === 'shared'
          ? 'Backup made. Save it somewhere safe, like Files or an email to yourself.'
          : 'Backup downloaded. Keep the file somewhere safe.',
      )
    })
  const onImportBackup = (e: Event) => {
    const f = takeFile(e)
    if (!f) return
    if (!confirm('Restore from this backup? Your puzzles are merged, and settings are replaced by the backup.')) return
    void run(async () => {
      const r = await importBackup(f)
      const bits = [`${r.solvesAdded} new solve${r.solvesAdded === 1 ? '' : 's'} added (${r.solvesTotal} total)`]
      if (r.familyMembers) bits.push(`${r.familyMembers} family birthdays`)
      if (r.photos) bits.push(`${r.photos} photo${r.photos === 1 ? '' : 's'}`)
      say(`Restored! ${bits.join(', ')}.`, false, r.keysRestored > 0)
    })
  }
  const onImportFamily = (e: Event) => {
    const f = takeFile(e)
    if (!f) return
    void run(async () => {
      const d = await importFamily(f)
      say(`Family loaded: ${d.members.length} birthdays and ${d.specials.length} special dates.`)
    })
  }

  const persisted = storagePersisted.value
  const standalone = isStandalone()
  const version = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'

  return (
    <div class="screen fade-in">
      <div class="topbar">
        <button class="round-btn" aria-label="Back" onClick={() => go('home')}><BackIcon /></button>
        <h1>Settings</h1>
        <div style={{ width: 52 }} />
      </div>

      {msg && (
        <div class={`set-msg${msg.err ? ' err' : ''}`} role="status">
          {msg.text}
          {msg.reload && (
            <div style={{ marginTop: 10 }}>
              <button class="btn small" onClick={() => location.reload()}>Reload now</button>
            </div>
          )}
        </div>
      )}

      {updateReady.value && (
        <div class="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, fontWeight: 600 }}>A new version of Nicdoku is ready.</div>
          <button class="btn small" onClick={() => void applyUpdate()}>Refresh</button>
        </div>
      )}

      <section class="set-group">
        <h2>You</h2>
        <div class="card padded">
          <label class="label" for="set-name" style={{ display: 'block', marginBottom: 6 }}>Your name</label>
          <input
            id="set-name"
            class="text-input"
            type="text"
            autocomplete="given-name"
            maxLength={24}
            value={s.name}
            onInput={(e) => updateSettings({ name: (e.currentTarget as HTMLInputElement).value })}
          />
        </div>
      </section>

      <section class="set-group">
        <h2>Controls</h2>
        <div class="card">
          <div class="set-stack">
            <div class="title" style={{ fontSize: 18, fontWeight: 600 }}>Tapping a square</div>
            <div class="seg" role="group" aria-label="Input mode">
              <button aria-pressed={s.inputMode === 'meowdoku'} onClick={() => updateSettings({ inputMode: 'meowdoku' })}>
                Tap = X, double-tap = piece
              </button>
              <button aria-pressed={s.inputMode === 'cycle'} onClick={() => updateSettings({ inputMode: 'cycle' })}>
                Tap cycles: empty → X → piece
              </button>
            </div>
          </div>
          <Toggle
            label="Auto-cross around pieces"
            note="Puts X's on the squares a piece rules out"
            checked={s.autoX}
            onChange={(v) => updateSettings({ autoX: v })}
          />
          <Toggle label="Show timer" checked={s.showTimer} onChange={(v) => updateSettings({ showTimer: v })} />
          <Toggle
            label="Show rules strip"
            note="The little reminder under the board"
            checked={s.showRules}
            onChange={(v) => updateSettings({ showRules: v })}
          />
        </div>
      </section>

      <section class="set-group">
        <h2>Look &amp; feel</h2>
        <div class="card">
          <Toggle
            label="Region patterns"
            note="Adds a soft pattern to each colour, so colours are never the only clue"
            checked={s.patterns}
            onChange={(v) => updateSettings({ patterns: v })}
          />
          <Toggle label="Sound" checked={s.sound} onChange={(v) => updateSettings({ sound: v })} />
          <Toggle
            label="Haptics"
            note={isIos() ? "iPhone web apps can't vibrate, so this does nothing on iPhone" : undefined}
            checked={s.haptics}
            onChange={(v) => updateSettings({ haptics: v })}
          />
        </div>
      </section>

      <section class="set-group">
        <h2>Pieces</h2>
        <div class="card">
          <Toggle
            label="Use my photo as the piece"
            note="Instead of the theme's piece"
            checked={s.photoPiece !== null}
            onChange={togglePhoto}
          />
          <div class="set-stack">
            {photos.length > 0 && (
              <div class="photo-grid">
                {photos.map((p) => (
                  <div class="photo-thumb" key={p.id}>
                    <button
                      class="pick"
                      aria-label="Use this photo"
                      aria-pressed={s.photoPiece === p.id}
                      onClick={() => updateSettings({ photoPiece: p.id })}
                    >
                      <img src={p.url} alt="" />
                    </button>
                    <button class="del" aria-label="Delete photo" onClick={() => removePhoto(p.id)}>
                      <span>×</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label class="btn small secondary">
              <input type="file" accept="image/*" onChange={onPhotoFile} disabled={busy} />
              Add a photo
            </label>
            <div class="sub muted" style={{ fontSize: 14 }}>
              Photos are shrunk and kept only on this phone.
            </div>
          </div>
        </div>
      </section>

      <FamilySection family={family} busy={busy} onImport={onImportFamily} say={say} />

      <section class="set-group">
        <h2>Your data</h2>
        <div class="card">
          <div class="set-row">
            <div class="grow">
              <div class="title">Last backup</div>
              <div class="sub">{fmtWhen(s.lastBackupAt)}</div>
            </div>
          </div>
          <div class="set-stack">
            <div class="btn-row">
              <button class="btn small" onClick={onExport} disabled={busy}>Export backup</button>
              <label class="btn small secondary">
                <input type="file" accept="application/json,.json" onChange={onImportBackup} disabled={busy} />
                Import backup
              </label>
            </div>
            <div class="sub muted" style={{ fontSize: 14 }}>
              Everything lives on this phone only. A backup file lets you move it to a new phone.
            </div>
          </div>
          <div class="set-row">
            <div class="grow">
              <div class="title">Storage</div>
              <div class="sub">
                {persisted === true
                  ? 'Protected, so iOS won’t tidy it away'
                  : persisted === false
                    ? standalone
                      ? 'Not protected yet'
                      : 'Add to Home Screen to keep it safe'
                    : 'Status unknown on this browser'}
              </div>
            </div>
            {persisted === false && (
              <button class="btn small secondary" onClick={() => void requestPersistence(true)}>Protect</button>
            )}
          </div>
        </div>
      </section>

      <section class="set-group">
        <div class="card">
          <button class="set-row" onClick={() => go('about')}>
            <InfoIcon />
            <div class="grow">
              <div class="title">About Nicdoku</div>
              <div class="sub">How to play, and does it train your brain?</div>
            </div>
            <span aria-hidden="true" style={{ fontSize: 24, color: 'var(--ink-soft)' }}>›</span>
          </button>
        </div>
      </section>

      <div class="version">Nicdoku · version {version}</div>
    </div>
  )
}

// ------------------------------------------------------------------ family

type FamilyProps = {
  family: FamilyData | null
  busy: boolean
  onImport: (e: Event) => void
  say: (text: string, err?: boolean) => void
}

type Draft = { name: string; birthday: string; emoji: string }
const EMPTY: Draft = { name: '', birthday: '', emoji: '' }

function FamilySection({ family, busy, onImport, say }: FamilyProps) {
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const members = family?.members ?? []
  const specials = family?.specials ?? []

  const save = async (nextMembers: FamilyMember[], nextSpecials = specials) => {
    await setFamily({ members: nextMembers, specials: nextSpecials })
  }

  const startEdit = (i: number | 'new') => {
    setEditing(i)
    setDraft(i === 'new' ? EMPTY : { ...EMPTY, ...members[i], emoji: members[i].emoji ?? '' })
  }

  const commit = async () => {
    const name = draft.name.trim()
    if (!name) return say('Add a name first.', true)
    if (!isIsoDate(draft.birthday)) return say('Pick a birthday date.', true)
    const m: FamilyMember = { name, birthday: draft.birthday, ...(draft.emoji.trim() ? { emoji: draft.emoji.trim() } : {}) }
    const next = [...members]
    if (editing === 'new') next.push(m)
    else if (typeof editing === 'number') next[editing] = m
    next.sort((a, b) => a.birthday.slice(5).localeCompare(b.birthday.slice(5)))
    await save(next)
    setEditing(null)
  }

  const remove = async (i: number) => {
    if (!confirm(`Remove ${members[i].name}?`)) return
    await save(members.filter((_, j) => j !== i))
  }

  const removeSpecial = async (i: number) => {
    if (!confirm(`Remove "${specials[i].title}"?`)) return
    await save(members, specials.filter((_, j) => j !== i))
  }

  const removeAll = async () => {
    if (!confirm('Remove all family birthdays and special dates from this phone?')) return
    await setFamily(null)
    setEditing(null)
  }

  const form = (
    <div class="set-stack">
      <input
        class="text-input"
        type="text"
        placeholder="Name"
        value={draft.name}
        maxLength={30}
        onInput={(e) => setDraft({ ...draft, name: (e.currentTarget as HTMLInputElement).value })}
      />
      <div style={{ display: 'flex', gap: 10 }}>
        <input
          class="text-input"
          type="date"
          aria-label="Birthday"
          value={draft.birthday}
          onInput={(e) => setDraft({ ...draft, birthday: (e.currentTarget as HTMLInputElement).value })}
        />
        <input
          class="text-input emoji"
          type="text"
          placeholder="🎂"
          aria-label="Emoji (optional)"
          value={draft.emoji}
          maxLength={8}
          onInput={(e) => setDraft({ ...draft, emoji: (e.currentTarget as HTMLInputElement).value })}
        />
      </div>
      <div class="btn-row">
        <button class="btn small" onClick={() => void commit()}>Save</button>
        <button class="btn small secondary" onClick={() => setEditing(null)}>Cancel</button>
      </div>
    </div>
  )

  return (
    <section class="set-group">
      <h2>Family &amp; dates</h2>
      <div class="card">
        {members.length === 0 && specials.length === 0 && editing === null && (
          <div class="set-row">
            <div class="sub">
              Birthdays give the puzzles a little celebration theme in the days before. Import the family file, or add
              people by hand.
            </div>
          </div>
        )}

        {members.map((m, i) =>
          editing === i ? (
            <div key={`e${i}`}>{form}</div>
          ) : (
            <div class="set-row" key={`${m.name}${i}`}>
              <span class="member-emoji" aria-hidden="true">{m.emoji || '🎂'}</span>
              <div class="grow">
                <div class="title">{m.name}</div>
                <div class="sub">{fmtBirthday(m.birthday)}</div>
              </div>
              <button class="icon-btn" aria-label={`Edit ${m.name}`} onClick={() => startEdit(i)}>
                <PencilIcon size={20} />
              </button>
              <button class="icon-btn" aria-label={`Remove ${m.name}`} onClick={() => void remove(i)}>
                <CloseIcon size={20} />
              </button>
            </div>
          ),
        )}

        {specials.map((d, i) => (
          <div class="set-row" key={`s${d.date}${i}`}>
            <span class="member-emoji" aria-hidden="true">{d.emoji || '⭐'}</span>
            <div class="grow">
              <div class="title">{d.title}</div>
              <div class="sub">
                {new Date(2000, Number(d.date.slice(0, 2)) - 1, Number(d.date.slice(3))).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                })}{' '}
                · every year
              </div>
            </div>
            <button class="icon-btn" aria-label={`Remove ${d.title}`} onClick={() => void removeSpecial(i)}>
              <CloseIcon size={20} />
            </button>
          </div>
        ))}

        {editing === 'new' && form}

        <div class="set-stack">
          <div class="btn-row">
            <button class="btn small secondary" onClick={() => startEdit('new')} disabled={editing !== null}>
              Add a birthday
            </button>
            <label class="btn small secondary">
              <input type="file" accept="application/json,.json" onChange={onImport} disabled={busy} />
              Import family file
            </label>
          </div>
          {(members.length > 0 || specials.length > 0) && (
            <button class="btn small danger" onClick={() => void removeAll()}>Remove all</button>
          )}
        </div>
      </div>
    </section>
  )
}
