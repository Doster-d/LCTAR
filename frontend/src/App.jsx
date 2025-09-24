/* @refresh reset */
import React, { useRef, useEffect, useState, Suspense } from 'react';
import ConsolePanel from './ConsolePanel';
import { loadAlva, poseToMatrix4 } from './alvaBridge';
const SceneComponent = React.lazy(() => import('./SceneComponent'));


function App({ onSwitchToLanding }) {
  console.log('[DEBUG] App.jsx: App function started');

  const [transforms, setTransforms] = useState([]);
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [anchorMatrix, setAnchorMatrix] = useState(null); // T_world_tag
  const [PipelineClass, setPipelineClass] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const pipelineRef = useRef(null);
  const frameCountRef = useRef(0);
  const alvaRef = useRef(null);
  const anchorLockedRef = useRef(false);
  const isActiveRef = useRef(false);
  const streamRef = useRef(null);

  console.log('[DEBUG] App.jsx: First useEffect starting');
  useEffect(() => {
    console.log('[DEBUG] App.jsx: First useEffect executed');
    // Загружаем ApriltagPipeline асинхронно
    import('./apriltagPipeline').then(module => {
      console.log('[DEBUG] App.jsx: ApriltagPipeline imported:', module);
      setPipelineClass(() => module.default);
    });
  }, []);

  console.log('[DEBUG] App.jsx: Second useEffect starting');
  useEffect(() => {
    console.log('[DEBUG] App.jsx: Second useEffect executed, PipelineClass:', PipelineClass);
      if (!PipelineClass) return;
 
      isActiveRef.current = true;

    const init = async () => {
      try {
        // Проверяем поддержку getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.error('❌ getUserMedia не поддерживается в этом браузере');
          return;
        }

        // Проверяем наличие video элемента
        if (!videoRef.current) {
          console.error('❌ Video элемент не найден');
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } }
        });
        streamRef.current = stream;

        const v = videoRef.current;
        v.srcObject = stream;
        v.setAttribute('playsinline','');
        v.muted = true;

        await v.play().catch((error) => {
          console.error('❌ Ошибка воспроизведения видео:', error);
        });

        // Добавляем отслеживание состояния видео

        // Проверяем, что pipeline еще не инициализирован
        if (pipelineRef.current) {
          console.warn('⚠️ Pipeline уже инициализирован');
          return;
        }

        pipelineRef.current = new PipelineClass();
        console.log('[DEBUG] Pipeline initialized');

        // Проверяем инициализацию pipeline
        if (!pipelineRef.current) {
          console.error('❌ Не удалось создать ApriltagPipeline');
          return;
        }

        await pipelineRef.current.init();
        console.log('[DEBUG] Pipeline init completed');

        // Инициализируем AlvaAR после того, как видео отдаёт валидные размеры
        const ensureAlva = async () => {
          const w = v.videoWidth, h = v.videoHeight;
          if (w && h && !alvaRef.current) {
            alvaRef.current = await loadAlva(w, h); // SLAM init
          }
        };
        await ensureAlva();
        setTimeout(ensureAlva, 1000); // Пытаемся снова через секунду, если не получилось сразу

        const processFrame = () => {
          frameCountRef.current++;

          if (!isActiveRef.current) return;

          if (!videoRef.current || !canvasRef.current) {
            requestAnimationFrame(processFrame);
            return;
          }

          // Проверяем, инициализирован ли pipeline
          if (!pipelineRef.current) {
            requestAnimationFrame(processFrame);
            return;
          }

          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');

          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;

          ctx.drawImage(videoRef.current, 0, 0);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

          const detectedTransforms = pipelineRef.current.detect(imageData);
          console.log('[DEBUG] Detected transforms:', detectedTransforms);

          setTransforms(detectedTransforms);
          
          if (alvaRef.current) {
            const cameraPose = alvaRef.current.findCameraPose(imageData);   // {R,t}
            const planePose  = alvaRef.current.findPlane();

            if (!anchorLockedRef.current && cameraPose && detections?.length > 0 && planePose) {
              const T_world_cam = poseToMatrix4(cameraPose);
              const T_tag_cam   = new Matrix4().fromArray(detections[0].matrix);
              const T_world_tag = T_world_cam.clone().multiply(T_tag_cam.clone().invert());
              setAnchorMatrix(T_world_tag.toArray());
              anchorLockedRef.current = true;
              console.log('🔒 Anchor locked:', T_world_tag.toArray());
            }
          }

          requestAnimationFrame(processFrame);
        };

        // Добавляем несколько способов запуска processFrame
        const startProcessing = () => {
          if (videoRef.current && videoRef.current.videoWidth > 0) {
            processFrame();
          } else {
            setTimeout(startProcessing, 100);
          }
        };

        videoRef.current.onloadedmetadata = () => {
          startProcessing();
          // Настраиваем проекционную матрицу камеры после загрузки метаданных видео
          if (pipelineRef.current && videoRef.current) {
            const video = videoRef.current;
            // Сохраняем размеры видео
            setVideoSize({ width: video.videoWidth, height: video.videoHeight });

            const intrinsics = pipelineRef.current.getCameraInfo();
            // Обновляем camera info в pipeline с реальными размерами видео
            pipelineRef.current.set_camera_info(
              intrinsics.fx,
              intrinsics.fy,
              video.videoWidth / 2, // cx - центр изображения
              video.videoHeight / 2 // cy - центр изображения
            );
          }
        };

        // Запускаем processFrame через таймаут как fallback
        setTimeout(() => {
          if (videoRef.current && videoRef.current.videoWidth > 0) {
            processFrame();
          }
        }, 1000);
      } catch (error) {
        console.error('❌ Критическая ошибка при инициализации:', error);
      }
    };

    console.log('Инициализация приложения...');
    init();

    return () => {
      isActiveRef.current = false;
      if (videoRef.current) {
        videoRef.current.pause();
        if (videoRef.current.srcObject) {
          videoRef.current.srcObject.getTracks().forEach(track => track.stop());
          videoRef.current.srcObject = null;
        }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      pipelineRef.current = null;
      alvaRef.current = null;
    };
  }, [PipelineClass]);

  return (
    <>
      <button onClick={onSwitchToLanding} style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000 }}>Back to Landing</button>
      <ConsolePanel />
      <video
        ref={videoRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          objectFit: 'cover',
          zIndex: -1,
          opacity: 0.7
        }}
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <Suspense fallback={<div>Loading 3D Scene...</div>}>
        <SceneComponent
          transforms={transforms}
          pipelineRef={pipelineRef}
          videoWidth={videoSize.width}
          videoHeight={videoSize.height}
          anchorMatrix={anchorMatrix}
        />
      </Suspense>
    </>
  );
}

export default App;
