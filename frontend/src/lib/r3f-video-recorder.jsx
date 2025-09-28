"use client";

import { Canvas } from "@react-three/fiber";
import React, {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Vector2, WebGLRenderer } from "three";
import { action, makeObservable, observable } from "mobx";
import { CanvasSource, Output, Mp4OutputFormat, BufferTarget, QUALITY_HIGH } from "mediabunny";

const EPSILON = 1e-7;
/**
 * @brief Округляет число вниз с учётом эпсилона, чтобы избежать ошибок округления.
 * @param n Входное значение.
 * @returns {number} Целая часть после округления вниз.
 */
function floor(n) { return Math.floor(n + EPSILON); }
/**
 * @brief Округляет число до ближайшего чётного целого.
 * @param n Входное значение.
 * @returns {number} Приближённое чётное целое.
 */
function even(n) { const r = Math.round(n); return r & 1 ? r + 1 : r; }

const SCALES = { "1x": 1, "2x": 2, "3x": 3, "4x": 4 };

const VideoCanvasContext = createContext(null);
/**
 * @brief React-хук для доступа к контексту VideoCanvasManager.
 * @returns {VideoCanvasManager} Активный менеджер видеоканваса.
 */
export const useVideoCanvas = () => {
  const ctx = useContext(VideoCanvasContext);
  if (!ctx) throw new Error("useVideoCanvas must be used inside <VideoCanvas>");
  return ctx;
};

/**
 * @brief Оборачивает канвас React Three Fiber и открывает менеджер записи через ref.
 * @param props Пропсы компонента, включая fps, onCreated и потомков.
 * @param ref Ref, принимающий VideoCanvasInstance.
 * @returns {JSX.Element} Управляемый элемент канваса.
 */
export const VideoCanvas = forwardRef(function VideoCanvas(
  { fps, onCreated, children, ...otherProps },
  ref
) {
  const stateRef = useRef(null);
  const videoCanvasRef = useRef(null);

  const maybeNotifyCreated = () => {
    if (stateRef.current && videoCanvasRef.current) {
      console.debug('[VideoCanvas] maybeNotifyCreated: notifying onCreated; state ready, videoCanvas ready');
      try { onCreated?.({ state: stateRef.current, videoCanvas: videoCanvasRef.current }); } catch (e) { console.error('[VideoCanvas] onCreated callback threw', e); }
    }
  };
  console.debug('[VideoCanvas] render start, fps=', fps, 'otherProps=', otherProps);

  return (
    <Canvas
      {...otherProps}
      ref={ref}
      gl={{ preserveDrawingBuffer: true }}
      onCreated={(state) => {
        console.debug('[VideoCanvas] onCreated (Canvas): state obtained', { drawingBuffer: state.gl?.getContext ? true : undefined, size: state.size });
        stateRef.current = state;
        maybeNotifyCreated();
      }}
    >
      <VideoCanvasInner
        ref={(mgr) => {
          videoCanvasRef.current = mgr;
          maybeNotifyCreated();
        }}
        fps={fps}
      >
        {children}
      </VideoCanvasInner>
    </Canvas>
  );
});

/**
 * @brief Внутренний слой канваса, управляющий расписанием захвата кадров.
 * @param fps Целевая частота кадров.
 * @param children Содержимое сцены для рендера.
 * @param ref Ref, получающий менеджер записи.
 * @returns {JSX.Element} Провайдер контекста для потомков.
 */
const VideoCanvasInner = forwardRef(function VideoCanvasInner({ fps, children }, ref) {
  const { gl, size } = require("@react-three/fiber").useThree((s) => ({
    gl: s.gl,
    size: s.size,
  }));
  const [videoCanvas] = useState(() => {
    console.debug('[VideoCanvasInner] creating VideoCanvasManager, fps=', fps, 'gl=', !!gl);
    return new VideoCanvasManager(gl, { fps });
  });

  useImperativeHandle(ref, () => videoCanvas);

  useEffect(() => {
    console.debug('[VideoCanvasInner] setFps ->', fps);
    videoCanvas.setFps(fps);
  }, [videoCanvas, fps]);

  require("@react-three/fiber").useFrame(({ gl, scene, camera, size }) => {
    const w = even(size.width), h = even(size.height);
    const cur = gl.getSize(new Vector2());
    if (cur.width !== w || cur.height !== h) {
      console.debug('[VideoCanvasInner] resize gl from', cur.width, 'x', cur.height, 'to', w, 'x', h);
      gl.setSize(w, h, false);
    }
    // render
    gl.render(scene, camera);

    const rec = videoCanvas.recording;
    if (!rec || rec.status !== VideoRecordingStatus.ReadyForFrames || rec.isCapturingFrame) return;

    const shouldCapture = (rec.lastCapturedFrame ?? -1) < videoCanvas.frame;
    if (!shouldCapture) return;

    if (rec instanceof FrameAccurateVideoRecording) {
      console.debug('[VideoCanvasInner] capture frame (frame-accurate) frame=', videoCanvas.frame);
      rec.captureFrame(videoCanvas.frame).then(() => videoCanvas.setFrame(videoCanvas.frame + 1)).catch(e => console.error('[VideoCanvasInner] captureFrame error', e));
    } else if (rec instanceof RealtimeVideoRecording) {
      console.debug('[VideoCanvasInner] capture frame (realtime) frame=', videoCanvas.frame);
      rec.captureFrame(videoCanvas.frame).catch(e => console.error('[VideoCanvasInner] captureFrame error', e));
    }
  }, 1);

  return <VideoCanvasContext.Provider value={videoCanvas}>{children}</VideoCanvasContext.Provider>;
});

/**
 * @brief Координирует время воспроизведения и запись WebGL-канваса.
 */
export class VideoCanvasManager {
  /**
   * @brief Создаёт новый менеджер записи.
   * @param gl WebGL-рендерер, используемый для захвата.
   * @param fps Целевая частота захвата.
   */
  constructor(gl, { fps = 60 } = {}) {
    this.gl = gl;
    this.fps = fps;
    this.recording = null;
    this.rawTime = 0;
    this.isPlaying = false;
    this.lastTimestamp = null;
    this.rafId = null;

    makeObservable(this, {
      isPlaying: observable.ref,
      rawTime: observable.ref,
      recording: observable.ref,
      fps: observable.ref,
      setTime: action,
      setFrame: action,
      setFps: action,
      play: action,
      pause: action,
    });
  }

  /**
   * @brief Переводит прошедшие секунды в индекс кадра.
   * @param time Время в секундах.
   * @returns {number} Индекс кадра.
   */
  toFrame(time) { return floor(time * this.fps); }
  /**
   * @brief Преобразует индекс кадра обратно во время.
   * @param frame Индекс кадра.
   * @returns {number} Время в секундах.
   */
  toTime(frame) { return frame / this.fps; }

  /**
   * @brief Текущее время воспроизведения в секундах.
   * @returns {number}
   */
  get time() { return this.toTime(this.frame); }
  /**
   * @brief Устанавливает время воспроизведения через преобразование кадров.
   * @param time Время в секундах.
   * @returns {void}
   */
  setTime(time) { this.setFrame(this.toFrame(time)); }

  /**
   * @brief Текущая позиция курсора по кадрам.
   * @returns {number}
   */
  get frame() { return this.toFrame(this.rawTime); }
  /**
   * @brief Обновляет курсор кадра и внутреннее представление времени.
   * @param frame Индекс кадра.
   * @returns {void}
   */
  setFrame(frame) { this.rawTime = this.toTime(floor(frame)); }
  /**
   * @brief Настраивает целевую частоту кадров.
   * @param fps Новая частота.
   * @returns {void}
   */
  setFps(fps) { this.fps = fps; }

  /**
   * @brief Запускает продвижение таймера воспроизведения.
   * @returns {void}
   */
  play() {
    this.isPlaying = true;
    if (this.rafId === null) {
      this.lastTimestamp = performance.now();
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  /**
   * @brief Останавливает продвижение таймера воспроизведения.
   * @returns {void}
   */
  pause() {
    this.isPlaying = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * @brief Внутренний RAF-цикл, накапливающий время кадра.
   */
  loop = action(() => {
    if (!this.isPlaying) return;
    const ts = performance.now();
    const delta = ts - this.lastTimestamp;
    this.lastTimestamp = ts;
    this.rawTime += delta / 1000;
    this.rafId = requestAnimationFrame(this.loop);
  });

  /**
   * @brief Запускает сессию записи с заданными параметрами.
   * @param mode Режим записи (покадровый или реального времени).
   * @param duration Целевая длительность в секундах.
   * @param format Описание выходного формата.
   * @param codec Идентификатор видеокодека.
   * @param size Пресет масштабирования пикселей.
   * @param quality Целевой битрейт или профиль качества.
   * @returns {Promise<Blob>} Промис с готовым видеоблобом.
   */
  record({
    mode,
    duration,
    format = new Mp4OutputFormat(),
    codec = "avc",
    size = "2x",
    quality = QUALITY_HIGH,
  }) {
    return new Promise(async (resolve, reject) => {
      const initialPR = this.gl.getPixelRatio();
      this.gl.setPixelRatio(1 * SCALES[size]);

      const common = {
        canvas: this.gl.domElement,
        fps: this.fps,
        format,
        codec,
        quality,
        onDone: (blob) => {
          this.pause();
          resolve(blob);
          this.recording = null;
          this.gl.setPixelRatio(initialPR);
        },
        onError: (err) => {
          this.pause();
          reject(err);
          this.recording = null;
          this.gl.setPixelRatio(initialPR);
        },
      };

      if (mode === "frame-accurate") {
        this.pause();
        this.recording = new FrameAccurateVideoRecording({ ...common, duration });
      } else {
        this.play();
        this.recording = new RealtimeVideoRecording({ ...common, duration });
      }
    });
  }
}

const VideoRecordingStatus = {
  Initializing: "initializing",
  ReadyForFrames: "ready-for-frames",
  Finalizing: "finalizing",
  Canceling: "canceling",
};

/**
 * @brief Базовый класс, инкапсулирующий жизненный цикл записи.
 */
class VideoRecording {
  /**
   * @brief Создаёт обёртку новой сессии записи.
   * @param canvas HTMLCanvasElement, с которого ведётся захват.
   * @param fps Частота захвата.
   * @param format Экземпляр выходного формата.
   * @param codec Идентификатор видеокодека.
   * @param quality Качество кодирования или битрейт.
   * @param onDone Колбэк с готовым блобом.
   * @param onError Колбэк при ошибке записи.
   */
  constructor({ canvas, fps, format, codec, quality, onDone, onError }) {
    this.canvas = canvas;
    this.fps = fps;
    this.format = format;
    this.codec = codec;
    this.quality = quality;
    this.onDone = onDone;
    this.onError = onError;

    this.status = VideoRecordingStatus.Initializing;
    this.firstFrame = null;
    this.lastCapturedFrame = null;
    this.isCapturingFrame = false;

    this.output = new Output({ format, target: new BufferTarget() });
    this.canvasSource = new CanvasSource(this.canvas, { codec, bitrate: quality });
    this.output.addVideoTrack(this.canvasSource, { frameRate: this.fps });
    this.output
      .start()
      .then(() => { this.setStatus(VideoRecordingStatus.ReadyForFrames); })
      .catch((e) => { this.cancelWithReason(e || new Error("Unable to initialize recording")); });

    makeObservable(this, {
      status: observable.ref,
      setStatus: action,
    });
  }

  /**
   * @brief Переводит секунды в номер кадра.
   * @param time Время в секундах.
   * @returns {number} Номер кадра.
   */
  toFrame(time) { return floor(time * this.fps); }
  /**
   * @brief Возвращает индекс кадра обратно во временную отметку.
   * @param frame Номер кадра.
   * @returns {number} Время в секундах.
   */
  toTime(frame) { return frame / this.fps; }

  /**
   * @brief Обновляет текущий статус записи.
   * @param s Новое значение статуса.
   * @returns {void}
   */
  setStatus(s) { this.status = s; }

  /**
   * @brief Завершает запись и возвращает итоговый блоб.
   * @returns {Promise<void>}
   */
  stop = async () => {
    try {
      this.setStatus(VideoRecordingStatus.Finalizing);
      this.canvasSource.close();
      await this.output.finalize();
      const buffer = this.output.target.buffer;
      const blob = new Blob([buffer], { type: this.output.format.mimeType });
      this.onDone(blob);
    } catch (err) {
      this.cancelWithReason(err);
    }
  };

  /**
   * @brief Отменяет запись и передаёт ошибку подписчикам.
   * @param err Ошибка, объясняющая причину отмены.
   * @returns {Promise<void>}
   */
  cancelWithReason = async (err = new Error("Recording canceled")) => {
    try {
      this.setStatus(VideoRecordingStatus.Canceling);
      this.canvasSource.close();
      await this.output.cancel();
      this.onError(err);
    } catch (e) {
      this.onError(e);
    }
  };

  /**
   * @brief Упрощённый помощник для отмены записи с сообщением по умолчанию.
   * @returns {Promise<void>}
   */
  cancel = async () => this.cancelWithReason(new Error("Recording canceled"));
}

/**
 * @brief Режим записи, снимающий дискретные кадры для детерминированного тайминга.
 */
class FrameAccurateVideoRecording extends VideoRecording {
  constructor(params) {
    super(params);
    this.duration = params.duration;
  }

  /**
   * @brief Захватывает кадр по точной временной отметке для последующего кодирования.
   * @param frame Индекс кадра, который нужно сохранить.
   * @returns {Promise<void>}
   */
  async captureFrame(frame) {
    try {
      this.isCapturingFrame = true;
      if (this.firstFrame === null) this.firstFrame = frame;
      await this.canvasSource.add(
        this.toTime(frame) - this.toTime(this.firstFrame),
        this.toTime(1)
      );
      this.lastCapturedFrame = frame;
      if (this.toTime(frame - this.firstFrame + 1) >= this.duration) {
        await this.stop();
      }
    } catch (err) {
      await this.cancelWithReason(err);
    } finally {
      this.isCapturingFrame = false;
    }
  }
}

/**
 * @brief Режим записи, транслирующий кадры в реальном времени.
 */
class RealtimeVideoRecording extends VideoRecording {
  constructor(params) {
    super(params);
    this.duration = params.duration ?? null;
  }

  /**
   * @brief Захватывает кадр в процессе записи в реальном времени.
   * @param frame Индекс кадра для сохранения.
   * @returns {Promise<void>}
   */
  async captureFrame(frame) {
    try {
      this.isCapturingFrame = true;
      if (this.firstFrame === null) this.firstFrame = frame;
      await this.canvasSource.add(
        this.toTime(frame) - this.toTime(this.firstFrame),
        this.toTime(1)
      );
      this.lastCapturedFrame = frame;
      if (this.duration !== null && this.toTime(frame - this.firstFrame + 1) >= this.duration) {
        await this.stop();
      }
    } catch (err) {
      await this.cancelWithReason(err);
    } finally {
      this.isCapturingFrame = false;
    }
  }
}
