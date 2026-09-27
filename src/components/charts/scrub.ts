import { useRef, useState } from 'preact/hooks'

/**
 * Tap or drag along a chart to move its tooltip. The index comes from the
 * pointer's x position across the whole svg, so a finger doesn't have to land
 * on a thin bar or a small dot. Tapping the selected item again closes it.
 */
export function useScrub(viewW: number, indexAt: (vx: number) => number | null) {
  const [sel, setSel] = useState<number | null>(null)
  const selRef = useRef<number | null>(null)
  const down = useRef<{ prev: number | null; moved: boolean } | null>(null)

  const set = (i: number | null) => {
    selRef.current = i
    setSel(i)
  }
  const at = (e: PointerEvent): number | null => {
    const r = (e.currentTarget as Element).getBoundingClientRect()
    if (!r.width) return null
    return indexAt(((e.clientX - r.left) / r.width) * viewW)
  }

  const handlers = {
    onPointerDown: (e: PointerEvent) => {
      down.current = { prev: selRef.current, moved: false }
      set(at(e))
    },
    onPointerMove: (e: PointerEvent) => {
      const d = down.current
      if (!d) return
      const i = at(e)
      if (i !== selRef.current) {
        d.moved = true
        set(i)
      }
    },
    onPointerUp: () => {
      const d = down.current
      down.current = null
      if (d && !d.moved && d.prev !== null && d.prev === selRef.current) set(null)
    },
    onPointerCancel: () => {
      down.current = null
    },
  }
  return { sel, handlers }
}
