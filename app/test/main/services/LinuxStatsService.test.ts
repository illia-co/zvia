import { describe, expect, it } from 'vitest'
import type { CommandRunner } from '@main/services/CommandRunner'
import {
  buildStatsSnapshot,
  computeCpuUsage,
  LinuxStatsService,
  type RawCpuSample
} from '@main/services/LinuxStatsService'

const MOCK_STATS_OUTPUT = [
  '---RELAY:STAT---',
  'cpu  4705 0 1234 56789 0 0 0 0 0 0',
  'cpu0 1000 0 300 14000 0 0 0 0 0 0',
  '---RELAY:MEM---',
  'MemTotal:       16384000 kB',
  'MemFree:         8192000 kB',
  'MemAvailable:   10240000 kB',
  'SwapTotal:       2097148 kB',
  'SwapFree:        1048576 kB',
  '---RELAY:LOAD---',
  '0.52 0.48 0.45 1/234 56789',
  '---RELAY:UPTIME---',
  '123456.78 987654.32',
  '---RELAY:NET---',
  'Inter-|   Receive                                                |  Transmit',
  ' face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed',
  '  eth0: 1234567890    1000    0    0    0     0          0         0 987654321    800    0    0    0     0       0          0',
  '---RELAY:DF---',
  '/dev/sda1 1000000000 500000000 400000000 56% /'
].join('\n')

function createMockRunner(stdout: string): CommandRunner {
  return {
    exec: async () => ({ exitCode: 0, stdout, stderr: '' })
  }
}

describe('LinuxStatsService', () => {
  it('parses /proc output from a batched stats command', async () => {
    const service = new LinuxStatsService(createMockRunner(MOCK_STATS_OUTPUT))
    const sample = await service.collectRawSample()

    expect(sample.uptimeSeconds).toBeCloseTo(123456.78)
    expect(sample.loadAverage).toEqual([0.52, 0.48, 0.45])
    expect(sample.memory.totalBytes).toBe(16384000 * 1024)
    expect(sample.memory.availableBytes).toBe(10240000 * 1024)
    expect(sample.memory.swapTotalBytes).toBe(2097148 * 1024)
    expect(sample.cpu).toHaveLength(2)
    expect(sample.network).toEqual([
      { name: 'eth0', rxBytes: 1234567890, txBytes: 987654321 }
    ])
    expect(sample.filesystems).toEqual([
      expect.objectContaining({
        device: '/dev/sda1',
        mount: '/',
        totalBytes: 1_000_000_000,
        usedBytes: 500_000_000
      })
    ])
  })

  it('computes CPU usage from consecutive samples', () => {
    const previous: RawCpuSample[] = [
      { label: 'cpu', total: 1000, idle: 800 },
      { label: 'cpu0', total: 500, idle: 400 }
    ]
    const current: RawCpuSample[] = [
      { label: 'cpu', total: 2000, idle: 1400 },
      { label: 'cpu0', total: 1000, idle: 700 }
    ]

    const usage = computeCpuUsage(previous, current)

    expect(usage.totalUsagePercent).toBeCloseTo(40)
    expect(usage.coreCount).toBe(1)
    expect(usage.cores[0]?.usagePercent).toBeCloseTo(40)
  })

  it('builds network throughput from consecutive raw samples', () => {
    const previous = {
      timestamp: 1000,
      uptimeSeconds: 100,
      cpu: [],
      memory: {
        totalBytes: 0,
        usedBytes: 0,
        freeBytes: 0,
        availableBytes: 0,
        usagePercent: 0,
        swapTotalBytes: 0,
        swapUsedBytes: 0,
        swapUsagePercent: 0
      },
      loadAverage: [0, 0, 0] as [number, number, number],
      network: [{ name: 'eth0', rxBytes: 1000, txBytes: 2000 }],
      filesystems: []
    }
    const current = {
      ...previous,
      timestamp: 3000,
      network: [{ name: 'eth0', rxBytes: 3000, txBytes: 4000 }]
    }

    const snapshot = buildStatsSnapshot(current, previous)

    expect(snapshot.network[0]?.rxBytesPerSec).toBe(1000)
    expect(snapshot.network[0]?.txBytesPerSec).toBe(1000)
  })
})
