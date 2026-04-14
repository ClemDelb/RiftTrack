import { useCallback, useRef } from 'react'
import { useToast } from '@/components/toast'

// ── Cooldowns ─────────────────────────────────────────────────────────────────
// Formula: (req_count × users / rate_limit) × window_ms
// Dev key: 100 req / 2 min shared by 10 users → 10 req / 2 min per user
//
// Home     : 10 req × 10 / 100 × 120 000 ms = 120 000 ms (2 min)
// History  : 16 req × 10 / 100 × 120 000 ms = 192 000 ms (~3 min 12 s)
// Champions: 32 req × 10 / 100 × 120 000 ms = 384 000 ms (~6 min 24 s)

export const REFRESH_COOLDOWNS = {
    home: 120_000,
    history: 192_000,
    champions: 384_000,
} as const

export type CooldownScreen = keyof typeof REFRESH_COOLDOWNS

// ── Hook ──────────────────────────────────────────────────────────────────────

function formatRemaining(ms: number): string {
    const secs = Math.ceil(ms / 1000)
    const m = Math.floor(secs / 60)
    const s = secs % 60
    if (m > 0) return s > 0 ? `${m} min ${s} s` : `${m} min`
    return `${s} s`
}

/**
 * Returns a `guard` function to call before each manual refresh.
 * If the cooldown hasn't elapsed, it shows a toast and returns false.
 * If the cooldown has elapsed, it stamps the time and returns true.
 */
export function useRefreshGuard(screen: CooldownScreen) {
    const cooldownMs = REFRESH_COOLDOWNS[screen]
    const lastRefreshTs = useRef<number>(0)
    const { show } = useToast()

    const guard = useCallback((): boolean => {
        const elapsed = Date.now() - lastRefreshTs.current
        if (elapsed < cooldownMs) {
            const remaining = cooldownMs - elapsed
            show(`Actualisation disponible dans ${formatRemaining(remaining)}`)
            return false
        }
        lastRefreshTs.current = Date.now()
        return true
    }, [cooldownMs, show])

    return guard
}
