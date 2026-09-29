import { useEffect, useRef, useState } from 'preact/hooks'
import { ResetSection } from '../components/ResetSection'
import { go } from '../router'
import { nextPersonalLine } from '../state/theme'
import { settings, updateSettings } from '../state/settings'
import { game, resetBoard } from '../state/game'
import { BackIcon, CloseIcon, InfoIcon, PencilIcon } from '../components/Icons'
import { Toggle } from '../components/Toggle'
import { isIos, isStandalone, storagePersisted, checkPersistence, requestPersistence, updateReady, applyUpdate } from '../pwa'
import {
  exportBackup, importBackup, importFamily, importFamilyCode, getFamily, setFamily, isIsoDate,
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

  // Good news fades after a few seconds; errors and "reload now" stay until dismissed or replaced.
  useEffect(() => {
    if (!msg || msg.err || msg.reload) return
    const t = setTimeout(() => setMsg(null), 4000)
    return () => clearTimeout(t)
  }, [msg])

  // A ref as well as state, so a fast double-tap can't start the same job twice.
  const busyRef = useRef(false)
  const run = async (fn: () => Promise<void>) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setMsg(null)
    try {
      await fn()
    } catch (e) {
      say((e as Error)?.message || 'Something went wrong.', true)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  // ---- current puzzle
  const g = game.value
  const onRestart = () => {
    if (!confirm('Start this puzzle again from an empty board?')) return
    resetBoard()
    go('game')
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
    const n = (family?.members.length ?? 0) + (family?.specials.length ?? 0)
    if (n > 0 && !confirm(`Replace your ${n} birthday${n === 1 ? '' : 's'} and dates with the ones in this file?`)) return
    void run(async () => {
      const d = await importFamily(f)
      say(familyLoadedMsg(d))
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
        <div class={`set-msg${msg.err ? ' err' : ''}`} role={msg.err ? 'alert' : 'status'}>
          <div class="set-msg-text">{msg.text}</div>
          {!msg.reload && (
            <button class="set-msg-x" aria-label="Dismiss" onClick={() => setMsg(null)}>
              <CloseIcon size={18} />
            </button>
          )}
          {msg.reload && (
            <div class="set-msg-actions">
              <button class="btn small" onClick={() => location.reload()}>Reload now</button>
            </div>
          )}
        </div>
      )}

      {g && !g.done && (
        <section class="set-group">
          <h2>This puzzle</h2>
          <div class="card">
            <button class="set-row" onClick={onRestart}>
              <div class="grow">
                <div class="title">Restart this puzzle</div>
                <div class="sub">Clears the board so you can start it fresh</div>
              </div>
              <span aria-hidden="true" style={{ fontSize: 24, color: 'var(--ink-soft)' }}>›</span>
            </button>
          </div>
        </section>
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
          {/* iPhone web apps can't vibrate, so the switch would do nothing there. */}
          {!isIos() && (
            <Toggle label="Haptics" checked={s.haptics} onChange={(v) => updateSettings({ haptics: v })} />
          )}
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

      <FamilySection family={family} busy={busy} onImport={onImportFamily} say={say} run={run} />

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
            {persisted === false && standalone && (
              <button class="btn small secondary" onClick={() => void requestPersistence(true)}>Protect</button>
            )}
          </div>
        </div>
      </section>

      <ResetSection onBackup={onExport} busy={busy} />

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

/** Confirmation that proves it worked, e.g. "8 birthdays and 1 special date loaded. Next: 🎂 Sam's birthday in 27 days" */
function familyLoadedMsg(d: FamilyData): string {
  const b = `${d.members.length} birthday${d.members.length === 1 ? '' : 's'}`
  const sp = d.specials.length ? ` and ${d.specials.length} special date${d.specials.length === 1 ? '' : 's'}` : ''
  const next = nextPersonalLine(new Date(), d, 400)
  return `${b}${sp} loaded.${next ? ` Next: ${next}` : ''}`
}

type FamilyProps = {
  family: FamilyData | null
  busy: boolean
  onImport: (e: Event) => void
  say: (text: string, err?: boolean) => void
  run: (fn: () => Promise<void>) => Promise<void>
}

type Draft = { name: string; birthday: string; emoji: string }
const EMPTY: Draft = { name: '', birthday: '', emoji: '' }

function FamilySection({ family, busy, onImport, say, run }: FamilyProps) {
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [pasting, setPasting] = useState(false)
  const [code, setCode] = useState('')
  const members = family?.members ?? []
  const specials = family?.specials ?? []

  const save = async (nextMembers: FamilyMember[], nextSpecials = specials) => {
    await setFamily({ members: nextMembers, specials: nextSpecials })
  }

  const startEdit = (i: number | 'new') => {
    setEditing(i)
    setDraft(i === 'new' ? EMPTY : { ...EMPTY, ...members[i], emoji: members[i].emoji ?? '' })
  }

  const commit = () => {
    if (busy) return
    const name = draft.name.trim()
    if (!name) return say('Add a name first.', true)
    if (!isIsoDate(draft.birthday)) return say('Pick a birthday date.', true)
    const m: FamilyMember = { name, birthday: draft.birthday, ...(draft.emoji.trim() ? { emoji: draft.emoji.trim() } : {}) }
    const next = [...members]
    if (editing === 'new') next.push(m)
    else if (typeof editing === 'number') next[editing] = m
    next.sort((a, b) => a.birthday.slice(5).localeCompare(b.birthday.slice(5)))
    void run(async () => {
      await save(next)
      setEditing(null)
    })
  }

  const remove = (i: number) => {
    if (!confirm(`Remove ${members[i].name}?`)) return
    void run(() => save(members.filter((_, j) => j !== i)))
  }

  const removeSpecial = (i: number) => {
    if (!confirm(`Remove "${specials[i].title}"?`)) return
    void run(() => save(members, specials.filter((_, j) => j !== i)))
  }

  const importCode = () => {
    if (busy || !code.trim()) return
    const n = members.length + specials.length
    if (n > 0 && !confirm(`Replace your ${n} birthday${n === 1 ? '' : 's'} and dates with the ones in this code?`)) return
    void run(async () => {
      const d = await importFamilyCode(code)
      setCode('')
      setPasting(false)
      say(familyLoadedMsg(d))
    })
  }

  const removeAll = () => {
    if (!confirm('Remove all family birthdays and special dates from this phone?')) return
    void run(async () => {
      await setFamily(null)
      setEditing(null)
    })
  }

  const form = (
    <div class="set-stack">
      <label class="field">
        <span class="label">Name</span>
        <input
          class="text-input"
          type="text"
          value={draft.name}
          maxLength={30}
          onInput={(e) => setDraft({ ...draft, name: (e.currentTarget as HTMLInputElement).value })}
        />
      </label>
      <div class="field-row">
        <label class="field grow">
          <span class="label">Birthday</span>
          <input
            class="text-input"
            type="date"
            value={draft.birthday}
            onInput={(e) => setDraft({ ...draft, birthday: (e.currentTarget as HTMLInputElement).value })}
          />
        </label>
        <label class="field">
          <span class="label">Emoji (optional)</span>
          <input
            class="text-input emoji"
            type="text"
            placeholder="🎂"
            value={draft.emoji}
            maxLength={8}
            onInput={(e) => setDraft({ ...draft, emoji: (e.currentTarget as HTMLInputElement).value })}
          />
        </label>
      </div>
      <div class="btn-row">
        <button class="btn small" onClick={commit} disabled={busy}>Save</button>
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
              <button class="icon-btn" aria-label={`Remove ${m.name}`} onClick={() => remove(i)}>
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
            <button class="icon-btn" aria-label={`Remove ${d.title}`} onClick={() => removeSpecial(i)}>
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
            <button class="btn small secondary" onClick={() => setPasting(!pasting)} disabled={busy} aria-expanded={pasting}>
              Paste a code
            </button>
          </div>
          {pasting && (
            <div class="set-stack">
              <label class="field">
                <span class="label">Paste the code you were sent (it starts NICDOKU1:)</span>
                <textarea
                  class="text-input code-input"
                  rows={4}
                  value={code}
                  placeholder="NICDOKU1:…"
                  autocomplete="off"
                  autocapitalize="off"
                  spellcheck={false}
                  onInput={(e) => setCode((e.currentTarget as HTMLTextAreaElement).value)}
                />
              </label>
              <button class="btn small" onClick={importCode} disabled={busy || !code.trim()}>
                Load birthdays
              </button>
            </div>
          )}
          {(members.length > 0 || specials.length > 0) && (
            <button class="btn small danger" onClick={removeAll} disabled={busy}>Remove all</button>
          )}
        </div>
      </div>
    </section>
  )
}
