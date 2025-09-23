# syntax=docker/dockerfile:1.6

########################
# 0) Python base + deps
########################
FROM python:3.11-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates build-essential && \
    rm -rf /var/lib/apt/lists/*
# uv для быстрого pip/локов
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:$PATH"

# Кэшируем зависимости проекта
COPY pyproject.toml README.md ./
COPY app/__init__.py ./app/__init__.py
RUN uv pip install --system -e .

########################
# 1) Сборка FFmpeg + TF C
########################
FROM debian:bookworm-slim AS ffmpeg_build
ARG FFMPEG_TAG=n7.1
# CPU по умолчанию. Для GPU можно передать --build-arg TF_VARIANT=gpu и TF_VERSION, 
# но тогда запускайте контейнер с NVIDIA runtime и драйвером на хосте.
ARG TF_VARIANT=cpu
ARG TF_VERSION=2.18.1

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      git curl ca-certificates xz-utils \
      build-essential pkg-config yasm nasm \
      libx264-dev zlib1g-dev && \
    rm -rf /var/lib/apt/lists/*

# nv-codec-headers are required to build FFmpeg with NVENC support.
# The runtime NVENC library (libnvidia-encode.so) comes from the host NVIDIA driver
# and must be present at runtime (nvidia-container-toolkit / host drivers).
RUN set -eux; \
        git clone --depth 1 https://github.com/FFmpeg/nv-codec-headers.git /tmp/nv-codec-headers; \
        cd /tmp/nv-codec-headers; \
        make install PREFIX=/usr/local; \
        rm -rf /tmp/nv-codec-headers

# Устанавливаем TensorFlow C API (libtensorflow*.so + headers)
# Офиц. инструкции: https://www.tensorflow.org/install/lang_c
RUN set -eux; \
    case "$TF_VARIANT" in cpu|gpu) ;; *) echo "TF_VARIANT must be cpu|gpu"; exit 2;; esac; \
    TF_URL="https://storage.googleapis.com/tensorflow/versions/${TF_VERSION}/libtensorflow-${TF_VARIANT}-linux-x86_64.tar.gz"; \
    echo "Downloading $TF_URL"; \
    curl -L "$TF_URL" -o /tmp/libtf.tgz; \
    tar -C /usr/local -xzf /tmp/libtf.tgz; \
    ldconfig

# Сборка FFmpeg с libtensorflow + x264
RUN git clone --depth 1 --branch "$FFMPEG_TAG" https://github.com/FFmpeg/FFmpeg.git /ffmpeg
WORKDIR /ffmpeg
RUN ./configure \
      --prefix=/opt/ffmpeg \
      --disable-debug --disable-doc \
      --enable-pthreads \
        --enable-gpl --enable-libx264 \
        --enable-nonfree --enable-nvenc \
      --enable-libtensorflow \
      --extra-cflags="-I/usr/local/include" \
      --extra-ldflags="-L/usr/local/lib" \
    && make -j"$(nproc)" \
    && make install

########################
# 2) Модели (SRCNN/ESPCN)
########################
# Берём готовые .pb из публичного образа с SR моделями
FROM miratmu/ffmpeg-tensorflow:latest AS models

########################
# 3) Runtime образ
########################
FROM python:3.11-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libx264-164 && \
    rm -rf /var/lib/apt/lists/*

# FFmpeg + библиотеки
COPY --from=ffmpeg_build /opt/ffmpeg /opt/ffmpeg
ENV PATH="/opt/ffmpeg/bin:${PATH}"
ENV LD_LIBRARY_PATH="/opt/ffmpeg/lib:/usr/local/lib:/usr/lib/x86_64-linux-gnu:${LD_LIBRARY_PATH}"

# TensorFlow C runtime (нужен для dnn_backend=tensorflow)
COPY --from=ffmpeg_build /usr/local/lib/libtensorflow*.so* /usr/local/lib/
RUN ldconfig || true

# Модели SR: кладём SRCNN и ESPCN (на всякий случай)
RUN mkdir -p /models
COPY --from=models /models/srcnn.pb /models/srcnn.pb
COPY --from=models /models/espcn.pb /models/espcn.pb

# Python зависимости проекта
COPY --from=base /usr/local/lib/python3.11 /usr/local/lib/python3.11
COPY --from=base /usr/local/bin /usr/local/bin
COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
