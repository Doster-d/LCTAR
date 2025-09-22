// Сервис для работы с inference API
import { apiClient } from '../api/client.js'
import { cameraService } from './cameraService.js'

export class InferenceService {
  constructor() {
    this.isProcessing = false
  }

  async runInference(characterId = null) {
    if (this.isProcessing) {
      throw new Error('Inference is already running')
    }

    try {
      this.isProcessing = true

      // Инициализируем камеру если нужно
      await cameraService.initialize()

      // Захватываем кадр с камеры
      const imageBlob = await cameraService.captureFrame()

      // Получаем фокальную длину
      const focalLength = cameraService.getFocalLength()

      console.log('Sending image for inference...', {
        focalLength,
        characterId,
        imageSize: imageBlob.size
      })

      // Отправляем на backend
      const result = await apiClient.inferenceFrame(imageBlob, focalLength, characterId)

      console.log('Inference result:', result)
      return result

    } catch (error) {
      console.error('Inference failed:', error)
      throw error
    } finally {
      this.isProcessing = false
    }
  }

  async healthCheck() {
    try {
      const result = await apiClient.healthCheck()
      return result
    } catch (error) {
      console.error('Backend health check failed:', error)
      return { status: 'error', message: error.message }
    }
  }

  isReady() {
    return cameraService.isInitialized && !this.isProcessing
  }

  getProcessingStatus() {
    return {
      isProcessing: this.isProcessing,
      isReady: this.isReady()
    }
  }
}

export const inferenceService = new InferenceService()