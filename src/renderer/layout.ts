import { useEffect, useState } from 'react'

export interface ResponsiveLayoutMetrics {
  autoUiScale: number
  contentWidth: number
  cardExpandedWidth: number
  cardCollapsedWidth: number
  cardCollapsedMargin: number
  bodyMaxHeight: number
  conversationMaxHeight: number
  marketplaceWidth: number
  marketplaceHeight: number
}

function clamp(value: number, min: number, max: number): number {
  if (max <= min) return min
  return Math.min(Math.max(value, min), max)
}

export function useViewportSize(): { width: number; height: number } {
  const [size, setSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }))

  useEffect(() => {
    const onResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return size
}

export function getResponsiveLayoutMetrics(
  viewportWidth: number,
  viewportHeight: number,
  expandedUI: boolean,
): ResponsiveLayoutMetrics {
  const safeWidth = Math.max(viewportWidth, 720)
  const safeHeight = Math.max(viewportHeight, 560)
  const autoUiScale = clamp(
    Math.min(safeWidth / 1040, safeHeight / 720),
    0.94,
    1.22,
  )

  const contentMaxWidth = Math.max(420, safeWidth - 176)
  const contentMinWidth = Math.min(expandedUI ? 560 : 420, contentMaxWidth)
  const contentWidth = clamp(
    Math.round(safeWidth * (expandedUI ? 0.62 : 0.44)),
    contentMinWidth,
    contentMaxWidth,
  )

  const collapsedInset = clamp(Math.round(contentWidth * 0.045), 18, 34)
  const cardExpandedWidth = contentWidth
  const cardCollapsedWidth = clamp(contentWidth - collapsedInset, Math.min(360, contentWidth), contentWidth)
  const cardCollapsedMargin = Math.round((contentWidth - cardCollapsedWidth) / 2)

  const marketplaceMaxWidth = Math.max(560, safeWidth - 96)
  const marketplaceMinWidth = Math.min(640, marketplaceMaxWidth)
  const marketplaceWidth = clamp(
    Math.round(safeWidth * 0.68),
    marketplaceMinWidth,
    marketplaceMaxWidth,
  )

  const marketplaceMaxHeight = Math.max(380, safeHeight - 172)
  const marketplaceHeight = clamp(
    Math.round(safeHeight * 0.62),
    Math.min(420, marketplaceMaxHeight),
    marketplaceMaxHeight,
  )

  const bodyMaxHeight = clamp(
    Math.round(safeHeight * (expandedUI ? 0.62 : 0.5)),
    320,
    Math.max(320, safeHeight - 220),
  )
  const conversationMaxHeight = Math.max(240, bodyMaxHeight - 60)

  return {
    autoUiScale,
    contentWidth,
    cardExpandedWidth,
    cardCollapsedWidth,
    cardCollapsedMargin,
    bodyMaxHeight,
    conversationMaxHeight,
    marketplaceWidth,
    marketplaceHeight,
  }
}
