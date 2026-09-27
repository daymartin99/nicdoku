import { useEffect, useState } from 'preact/hooks'
import { kvGet } from '../db'
import type { PieceArt } from '../themes/types'

const photoCache = new Map<string, string>()

export function Piece({ art, size = '100%' }: { art: PieceArt; size?: string | number }) {
  const style = { width: size, height: size }
  if (art.kind === 'svg') {
    return <span class="piece" style={style} dangerouslySetInnerHTML={{ __html: art.svg }} />
  }
  if (art.kind === 'emoji') {
    return (
      <span class="piece piece-emoji" style={style}>
        {art.char}
      </span>
    )
  }
  return <PhotoPiece id={art.photoId} style={style} />
}

function PhotoPiece({ id, style }: { id: string; style: Record<string, string | number> }) {
  const [src, setSrc] = useState(photoCache.get(id) ?? '')
  useEffect(() => {
    if (photoCache.has(id)) return
    kvGet<string>(`photo:${id}`)
      .then((v) => {
        if (v) {
          photoCache.set(id, v)
          setSrc(v)
        }
      })
      .catch(() => {})
  }, [id])
  return (
    <span class="piece piece-photo" style={style}>
      {src && <img src={src} alt="" draggable={false} />}
    </span>
  )
}
