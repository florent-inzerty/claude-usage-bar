import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Snap } from '../types'

const snapAtom = atom({ plugin: 'usage-bar', key: 'snap' } as const, null)

const WINDOWS: Record<string, { label: string; ms: number }> = {
  five_hour: { label: '5h', ms: 5 * 3600e3 }
}

const dur = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60e3))
  return m >= 1440
    ? `${Math.floor(m / 1440)}j${Math.floor((m % 1440) / 60)}h`
    : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
}

const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 1e5 ? 0 : 1)}k` : `${n}`)
const tone = (p: number) => (p >= 85 ? 'error' : p >= 60 ? 'warning' : 'success')
const bar = (p: number, n = 10) => {
  const f = Math.max(0, Math.min(n, Math.round((p / 100) * n)))
  return { on: '█'.repeat(f), off: '░'.repeat(n - f) }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => (await sync($).catch(() => {}), next(e)))
  on('session.measure', async ($, e, next) => (await sync($).catch(() => {}), next(e)))
  on('prompt.submit', async ($, e, next) => (await sync($).catch(() => {}), next(e)))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const snap = await read($, snapAtom)
    if (!snap || e.props.hasSurvey) return next(e)

    const now = await $.clock.now()
    const { Box, Text } = $.ui.resolve(e)
    const cells: any[] = []
    const sep = (i: string) => <Text key={i} dimColor>│</Text>

    if (snap.tokens != null) {
      const p = snap.percent ?? 0
      const b = bar(p)
      cells.push(
        <Box key="ctx" gap={1}>
          <Text dimColor>ctx</Text>
          <Text color={tone(p)}>{b.on}</Text>
          <Text dimColor>{b.off}</Text>
          <Text bold>{k(snap.tokens)}</Text>
          <Text dimColor>/{k(snap.window)} ({p}%)</Text>
        </Box>
      )
    }
    if (snap.usd != null) {
      cells.push(sep('s0'), <Text key="usd" color="claude" bold>${snap.usd.toFixed(2)}</Text>)
    }
    for (const r of snap.limits) {
      const w = WINDOWS[r.kind]
      if (!w) continue
      const b = bar(r.pct)
      const left = r.resetsAt ? Date.parse(r.resetsAt) - now : null
      const delta = left == null ? null : Math.round(((w.ms - left) / w.ms) * 100 - r.pct)
      cells.push(
        sep('s' + r.kind),
        <Box key={r.kind} gap={1}>
          <Text bold>{w.label}</Text>
          <Text color={tone(r.pct)}>{b.on}</Text>
          <Text dimColor>{b.off}</Text>
          <Text bold color={tone(r.pct)}>{r.pct}%</Text>
          {left != null && <Text dimColor>↻{dur(left)}</Text>}
          {delta != null && (
            <Text bold color={delta >= 0 ? 'success' : 'error'}>
              {delta >= 0 ? `▲ marge +${delta}%` : `▼ trop vite ${delta}%`}
            </Text>
          )}
        </Box>
      )
    }

    return (
      <Box gap={1} paddingX={1} borderStyle="round" borderColor="promptBorder">
        {cells}
      </Box>
    )
  })
}

async function sync($: any) {
  $.ui.status(undefined)
  const u = await $.session.usage()
  const snap: Snap = {
    tokens: u.context.tokens,
    window: u.context.window,
    percent: u.context.percent,
    usd: u.cost?.usd,
    limits: u.rateLimits.map((r: any) => ({ kind: r.kind, pct: r.percentUsed, resetsAt: r.resetsAt }))
  }
  await update($, snapAtom, () => snap)
}
