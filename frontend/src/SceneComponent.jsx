import { useEffect, useState, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Matrix4, Vector3, Color } from 'three';

/**
 * @brief Проверяет, что массив соответствует однородной матрице 4×4.
 * @param matrixArray Массив элементов матрицы.
 * @returns {boolean} Истина, если матрица валидна.
 */
function isMatrixValid(matrixArray) {
  return Boolean(matrixArray && Array.isArray(matrixArray) &&
    matrixArray.length === 16 &&
    matrixArray.every(val => val !== null && val !== undefined && !isNaN(val)));
}

/**
 * @brief Строит проекционную матрицу по внутренним параметрам камеры.
 * @param camera Настраиваемая камера Three.js.
 * @param fx Горизонтальное фокусное расстояние.
 * @param fy Вертикальное фокусное расстояние.
 * @param cx Координата X главной точки.
 * @param cy Координата Y главной точки.
 * @param w Ширина кадра в пикселях.
 * @param h Высота кадра в пикселях.
 * @param near Ближняя плоскость отсечения.
 * @param far Дальняя плоскость отсечения.
 * @returns {void}
 */
function setProjectionFromIntrinsics(camera, fx, fy, cx, cy, w, h, near=0.01, far=100) {
  const P = new Matrix4();
  const m00 = 2*fx/w, m11 = 2*fy/h;
  const m02 = 1 - 2*cx/w, m12 = 2*cy/h - 1;
  const m22 = (far+near)/(near-far), m23 = (2*far*near)/(near-far);
  P.set(
    m00, 0,   m02, 0,
    0,   m11, m12, 0,
    0,   0,   m22, m23,
    0,   0,  -1,   0
  );
  camera.projectionMatrix.copy(P);
  // camera.projectionMatrixInverse.copy(P.clone().invert());
}

/**
 * @brief Лёгкая обёртка сцены, подстраивающая камеру под параметры AprilTag.
 * @param props.transforms Набор трансформаций для отрисовки с поддержкой стабилизации.
 * @param props.pipelineRef Ссылка на пайплайн AprilTag с интринзиками.
 * @param props.videoWidth Ширина исходного видео.
 * @param props.videoHeight Высота исходного видео.
 * @param props.anchorMatrix Дополнительная матрица якоря.
 * @param props.showQualityIndicators Показывать индикаторы качества детекции.
 * @param props.onQualityChange Callback для изменений качества детекции.
 * @returns {JSX.Element} Содержимое сцены с отображением якоря и индикаторов качества.
 */
function Scene({
  transforms,
  pipelineRef,
  videoWidth,
  videoHeight,
  anchorMatrix,
  showQualityIndicators = true,
  onQualityChange
}) {
  const { camera, scene } = useThree();
  const [qualityState, setQualityState] = useState({
    overall: { quality: 0, mode: 'none', confidence: 0 },
    indicators: new Map()
  });

  // Рефы для индикаторов качества
  const qualityMeshesRef = useRef(new Map());

  // Цвета для индикации качества
  const qualityColors = {
    high: new Color(0x00ff00),     // Зеленый - высокое качество
    medium: new Color(0xffff00),   // Желтый - среднее качество
    low: new Color(0xff0000),      // Красный - низкое качество
    recovered: new Color(0xffa500), // Оранжевый - восстановленные детекции
    none: new Color(0x666666)      // Серый - отсутствие детекции
  };

  // Обновление состояния качества детекции
  useEffect(() => {
    if (transforms && transforms.length > 0) {
      const overallQuality = transforms[0]?.qualityInfo?.overall;
      if (overallQuality) {
        const newQualityState = {
          overall: overallQuality,
          indicators: new Map()
        };

        // Создаем индикаторы для каждого маркера
        transforms.forEach((transform, index) => {
          const confidence = transform.qualityInfo?.individual || 0;
          const isRecovered = transform.recovered || false;
          const mode = overallQuality.mode;

          newQualityState.indicators.set(transform.id, {
            confidence,
            isRecovered,
            mode,
            position: transform.position,
            index
          });
        });

        setQualityState(newQualityState);

        // Вызываем callback для внешнего обновления
        if (onQualityChange) {
          onQualityChange(newQualityState);
        }
      }
    } else {
      // Нет детекций
      setQualityState({
        overall: { quality: 0, mode: 'none', confidence: 0 },
        indicators: new Map()
      });

      if (onQualityChange) {
        onQualityChange({
          overall: { quality: 0, mode: 'none', confidence: 0 },
          indicators: new Map()
        });
      }
    }
  }, [transforms, onQualityChange]);

  useEffect(() => {
    camera.position.set(0, 0, 0);
    camera.matrixAutoUpdate = false;
    camera.updateMatrix();
    camera.updateMatrixWorld(true);

    if (pipelineRef.current && videoWidth && videoHeight) {
      const intrinsics = pipelineRef.current.getCameraInfo();
      setProjectionFromIntrinsics(
        camera,
        intrinsics.fx,
        intrinsics.fy,
        intrinsics.cx,
        intrinsics.cy,
        videoWidth,
        videoHeight
      );
    }
  }, [camera, pipelineRef, videoWidth, videoHeight]);

  // Анимационный цикл для плавного обновления индикаторов
  useFrame((state, delta) => {
    if (!showQualityIndicators || qualityState.indicators.size === 0) return;

    qualityState.indicators.forEach((indicator, id) => {
      const mesh = qualityMeshesRef.current.get(id);
      if (mesh) {
        // Плавное изменение цвета на основе уверенности
        const confidence = indicator.confidence;
        let targetColor;

        if (indicator.isRecovered) {
          targetColor = qualityColors.recovered;
        } else if (confidence > 0.7) {
          targetColor = qualityColors.high;
        } else if (confidence > 0.4) {
          targetColor = qualityColors.medium;
        } else {
          targetColor = qualityColors.low;
        }

        // Плавный переход цвета
        mesh.material.color.lerp(targetColor, delta * 2);

        // Пульсация для восстановленных детекций
        if (indicator.isRecovered) {
          const pulse = (Math.sin(state.clock.elapsedTime * 3) + 1) * 0.5;
          mesh.scale.setScalar(1 + pulse * 0.2);
        }
      }
    });
  });

  return (
    <>
      {/* Стабилизированный якорь */}
      {anchorMatrix && (
        <group matrixAutoUpdate={false} matrix={new Matrix4().fromArray(anchorMatrix)}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.08, 0.08, 0.08]} />
            <meshStandardMaterial color={'orange'} />
          </mesh>
        </group>
      )}

      {/* Визуализация детекций маркеров с индикаторами качества */}
      {transforms && transforms.map((transform, index) => {
        const confidence = transform.qualityInfo?.individual || 0;
        const isRecovered = transform.recovered || false;
        const matrix = transform.stabilizedMatrix || transform.matrix;

        if (!matrix) return null;

        return (
          <group
            key={`${transform.id}-${index}`}
            matrixAutoUpdate={false}
            matrix={new Matrix4().fromArray(matrix)}
          >
            {/* Основной маркер */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.06, 0.06, 0.01]} />
              <meshStandardMaterial
                color={isRecovered ? qualityColors.recovered :
                       confidence > 0.7 ? qualityColors.high :
                       confidence > 0.4 ? qualityColors.medium : qualityColors.low}
                transparent
                opacity={0.8}
              />
            </mesh>

            {/* Индикатор уверенности (кольцо) */}
            {showQualityIndicators && (
              <mesh position={[0, 0, 0.02]}>
                <ringGeometry args={[0.08, 0.12, 16]} />
                <meshBasicMaterial
                  color={confidence > 0.7 ? qualityColors.high :
                         confidence > 0.4 ? qualityColors.medium : qualityColors.low}
                  transparent
                  opacity={0.6}
                />
              </mesh>
            )}

            {/* Индикатор восстановления (пульсирующая сфера) */}
            {isRecovered && showQualityIndicators && (
              <mesh position={[0, 0, 0.05]}>
                <sphereGeometry args={[0.03, 8, 8]} />
                <meshBasicMaterial
                  color={qualityColors.recovered}
                  transparent
                  opacity={0.7}
                />
              </mesh>
            )}

            {/* Метка ID маркера */}
            {showQualityIndicators && (
              <mesh position={[0, 0, 0.08]}>
                <planeGeometry args={[0.04, 0.02]} />
                <meshBasicMaterial color={'white'} transparent opacity={0.9} />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Индикатор режима множественных маркеров */}
      {showQualityIndicators && qualityState.overall.mode === 'multi' && (
        <mesh position={[0.8, 0.6, -1]}>
          <planeGeometry args={[0.3, 0.1]} />
          <meshBasicMaterial
            color={qualityColors.high}
            transparent
            opacity={0.8}
          />
        </mesh>
      )}

      {/* Индикатор потери детекции */}
      {showQualityIndicators && qualityState.overall.mode === 'none' && (
        <mesh position={[0, 0.6, -1]}>
          <planeGeometry args={[0.4, 0.12]} />
          <meshBasicMaterial
            color={qualityColors.none}
            transparent
            opacity={0.6}
          />
        </mesh>
      )}

      <ambientLight intensity={0.4} />
      <directionalLight position={[2.5, 8, 5]} intensity={1.5} />

      {/* Дополнительное освещение для лучшей видимости индикаторов */}
      <pointLight position={[0, 2, 2]} intensity={0.5} color={qualityColors.high} />
    </>
  );
}

/**
 * @brief Адаптер, пробрасывающий пропсы во внутренний компонент Scene с поддержкой стабилизированных трансформаций.
 * @param props.transforms Стабилизированные трансформации маркеров.
 * @param props.pipelineRef Ссылка на пайплайн AprilTag.
 * @param props.videoWidth Ширина видео.
 * @param props.videoHeight Высота видео.
 * @param props.anchorMatrix Матрица якоря.
 * @param props.showQualityIndicators Показывать индикаторы качества (по умолчанию true).
 * @param props.onQualityChange Callback для изменений качества детекции.
 * @returns {JSX.Element} Настроенный компонент Scene с визуализацией качества.
 */
export default function SceneComponent({
  transforms,
  pipelineRef,
  videoWidth,
  videoHeight,
  anchorMatrix,
  showQualityIndicators = true,
  onQualityChange,
  ...props
}) {
  return (
    <Scene
      transforms={transforms}
      pipelineRef={pipelineRef}
      videoWidth={videoWidth}
      videoHeight={videoHeight}
      anchorMatrix={anchorMatrix}
      showQualityIndicators={showQualityIndicators}
      onQualityChange={onQualityChange}
      {...props}
    />
  );
}
