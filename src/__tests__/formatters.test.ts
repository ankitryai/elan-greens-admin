// Unit tests for formatting utilities.
// These are pure functions with no external dependencies — ideal unit test targets.

import { describe, it, expect } from 'vitest'
import { formatBytes, formatStoragePercent, formatDate, splitPipe } from '@/lib/formatters'

describe('formatBytes', () => {
  it('returns "0 B" for zero', () => {
    expect(formatBytes(0)).toBe('0 B')
  })
  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB')
  })
  it('formats megabytes with one decimal', () => {
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB')
  })
  it('formats gigabytes', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB')
  })
})

describe('formatStoragePercent', () => {
  it('returns 0 for 0 bytes', () => {
    expect(formatStoragePercent(0)).toBe(0)
  })
  it('returns 50 for half a gigabyte', () => {
    expect(formatStoragePercent(512 * 1024 * 1024)).toBeCloseTo(50, 0)
  })
  it('caps at 100 if storage overflows', () => {
    expect(formatStoragePercent(2 * 1024 * 1024 * 1024)).toBe(100)
  })
})

describe('formatDate', () => {
  it('returns em-dash for null', () => {
    expect(formatDate(null)).toBe('—')
  })
  it('formats a valid ISO date', () => {
    // Date is locale-formatted; just assert it contains the year.
    expect(formatDate('2022-06-15')).toContain('2022')
  })
})

describe('splitPipe', () => {
  it('returns empty array for null', () => {
    expect(splitPipe(null)).toEqual([])
  })
  it('returns empty array for empty string', () => {
    expect(splitPipe('')).toEqual([])
  })
  it('splits by pipe', () => {
    expect(splitPipe('Treats fever|Reduces inflammation')).toEqual([
      'Treats fever',
      'Reduces inflammation',
    ])
  })
  it('trims whitespace around each part', () => {
    expect(splitPipe(' Roots | Bark ')).toEqual(['Roots', 'Bark'])
  })
  it('filters out empty segments', () => {
    expect(splitPipe('A||B')).toEqual(['A', 'B'])
  })
})
