import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'

type DragState = {
  pointerScreenX: number
  pointerScreenY: number
  windowX: number
  windowY: number
}

function updateDragMarker(active: boolean): void {
  document.documentElement.dataset.windowDragging = active ? 'true' : 'false'
  document.body.style.userSelect = active ? 'none' : ''
}

export function useWindowDrag() {
  const [isRepositionMode, setIsRepositionMode] = useState(false)
  const dragStateRef = useRef<DragState | null>(null)
  const pointerRef = useRef<{ clientX: number; clientY: number } | null>(null)

  const syncIgnoreMouseEvents = useCallback((point?: { clientX: number; clientY: number } | null) => {
    const element = point ? document.elementFromPoint(point.clientX, point.clientY) : null
    const isUi = !!(element && element.closest('[data-clui-ui]'))
    if (isUi) {
      window.clui.setIgnoreMouseEvents(false)
      return
    }
    window.clui.setIgnoreMouseEvents(true, { forward: true })
  }, [])

  const updateBodyCursor = useCallback((nextDragging: boolean, nextMode: boolean) => {
    document.body.style.cursor = nextDragging ? 'grabbing' : nextMode ? 'grab' : ''
  }, [])

  const stopDragging = useCallback((point?: { clientX: number; clientY: number } | null) => {
    if (!dragStateRef.current && document.documentElement.dataset.windowDragging !== 'true') return
    dragStateRef.current = null
    updateDragMarker(false)
    updateBodyCursor(false, document.documentElement.dataset.windowRepositionMode === 'true')
    if (document.documentElement.dataset.windowRepositionMode !== 'true') {
      syncIgnoreMouseEvents(point ?? pointerRef.current)
    }
  }, [syncIgnoreMouseEvents, updateBodyCursor])

  const setRepositionMode = useCallback((active: boolean) => {
    document.documentElement.dataset.windowRepositionMode = active ? 'true' : 'false'
    setIsRepositionMode(active)
    updateBodyCursor(false, active)

    if (active) {
      window.clui.setIgnoreMouseEvents(false)
      return
    }

    stopDragging(pointerRef.current)
    syncIgnoreMouseEvents(pointerRef.current)
  }, [stopDragging, syncIgnoreMouseEvents, updateBodyCursor])

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      pointerRef.current = { clientX: event.clientX, clientY: event.clientY }

      const dragState = dragStateRef.current
      if (!dragState) return

      const nextX = dragState.windowX + (event.screenX - dragState.pointerScreenX)
      const nextY = dragState.windowY + (event.screenY - dragState.pointerScreenY)
      window.clui.setWindowPosition(nextX, nextY)
    }

    const handleMouseUp = (event: MouseEvent) => {
      stopDragging({ clientX: event.clientX, clientY: event.clientY })
    }

    const handleWindowBlur = () => {
      setRepositionMode(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Shift') return
      if (!document.hasFocus()) return
      if (document.documentElement.dataset.windowRepositionMode === 'true') return
      setRepositionMode(true)
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key !== 'Shift') return
      setRepositionMode(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('blur', handleWindowBlur)
    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp, true)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('blur', handleWindowBlur)
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
    }
  }, [setRepositionMode, stopDragging])

  useEffect(() => () => {
    document.documentElement.dataset.windowRepositionMode = 'false'
    updateDragMarker(false)
    updateBodyCursor(false, false)
  }, [])

  const handleMouseDown = useCallback(async (event: ReactMouseEvent<HTMLElement>) => {
    if (document.documentElement.dataset.windowRepositionMode !== 'true') return
    if (event.button !== 0) return

    const bounds = await window.clui.getWindowBounds()
    if (!bounds) return

    dragStateRef.current = {
      pointerScreenX: event.screenX,
      pointerScreenY: event.screenY,
      windowX: bounds.x,
      windowY: bounds.y,
    }

    updateDragMarker(true)
    updateBodyCursor(true, true)
    window.clui.setIgnoreMouseEvents(false)
    event.preventDefault()
    event.stopPropagation()
  }, [updateBodyCursor])

  return {
    isRepositionMode,
    onMouseDown: handleMouseDown,
  }
}
