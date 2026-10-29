export type Limit = { kind: string; pct: number; resetsAt?: string }
export type Snap = { tokens?: number; window: number; percent?: number; usd?: number; limits: Limit[] }

declare module 'claude-code' {
  interface PluginState {
    'usage-bar': { snap: Snap | null }
  }
}
