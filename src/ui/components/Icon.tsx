import type { ReactNode, SVGProps } from 'react'

/**
 * Tiny hand-rolled icon set (24x24 stroke geometry) so the app ships without an
 * icon dependency. Add new glyphs to PATHS and they become available by name.
 */
export type IconName = keyof typeof PATHS

const PATHS = {
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.6v.2h-4V21a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 00.3-1.9A1.7 1.7 0 003 14H2.8v-4H3a1.7 1.7 0 001.6-1 1.7 1.7 0 00-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 009 4.6 1.7 1.7 0 0010 3v-.2h4V3a1.7 1.7 0 001 1.6 1.7 1.7 0 001.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 00-.3 1.9 1.7 1.7 0 001.6 1h.2v4H21a1.7 1.7 0 00-1.6 1z" />
    </>
  ),
  cursor: <path d="M5 3l14 8.5-6.2 1.2L11 20 5 3z" />,
  room: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1" />
      <path d="M3.5 15.5h6v4" />
    </>
  ),
  door: (
    <>
      <path d="M4 20h16" />
      <path d="M7 20V5a1 1 0 011-1h8a1 1 0 011 1v15" />
      <path d="M13.5 12.2h.01" />
    </>
  ),
  window: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="1" />
      <path d="M12 5.5v13M3.5 12h17" />
    </>
  ),
  ruler: (
    <>
      <path d="M3 15.5L15.5 3 21 8.5 8.5 21 3 15.5z" />
      <path d="M7.5 11l2 2M11 7.5l2 2M14.5 4l2 2" />
    </>
  ),
  undo: (
    <>
      <path d="M4 8h10a5 5 0 010 10H8" />
      <path d="M8 4L4 8l4 4" />
    </>
  ),
  redo: (
    <>
      <path d="M20 8H10a5 5 0 000 10h6" />
      <path d="M16 4l4 4-4 4" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 12.5h9L17.5 7" />
      <path d="M10.5 10.5v6M13.5 10.5v6" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11.5" height="11.5" rx="2" />
      <path d="M15 5.5A2 2 0 0013 3.5H5.5a2 2 0 00-2 2V13a2 2 0 002 2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  fit: (
    <>
      <path d="M4 9V5.5A1.5 1.5 0 015.5 4H9M15 4h3.5A1.5 1.5 0 0120 5.5V9M20 15v3.5a1.5 1.5 0 01-1.5 1.5H15M9 20H5.5A1.5 1.5 0 014 18.5V15" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" />
      <path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17" />
    </>
  ),
  magnet: (
    <>
      <path d="M6 4v7a6 6 0 0012 0V4" />
      <path d="M6 10h4M14 10h4" />
      <path d="M6 4h4M14 4h4" />
    </>
  ),
  download: (
    <>
      <path d="M12 3.5v11" />
      <path d="M7.5 10L12 14.5 16.5 10" />
      <path d="M4 18.5h16" />
    </>
  ),
  upload: (
    <>
      <path d="M12 14.5v-11" />
      <path d="M7.5 8L12 3.5 16.5 8" />
      <path d="M4 18.5h16" />
    </>
  ),
  file: (
    <>
      <path d="M6 3.5h7L18.5 9v11.5H6z" />
      <path d="M13 3.5V9h5.5" />
    </>
  ),
  keyboard: (
    <>
      <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
      <path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7.5 14h9" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  chevronRight: <path d="M9 5l7 7-7 7" />,
  chevronDown: <path d="M5 9l7 7 7-7" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
    </>
  ),
  rotate: (
    <>
      <path d="M20 12a8 8 0 11-2.4-5.7" />
      <path d="M20 4v4.5h-4.5" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 018 0v3" />
    </>
  ),
  unlock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 017.4-2" />
    </>
  ),
  front: (
    <>
      <rect x="7.5" y="7.5" width="9" height="9" rx="1.5" />
      <path d="M4.5 12.5v5A2 2 0 006.5 19.5h5M12.5 4.5h5a2 2 0 012 2v5" />
    </>
  ),
  back: (
    <>
      <rect x="4.5" y="4.5" width="9" height="9" rx="1.5" />
      <path d="M10.5 17.5h7a2 2 0 002-2v-7" />
    </>
  ),
  dimension: (
    <>
      <path d="M3 8v8M21 8v8M3 12h18" />
      <path d="M6.5 9.5L4 12l2.5 2.5M17.5 9.5L20 12l-2.5 2.5" />
    </>
  ),
  tag: (
    <>
      <path d="M11 3.5H5.5a2 2 0 00-2 2V11L13 20.5l7.5-7.5z" />
      <circle cx="8" cy="8" r="1.4" />
    </>
  ),
  sofa: (
    <>
      <path d="M4 11V7.5A2 2 0 016 5.5h12a2 2 0 012 2V11" />
      <path d="M3 11.5h18v6a1 1 0 01-1 1H4a1 1 0 01-1-1z" />
      <path d="M7 11.5v-3M17 11.5v-3" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3.5l8.5 4.5L12 12.5 3.5 8z" />
      <path d="M3.5 13l8.5 4.5 8.5-4.5" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="M4 17l4.5-5 3 3.2 3-3.7 5.5 6.5" />
    </>
  ),
  hand: (
    <>
      <path d="M8 12V5.5a1.5 1.5 0 013 0V11" />
      <path d="M11 11V4.5a1.5 1.5 0 013 0V11" />
      <path d="M14 11V6.5a1.5 1.5 0 013 0V15a5.5 5.5 0 01-5.5 5.5h-1A5.5 5.5 0 015 15v-2.5a1.5 1.5 0 013 0" />
    </>
  ),
} satisfies Record<string, ReactNode>

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  size?: number
}

export function Icon({ name, size = 16, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  )
}
