name: Backend tests (arb)

on:
  push:
    paths:
      - "arb/**"
      - ".github/workflows/backend-tests.yml"
  pull_request:
    paths:
      - "arb/**"

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      # Если есть pyproject.toml — ставим через Poetry и ДОустанавливаем celery
      - name: Install deps via Poetry (if present)
        if: hashFiles('pyproject.toml') != ''
        run: |
          python -m pip install --upgrade pip
          pip install poetry
          poetry config virtualenvs.create false
          poetry install --no-interaction --no-root
          pip install celery

      # Если Poetry нет — ставим из requirements и ДОустанавливаем celery
      - name: Install deps via requirements
        if: hashFiles('pyproject.toml') == ''
        run: |
          python -m pip install --upgrade pip
          if [ -f arb/requirements.txt ]; then
            pip install -r arb/requirements.txt
          elif [ -f requirements.txt ]; then
            pip install -r requirements.txt
          else
            pip install django djangorestframework
          fi
          pip install celery

      - name: Prepare .env (optional)
        run: |
          cp -f .env.example .env 2>/dev/null || true
          echo "DJANGO_SECRET_KEY=test_ci_secret" >> .env
          echo "DEBUG=1" >> .env

      # Запускаем ровно файл arb/arb/tests.py (dotted-path: arb.tests)
      - name: Run tests (arb/arb/tests.py)
        working-directory: arb
        env:
          DJANGO_SETTINGS_MODULE: arb.settings
          # чтобы Celery не пытался коннектиться к брокеру
          CELERY_BROKER_URL: "memory://"
          CELERY_RESULT_BACKEND: "cache+memory://"
          # форсим SQLite для CI
          DJANGO_DB_ENGINE: sqlite3
          DJANGO_DB_NAME: ":memory:"
          # помогаем Python найти пакет arb при импортах
          PYTHONPATH: ${{ github.workspace }}/arb
        run: |
          python manage.py test arb.tests --verbosity=2
