import { describe, expect, it } from 'vitest'
import { mapTimeRangeToSince } from './logQuery'

describe('mapTimeRangeToSince', () => {
  it('maps preset ranges to journalctl since strings', () => {
    expect(mapTimeRangeToSince('15m')).toBe('15 minutes ago')
    expect(mapTimeRangeToSince('1h')).toBe('1 hour ago')
    expect(mapTimeRangeToSince('6h')).toBe('6 hours ago')
    expect(mapTimeRangeToSince('24h')).toBe('24 hours ago')
    expect(mapTimeRangeToSince('today')).toBe('today')
  })

  it('returns undefined for all time', () => {
    expect(mapTimeRangeToSince('all')).toBeUndefined()
    expect(mapTimeRangeToSince(undefined)).toBeUndefined()
  })
})
