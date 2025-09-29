python3 -m venv .venv
source .venv/bin/activate
pip install poetry

poetry install

arb/manage.py runserver


TESTS
./test.py


## Документация (Doxygen)

Сгенерировать HTML-документацию кода (на русском):

1. Установите doxygen на систему.
   - macOS: `brew install doxygen`
   - Ubuntu/Debian: `sudo apt-get install doxygen`
2. Из корня проекта выполните:
   - `doxygen Doxyfile`
3. Откройте `docs/html/index.html` в браузере.

Конфигурация находится в `Doxyfile`. Источники документации: каталог `arb/arb`.