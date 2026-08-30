import { useEffect, useState } from 'react'
import type { DockerContainer } from '@shared/docker'
import type { ServerId } from '@shared/server'
import { ErrorSurface } from '@renderer/components/errors/ErrorSurface'
import { parseZviaError } from '@renderer/lib/errors'

interface ContainerInspectViewProps {
  serverId: ServerId
  container: DockerContainer
}

export function ContainerInspectView({ serverId, container }: ContainerInspectViewProps) {
  const [inspectData, setInspectData] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    void window.zvia.docker
      .inspectContainer({ serverId, containerId: container.id })
      .then((data) => {
        if (!cancelled) setInspectData(data)
      })
      .catch((err) => {
        if (!cancelled) setError(parseZviaError(err).message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [serverId, container.id])

  if (loading) {
    return <p className="p-6 text-center text-xs text-text-secondary">Loading inspect data…</p>
  }

  if (error) {
    return (
      <div className="p-4">
        <ErrorSurface error={error} />
      </div>
    )
  }

  return (
    <pre className="h-full overflow-auto p-4 font-mono text-[11px] leading-relaxed text-text-secondary">
      {JSON.stringify(inspectData, null, 2)}
    </pre>
  )
}
