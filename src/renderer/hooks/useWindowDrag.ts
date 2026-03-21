import { useCallback, useEffect, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'

function updateDragMarker(active: boolean): void {
  document.documentElement.dataset.windowDragging = active ? 'true' : 'false'
  document.body.style.userSelect = active ? 'none' : ''
}

export function useWindowDrag() {
  const [isRepositionMode, setIsRepositionMode] = useState(false)

  const updateBodyCursor = useCallback((nextDragging: boolean, nextMode: boolean) => {
    document.body.style.cursor = nextDragging ? 'grabbing' : nextMode ? 'grab' : ''
  }, [])

  const setRepositionMode = useCallback((active: boolean) => {
    document.documentElement.dataset.windowRepositionMode = active ? 'true' : 'false'
    setIsRepositionMode(active)
    updateDragMarker(false)
    updateBodyCursor(false, active)

    if (active) {
      window.clui.setIgnoreMouseEvents(false)
      return
    }

    window.clui.setIgnoreMouseEvents(true, { forward: true })
  }, [updateBodyCursor])

  useEffect(() => {
    const handleMouseUp = () => {
      if (document.documentElement.dataset.windowRepositionMode === 'true') {
        updateDragMarker(false)
        updateBodyCursor(false, true)
      }
    }

    const handleWindowBlur = () => {
      setRepositionMode(false)
    }

    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('blur', handleWindowBlur)
    const unsubRepositionMode = window.clui.onRepositionModeChange((active) => {
      setRepositionMode(active)
    })

    return () => {
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('blur', handleWindowBlur)
      unsubRepositionMode()
    }
  }, [setRepositionMode, updateBodyCursor])

  useEffect(() => () => {
    document.documentElement.dataset.windowRepositionMode = 'false'
    updateDragMarker(false)
    updateBodyCursor(false, false)
  }, [updateBodyCursor])

  const handleMouseDown = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    if (event.button !== 0) return
    if (document.documentElement.dataset.windowRepositionMode !== 'true') return

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
