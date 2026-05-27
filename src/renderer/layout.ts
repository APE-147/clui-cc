export const UI_SCALE_OPTIONS = [100, 110, 120] as const

export type UiScalePercent = typeof UI_SCALE_OPTIONS[number]

export function normalizeUiScale(value: unknown): UiScalePercent {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 100
  if (n < 105) return 100
  if (n < 115) return 110
  return 120
}

export function getScaledLayout({
  expandedUI,
  contentWidth,
  uiScale,
}: {
  expandedUI: boolean
  contentWidth: number
  uiScale: unknown
}) {
  const normalizedScale = normalizeUiScale(uiScale)
  const visualScale = normalizedScale / 100

  return {
    uiScale: normalizedScale,
    visualScale,
    contentWidth: expandedUI ? 700 : contentWidth,
    cardExpandedWidth: expandedUI ? 700 : 460,
    cardCollapsedWidth: expandedUI ? 670 : 430,
    bodyMaxHeight: expandedUI ? 520 : 400,
    columnTransform: `translateY(var(--clui-card-y, 0px)) scale(${visualScale})`,
  }
}
