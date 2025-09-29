FROM python:3.13-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    default-libmysqlclient-dev \
    pkg-config \
    libmariadb-dev \
    libmariadb3 \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml poetry.lock ./

RUN pip install poetry && \
    poetry config virtualenvs.create false && \
    poetry install --only=main --no-root

COPY arb/ ./arb/

EXPOSE 8000

CMD ["python", "arb/manage.py", "runserver", "0.0.0.0:8000"]
