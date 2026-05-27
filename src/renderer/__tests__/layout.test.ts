import { describe, expect, it } from 'vitest'
import { getScaledLayout, normalizeUiScale, normalizeWidthScale } from '../layout'

describe('input UI scaling', () => {
  it('keeps width scaling and whole-UI scaling independent', () => {
    const layout = getScaledLayout({
      expandedUI: false,
      contentWidth: 460,
      widthScale: 110,
      uiScale: 120,
    })

    expect(layout.contentWidth).toBe(506)
    expect(layout.cardCollapsedWidth).toBe(473)
    expect(layout.columnTransform).toContain('scale(1.2)')
  })

  it('snaps whole-UI scale values to the old 100/110/120 percent scale steps', () => {
    expect(normalizeUiScale(103)).toBe(100)
    expect(normalizeUiScale(112)).toBe(110)
    expect(normalizeUiScale(150)).toBe(120)
  })

  it('clamps width scale to the slider range', () => {
    expect(normalizeWidthScale(60)).toBe(75)
    expect(normalizeWidthScale(112)).toBe(112)
    expect(normalizeWidthScale(180)).toBe(150)
  })
})
