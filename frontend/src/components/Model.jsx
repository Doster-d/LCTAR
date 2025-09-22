/*
Model component relocated from public (JSX should not be in /public)
*/
import React, { useState, useCallback } from 'react'
import { useGraph } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'

export function Model({ anchorId, onAnchorClick, ...props }) {
  const group = React.useRef()
  const { scene, animations } = useGLTF('/testmodel.glb')
  const clone = React.useMemo(() => SkeletonUtils.clone(scene), [scene])
  const { nodes, materials } = useGraph(clone)
  useAnimations(animations, group)

  const [weaponsVisible, setWeaponsVisible] = useState(true)
  const toggleWeapons = useCallback((e) => {
    e.stopPropagation()
    setWeaponsVisible(v => !v)
  }, [])

  const handleClick = useCallback((e) => {
    e.stopPropagation()
    onAnchorClick?.(anchorId)
    toggleWeapons(e)
  }, [onAnchorClick, anchorId, toggleWeapons])

  return (
    <group ref={group} {...props} dispose={null} onClick={handleClick}>
      <group name="Sketchfab_Scene">
        <primitive object={nodes._rootJoint} />
        <skinnedMesh name="Object_92" geometry={nodes.Object_92.geometry} material={materials.ArmsMat} skeleton={nodes.Object_92.skeleton} rotation={[-Math.PI / 2, 0, 0]} scale={0.011} />
        <skinnedMesh name="Object_93" geometry={nodes.Object_93.geometry} material={materials.ArmsAccMat} skeleton={nodes.Object_93.skeleton} rotation={[-Math.PI / 2, 0, 0]} scale={0.011} />
        <skinnedMesh name="Object_94" geometry={nodes.Object_94.geometry} material={materials.LegsMat} skeleton={nodes.Object_94.skeleton} rotation={[-Math.PI / 2, 0, 0]} scale={0.011} />
        <skinnedMesh name="Object_95" geometry={nodes.Object_95.geometry} material={materials.CorpseMat} skeleton={nodes.Object_95.skeleton} rotation={[-Math.PI / 2, 0, 0]} scale={0.011} />
        <skinnedMesh name="Object_96" geometry={nodes.Object_96.geometry} material={materials.TorsoMat} skeleton={nodes.Object_96.skeleton} rotation={[-Math.PI / 2, 0, 0]} scale={0.011} />
        <skinnedMesh name="Object_98" geometry={nodes.Object_98.geometry} material={materials.HeadMat} skeleton={nodes.Object_98.skeleton} rotation={[-Math.PI / 2, 0, 0]} scale={0.011} />
        <skinnedMesh name="Object_99" geometry={nodes.Object_99.geometry} material={materials.HeadAcc} skeleton={nodes.Object_99.skeleton} rotation={[-Math.PI / 2, 0, 0]} scale={0.011} />
        <skinnedMesh name="Object_100" geometry={nodes.Object_100.geometry} material={materials.CorpseMat} skeleton={nodes.Object_100.skeleton} rotation={[-Math.PI / 2, 0, 0]} scale={0.011} />
        {weaponsVisible && (
          <>
            <skinnedMesh name="Object_102" geometry={nodes.Object_102.geometry} material={materials.WeaponMat} skeleton={nodes.Object_102.skeleton} rotation={[-Math.PI / 2, 0, 0]} scale={0.011} />
            <skinnedMesh name="Object_104" geometry={nodes.Object_104.geometry} material={materials.AltWeaponMat} skeleton={nodes.Object_104.skeleton} rotation={[-Math.PI / 2, 0, 0]} scale={0.011} />
          </>
        )}
      </group>
    </group>
  )
}

useGLTF.preload('/testmodel.glb')
