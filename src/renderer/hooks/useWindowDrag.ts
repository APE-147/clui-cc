import { useCallback, useEffect, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'

type DragState = {
  pointerScreenX: number
  pointerScreenY: number
  windowX: number
  windowY: number
}

const DRAG_BLOCKER_SELECTOR = [
  '.no-drag',
  '.conversation-selectable',
  'button',
  'input',
  'textarea',
  'select',
  'option',
  'label',
  'a[href]',
  '[role="button"]',
  '[contenteditable="true"]',
  '[data-no-window-drag]',
].join(', ')

function updateDragMarker(active: boolean): void {
  document.documentElement.dataset.windowDragging = active ? 'true' : 'false'
  document.body.style.cursor = active ? 'grabbing' : ''
  document.body.style.userSelect = active ? 'none' : ''
}

export function useWindowDrag() {
  const dragStateRef = useRef<DragState | null>(null)

  const syncIgnoreMouseEvents = useCallback((event?: MouseEvent) => {
    const element = event ? document.elementFromPoint(event.clientX, event.clientY) : null
    const isUi = !!(element && element.closest('[data-clui-ui]'))
    if (isUi) {
      window.clui.setIgnoreMouseEvents(false)
      return
    }
    window.clui.setIgnoreMouseEvents(true, { forward: true })
  }, [])

  const stopDragging = useCallback((event?: MouseEvent) => {
    if (!dragStateRef.current) return
    dragStateRef.current = null
    updateDragMarker(false)
    syncIgnoreMouseEvents(event)
  }, [syncIgnoreMouseEvents])

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const dragState = dragStateRef.current
      if (!dragState) return

      const nextX = dragState.windowX + (event.screenX - dragState.pointerScreenX)
      const nextY = dragState.windowY + (event.screenY - dragState.pointerScreenY)
      window.clui.setWindowPosition(nextX, nextY)
    }

    const handleMouseUp = (event: MouseEvent) => {
      stopDragging(event)
    }

    const handleWindowBlur = () => {
      stopDragging()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('blur', handleWindowBlur)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [stopDragging])

  useEffect(() => () => {
    updateDragMarker(false)
  }, [])

  const handleMouseDown = useCallback(async (event: ReactMouseEvent<HTMLElement>) => {
    if (event.button !== 0) return

    const target = event.target
    if (!(target instanceof HTMLElement)) return
    if (target.closest(DRAG_BLOCKER_SELECTOR)) return

    const bounds = await window.clui.getWindowBounds()
    if (!bounds) return

    dragStateRef.current = {
      pointerScreenX: event.screenX,
      pointerScreenY: event.screenY,
      windowX: bounds.x,
      windowY: bounds.y,
    }

    updateDragMarker(true)
    window.clui.setIgnoreMouseEvents(false)
    event.preventDefault()
  }, [])

  return {
    onMouseDown: handleMouseDown,
  }
}
