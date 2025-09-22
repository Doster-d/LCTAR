# Frontend ЛЦТ 7 задача К1

## Назначение

Фронтенд на Vite + React с 3D/AR сценой на React Three Fiber и WebXR. Точка входа `src/main.jsx`, корневой компонент `App` → `ARScene`. Скрипты и зависимости описаны в `package.json`.

## Требования

* Node.js ≥ 18.18 (рекомендовано LTS 20+ для ESLint 9 и Vite 7).
* Управление Node через `fnm`.

Сервер разработки слушает порт `3000`, включён CORS и `allowedHosts` для `*.tuna.am` (см. `vite.config.js`).

## Быстрый старт (fnm)

```bash
# установить и выбрать LTS
fnm use --install-if-missing v20.19.5

# установить зависимости
npm i

# запустить dev-сервер
npm run dev
```

Откройте `http://localhost:3000/`.

## Скрипты

* `npm run dev` — запуск Vite dev-сервера. Скрипты определены в `package.json`.
* `npm run build` — прод-сборка в `dist/`.
* `npm run preview` — локальный предпросмотр собранного.
* `npm run lint` — проверка ESLint (конфигурация в `eslint.config.js`).

## Структура

Ключевые файлы:

* `src/ARScene.jsx` — холст `@react-three/fiber`, обёртка `@react-three/xr`, свет, окружение, кнопка входа в AR.
* `src/components/Model.jsx` — загрузка GLTF, клонирование скелета, переключение видимости оружия. Ищет `/testmodel.glb`.
* `vite.config.js` — плагины и сервер (порт 3000, CORS, allowedHosts).

Полный список директорий показан в сводном файле репозитория.

## 3D-модель

Компонент `Model` загружает модель по пути `/testmodel.glb`.

## WebXR / AR

`ARScene` проверяет поддержку `immersive-ar` через `navigator.xr.isSessionSupported`.

Кнопка **Enter AR** появляется только при поддержке.

Для работы AR требуется браузер с WebXR и защищённый контекст (https).

## Линтинг

ESLint 9 с правилами для React Hooks и React Refresh. Запуск: `npm run lint`. Конфиг в `eslint.config.js`.

## Сборка и предпросмотр

```bash
npm run build
npm run preview
```

Vite соберёт статику в `dist/`. Предпросмотр поднимет локальный сервер. Скрипты определены в `package.json`.

## Настройки dev-сервера

Порт: `3000`. Разрешены хосты `*.ru.tuna.am`, `*.tuna.am`. CORS открыт (`origin: '*'`). Менять при необходимости в `vite.config.js`.

## Деплой

Сборка — статическая. Подходит любой статический хостинг или CDN. Для AR используйте HTTPS.

## Известные моменты

* Без `public/testmodel.glb` сцена загрузится без модели.
* AR доступен только в поддерживаемых браузерах WebXR. Локально тестируйте на устройстве с поддержкой.
