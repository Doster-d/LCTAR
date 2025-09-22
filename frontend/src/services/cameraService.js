// Сервис для работы с камерой и захватом изображений
export class CameraService {
  constructor() {
    this.videoElement = null
    this.canvas = null
    this.stream = null
    this.isInitialized = false
  }

  async initialize() {
    if (this.isInitialized) return

    try {
      // Создаем элементы для работы с камерой
      this.videoElement = document.createElement('video')
      this.canvas = document.createElement('canvas')
      const context = this.canvas.getContext('2d')

      // Запрашиваем доступ к камере
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Используем заднюю камеру для AR
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      })

      this.videoElement.srcObject = this.stream
      this.videoElement.play()

      this.isInitialized = true
      console.log('Camera initialized successfully')
    } catch (error) {
      console.error('Failed to initialize camera:', error)
      throw error
    }
  }

  async captureFrame() {
    if (!this.isInitialized) {
      throw new Error('Camera not initialized')
    }

    return new Promise((resolve) => {
      const capture = () => {
        if (this.videoElement.readyState === this.videoElement.HAVE_ENOUGH_DATA) {
          const { videoWidth, videoHeight } = this.videoElement

          this.canvas.width = videoWidth
          this.canvas.height = videoHeight

          const context = this.canvas.getContext('2d')
          context.drawImage(this.videoElement, 0, 0, videoWidth, videoHeight)

          this.canvas.toBlob((blob) => {
            resolve(blob)
          }, 'image/jpeg', 0.8)
        } else {
          requestAnimationFrame(capture)
        }
      }
      capture()
    })
  }

  getVideoElement() {
    return this.videoElement
  }

  getFocalLength() {
    // Ориентировочная фокальная длина для мобильных устройств
    // В реальном приложении это значение должно рассчитываться более точно
    const { videoWidth } = this.videoElement || { videoWidth: 1920 }
    return videoWidth * 0.8 // Примерное значение
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
    }
    this.isInitialized = false
  }
}

export const cameraService = new CameraService()