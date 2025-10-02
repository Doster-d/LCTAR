/*
 * Комбинированная модель, объединяющая поезд из Train.jsx и коробку с апельсинами из Orangebox.jsx
 * Auto-generated combined model based on:
 * - Train.jsx (https://github.com/pmndrs/gltfjsx)
 * - Orangebox.jsx (https://github.com/pmndrs/gltfjsx)
 */

import React, { forwardRef, useEffect, useMemo, useRef } from 'react'
import { useGraph } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'

/**
 * @brief Комбинированная модель поезда с коробкой апельсинов.
 * Объединяет анимированную модель поезда с коробкой апельсинов на платформе.
 * @param props Проброшенные пропсы группы для позиционирования.
 * @returns {JSX.Element} Иерархия мешей с подключённой анимацией.
 */
export const Model = forwardRef((props, ref) => {
  const group = useRef()
  const trainGroup = useRef()

  // Загрузка моделей
  const { scene: trainScene, animations: trainAnimations } = useGLTF('./models/Train-transformed.glb')
  const { scene: orangeboxScene, animations: orangeboxAnimations } = useGLTF('models/orangebox-transformed.glb')

  // Клонирование сцен для переиспользования
  const clonedTrainScene = useMemo(() => SkeletonUtils.clone(trainScene), [trainScene])
  const clonedOrangeboxScene = useMemo(() => SkeletonUtils.clone(orangeboxScene), [orangeboxScene])

  // Получение nodes и materials для обеих моделей
  const { nodes: trainNodes, materials: trainMaterials } = useGraph(clonedTrainScene)
  const { nodes: orangeboxNodes, materials: orangeboxMaterials } = useGraph(clonedOrangeboxScene)

  // Анимации для обеих моделей
  const { actions: trainActions } = useAnimations(trainAnimations, trainGroup)
  const { actions: orangeboxActions } = useAnimations(orangeboxAnimations, trainGroup)

  // Ref forwarding
  useEffect(() => {
    if (!ref) return
    if (typeof ref === 'function') ref(group.current)
    else ref.current = group.current
  }, [ref])

  // Настройка анимаций для поезда
  useEffect(() => {
    if (!group.current) return
    const animationsList = Array.isArray(trainAnimations) ? trainAnimations : []
    group.current.userData.animations = animationsList
    group.current.animations = animationsList
  }, [trainAnimations])

  // Запуск анимаций поезда
  useEffect(() => {
    if (!trainActions) return
    const actionList = Object.values(trainActions)
    if (!actionList.length) return
    actionList.forEach(action => action.reset().play())
  }, [trainActions])

  // Запуск анимаций коробки с апельсинами
  useEffect(() => {
    if (!orangeboxActions) return
    const actionList = Object.values(orangeboxActions)
    if (!actionList.length) return
    actionList.forEach(action => action.reset().play())
  }, [orangeboxActions])

  // Получение узлов модели поезда
  const trainBodyNode = trainNodes['Train-Mat.2'] ?? trainNodes['Train-Mat2'] ?? trainNodes['Train_Mat.2'] ?? trainNodes['Train_Mat2']
  const trainWagonNode = trainNodes['Train-Wagon']
  const trainWheelsNode = trainNodes['Train-Wheels']
  const railsNode = trainNodes.Rails

  // Получение узлов модели коробки с апельсинами
  const orangesBoxNode = orangeboxNodes.Oranges_Box
  const orangeNode = orangeboxNodes.Orange

  if (!trainBodyNode) {
    console.error('Train model mesh "Train-Mat.2" not found. Available nodes:', Object.keys(trainNodes))
  }

  return (
    <group ref={group} {...props} dispose={null}>
      <group ref={trainGroup} rotation={[0, Math.PI / 2, 0]}>
        <group name="Null">
          {/* Модель поезда */}
          <group name="Train" position={[0, 0.26, 0]}>
            {trainBodyNode && (
              <mesh
                name={trainBodyNode.name ?? 'Train-Mat.2'}
                geometry={trainBodyNode.geometry}
                material={trainMaterials['Mat.2']}
              />
            )}
            {trainWagonNode && (
              <mesh
                name={trainWagonNode.name ?? 'Train-Wagon'}
                geometry={trainWagonNode.geometry}
                material={trainMaterials.Wagon}
              />
            )}
            {trainWheelsNode && (
              <mesh
                name={trainWheelsNode.name ?? 'Train-Wheels'}
                geometry={trainWheelsNode.geometry}
                material={trainMaterials.Wheels}
              />
            )}


            {/* Отдельный апельсин рядом с поездом */}
            {orangeNode && (
              <mesh
                name="Orange_near_Train"
                geometry={orangeNode.geometry}
                material={orangeboxMaterials.Mat}
                position={[-0.068 + 0, 0.123 + 0.26, 0.14 + 0]}
              />
            )}
          </group>

          {/* Коробка с апельсинами рядом с точкой спавна поезда */}
          {orangesBoxNode && (
            <group name="Orangebox_Stationary" position={[0.25, 0, 0]}>
              <group name="Oranges_Box" position={[0.016, 0.1, 0]} rotation={[0, -0.01, 0.008]}>
                <mesh name="Orange6" geometry={orangesBoxNode.children[0]?.geometry} material={orangeboxMaterials.Mat} position={[0.017, 0.023, -0.076]} rotation={[0.326, 0, -0.544]} />
                <mesh name="Orange4" geometry={orangesBoxNode.children[1]?.geometry} material={orangeboxMaterials.Mat} position={[-0.024, 0.029, 0.018]} rotation={[1.126, 0.001, -0.045]} />
                <mesh name="Orange1" geometry={orangesBoxNode.children[2]?.geometry} material={orangeboxMaterials.Mat} position={[-0.08, 0.046, 0.066]} rotation={[0.314, -0.285, -1.396]} />
                <mesh name="Orange11" geometry={orangesBoxNode.children[3]?.geometry} material={orangeboxMaterials.Mat} position={[-0.084, 0.022, 0.14]} />
                <mesh name="Box" geometry={orangesBoxNode.children[4]?.geometry} material={orangeboxMaterials['Mat.3']} position={[-0.003, -0.014, 0.002]} />
              </group>
            </group>
          )}

          {/* Рельсы */}
          {railsNode && (
            <mesh
              name={railsNode.name ?? 'Rails'}
              geometry={railsNode.geometry}
              material={trainMaterials['Mat.5']}
              position={[0, -0.114, -1.044]}
            />
          )}
        </group>
      </group>
    </group>
  )
})

/**
 * @brief Предварительно загружает GLTF-модели для комбинированной модели.
 */
useGLTF.preload('./models/Train-transformed.glb')
useGLTF.preload('./models/orangebox-transformed.glb')
