import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ServerId } from '@shared/server'
import type { PrivilegeProbeResult } from '@shared/permissions'
import {
  PERMISSION_CAPABILITIES,
  PERMISSION_CATEGORIES,
  buildSudoersEntry,
  type PermissionCategory,
  type PermissionDanger
} from '@shared/permissions'
import { Button } from '@renderer/components/ui/button'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { ErrorSurface } from '@renderer/components/errors/ErrorSurface'
import { useNavigationStore } from '@renderer/state/navigationStore'
import { usePermissionsStore } from '@renderer/state/permissionsStore'
import { parseZviaError } from '@renderer/lib/errors'
import { cn } from '@renderer/lib/utils'

interface PermissionsTabProps {
  serverId: ServerId
  isConnected: boolean
}

function dangerChipClass(danger: PermissionDanger): string {
  if (danger === 'critical') return 'bg-status-error/25 text-status-error'
  if (danger === 'high') return 'bg-status-error/15 text-status-error'
  if (danger === 'medium') return 'bg-status-warning/15 text-status-warning'
  return 'bg-status-healthy/15 text-status-healthy'
}

function categoryDotClass(category: PermissionCategory): string {
  if (category === 'read-only') return 'bg-status-healthy'
  if (category === 'service-control') return 'bg-status-warning'
  if (category === 'operational') return 'bg-status-warning'
  return 'bg-status-error'
}

export function PermissionsTab({ serverId, isConnected }: PermissionsTabProps) {
  const openWithIntent = useNavigationStore((state) => state.openWithIntent)
  const refreshGuards = usePermissionsStore((state) => state.ensureLoaded)
  const invalidateGuards = usePermissionsStore((state) => state.invalidate)
  const [probe, setProbe] = useState<PrivilegeProbeResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [enabled, setEnabled] = useState<Set<string>>(new Set())
  const [units, setUnits] = useState<Set<string>>(new Set())
  const [availableUnits, setAvailableUnits] = useState<string[]>([])
  const [configRoot, setConfigRoot] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  // Last draft confirmed written to local storage. Differs from `enabled` /
  // `units` while a save is in flight or when a save failed.
  const [savedSnapshot, setSavedSnapshot] = useState<{
    enabled: string[]
    units: string[]
  } | null>(null)
  const [showCommands, setShowCommands] = useState<Set<string>>(new Set())
  const [openSections, setOpenSections] = useState<Set<PermissionCategory>>(
    new Set(PERMISSION_CATEGORIES.map((category) => category.id))
  )

  const loadAll = useCallback(async () => {
    if (!isConnected) return
    setChecking(true)
    setError(null)
    try {
      const [probeResult, choices] = await Promise.all([
        window.zvia.privilege.probe({ serverId }),
        window.zvia.permissions.getChoices({ serverId })
      ])
      setProbe(probeResult)
      setEnabled(new Set(choices.enabled))
      setUnits(new Set(choices.units))
      setSavedSnapshot({ enabled: choices.enabled, units: choices.units })
      const [nginxStatus, services] = await Promise.all([
        window.zvia.nginx.status({ serverId }).catch(() => null),
        window.zvia.services.list({ serverId }).catch(() => [])
      ])
      setConfigRoot(nginxStatus?.paths.configRoot ?? null)
      setAvailableUnits(services.map((unit) => unit.unit).sort())
      invalidateGuards(serverId)
      await refreshGuards(serverId)
    } catch (err) {
      setError(parseZviaError(err).message)
    } finally {
      setChecking(false)
    }
  }, [isConnected, serverId, invalidateGuards, refreshGuards])

  useEffect(() => {
    setProbe(null)
    void loadAll()
  }, [loadAll])

  const persist = async (nextEnabled: Set<string>, nextUnits: Set<string>): Promise<void> => {
    setSaving(true)
    try {
      const saved = await window.zvia.permissions.setChoices({
        serverId,
        enabled: [...nextEnabled],
        units: [...nextUnits]
      })
      setEnabled(new Set(saved.enabled))
      setUnits(new Set(saved.units))
      setSavedSnapshot({ enabled: saved.enabled, units: saved.units })
      invalidateGuards(serverId)
      await refreshGuards(serverId)
    } catch (err) {
      setError(parseZviaError(err).message)
    } finally {
      setSaving(false)
    }
  }

  const toggleCapability = (id: string, checked: boolean): void => {
    const next = new Set(enabled)
    if (checked) next.add(id)
    else next.delete(id)
    setEnabled(next)
    void persist(next, units)
  }

  const toggleUnit = (unit: string, checked: boolean): void => {
    const next = new Set(units)
    if (checked) next.add(unit)
    else next.delete(unit)
    setUnits(next)
    void persist(enabled, next)
  }

  const toggleSection = (id: PermissionCategory): void => {
    setOpenSections((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleCommands = (id: string): void => {
    setShowCommands((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const entry = useMemo(() => {
    if (!probe) return ''
    return buildSudoersEntry(probe.username, enabled, {
      configRoot,
      units: [...units].sort()
    })
  }, [probe, enabled, configRoot, units])

  const pendingCount = useMemo(
    () => [...enabled].filter((id) => probe?.granted[id] !== true).length,
    [enabled, probe]
  )

  // Reverse divergence: unchecked locally but still granted on the server.
  // Root ignores sudoers, so divergence banners only apply to non-root.
  const revokedCount = useMemo(() => {
    if (!probe || probe.isRoot) return 0
    return PERMISSION_CAPABILITIES.filter(
      (cap) => !enabled.has(cap.id) && probe.granted[cap.id] === true
    ).length
  }, [enabled, probe])

  const resetDraftToServer = (): void => {
    if (!probe) return
    const next = new Set(
      PERMISSION_CAPABILITIES.map((cap) => cap.id).filter((id) => probe.granted[id] === true)
    )
    setEnabled(next)
    void persist(next, units)
  }

  // Draft differs from the last locally saved state: a save is in flight or
  // the last save failed (error above says why).
  const draftUnsaved = useMemo(() => {
    if (!savedSnapshot) return false
    const same = (current: Set<string>, saved: string[]): boolean =>
      current.size === saved.length && saved.every((id) => current.has(id))
    return !same(enabled, savedSnapshot.enabled) || !same(units, savedSnapshot.units)
  }, [enabled, units, savedSnapshot])

  const draftInSyncWithServer =
    probe != null && !probe.isRoot && pendingCount === 0 && revokedCount === 0

  const copyEntry = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(entry)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Selectable as plain text when clipboard is unavailable.
    }
  }

  const openTerminalApply = (): void => {
    // VISUAL/EDITOR first: visudo defaults to vi, nano is the safer guided
    // choice. sudo accepts VAR=value prefixes unless explicitly restricted.
    // visudo -f creates the file with umask permissions; sudo ignores
    // sudoers.d files unless they are exactly 0440, so fix + verify in chain.
    openWithIntent(serverId, {
      tool: 'terminal',
      prefill:
        'sudo VISUAL=nano EDITOR=nano visudo -f /etc/sudoers.d/zvia && sudo chmod 0440 /etc/sudoers.d/zvia && sudo visudo -c'
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-divider px-3 py-2">
        <p className="mt-2 text-xs leading-relaxed text-text-secondary">
          Step 1 — select below. Toggles only edit the local policy draft (auto-saved).
          Step 2 — apply the draft on the server via visudo. Step 3 — Re-check.
          Nothing changes on the server until you do.
        </p>
        {probe && !probe.isRoot && (
          <p className="mt-1 text-[11px] text-text-tertiary">
            {probe.sudoKind === 'password' || probe.sudoKind === 'none'
              ? 'This SSH user cannot elevate non-interactively today.'
              : 'This SSH user already has some passwordless sudo grants.'}
          </p>
        )}
        {probe?.isRoot && (
          <p className="mt-1 text-[11px] text-text-tertiary">
            Connected as root — everything is already allowed.
          </p>
        )}
        {probe && !probe.isRoot && probe.unrestricted && (
          <p className="mt-1 text-[11px] text-text-tertiary">
            This user already has full passwordless sudo (`ALL`) — every capability is
            granted regardless of the draft below. The policy is redundant for this server.
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <Button size="sm" variant="ghost" disabled={checking} onClick={() => void loadAll()}>
            Re-check
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!probe || probe.isRoot || checking || saving || draftInSyncWithServer}
            onClick={resetDraftToServer}
            title={
              !probe || probe.isRoot
                ? 'Available once the server probe loads'
                : draftInSyncWithServer
                  ? 'Draft already matches the server'
                  : 'Set every checkbox to what the server actually grants'
            }
          >
            Reset to server
          </Button>
          <span className="ml-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-text-tertiary">
            <span
              className={cn(
                'size-1.5 rounded-full',
                saving || draftUnsaved ? 'bg-status-warning' : 'bg-status-healthy'
              )}
              aria-hidden
            />
            {saving ? 'Saving…' : draftUnsaved ? 'Unsaved draft' : 'Draft saved'}
          </span>
        </div>
      </div>

      {error && (
        <div className="border-b border-divider p-3">
          <ErrorSurface error={error} onDismiss={() => setError(null)} />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto pb-6">
        {checking && !probe ? (
          <p className="p-6 text-center text-xs text-text-secondary">Checking permissions…</p>
        ) : (
          <>
            <p className="px-3 pb-1 pt-3 text-[11px] text-text-tertiary">
              {enabled.size} of {PERMISSION_CAPABILITIES.length} in local policy draft.
              Unchecking removes its lines from the draft below, not from the server.
            </p>
            {(pendingCount > 0 || revokedCount > 0) && probe && !probe.isRoot && !probe.unrestricted && (
              <div className="mx-3 mb-1 flex flex-wrap items-center gap-2 rounded-panel bg-bg-secondary px-2 py-1.5">
                <p className="text-[11px] leading-relaxed text-status-warning">
                  Draft differs from server
                  {pendingCount > 0 &&
                    revokedCount > 0 &&
                    `: ${pendingCount} to add, ${revokedCount} to remove`}
                  {pendingCount > 0 &&
                    revokedCount === 0 &&
                    `: ${pendingCount} selected but not granted yet`}
                  {revokedCount > 0 &&
                    pendingCount === 0 &&
                    `: ${revokedCount} still granted on the server but not in the draft`}
                  . Apply via visudo below, then Re-check — or Reset to server above.
                </p>
              </div>
            )}
            {PERMISSION_CATEGORIES.map((category) => (
              <CategorySection
                key={category.id}
                categoryId={category.id}
                title={category.title}
                blurb={category.blurb}
                open={openSections.has(category.id)}
                onToggleOpen={() => toggleSection(category.id)}
                probe={probe}
                enabled={enabled}
                saving={saving}
                showCommands={showCommands}
                availableUnits={availableUnits}
                units={units}
                onToggleCapability={toggleCapability}
                onToggleCommands={toggleCommands}
                onToggleUnit={toggleUnit}
              />
            ))}

            <h3 className="px-3 pb-1 pt-3 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
              Policy draft — apply on server
            </h3>
            <div className="px-3">
              {enabled.size === 0 ? (
                <p className="py-1 text-xs text-text-tertiary">
                  Nothing selected — enable capabilities above to generate the policy.
                </p>
              ) : (
                <>
                  {pendingCount > 0 && (
                    <p className="mb-2 text-[11px] leading-relaxed text-status-warning">
                      {pendingCount} selected {pendingCount === 1 ? 'capability is' : 'capabilities are'}{' '}
                      not granted on the server yet — draft only. Apply below, then Re-check.
                    </p>
                  )}
                  <pre className="overflow-x-auto whitespace-pre-wrap rounded-panel bg-bg-secondary p-3 font-mono text-[11px] leading-relaxed text-text-secondary">
                    {entry}
                  </pre>
                  <p className="mt-2 text-[11px] leading-relaxed text-text-tertiary">
                    Add this line via <span className="font-mono">visudo</span> on the server
                    (opens <span className="font-mono">nano</span>; paste,{' '}
                    <span className="font-mono">Ctrl+O</span>, <span className="font-mono">Enter</span>,{' '}
                    <span className="font-mono">Ctrl+X</span>), then{' '}
                    <span className="font-mono">sudo chmod 0440 /etc/sudoers.d/zvia</span> —
                    sudo ignores the file at any other mode — verify with{' '}
                    <span className="font-mono">sudo visudo -c</span> and
                    Re-check above. The app never applies it for you. The Continue in
                    Terminal button types the whole sequence for you.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={() => void copyEntry()}>
                      {copied ? 'Copied' : 'Copy policy'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={openTerminalApply}>
                      Continue in Terminal
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={checking}
                      onClick={() => void loadAll()}
                    >
                      Re-check
                    </Button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

interface CategorySectionProps {
  categoryId: PermissionCategory
  title: string
  blurb: string
  open: boolean
  onToggleOpen: () => void
  probe: PrivilegeProbeResult | null
  enabled: Set<string>
  saving: boolean
  showCommands: Set<string>
  availableUnits: string[]
  units: Set<string>
  onToggleCapability: (id: string, checked: boolean) => void
  onToggleCommands: (id: string) => void
  onToggleUnit: (unit: string, checked: boolean) => void
}

function CategorySection({
  categoryId,
  title,
  blurb,
  open,
  onToggleOpen,
  probe,
  enabled,
  saving,
  showCommands,
  availableUnits,
  units,
  onToggleCapability,
  onToggleCommands,
  onToggleUnit
}: CategorySectionProps) {
  const capabilities = PERMISSION_CAPABILITIES.filter((cap) => cap.category === categoryId)
  const enabledCount = capabilities.filter((cap) => enabled.has(cap.id)).length
  return (
    <div key={categoryId} className="border-t border-divider">
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <span className={cn('size-1.5 rounded-full', categoryDotClass(categoryId))} aria-hidden />
        <span className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          {title}
        </span>
        <span className="text-[10px] text-text-tertiary">
          {enabledCount}/{capabilities.length}
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-text-tertiary">
          {open ? 'Hide' : 'Show'}
          <span
            aria-hidden
            className={cn(
              'inline-block text-sm leading-none transition-transform duration-default',
              open ? 'rotate-90' : ''
            )}
          >
            ‹
          </span>
        </span>
      </button>
      {open && (
        <>
          {blurb && <p className="px-3 pb-1 text-[11px] text-text-tertiary">{blurb}</p>}
          {categoryId === 'root-equivalent' && (
            <p className="px-3 pb-2 text-[11px] leading-relaxed text-status-error">
              Effectively root. These capabilities can take over the machine; enable them only
              for full server administration.
            </p>
          )}
      {capabilities.map((cap) => {
        const checked = enabled.has(cap.id)
        const granted = probe?.granted[cap.id]
        return (
          <div key={cap.id} className="border-t border-divider px-3 py-2">
            <div className="flex items-start gap-2">
              <Checkbox
                checked={checked}
                disabled={saving || probe?.isRoot === true}
                onCheckedChange={(value) => onToggleCapability(cap.id, value === true)}
                aria-label={cap.label}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-text">{cap.label}</span>
                  <span
                    className={cn(
                      'rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                      dangerChipClass(cap.danger)
                    )}
                  >
                    {cap.danger}
                  </span>
                  {granted !== undefined && (
                    <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-text-tertiary">
                      <span
                        className={cn(
                          'size-1.5 rounded-full',
                          !checked
                            ? granted === true && probe?.isRoot !== true
                              ? 'bg-status-warning'
                              : 'bg-text-tertiary'
                            : granted
                              ? 'bg-status-healthy'
                              : 'bg-status-warning'
                        )}
                        aria-hidden
                      />
                      {!checked
                        ? granted === true && probe?.isRoot !== true
                          ? 'Still granted'
                          : 'Not in draft'
                        : granted
                          ? 'Granted'
                          : 'Pending'}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-text-secondary">{cap.description}</p>
                {cap.operations.length > 0 && (
                  <p className="mt-0.5 font-mono text-[10px] text-text-tertiary">
                    {cap.operations.join(' · ')}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => onToggleCommands(cap.id)}
                  className="mt-1 text-[11px] text-text-tertiary underline-offset-2 hover:text-text hover:underline"
                >
                  {showCommands.has(cap.id) ? 'Hide exact commands' : 'Show exact commands'}
                </button>
                {showCommands.has(cap.id) && (
                  <pre className="mt-1 overflow-x-auto rounded-sm bg-bg-secondary p-2 font-mono text-[10px] leading-relaxed text-text-secondary">
                    {cap.commands.join('\n')}
                  </pre>
                )}
                {cap.needsUnits && checked && (
                  <div className="mt-2">
                    <p className="text-[11px] text-text-tertiary">Applies to these units only:</p>
                    {availableUnits.length === 0 ? (
                      <p className="mt-1 text-[11px] text-text-tertiary">
                        No units discovered — connect the Services tool first, or type the line
                        manually.
                      </p>
                    ) : (
                      <div className="mt-1 max-h-32 overflow-auto rounded-panel border border-divider">
                        <div className="space-y-1 p-3">
                        {availableUnits.map((unit) => (
                          <label
                            key={unit}
                            className="flex cursor-pointer items-center gap-2 px-1 py-0.5 text-xs text-text-secondary hover:text-text"
                          >
                            <Checkbox
                              checked={units.has(unit)}
                              disabled={saving}
                              onCheckedChange={(value) => onToggleUnit(unit, value === true)}
                              aria-label={unit}
                            />
                            <span className="truncate font-mono">{unit}</span>
                          </label>
                        ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
        </>
      )}
    </div>
  )
}
