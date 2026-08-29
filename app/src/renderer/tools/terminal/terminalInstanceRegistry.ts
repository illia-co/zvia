import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import type { ServerId } from '@shared/server'
import { terminalFontFamily, terminalTheme } from './terminalTheme'

export interface TerminalInstance {
  terminal: Terminal
  fitAddon: FitAddon
  ptyOpened: boolean
}

const instances = new Map<string, TerminalInstance>()

export function terminalInstanceKey(serverId: ServerId, sessionId: string): string {
  return `${serverId}:${sessionId}`
}

export function getOrCreateTerminalInstance(serverId: ServerId, sessionId: string): TerminalInstance {
  const key = terminalInstanceKey(serverId, sessionId)
  let entry = instances.get(key)
  if (!entry) {
    const terminal = new Terminal({
      theme: terminalTheme,
      fontFamily: terminalFontFamily,
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      scrollback: 5000
    })
    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    entry = { terminal, fitAddon, ptyOpened: false }
    instances.set(key, entry)
  }
  return entry
}

export function attachTerminalToContainer(entry: TerminalInstance, container: HTMLElement): void {
  const { terminal } = entry
  if (terminal.element?.parentElement === container) return

  if (terminal.element?.parentElement) {
    terminal.element.parentElement.removeChild(terminal.element)
  }

  if (!terminal.element) {
    terminal.open(container)
  } else {
    container.appendChild(terminal.element)
  }
}

export function detachTerminalFromDom(entry: TerminalInstance): void {
  const element = entry.terminal.element
  if (element?.parentElement) {
    element.parentElement.removeChild(element)
  }
}

export function isPtyOpened(serverId: ServerId, sessionId: string): boolean {
  return instances.get(terminalInstanceKey(serverId, sessionId))?.ptyOpened ?? false
}

export function markPtyOpened(serverId: ServerId, sessionId: string): void {
  const entry = instances.get(terminalInstanceKey(serverId, sessionId))
  if (entry) {
    entry.ptyOpened = true
  }
}

export function disposeTerminalInstance(serverId: ServerId, sessionId: string): void {
  const key = terminalInstanceKey(serverId, sessionId)
  const entry = instances.get(key)
  if (!entry) return
  entry.terminal.dispose()
  instances.delete(key)
}
