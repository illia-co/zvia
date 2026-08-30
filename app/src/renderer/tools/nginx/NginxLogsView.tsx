import { useCallback, useEffect, useRef, useState } from 'react'
import type { NginxLogPaths } from '@shared/nginx'
import type { ServerId } from '@shared/server'
import { Button } from '@renderer/components/ui/button'
import { ElevationRequired } from '@renderer/components/errors/ElevationRequired'
import { ErrorSurface } from '@renderer/components/errors/ErrorSurface'
import { describeToolError } from '@renderer/lib/toolErrors'
import { cn, generateId } from '@renderer/lib/utils'

interface NginxLogsViewProps {
  serverId: ServerId
}

const MAX_BUFFER = 500_000
const TRIM_TO = 400_000

export function NginxLogsView({ serverId }: NginxLogsViewProps) {
  const [paths, setPaths] = useState<NginxLogPaths | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [logs, setLogs] = useState('')
  const [paused, setPaused] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [elevation, setElevation] = useState<string | null>(null)
  const streamIdRef = useRef(generateId())
  const pausedRef = useRef(false)
  const scrollRef = useRef<HTMLPreElement>(null)
  const atBottomRef = useRef(true)

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  const appendLogs = useCallback((chunk: string) => {
    if (pausedRef.current) return
    setLogs((current) => {
      const next = current + chunk
      return next.length > MAX_BUFFER ? next.slice(-TRIM_TO) : next
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    setPaths(null)
    setSelectedPath(null)

    void (async () => {
      try {
        const result = await window.zvia.nginx.logPaths({ serverId })
        if (cancelled) return
        setPaths(result)
        setSelectedPath(result.errorLogs[0] ?? result.accessLogs[0] ?? null)
        setError(null)
        setElevation(null)
      } catch (err) {
        if (cancelled) return
        const described = describeToolError(err)
        setError(described.message)
        setElevation(described.elevation)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [serverId])

  useEffect(() => {
    if (!selectedPath) return
    const streamId = streamIdRef.current
    setLogs('')

    const unsubscribeData = window.zvia.nginx.onLogsData((event) => {
      if (event.serverId !== serverId || event.streamId !== streamId) return
      appendLogs(new TextDecoder().decode(event.bytes))
    })

    const unsubscribeExit = window.zvia.nginx.onLogsExit((event) => {
      if (event.serverId !== serverId || event.streamId !== streamId) return
      if (event.exitCode !== 0) {
        setError(`Log stream ended with exit code ${event.exitCode}`)
      }
    })

    void window.zvia.nginx
      .startLogs({ serverId, streamId, path: selectedPath })
      .catch((err) => {
        const described = describeToolError(err)
        setError(described.message)
        setElevation(described.elevation)
      })

    return () => {
      unsubscribeData()
      unsubscribeExit()
      void window.zvia.nginx.stopLogs({ serverId, streamId })
    }
  }, [appendLogs, selectedPath, serverId])

  useEffect(() => {
    if (!atBottomRef.current || !scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [logs, search])

  if (elevation) {
    return (
      <div className="h-full overflow-auto p-4">
        <ElevationRequired serverId={serverId} command={elevation} />
      </div>
    )
  }

  const allPaths = [...(paths?.errorLogs ?? []), ...(paths?.accessLogs ?? [])]
  const filteredLogs = search
    ? logs
        .split('\n')
        .filter((line) => line.toLowerCase().includes(search.toLowerCase()))
        .join('\n')
    : logs

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-divider px-3 py-2">
        <select
          value={selectedPath ?? ''}
          onChange={(event) => setSelectedPath(event.target.value || null)}
          className="max-w-[18rem] rounded-panel border border-divider bg-bg px-2 py-1 font-mono text-xs text-text outline-none focus:border-text-tertiary"
        >
          {allPaths.length === 0 && <option value="">No log files reported</option>}
          {paths?.errorLogs.map((path) => (
            <option key={path} value={path}>
              {path}
            </option>
          ))}
          {paths?.accessLogs.map((path) => (
            <option key={path} value={path}>
              {path}
            </option>
          ))}
        </select>

        <Button size="sm" variant="ghost" onClick={() => setPaused((value) => !value)}>
          {paused ? 'Resume' : 'Pause'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setLogs('')}>
          Clear
        </Button>

        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Filter lines"
          className="ml-auto w-40 rounded-panel border border-divider bg-bg px-2 py-1 text-xs text-text outline-none focus:border-text-tertiary"
        />
      </div>

      {error && (
        <div className="border-b border-divider p-3">
          <ErrorSurface error={error} onDismiss={() => setError(null)} />
        </div>
      )}

      <pre
        ref={scrollRef}
        onScroll={(event) => {
          const element = event.currentTarget
          atBottomRef.current =
            element.scrollHeight - element.scrollTop - element.clientHeight < 24
        }}
        className={cn(
          'min-h-0 flex-1 overflow-auto bg-bg p-3 font-mono text-[11px] leading-relaxed text-text-secondary',
          paused && 'opacity-70'
        )}
      >
        {filteredLogs || (selectedPath ? 'Waiting for output…' : 'Select a log file.')}
      </pre>
    </div>
  )
}
