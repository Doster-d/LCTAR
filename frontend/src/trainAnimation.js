/**
 * @brief Система анимации для Train модели в AR сцене через Three.js RAF
 */

/**
 * @brief Обновляет анимацию Train модели через requestAnimationFrame.
 * @param train Экземпляр поезда для анимации.
 * @param deltaTime Время с последнего кадра в секундах.
 */
export function updateTrainAnimation(train, deltaTime) {
  if (!train || !train.userData) return;

  // Инициализируем userData для анимации если еще не создан
  if (!train.userData.animation) {
    const wheel = train.getObjectByName('Train-Wheels');
    const group = train;
    
    train.userData.animation = {
      timeRef: 0,
      groupTimeRef: 0,
      baseRef: wheel ? {
        x: wheel.position.x,
        y: wheel.position.y,
        z: wheel.position.z
      } : null,
      groupBaseRef: {
        x: group.position.x,
        y: group.position.y,
        z: group.position.z,
        rotX: group.rotation.x,
        rotY: group.rotation.y,
        rotZ: group.rotation.z
      },
      wheel: wheel
    };
    console.log('🎬 Train animation initialized:', train.userData.animation);
  }

  const anim = train.userData.animation;
  const wheel = anim.wheel;

  // Анимация колес: только вертикальное (вверх‑вниз) движение
  anim.timeRef = (anim.timeRef + deltaTime * 0.3) % 1;
  const t = anim.timeRef;
  const amplitude = 0.008; // уменьшенная амплитуда движения по Y для колес
  const offsetY = Math.sin(t * Math.PI * 2) * amplitude;
  if (wheel && anim.baseRef) {
    wheel.position.y = anim.baseRef.y + offsetY;
  }

  // Анимация всей модели: мягкое вверх‑вниз и небольшой наклон
  anim.groupTimeRef += deltaTime;
  const gt = anim.groupTimeRef;
  const groupAmp = 0.01; // уменьшенная амплитуда для всей модели (по Y)
  const groupOffsetY = Math.sin(gt * 0.8) * groupAmp;
  const tiltAmp = 0.008; // уменьшенная амплитуда наклона (в радианах)
  const tilt = Math.sin(gt * 0.6) * tiltAmp;

  if (anim.groupBaseRef) {
    train.position.y = anim.groupBaseRef.y + groupOffsetY;
    // Небольшой наклон вокруг Z
    train.rotation.z = anim.groupBaseRef.rotZ + tilt;
  }
}

/**
 * @brief Запускает цикл анимации для поезда
 * @param trainRef Ref к экземпляру поезда
 * @returns {function} Функция для остановки анимации
 */
export function startTrainAnimation(trainRef) {
  let animationId;
  let lastTime = performance.now() * 0.001;
  
  const animate = () => {
    if (trainRef.current) {
      const now = performance.now() * 0.001;
      const deltaTime = now - lastTime;
      lastTime = now;
      
      updateTrainAnimation(trainRef.current, deltaTime);
    }
    
    animationId = requestAnimationFrame(animate);
  };
  
  animate();
  
  return () => {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
  };
}
