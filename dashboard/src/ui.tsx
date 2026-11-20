import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { STATUS_LABEL, useI18n } from './i18n'
import type { Status } from './api'

export function Badge({ status }: { status: Status }) {
  const { lang } = useI18n()
  return <span className={`badge b-${status}`}>{STATUS_LABEL[status][lang]}</span>
}

/** Runs `load` on mount and whenever `deps` change; exposes reload. Ignores stale responses. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, set] = useState<{ data?: T; error?: unknown; loading: boolean }>({ loading: true })
  const seq = useRef(0)
  const run = useCallback(() => {
    const n = ++seq.current
    set((s) => ({ ...s, loading: true }))
    load().then((data) => { if (n === seq.current) set({ data, loading: false }) }, (error) => { if (n === seq.current) set({ error, loading: false }) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => { run() }, [run])
  return { ...state, reload: run }
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return <section className="card section">{title && <h3>{title}</h3>}{children}</section>
}

export const shortId = (id: string) => id.slice(0, 8)

/** A label that wraps its control, so assistive technology reads them together. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>
}

export const NEXT: Partial<Record<Status, Status>> = { submitted: 'review', review: 'authority', needs_documents: 'review', authority: 'decision', decision: 'completed' }
export const ago = (ms: number, lang: 'ar' | 'en') => {
  const m = Math.max(0, Math.round((Date.now() - ms) / 60000))
  const rtf = new Intl.RelativeTimeFormat(lang === 'ar' ? 'ar' : 'en', { numeric: 'auto' })
  return m < 60 ? rtf.format(-m, 'minute') : m < 1440 ? rtf.format(-Math.round(m / 60), 'hour') : rtf.format(-Math.round(m / 1440), 'day')
}
