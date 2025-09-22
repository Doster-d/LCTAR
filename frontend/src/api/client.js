// API клиент для подключения к backend
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

class ApiClient {
  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    }

    // Добавляем credentials для CORS если нужно
    if (options.withCredentials) {
      config.credentials = 'include'
    }

    try {
      const response = await fetch(url, config)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('API request failed:', error)
      throw error
    }
  }

  // Отправка изображения для inference
  async inferenceFrame(imageFile, focalLength, characterId = null) {
    const formData = new FormData()
    formData.append('file', imageFile)
    formData.append('focal_length', focalLength.toString())

    if (characterId) {
      formData.append('character_id', characterId.toString())
    }

    return this.request('/inference/frame', {
      method: 'POST',
      body: formData,
      headers: {} // Не устанавливаем Content-Type для FormData
    })
  }

  // Проверка здоровья API
  async healthCheck() {
    return this.request('/health')
  }
}

// Создаем экземпляр клиента
export const apiClient = new ApiClient()
export default ApiClient