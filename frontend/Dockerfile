# Build stage
FROM node:24 AS build

# Установка рабочей директории
WORKDIR /app

# Копирование package.json и package-lock.json
COPY package*.json ./

# Установка зависимостей
RUN npm ci --omit=dev

# Исправляем проблему с нативными зависимостями rollup
RUN rm -rf node_modules/@rollup
RUN npm install

# Копирование исходного кода
COPY . .

# Поддержка переменной окружения VITE_API_URL
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Сборка приложения
RUN npm run build

# Production stage
FROM nginx:1

# Копирование собранных файлов в nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Копирование конфигурации nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Expose порт 80
EXPOSE 80

# Запуск nginx
CMD ["nginx", "-g", "daemon off;"]