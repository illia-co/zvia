import { useEffect, useRef, useState } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import type { Terminal } from '@xterm/xterm'
import type { ServerId } from '@shared/server'
import { cn } from '@renderer/lib/utils'
import {
  attachTerminalToContainer,
  detachTerminalFromDom,
  getOrCreateTerminalInstance,
  isPtyOpened,
  markPtyOpened
} from './terminalInstanceRegistry'

interface TerminalViewProps {
  serverId: ServerId
  sessionId: string
  command?: string
  prefill?: string
  isActive: boolean
  isWorkspaceVisible: boolean
  isConnected: boolean
  onSessionEnded: () => void
}

const OPEN_RETRY_DELAY_MS = 150
const OPEN_MAX_ATTEMPTS = 8

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function waitForDimensions(
  container: HTMLElement,
  fit: () => void,
  measure: () => { cols: number; rows: number },
  timeoutMs = 500
): Promise<{ cols: number; rows: number }> {
  return new Promise((resolve) => {
    const readDimensions = () => {
      fit()
      return measure()
    }

    const initial = readDimensions()
    if (initial.cols > 0 && initial.rows > 0) {
      resolve(initial)
      return
    }

    let settled = false
    const settle = () => {
      if (settled) return
      settled = true
      observer.disconnect()
      window.clearTimeout(timeoutId)
      resolve(readDimensions())
    }

    const observer = new ResizeObserver(() => {
      const dimensions = readDimensions()
      if (dimensions.cols > 0 && dimensions.rows > 0) {
        settle()
      }
    })
    observer.observe(container)

    const timeoutId = window.setTimeout(settle, timeoutMs)

    window.requestAnimationFrame(() => {
      const dimensions = readDimensions()
      if (dimensions.cols > 0 && dimensions.rows > 0) {
        settle()
      }
    })
  })
}

function fitTerminal(
  terminal: Terminal,
  fitAddon: FitAddon,
  serverId: ServerId,
  sessionId: string,
  shouldResizeSession: boolean
) {
  fitAddon.fit()
  const { cols, rows } = terminal
  if (shouldResizeSession && cols > 0 && rows > 0) {
    void window.zvia.terminal.resize({ serverId, sessionId, cols, rows })
  }
}

export function TerminalView({
  serverId,
  sessionId,
  command,
  prefill,
  isActive,
  isWorkspaceVisible,
  isConnected,
  onSessionEnded
}: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const isVisibleRef = useRef(isActive && isWorkspaceVisible)
  const onSessionEndedRef = useRef(onSessionEnded)
  const isConnectedRef = useRef(isConnected)
  const [sessionEnded, setSessionEnded] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)

  const isVisible = isActive && isWorkspaceVisible

  useEffect(() => {
    onSessionEndedRef.current = onSessionEnded
  }, [onSessionEnded])

  useEffect(() => {
    isConnectedRef.current = isConnected
  }, [isConnected])

  useEffect(() => {
    isVisibleRef.current = isVisible
  }, [isVisible])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const entry = getOrCreateTerminalInstance(serverId, sessionId)
    attachTerminalToContainer(entry, container)

    const { terminal, fitAddon } = entry
    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    const resizeObserver = new ResizeObserver(() => {
      fitTerminal(
        terminal,
        fitAddon,
        serverId,
        sessionId,
        isPtyOpened(serverId, sessionId) && isVisibleRef.current
      )
    })
    resizeObserver.observe(container)

    const unsubscribeData = window.zvia.terminal.onData((event) => {
      if (event.serverId !== serverId || event.sessionId !== sessionId) return
      setOpenError(null)
      terminal.write(event.bytes)
    })

    const unsubscribeExit = window.zvia.terminal.onExit((event) => {
      if (event.serverId !== serverId || event.sessionId !== sessionId) return
      setSessionEnded(true)
      onSessionEndedRef.current()
    })

    const inputDisposable = terminal.onData((data) => {
      if (!isPtyOpened(serverId, sessionId) || !isConnectedRef.current) return
      void window.zvia.terminal.write({ serverId, sessionId, data })
    })

    return () => {
      resizeObserver.disconnect()
      unsubscribeData()
      unsubscribeExit()
      inputDisposable.dispose()
      detachTerminalFromDom(entry)
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [serverId, sessionId])

  useEffect(() => {
    if (!isConnected || !isActive || isPtyOpened(serverId, sessionId) || sessionEnded) return

    const terminal = terminalRef.current
    const fitAddon = fitAddonRef.current
    const container = containerRef.current
    if (!terminal || !fitAddon || !container) return

    let cancelled = false

    const openSession = async () => {
      setOpenError(null)

      for (let attempt = 0; attempt < OPEN_MAX_ATTEMPTS; attempt += 1) {
        if (cancelled || isPtyOpened(serverId, sessionId)) return

        const { cols, rows } = await waitForDimensions(
          container,
          () => fitAddon.fit(),
          () => ({ cols: terminal.cols, rows: terminal.rows })
        )
        if (cancelled || isPtyOpened(serverId, sessionId)) return
        if (cols <= 0 || rows <= 0) {
          if (attempt < OPEN_MAX_ATTEMPTS - 1) {
            await wait(OPEN_RETRY_DELAY_MS * (attempt + 1))
            continue
          }
          setOpenError('Failed to open terminal session.')
          return
        }
        try {
          await window.zvia.terminal.open({ serverId, sessionId, cols, rows, command })
          if (cancelled) {
            void window.zvia.terminal.close({ serverId, sessionId })
            return
          }
          markPtyOpened(serverId, sessionId)
          setOpenError(null)
          if (prefill) {
            void window.zvia.terminal.write({ serverId, sessionId, data: prefill })
          }
          if (isVisibleRef.current) {
            terminal.focus()
          }
          return
        } catch {
          if (cancelled || isPtyOpened(serverId, sessionId)) return
          if (attempt < OPEN_MAX_ATTEMPTS - 1) {
            await wait(OPEN_RETRY_DELAY_MS * (attempt + 1))
            continue
          }
          setOpenError('Failed to open terminal session.')
        }
      }
    }

    void openSession()

    return () => {
      cancelled = true
    }
  }, [serverId, sessionId, isConnected, isActive, sessionEnded, command, prefill])

  useEffect(() => {
    if (!isVisible) return

    const terminal = terminalRef.current
    const fitAddon = fitAddonRef.current
    if (!terminal || !fitAddon) return

    let innerFrameId: number | undefined
    const outerFrameId = window.requestAnimationFrame(() => {
      innerFrameId = window.requestAnimationFrame(() => {
        fitTerminal(terminal, fitAddon, serverId, sessionId, isPtyOpened(serverId, sessionId))
        if (isPtyOpened(serverId, sessionId)) {
          terminal.refresh(0, terminal.rows - 1)
          terminal.focus()
        }
      })
    })

    return () => {
      window.cancelAnimationFrame(outerFrameId)
      if (innerFrameId !== undefined) {
        window.cancelAnimationFrame(innerFrameId)
      }
    }
  }, [isVisible, serverId, sessionId])

  return (
    <div className="relative h-full min-h-0 w-full">
      <div
        ref={containerRef}
        className={cn(
          'terminal-surface h-full min-h-0 w-full',
          !isActive && 'invisible pointer-events-none'
        )}
        aria-hidden={!isActive}
      />
      {openError && (
        <div className="pointer-events-none absolute inset-x-0 top-2 z-10 px-3 text-center text-xs text-red-400">
          {openError}
        </div>
      )}
    </div>
  )
}
