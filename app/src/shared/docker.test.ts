import { describe, expect, it } from 'vitest'
import { parsePublishedHostPorts } from './docker'

describe('parsePublishedHostPorts', () => {
  it('collapses the IPv4 and IPv6 rows docker prints for one publish', () => {
    expect(parsePublishedHostPorts('0.0.0.0:8080->80/tcp, [::]:8080->80/tcp')).toEqual([8080])
    expect(parsePublishedHostPorts('0.0.0.0:8080->80/tcp, :::8080->80/tcp')).toEqual([8080])
  })

  it('keeps every distinct host port in order', () => {
    expect(
      parsePublishedHostPorts('0.0.0.0:80->80/tcp, [::]:80->80/tcp, 0.0.0.0:443->443/tcp')
    ).toEqual([80, 443])
  })

  it('reads the host port of a bound address and a udp publish', () => {
    expect(parsePublishedHostPorts('127.0.0.1:5432->5432/tcp')).toEqual([5432])
    expect(parsePublishedHostPorts('0.0.0.0:53->53/udp')).toEqual([53])
  })

  it('uses the first port of a published range', () => {
    expect(parsePublishedHostPorts('0.0.0.0:8000-8002->8000-8002/tcp')).toEqual([8000])
  })

  it('ignores exposed-but-unpublished ports and empty values', () => {
    expect(parsePublishedHostPorts('80/tcp')).toEqual([])
    expect(parsePublishedHostPorts('80/tcp, 443/tcp')).toEqual([])
    expect(parsePublishedHostPorts('')).toEqual([])
  })

  it('ignores out-of-range numbers', () => {
    expect(parsePublishedHostPorts('0.0.0.0:99999->80/tcp')).toEqual([])
  })
})
