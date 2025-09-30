/**
 * @file Рефакторированный компонент AR Recorder
 */
import React, { useState, useCallback, useEffect } from 'react';
import ControlPanel from './components/ui/ControlPanel.jsx';
import ARRenderer from './components/ar/ARRenderer.jsx';
import { useCamera, useRecording, useAprilTag, useAlvaAR } from './hooks/index.js';
import { loadAlva } from './alvaBridge';

const ARRecorder = ({ onShowLanding }) => {
  // Основное состояние
  const [running, setRunning] = useState(false);
  const [withMic, setWithMic] = useState(true);
  const [micStreamRef, setMicStreamRef] = useState(null);
  const [arData, setArData] = useState({
    aprilTagCount: 0,
    trainData: { hasInstance: false, isVisible: false },
    debugCubeData: { hasInstance: false, isVisible: false },
    activeSceneId: null,
    status: "Нужен HTTPS или localhost"
  });

  // Хуки
  const camera = useCamera();
  const recording = useRecording();
  const aprilTag = useAprilTag();
  const alvaAR = useAlvaAR();

  /**
   * Запуск камеры
   */
  const handleStartCamera = useCallback(async () => {
    const result = await camera.startCamera(
      aprilTag.aprilTagPipelineRef.current,
      alvaAR.alvaRef,
      alvaAR.assignAlvaPoints,
      loadAlva,
      () => {
        // Callback для обновления размеров после инициализации камеры
        console.log('Camera ready, triggering size update');
        window.dispatchEvent(new Event('resize'));
      }
    );

    if (result.success) {
      // Получение микрофона при необходимости
      if (withMic) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          });
          setMicStreamRef(micStream);
        } catch (e) {
          console.warn('Failed to get microphone:', e);
          setMicStreamRef(null);
        }
      }

      setRunning(true);
      setArData(prev => ({ ...prev, status: "Камера активна" }));
    } else {
      const errorMessage = result.error?.message || result.error?.name || 'Unknown error';
      console.error('Camera start failed:', result.error);
      setArData(prev => ({ ...prev, status: `Ошибка камеры: ${errorMessage}` }));
    }
  }, [camera, aprilTag.aprilTagPipelineRef, alvaAR, withMic]);

  /**
   * Остановка камеры
   */
  const handleStopCamera = useCallback(() => {
    camera.stopCamera();
    aprilTag.clearDetections();
    
    if (micStreamRef) {
      micStreamRef.getTracks().forEach(t => t.stop());
      setMicStreamRef(null);
    }

    setRunning(false);
    setArData(prev => ({ ...prev, status: "Камера остановлена" }));
  }, [camera, aprilTag, micStreamRef]);

  /**
   * Запуск записи
   */
  const handleStartRecording = useCallback(() => {
    const canvas = document.getElementById('mix');
    const result = recording.startRecording(canvas, micStreamRef);
    
    if (result.success) {
      setArData(prev => ({ ...prev, status: `Запись: ${result.mimeType}` }));
    } else {
      setArData(prev => ({ ...prev, status: result.error }));
    }
  }, [recording, micStreamRef]);

  /**
   * Остановка записи
   */
  const handleStopRecording = useCallback(() => {
    recording.stopRecording();
    setArData(prev => ({ ...prev, status: "Готово" }));
  }, [recording]);

  /**
   * Переключение микрофона
   */
  const handleToggleMic = useCallback((enabled) => {
    setWithMic(enabled);
    
    // Если микрофон отключен и есть активный поток - остановить его
    if (!enabled && micStreamRef) {
      micStreamRef.getTracks().forEach(t => t.stop());
      setMicStreamRef(null);
    }
  }, [micStreamRef]);

  /**
   * Обработка изменений в AR данных
   */
  const handleARDataChange = useCallback((newData) => {
    setArData(prev => ({ ...prev, ...newData }));
  }, []);

  /**
   * Обработка изменений детекций
   */
  const handleDetectionsChange = useCallback((detections) => {
    // Можно добавить дополнительную логику обработки детекций
    console.debug('Detections changed:', detections.length);
  }, []);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      recording.stopRecording();
      camera.stopCamera();
      recording.cleanup();
      camera.cleanup();
      
      // Очистка микрофона
      if (micStreamRef) {
        micStreamRef.getTracks().forEach(t => t.stop());
      }
    };
  }, []); // Пустой массив зависимостей для выполнения только при размонтировании

  return (
    <div style={{
      height: "100vh",
      background: "#1a1a1a",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Скрытое видео - должно быть здесь для доступности camRef */}
      <video
        id="cam"
        ref={camera.camRef}
        playsInline
        muted
        style={{ display: "none" }}
      />

      {/* AR Renderer */}
      <ARRenderer
        running={running}
        onStatusChange={handleARDataChange}
        onDetectionsChange={handleDetectionsChange}
      />

      {/* Control Panel */}
      <ControlPanel
        // Status data
        time={recording.time}
        aprilTagCount={arData.aprilTagCount}
        trainActive={arData.trainData.hasInstance && arData.trainData.isVisible}
        debugCubeActive={arData.debugCubeData.hasInstance && arData.debugCubeData.isVisible}
        activeSceneId={arData.activeSceneId}
        downloadLink={recording.downloadLink}
        status={arData.status}
        
        // Camera controls
        running={running}
        onStartCamera={handleStartCamera}
        onStopCamera={handleStopCamera}
        
        // Audio controls
        withMic={withMic}
        onToggleMic={handleToggleMic}
        
        // Recording controls
        recOn={recording.recOn}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
        
        // Landing button
        onShowLanding={onShowLanding}
      />
    </div>
  );
};

export default ARRecorder;
