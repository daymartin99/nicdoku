import { go } from '../router'
import { MAKER_NAME, OWNER_NAME } from '../config'
import { BackIcon } from '../components/Icons'
import './Settings.css'

const PAL = ['#8E7BDB', '#F7A05E', '#8DD67E', '#F5A2DE', '#A8C8E6', '#D5718E']

/** Tiny board: `regions` rows of region letters, `marks` rows of '.', 'x' or 'o' (piece). */
function MiniGrid({ regions, marks, size = 88 }: { regions: string[]; marks: string[]; size?: number }) {
  const n = regions.length
  const c = 100 / n
  return (
    <svg width={size} height={size} viewBox="-2 -2 104 104" aria-hidden="true">
      <rect x="-2" y="-2" width="104" height="104" rx="10" fill="#fff" />
      {regions.flatMap((row, r) =>
        [...row].map((ch, col) => (
          <rect
            key={`${r}-${col}`}
            x={col * c + 1}
            y={r * c + 1}
            width={c - 2}
            height={c - 2}
            rx={c * 0.18}
            fill={PAL[ch.charCodeAt(0) - 65] ?? '#eee'}
          />
        )),
      )}
      {marks.flatMap((row, r) =>
        [...row].map((m, col) => {
          const cx = col * c + c / 2
          const cy = r * c + c / 2
          if (m === 'x') {
            const d = c * 0.16
            return (
              <path
                key={`m${r}-${col}`}
                d={`M${cx - d} ${cy - d}L${cx + d} ${cy + d}M${cx + d} ${cy - d}L${cx - d} ${cy + d}`}
                stroke="#fff"
                stroke-width={c * 0.09}
                stroke-linecap="round"
              />
            )
          }
          if (m === 'o') {
            return (
              <g key={`m${r}-${col}`}>
                <circle cx={cx} cy={cy} r={c * 0.32} fill="#FFE2C6" stroke="#7a5548" stroke-width={c * 0.06} />
                <circle cx={cx - c * 0.1} cy={cy - c * 0.03} r={c * 0.04} fill="#5c3d33" />
                <circle cx={cx + c * 0.1} cy={cy - c * 0.03} r={c * 0.04} fill="#5c3d33" />
              </g>
            )
          }
          return null
        }),
      )}
    </svg>
  )
}

function Gesture({ kind }: { kind: 'tap' | 'double' | 'drag' }) {
  return (
    <svg width="88" height="56" viewBox="0 0 88 56" aria-hidden="true">
      <rect x="4" y="8" width="80" height="40" rx="12" fill="#fbf6f2" />
      {kind === 'drag' ? (
        <>
          <path d="M20 28H68" stroke="#F7A05E" stroke-width="5" stroke-linecap="round" stroke-dasharray="1 11" />
          <circle cx="68" cy="28" r="9" fill="#F7A05E" opacity="0.9" />
          <path d="M60 22l8 6-8 6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        </>
      ) : (
        <>
          <circle cx="44" cy="28" r="9" fill="#F7A05E" />
          <circle cx="44" cy="28" r="15" fill="none" stroke="#F7A05E" stroke-width="3" opacity="0.5" />
          {kind === 'double' && <circle cx="44" cy="28" r="20" fill="none" stroke="#F7A05E" stroke-width="2.5" opacity="0.3" />}
        </>
      )}
    </svg>
  )
}

export function AboutScreen() {
  return (
    <div class="screen fade-in about">
      <div class="topbar">
        <button class="round-btn" aria-label="Back" onClick={() => go('settings')}><BackIcon /></button>
        <h1>About</h1>
        <div style={{ width: 52 }} />
      </div>

      <section class="card">
        <h2>What this is</h2>
        <p>
          Nicdoku is a little colour puzzle{MAKER_NAME ? ` made by ${MAKER_NAME}` : ''}{OWNER_NAME ? `, just for ${OWNER_NAME}` : ''}. There are no ads, no
          tracking and no accounts. Everything, from your scores to your photos and family dates, stays on your phone.
        </p>
      </section>

      <section class="card">
        <h2>How to play</h2>
        <div class="about-rule">
          <MiniGrid
            regions={['AABB', 'ACCB', 'DDCB', 'DDCC']}
            marks={['.o..', '...o', 'o...', '..o.']}
          />
          <p>Place one piece in every <b>row</b>, every <b>column</b> and every <b>colour</b>.</p>
        </div>
        <div class="about-rule">
          <MiniGrid regions={['EEE', 'EEE', 'EEE']} marks={['xxx', 'xox', 'xxx']} />
          <p>Pieces can't <b>touch</b>, not even corner to corner.</p>
        </div>
        <div class="about-rule">
          <Gesture kind="tap" />
          <p><b>Tap</b> a square to mark it with an X (a square that can't have a piece).</p>
        </div>
        <div class="about-rule">
          <Gesture kind="double" />
          <p><b>Double-tap</b> to place a piece.</p>
        </div>
        <div class="about-rule">
          <Gesture kind="drag" />
          <p><b>Drag</b> across squares to X lots at once.</p>
        </div>
        <p class="muted" style={{ fontSize: 15, marginTop: 6 }}>
          Prefer one tap to cycle empty → X → piece? You can switch in Settings.
        </p>
      </section>

      <section class="card">
        <h2>Does it train your brain?</h2>
        <p>Honest answer: a bit, but probably not the way adverts claim.</p>
        <ul>
          <li>
            Practising puzzles makes you <b>better at puzzles</b>. That part is real.
          </li>
          <li>
            The evidence that "brain games" improve everyday memory or focus in general is weak. A big review
            found people mostly improve at the games they practise, not much else (
            <a href="https://journals.sagepub.com/doi/10.1177/1529100616661983" target="_blank" rel="noopener noreferrer">
              Simons et al., 2016
            </a>
            ).
          </li>
          <li>
            What <i>is</i> supported: short breaks tend to boost energy and reduce tiredness (
            <a
              href="https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0272460"
              target="_blank"
              rel="noopener noreferrer"
            >
              Albulescu et al., 2022
            </a>
            ).
          </li>
        </ul>
        <p>So think of Nicdoku as a focused, enjoyable little reset. Not medicine, just a nice break. 💛</p>
      </section>
    </div>
  )
}
