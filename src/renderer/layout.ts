export const UI_SCALE_OPTIONS = [100, 110, 120] as const

export type UiScalePercent = typeof UI_SCALE_OPTIONS[number]

export function normalizeWidthScale(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 100
  return Math.max(75, Math.min(150, n))
}

export function normalizeUiScale(value: unknown): UiScalePercent {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 100
  if (n < 105) return 100
  if (n < 115) return 110
  return 120
}

export function getScaledLayout({
  expandedUI,
  contentWidth,
  widthScale,
  uiScale,
}: {
  expandedUI: boolean
  contentWidth: number
  widthScale?: unknown
  uiScale: unknown
}) {
  const normalizedWidthScale = normalizeWidthScale(widthScale)
  const normalizedScale = normalizeUiScale(uiScale)
  const widthFactor = normalizedWidthScale / 100
  const visualScale = normalizedScale / 100

  return {
    widthScale: normalizedWidthScale,
    uiScale: normalizedScale,
    visualScale,
    contentWidth: Math.round((expandedUI ? 700 : contentWidth) * widthFactor),
    cardExpandedWidth: Math.round((expandedUI ? 700 : 460) * widthFactor),
    cardCollapsedWidth: Math.round((expandedUI ? 670 : 430) * widthFactor),
    bodyMaxHeight: expandedUI ? 520 : 400,
    columnTransform: `translateY(var(--clui-card-y, 0px)) scale(${visualScale})`,
  }
}
