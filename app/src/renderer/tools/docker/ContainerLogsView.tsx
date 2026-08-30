import { useCallback, useEffect, useRef, useState } from 'react'
import type { DockerContainer } from '@shared/docker'
import type { ServerId } from '@shared/server'
import { Button } from '@renderer/components/ui/button'
import { ErrorSurface } from '@renderer/components/errors/ErrorSurface'
import { parseZviaError } from '@renderer/lib/errors'
import { cn, generateId } from '@renderer/lib/utils'

interface ContainerLogsViewProps {
  serverId: ServerId
  container: DockerContainer
}

export function ContainerLogsView({ serverId, container }: ContainerLogsViewProps) {
  const [logs, setLogs] = useState('')
  const [paused, setPaused] = useState(false)
  const [search, setSearch] = useState('')
  const [timestamps, setTimestamps] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const streamIdRef = useRef(generateId())
  const pausedRef = useRef(false)
  const containerRef = useRef<HTMLPreElement>(null)
  const atBottomRef = useRef(true)

  const appendLogs = useCallback((chunk: string) => {
    if (pausedRef.current) return
    setLogs((current) => {
      const next = current + chunk
      return next.length > 500_000 ? next.slice(-400_000) : next
    })
  }, [])

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  useEffect(() => {
    const streamId = streamIdRef.current
    setLogs('')
    setError(null)

    const unsubscribeData = window.zvia.docker.onLogsData((event) => {
      if (event.serverId !== serverId || event.streamId !== streamId) return
      appendLogs(new TextDecoder().decode(event.bytes))
    })

    const unsubscribeExit = window.zvia.docker.onLogsExit((event) => {
      if (event.serverId !== serverId || event.streamId !== streamId) return
      if (event.exitCode !== 0) {
        setError(`Log stream ended with exit code ${event.exitCode}`)
      }
    })

    void window.zvia.docker
      .startLogs({
        serverId,
        streamId,
        containerId: container.id,
        timestamps,
        tail: 200
      })
      .catch((err) => {
        setError(parseZviaError(err).message)
      })

    return () => {
      unsubscribeData()
      unsubscribeExit()
      void window.zvia.docker.stopLogs({ serverId, streamId })
    }
  }, [serverId, container.id, timestamps, appendLogs])

  useEffect(() => {
    if (!atBottomRef.current || !containerRef.current) return
    containerRef.current.scrollTop = containerRef.current.scrollHeight
  }, [logs, search])

  const filteredLogs = search
    ? logs
        .split('\n')
        .filter((line) => line.toLowerCase().includes(search.toLowerCase()))
        .join('\n')
    : logs

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(filteredLogs)
    } catch {
      setError('Failed to copy logs to clipboard')
    }
  }

  return (
    <div className="flex h-full flex-col bg-[#1a1a1a] text-[#f2f2f2]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#2a2a2a] px-3 py-2">
        <Button
          size="sm"
          variant="ghost"
          className="text-[#999999] hover:bg-[#242424] hover:text-[#f2f2f2]"
          onClick={() => setPaused((value) => !value)}
        >
          {paused ? 'Resume' : 'Pause'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-[#999999] hover:bg-[#242424] hover:text-[#f2f2f2]"
          onClick={() => void handleCopy()}
        >
          Copy
        </Button>
        <label className="inline-flex items-center gap-2 text-xs text-[#999999]">
          <input
            type="checkbox"
            checked={timestamps}
            onChange={(event) => setTimestamps(event.target.checked)}
          />
          Timestamps
        </label>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search logs"
          className="ml-auto min-w-[10rem] rounded-panel border border-[#333333] bg-[#242424] px-2 py-1 text-xs text-[#f2f2f2] outline-none"
        />
      </div>

      {error && (
        <div className="border-b border-[#2a2a2a] p-3">
          <ErrorSurface error={error} onDismiss={() => setError(null)} />
        </div>
      )}

      <pre
        ref={containerRef}
        onScroll={(event) => {
          const element = event.currentTarget
          atBottomRef.current =
            element.scrollHeight - element.scrollTop - element.clientHeight < 24
        }}
        className={cn(
          'min-h-0 flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-[#d4d4d4]',
          paused && 'opacity-70'
        )}
      >
        {filteredLogs || 'Waiting for logs…'}
      </pre>
    </div>
  )
}
