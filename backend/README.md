# LCT AR Backend

Initial scaffold. Implemented:
- Auth (register, login, me)
- Video upload with score + first upload bonus
- Client logs (submit + list admin placeholder — list requires admin user manual flag currently)
- Inference stub (disabled by default) with i18n support (en/ru)
- Gamification service

## Development

```bash
# Build and start
docker compose up --build

# Exec into container (example)
docker compose exec backend bash

# Run tests
pytest -q
```
