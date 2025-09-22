import React, { useState, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'

export function AnchorManager({ onAnchorCreated, onAnchorDeleted }) {
  const [anchors, setAnchors] = useState([])
  const [isPlacing, setIsPlacing] = useState(false)

  const createAnchor = useCallback((position, rotation) => {
    const anchorId = Date.now().toString()
    const newAnchor = {
      id: anchorId,
      position: position || [0, 0, 0],
      rotation: rotation || [0, 0, 0],
      created: Date.now()
    }

    setAnchors(prev => [...prev, newAnchor])
    onAnchorCreated?.(newAnchor)
    return anchorId
  }, [onAnchorCreated])

  const deleteAnchor = useCallback((anchorId) => {
    setAnchors(prev => {
      const updated = prev.filter(anchor => anchor.id !== anchorId)
      onAnchorDeleted?.(anchorId)
      return updated
    })
  }, [onAnchorDeleted])

  const startPlacing = useCallback(() => {
    setIsPlacing(true)
  }, [])

  const stopPlacing = useCallback(() => {
    setIsPlacing(false)
  }, [])

  return {
    anchors,
    isPlacing,
    createAnchor,
    deleteAnchor,
    startPlacing,
    stopPlacing,
    AnchorGroup: ({ children, anchorId }) => (
      <AnchorGroup key={anchorId}>
        {children}
      </AnchorGroup>
    )
  }
}