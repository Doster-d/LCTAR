@page backend Документация по бэкенду (Django REST API)

## Введение

Система захвата AR-контента с элементами геймификации для повышения вовлеченности пользователей.

## Описание проекта

LCTAR - это инновационная платформа для просмотра и взаимодействия с AR-контентом, где пользователи могут просматривать 3D модели различных активов (например, чебурашек) и получать промокоды за полное прохождение всех доступных активов. Система использует современную микросервисную архитектуру для обеспечения высокой производительности и масштабируемости.

## Архитектура системы

```
[Frontend React] → [Django REST API] → [MySQL 8.0]
                     ↓
              [Redis 7.0+] ↔ [Celery Workers]
                     ↓
                [RabbitMQ 3]
```

### Компоненты архитектуры

- **Django REST API**: Основной бэкенд сервер, обрабатывающий HTTP запросы
- **MySQL 8.0**: Реляционная база данных для хранения пользовательских данных, сессий и прогресса
- **Redis 7.0+**: Кэширование и брокер результатов для Celery
- **RabbitMQ 3**: Брокер сообщений для асинхронных задач
- **Celery Workers**: Асинхронные рабочие процессы для отправки email и фоновых задач

## Технологический стек

### Основные технологии
- **Django 5.2.6+** - высокоуровневый веб-фреймворк на Python
- **Django REST Framework 3.15+** - мощный и гибкий инструментарий для создания Web API
- **MySQL 8.0** - надежная реляционная база данных
- **Redis 7.0+** - хранилище данных в памяти для кэширования
- **RabbitMQ 3** - надежный брокер сообщений
- **Celery 5.3+** - распределенная система обработки задач

### Дополнительные инструменты
- **Python 3.13+** - современная версия языка программирования
- **python-decouple** - управление конфигурацией через переменные окружения
- **django-cors-headers** - обработка CORS для взаимодействия с frontend
- **pre-commit** - инструменты для автоматической проверки кода перед коммитом
- **ruff** - быстрый линтер и форматировщик Python кода

## Быстрый старт

### Через Docker Compose (рекомендуется)

```bash
# Сборка и запуск всех сервисов
docker-compose up --build

# Запуск в фоновом режиме
docker-compose up -d --build
```

После успешного запуска сервисы будут доступны на:
- **Django API**: http://localhost:8000
- **MySQL**: localhost:3306
- **Redis**: localhost:6379
- **RabbitMQ Management**: http://localhost:15672

### Локальная разработка

```bash
# Установка зависимостей
poetry install

# Или через pip
pip install -r requirements.txt

# Запуск Django сервера
cd arb
python manage.py runserver

# Запуск Celery worker в отдельном терминале
celery -A arb worker -l info

# Запуск Celery beat для периодических задач (если есть)
celery -A arb beat -l info
```

## Установка зависимостей

### Через Poetry (рекомендуется)

```bash
# Установка Poetry (если не установлен)
curl -sSL https://install.python-poetry.org | python3 -

# Клонирование проекта и установка зависимостей
git clone <repository-url>
cd lctar
poetry install
```

### Через pip

```bash
# Создание виртуального окружения
python -m venv venv
source venv/bin/activate  # Для Linux/Mac
# или
venv\Scripts\activate     # Для Windows

# Установка зависимостей
pip install -r requirements.txt
```

## Конфигурация окружения

1. Скопируйте файл примеров переменных окружения:
```bash
cp .env.example .env
```

2. Отредактируйте `.env` файл, указав актуальные значения:

```env
# Django настройки
SECRET_KEY=your-super-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# База данных
DB_NAME=lctar_db
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_ROOTPASSWORD=your_db_root_password
DB_HOST=localhost
DB_PORT=3306

# Email настройки
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-email-password
EMAIL_USE_TLS=True

# Redis
REDIS_URL=redis://localhost:6379/0

# CORS настройки
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000
CORS_ALLOW_CREDENTIALS=false
```

## Структура проекта

```
arb/
├── arb/                          # Основное Django приложение
│   ├── models.py                # Модели данных (пользователи, сессии, промокоды)
│   ├── views.py                 # API представления и бизнес-логика
│   ├── urls.py                  # Маршрутизация URL
│   ├── settings.py              # Конфигурация Django
│   ├── middleware.py            # Пользовательский middleware
│   ├── tasks.py                 # Celery задачи
│   ├── celery.py                # Конфигурация Celery
│   ├── admin.py                 # Django admin конфигурация
│   ├── tests.py                 # Тесты приложения
│   └── migrations/              # Миграции базы данных
├── manage.py                    # Django management script
├── requirements.txt             # Зависимости Python
└── pyproject.toml              # Конфигурация проекта (Poetry)
```

## API Endpoints

### Основные эндпоинты

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| POST | `/session/start/` | Создание новой сессии просмотра |
| POST | `/view/` | Регистрация просмотра актива пользователем |
| POST | `/user/email/` | Привязка email к сессии пользователя |
| GET | `/progress/` | Получение прогресса просмотра активов |
| GET | `/promo/` | Получение промокода за прохождение |
| GET | `/stats/` | Сводная статистика просмотров |

### Детальное описание API

#### Создание сессии
```http
POST /session/start/
```

**Ответ:**
```json
{
  "session_id": "uuid-здесь"
}
```

#### Регистрация просмотра
```http
POST /view/
Content-Type: application/json

{
  "session_id": "uuid-сессии",
  "asset_slug": "идентификатор-актива"
}
```

**Ответ:**
```json
{
  "session_id": "uuid-сессии",
  "asset_slug": "идентификатор-актива",
  "awarded_points": 10,
  "session_score": 150,
  "promo_code": "PROMO-ABC123-120000"  // если все активы просмотрены
}
```

#### Привязка email
```http
POST /user/email/
Content-Type: application/json

{
  "session_id": "uuid-сессии",
  "email": "user@example.com"
}
```

## Модели данных

### User (Пользователь)
- `id` - UUID первичный ключ
- `email` - уникальный адрес электронной почты
- `is_verified` - флаг верификации пользователя
- `verified_at` - время подтверждения почты
- `created_at` - время создания записи
- `total_score` - суммарный балл пользователя
- `metadata` - дополнительные метаданные в формате JSON

### Session (Сессия)
- `id` - UUID первичный ключ
- `user` - ссылка на пользователя (может отсутствовать)
- `created_at` - время создания сессии
- `last_seen` - последняя активность в сессии
- `score` - накопленные очки в рамках сессии
- `pending_email` - почта, привязанная позже
- `is_active` - флаг активности сессии
- `metadata` - дополнительные метаданные в формате JSON

### Asset (Актив/Контент)
- `id` - целочисленный первичный ключ
- `slug` - уникальный идентификатор актива
- `name` - человекочитаемое название
- `type` - тип актива (категория)
- `campaign` - кампания/пул активов
- `meta` - дополнительные метаданные в формате JSON

### SessionItemProgress (Прогресс просмотра)
- `id` - целочисленный первичный ключ
- `session` - ссылка на сессию
- `asset` - ссылка на актив
- `viewed_at` - время первого просмотра
- `times_viewed` - количество просмотров

### ViewEvent (Событие просмотра)
- `id` - целочисленный первичный ключ
- `session` - ссылка на сессию
- `asset` - ссылка на актив (может отсутствовать)
- `event_type` - тип события (например, "viewed_asset")
- `timestamp` - время возникновения события
- `raw_payload` - оригинальные данные события
- `processed` - флаг обработки события

### PromoCode (Промокод)
- `id` - целочисленный первичный ключ
- `code` - уникальный код промо
- `session` - ссылка на сессию (может отсутствовать)
- `user` - ссылка на пользователя (может отсутствовать)
- `email` - электронная почта получателя
- `issued_at` - время генерации промокода
- `sent_at` - время отправки промокода по email
- `used_at` - время использования промокода
- `meta` - дополнительные данные в формате JSON

## Celery задачи

### Асинхронные задачи

#### Отправка промокода по email
**Задача:** `arb.send_promocode_email`

Отправляет промокод пользователю на email после прохождения всех активов.

**Параметры:**
- `promo_code` (str) - код промокода для отправки

**Процесс:**
1. Получение промокода из базы данных
2. Отправка email с промокодом
3. Логирование события отправки в `ViewEvent`
4. Обновление времени отправки в `PromoCode`

## Разработка и тестирование

### Миграции базы данных

```bash
# Создание миграций
python manage.py makemigrations

# Применение миграций
python manage.py migrate

# Создание суперпользователя для админ-панели
python manage.py createsuperuser
```

### Тестирование

```bash
# Запуск всех тестов
python manage.py test

# Запуск конкретного приложения
python manage.py test arb

# Тестирование с покрытием
coverage run manage.py test
coverage report
```

### Линтинг и форматирование

```bash
# Проверка кода линтером
ruff check .

# Автоматическое исправление проблем
ruff check . --fix

# Форматирование кода
ruff format .

# Проверка перед коммитом
pre-commit run --all-files
```

## Развертывание

### Продакшн сборка с Docker

```bash
# Сборка и запуск продакшн версии
docker-compose -f docker-compose.prod.yml up --build -d

# Сборка статических файлов (если используются)
python manage.py collectstatic --noinput

# Создание миграций в продакшене
python manage.py migrate --noinput
```

### Рекомендации по продакшен развертыванию

1. **Безопасность:**
   - Использовать сильный `SECRET_KEY`
   - Установить `DEBUG=False`
   - Настроить правильные `ALLOWED_HOSTS`
   - Использовать HTTPS в продакшене

2. **Производительность:**
   - Настроить Redis для продакшена
   - Использовать базу данных с подходящими ресурсами
   - Настроить мониторинг и логирование

3. **Масштабирование:**
   - Использовать несколько Celery workers
   - Настроить load balancer для Django серверов
   - Использовать Redis cluster для больших нагрузок

## Мониторинг и логи

### Django Admin Panel
Админ-панель доступна по адресу `/admin/` после создания суперпользователя.

### Celery Monitoring
Для мониторинга задач Celery можно использовать Flower:
```bash
pip install flower
celery -A arb flower
```

### Структурированные логи
Проект использует встроенное логирование Django с уровнями:
- DEBUG
- INFO
- WARNING
- ERROR
- CRITICAL

### Метрики и мониторинг
Для сбора метрик рекомендуется использовать:
- **Sentry** для отслеживания ошибок
- **Prometheus + Grafana** для метрик производительности
- **ELK Stack** для централизованного логирования

## Поддержка и развитие

При возникновении вопросов или проблем:
1. Проверьте логи Django и Celery
2. Убедитесь в корректности конфигурации переменных окружения
3. Проверьте статус всех сервисов в Docker Compose
