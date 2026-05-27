import { describe, expect, it } from 'vitest'
import { getScaledLayout, normalizeUiScale } from '../layout'

describe('input UI scaling', () => {
  it('scales the whole UI without widening the base layout dimensions', () => {
    const layout = getScaledLayout({
      expandedUI: false,
      contentWidth: 460,
      uiScale: 120,
    })

    expect(layout.contentWidth).toBe(460)
    expect(layout.cardCollapsedWidth).toBe(430)
    expect(layout.columnTransform).toContain('scale(1.2)')
  })

  it('snaps legacy or slider values to the old 100/110/120 percent scale steps', () => {
    expect(normalizeUiScale(103)).toBe(100)
    expect(normalizeUiScale(112)).toBe(110)
    expect(normalizeUiScale(150)).toBe(120)
  })
})
