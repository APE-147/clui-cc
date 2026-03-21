import { app, screen, type Display, type Rectangle } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'

export interface SavedWindowPlacement {
  version: 1
  displayId: number | null
  xRatio: number
  yRatio: number
}

export interface WindowMetrics {
  width: number
  height: number
  bottomMargin: number
}

const PLACEMENT_FILE = 'window-placement.json'

function clamp(value: number, min: number, max: number): number {
  if (max <= min) return min
  return Math.min(Math.max(value, min), max)
}

function getPlacementPath(): string {
  return join(app.getPath('userData'), PLACEMENT_FILE)
}

export function getResponsiveWindowMetrics(display: Display): WindowMetrics {
  const { width, height } = display.workAreaSize

  const horizontalMargin = clamp(Math.round(width * 0.04), 28, 80)
  const verticalMargin = clamp(Math.round(height * 0.04), 24, 72)
  const maxWidth = Math.max(720, width - horizontalMargin * 2)
  const maxHeight = Math.max(560, height - verticalMargin * 2)

  const preferredWidth = Math.round(width * 0.72)
  const preferredHeight = Math.round(height * 0.78)

  const windowWidth = clamp(preferredWidth, Math.min(920, maxWidth), maxWidth)
  const windowHeight = clamp(preferredHeight, Math.min(700, maxHeight), maxHeight)
  const bottomMargin = clamp(Math.round(height * 0.05), 24, 72)

  return {
    width: windowWidth,
    height: windowHeight,
    bottomMargin,
  }
}

function getDefaultRatios(display: Display): { xRatio: number; yRatio: number } {
  const metrics = getResponsiveWindowMetrics(display)
  const xRange = Math.max(0, display.workArea.width - metrics.width)
  const yRange = Math.max(0, display.workArea.height - metrics.height)
  const defaultY = display.workArea.height - metrics.height - metrics.bottomMargin

  return {
    xRatio: xRange > 0 ? 0.5 : 0,
    yRatio: yRange > 0 ? clamp(defaultY / yRange, 0, 1) : 0,
  }
}

function sanitizePlacement(raw: Partial<SavedWindowPlacement> | null | undefined): SavedWindowPlacement | null {
  if (!raw) return null

  const displayId = typeof raw.displayId === 'number' ? raw.displayId : null
  const xRatio = typeof raw.xRatio === 'number' ? clamp(raw.xRatio, 0, 1) : null
  const yRatio = typeof raw.yRatio === 'number' ? clamp(raw.yRatio, 0, 1) : null

  if (xRatio == null || yRatio == null) return null

  return {
    version: 1,
    displayId,
    xRatio,
    yRatio,
  }
}

export function loadSavedWindowPlacement(): SavedWindowPlacement | null {
  try {
    const path = getPlacementPath()
    if (!existsSync(path)) return null

    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<SavedWindowPlacement>
    return sanitizePlacement(parsed)
  } catch {
    return null
  }
}

export function saveWindowPlacement(placement: SavedWindowPlacement): void {
  try {
    const path = getPlacementPath()
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(placement, null, 2))
  } catch {
    // Best-effort persistence only.
  }
}

export function resolvePlacementDisplay(placement: SavedWindowPlacement | null, fallbackPoint = screen.getCursorScreenPoint()): Display {
  if (placement?.displayId != null) {
    const matched = screen.getAllDisplays().find((display) => display.id === placement.displayId)
    if (matched) return matched
  }

  return screen.getDisplayNearestPoint(fallbackPoint)
}

export function resolveWindowBounds(display: Display, placement: SavedWindowPlacement | null): Rectangle {
  const metrics = getResponsiveWindowMetrics(display)
  const ratios = placement ? { xRatio: placement.xRatio, yRatio: placement.yRatio } : getDefaultRatios(display)
  const xRange = Math.max(0, display.workArea.width - metrics.width)
  const yRange = Math.max(0, display.workArea.height - metrics.height)

  return {
    x: display.workArea.x + Math.round(xRange * clamp(ratios.xRatio, 0, 1)),
    y: display.workArea.y + Math.round(yRange * clamp(ratios.yRatio, 0, 1)),
    width: metrics.width,
    height: metrics.height,
  }
}

export function placementFromBounds(bounds: Rectangle): SavedWindowPlacement {
  const display = screen.getDisplayMatching(bounds)
  const xRange = Math.max(0, display.workArea.width - bounds.width)
  const yRange = Math.max(0, display.workArea.height - bounds.height)

  return {
    version: 1,
    displayId: display.id,
    xRatio: xRange > 0 ? clamp((bounds.x - display.workArea.x) / xRange, 0, 1) : 0,
    yRatio: yRange > 0 ? clamp((bounds.y - display.workArea.y) / yRange, 0, 1) : 0,
  }
}
