# LCTAR Component Architecture Diagram

## Обзор архитектуры

LCTAR (Location-based AR Quest System) представляет собой современную систему дополненной реальности для музеев и парков, построенную на базе веб-технологий.

## Основные компоненты

### 🖥️ Frontend (React)
- **App.jsx** - Главный компонент приложения
- **SceneComponent.jsx** - 3D сцена с Three.js
- **ApriltagPipeline.jsx** - Пайплайн детекции AprilTag меток
- **AlvaBridge.jsx** - Интеграция с SLAM системой AlvaAR
- **ConsolePanel.jsx** - Панель отладки и логов
- **Landing.jsx** - Приветственная страница

### 🎮 3D Rendering Engine
- **Three.js** - 3D графика и рендеринг
- **React Three Fiber** - React-обертка для Three.js
- **WebGL Context** - Низкоуровневое GPU ускорение

### 👁️ Computer Vision
- **AprilTag WASM** - WebAssembly модуль для детекции AprilTag
- **OpenCV.js** - Обработка изображений в браузере
- **Camera API** - Захват видео с камеры устройства

### ⚡ Backend (FastAPI)
- **API Routes** - REST эндпоинты для взаимодействия
- **Models** - SQLAlchemy модели данных
- **Services** - Бизнес-логика и сервисы
- **AI/ML Pipeline** - Модели машинного обучения

### 🤖 AI/ML Services
- **YOLO Model** - Детекция объектов
- **Depth Model** - Оценка глубины сцены
- **Height Calculation** - Вычисление роста объектов

### 🗄️ Database (PostgreSQL)
- **Users** - Данные пользователей
- **Characters** - Персонажи и контент
- **Videos** - Загруженные видео
- **Client Logs** - Логи клиентской стороны
- **Quest Sessions** - Сессии прохождения квестов
- **Achievements** - Достижения и награды
- **Coupons** - Сгенерированные купоны

### 🌐 External Services
- **CDN (CloudFront)** - Доставка статических файлов
- **WebRTC Service** - P2P коммуникация
- **Authentication Provider** - Аутентификация пользователей

### 🏗️ Infrastructure
- **Docker** - Контейнеризация
- **Nginx** - Reverse proxy и балансировщик нагрузки
- **Redis Cache** - Кеширование
- **Monitoring** - Мониторинг и observability

### 🚀 Deployment Architecture
- **Container Orchestration** - Docker Compose для разработки
- **Load Balancing** - Nginx reverse proxy с health checks
- **Security Layer** - SSL/TLS, Firewall, WAF, DDoS protection
- **Monitoring Stack** - Prometheus metrics, Grafana dashboards
- **Storage Solutions** - Persistent volumes для БД, S3 для assets
- **CDN Distribution** - Global static asset distribution
- **Scalability** - Horizontal scaling with load balancer

### 🎯 Core Systems
- **AprilTag Detection** - Система распознавания маркеров
- **SLAM System** - Одновременная локализация и картирование
- **Gamification Engine** - Игровая механика и награды

## Взаимодействия между компонентами

### Frontend ↔ Backend
- REST API для обмена данными квестов и действий пользователя
- WebSocket для обновлений в реальном времени
- JSON для структурированных ответов

### Computer Vision Pipeline
- Поток видео от камеры к системе детекции AprilTag
- WebAssembly обработка для высокой производительности
- OpenCV.js для предварительной обработки изображений

### 3D Rendering
- Three.js для рендеринга 3D графики
- React Three Fiber для интеграции с React
- WebGL для аппаратного ускорения

### Data Flow
```
Frontend → Backend (POST /api/quest/*)
Backend → Database (CRUD operations)
Database → Backend (query results)
Backend → Frontend (JSON responses)
```

## Ключевые особенности архитектуры

1. **Современный стек технологий** - React, FastAPI, PostgreSQL
2. **WebAR возможности** - Работает в браузере без установки приложений
3. **Компьютерное зрение** - Real-time детекция AprilTag через WebAssembly
4. **Микросервисная архитектура** - Масштабируемый backend
5. **Игровая механика** - Система токенов и достижений
6. **Многоязычность** - Поддержка нескольких языков
7. **Контейнеризация** - Легкое развертывание и масштабирование

## Технологический стек

### Frontend
- React 18+
- Three.js / React Three Fiber
- AprilTag WebAssembly
- OpenCV.js
- TypeScript

### Backend
- FastAPI (Python)
- SQLAlchemy ORM
- PostgreSQL
- YOLO / Depth Models
- Redis Cache

### Infrastructure
- Docker & Docker Compose
- Nginx
- AWS S3 / CloudFront
- Monitoring (Prometheus/Grafana)

## Безопасность
- JWT токены для аутентификации
- CORS настройки
- Валидация входных данных
- Защищенные API эндпоинты

## Производительность
- WebAssembly для тяжелых вычислений
- CDN для статических файлов
- Кеширование Redis
- Оптимизированные 3D модели
- Lazy loading компонентов

## 📊 Deployment Diagram

Отдельная диаграмма развертывания (`deployment_diagram.puml`) показывает полную инфраструктуру развертывания LCTAR системы:

### Основные слои развертывания

**Пользовательский трафик:**
- End Users и Administrators подключаются через HTTPS
- Nginx reverse proxy обрабатывает входящий трафик
- SSL/TLS termination и rate limiting для безопасности

**Контейнеры приложений:**
- **Frontend Container**: React SPA с Three.js и WebAssembly
- **Backend Container**: FastAPI сервер с AI/ML сервисами
- **Database Container**: PostgreSQL с connection pooling

**Инфраструктурные сервисы:**
- **Monitoring Stack**: Prometheus, Grafana, AlertManager
- **Storage & Cache**: Redis, S3, persistent volumes
- **Security**: Firewall, DDoS protection, WAF

**Внешние сервисы:**
- **CDN (CloudFront)**: Глобальное распределение статических assets
- **DNS Provider**: Маршрутизация трафика
- **SSL Certificates**: Сертификаты для защищенных соединений

### Ключевые особенности развертывания

1. **Масштабируемость**: Horizontal scaling через load balancer
2. **Высокая доступность**: Health checks и monitoring
3. **Безопасность**: Многоуровневая защита (SSL, Firewall, WAF, DDoS)
4. **Производительность**: CDN для статических файлов, Redis кеширование
5. **Мониторинг**: Полная observability через Prometheus/Grafana
6. **Резервное копирование**: Автоматические бэкапы базы данных

### Трафик Flow

```mermaid
Users → Nginx (SSL/443) → Frontend/Backend Containers
Frontend → Backend API → PostgreSQL Database
Static Assets → S3 → CloudFront CDN → Users
All Components → Prometheus → Grafana Dashboards
```

---

*Диаграммы созданы с использованием PlantUML для визуализации архитектуры LCTAR системы*