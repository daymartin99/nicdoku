// Small stroke icons used across screens (currentColor).
type P = { size?: number }
const base = (size = 26) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  'stroke-width': 2.6, 'stroke-linecap': 'round' as const, 'stroke-linejoin': 'round' as const,
})

export const BackIcon = ({ size }: P) => (
  <svg {...base(size)}><path d="M19 12H5M11 5l-7 7 7 7" /></svg>
)
export const GearIcon = ({ size }: P) => (
  <svg {...base(size)} fill="currentColor" stroke="none">
    <path d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.2 1.6 2 3.5 2.5-1c.5.4 1.1.8 1.7 1l.4 2.6h4l.4-2.6c.6-.2 1.2-.6 1.7-1l2.5 1 2-3.5L19.4 13ZM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" transform="translate(-1 0)" />
  </svg>
)
export const UndoIcon = ({ size }: P) => (
  <svg {...base(size)}><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
)
export const PencilIcon = ({ size }: P) => (
  <svg {...base(size)}><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></svg>
)
export const ChartIcon = ({ size }: P) => (
  <svg {...base(size)}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
)
export const CalendarIcon = ({ size }: P) => (
  <svg {...base(size)}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
)
export const InfoIcon = ({ size }: P) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></svg>
)
export const CloseIcon = ({ size }: P) => (
  <svg {...base(size)}><path d="M6 6l12 12M18 6 6 18" /></svg>
)
export const ResetIcon = ({ size }: P) => (
  <svg {...base(size)}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>
)
