const P: Record<string, string> = {
  x: 'M6 6l12 12M18 6L6 18',
  expand: 'M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2',
  chat: 'M4 5h16v11H8l-4 4z',
  file: 'M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5',
  check: 'M5 12l5 5L20 7',
  clock: 'M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
  refresh: 'M20 11a8 8 0 00-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0014.5 4.5L20 16M20 20v-4h-4',
  alert: 'M12 9v4M12 17h.01M10.3 4l-8 14A2 2 0 004 21h16a2 2 0 001.7-3l-8-14a2 2 0 00-3.4 0z',
  grip: 'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01',
}

/** Small stroke icon; decorative, so hidden from assistive technology (the control carries the label). */
export function Icon({ name, size = 16 }: { name: keyof typeof P | string; size?: number }) {
  return (
    <svg className="kb-ico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === 'grip' ? 3 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={P[name] ?? ''} />
    </svg>
  )
}
