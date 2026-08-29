import { useEffect, useRef, useState } from 'react'
import type { StatsSubscriptionMode, StatsUpdatePayload } from '@shared/stats'
import type { ServerId } from '@shared/server'
import { generateId } from '@renderer/lib/utils'

interface UseStatsSubscriptionOptions {
  serverId: ServerId
  mode: StatsSubscriptionMode
  enabled: boolean
}

interface UseStatsSubscriptionResult {
  info: StatsUpdatePayload['info'] | null
  stats: StatsUpdatePayload['stats'] | null
}

export function useStatsSubscription({
  serverId,
  mode,
  enabled
}: UseStatsSubscriptionOptions): UseStatsSubscriptionResult {
  const [payload, setPayload] = useState<StatsUpdatePayload | null>(null)
  const subscriberId = useRef(generateId())

  useEffect(() => {
    setPayload(null)
  }, [serverId])

  useEffect(() => {
    if (!enabled) {
      setPayload(null)
      return
    }

    const id = subscriberId.current
    const unsubscribeEvents = window.relay.stats.onUpdate((event) => {
      if (event.serverId !== serverId) return
      setPayload({ info: event.info, stats: event.stats })
    })

    void window.relay.stats.subscribe({ serverId, subscriberId: id, mode })

    return () => {
      unsubscribeEvents()
      void window.relay.stats.unsubscribe({ serverId, subscriberId: id })
    }
  }, [enabled, mode, serverId])

  return {
    info: payload?.info ?? null,
    stats: payload?.stats ?? null
  }
}
