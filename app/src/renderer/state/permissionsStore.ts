import { useEffect } from 'react'
import { create } from 'zustand'
import type { ServerId } from '@shared/server'
import type { PrivilegeProbeResult } from '@shared/permissions'
import { parseZviaError } from '@renderer/lib/errors'

export interface CapabilityState {
  probe: PrivilegeProbeResult | null
  enabled: Set<string>
  units: Set<string>
  loading: boolean
  error: string | null
  loadedAt: number | null
  pending: boolean
}

interface PermissionsStoreState {
  byServer: Record<ServerId, CapabilityState | undefined>
  ensureLoaded: (serverId: ServerId) => Promise<void>
  invalidate: (serverId: ServerId) => void
}

function emptyState(): CapabilityState {
  return {
    probe: null,
    enabled: new Set(),
    units: new Set(),
    loading: false,
    error: null,
    loadedAt: null,
    pending: false
  }
}

export const usePermissionsStore = create<PermissionsStoreState>((set, get) => ({
  byServer: {},

  async ensureLoaded(serverId: ServerId): Promise<void> {
    const existing = get().byServer[serverId]
    if (existing && (existing.loading || existing.pending || existing.loadedAt !== null)) return
    set((state) => ({
      byServer: { ...state.byServer, [serverId]: { ...emptyState(), loading: true, pending: true } }
    }))
    try {
      const [probe, choices] = await Promise.all([
        window.zvia.privilege.probe({ serverId }),
        window.zvia.permissions.getChoices({ serverId })
      ])
      set((state) => ({
        byServer: {
          ...state.byServer,
          [serverId]: {
            probe,
            enabled: new Set(choices.enabled),
            units: new Set(choices.units),
            loading: false,
            error: null,
            loadedAt: Date.now(),
            pending: false
          }
        }
      }))
    } catch (error) {
      set((state) => ({
        byServer: {
          ...state.byServer,
          [serverId]: {
            ...emptyState(),
            loading: false,
            error: parseZviaError(error).message
          }
        }
      }))
    }
  },

  invalidate(serverId: ServerId): void {
    set((state) => {
      const next = { ...state.byServer }
      delete next[serverId]
      return { byServer: next }
    })
  }
}))

export interface Capabilities {
  loading: boolean
  isRoot: boolean
  /** True when the capability toggle is ON and the probe reports granted. */
  can: (capabilityId: string, unit?: string) => boolean
  /** Human reason when can() is false; null when allowed. */
  reason: (capabilityId: string, unit?: string) => string | null
  refresh: () => Promise<void>
}

/**
 * Single permission evaluation. Null entry (not yet loaded) fails open —
 * no flicker-disabled buttons; the server stays the source of truth.
 * Returns the denial reason, or null when allowed.
 */
function evaluate(
  entry: CapabilityState | undefined,
  capabilityId: string,
  unit?: string
): string | null {
  if (!entry?.probe || entry.probe.isRoot) return null
  if (!entry.enabled.has(capabilityId)) return 'Disabled in Settings → Permissions'
  if (entry.probe.granted[capabilityId] !== true) {
    return 'Not granted on server — review the policy in Settings → Permissions'
  }
  if (unit && !entry.units.has(unit)) return 'Unit not selected in Settings → Permissions'
  return null
}

export function isAllowed(
  entry: CapabilityState | undefined,
  capabilityId: string,
  unit?: string
): boolean {
  return evaluate(entry, capabilityId, unit) === null
}

export function denialReason(
  entry: CapabilityState | undefined,
  capabilityId: string,
  unit?: string
): string | null {
  return evaluate(entry, capabilityId, unit)
}

/** Display message for dispatch-hook denials (buttons already disable first). */
export function denialMessage(
  entry: CapabilityState | undefined,
  capabilityId: string,
  unit?: string
): string {
  return (
    evaluate(entry, capabilityId, unit) ??
    `${capabilityId} is not allowed by the current Settings → Permissions policy.`
  )
}

/**
 * Central permission guard. Disabled = toggle OFF (explicit intent) or probe
 * Denied (server truth). Root allows everything. The sudoers file remains the
 * real boundary; this keeps every button consistent with Settings.
 */
export function useCapabilities(serverId: ServerId | null): Capabilities {
  const entry = usePermissionsStore((state) => (serverId ? state.byServer[serverId] : undefined))
  const ensureLoaded = usePermissionsStore((state) => state.ensureLoaded)

  useEffect(() => {
    if (serverId) void ensureLoaded(serverId)
  }, [serverId, ensureLoaded])

  if (!serverId || !entry?.probe) {
    // Fail open while loading: no flicker-disabled buttons; the server stays
    // the source of truth on attempt (ElevationRequired on denial).
    const loading = entry?.loading ?? serverId !== null
    return {
      loading,
      isRoot: false,
      can: () => true,
      reason: () => null,
      refresh: () => (serverId ? ensureLoaded(serverId) : Promise.resolve())
    }
  }

  const { probe, enabled, units } = entry
  if (probe.isRoot) {
    return {
      loading: false,
      isRoot: true,
      can: () => true,
      reason: () => null,
      refresh: () => ensureLoaded(serverId)
    }
  }

  return {
    loading: false,
    isRoot: false,
    can: (capabilityId: string, unit?: string) => isAllowed(entry, capabilityId, unit),
    reason: (capabilityId: string, unit?: string) => denialReason(entry, capabilityId, unit),
    refresh: () => ensureLoaded(serverId)
  }
}
