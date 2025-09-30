#!/bin/sh
set -e

if [ -n "$DB_HOST" ] && [ -n "$DB_PORT" ]; then
  echo "Waiting for MySQL at $DB_HOST:$DB_PORT..."
  for i in $(seq 1 60); do
    nc -z "$DB_HOST" "$DB_PORT" && break
    sleep 1
  done
fi

cd /app/arb

if [ "$SKIP_MIGRATIONS" != "1" ]; then
  echo "Running migrations..."
  python manage.py migrate --noinput
else
  echo "Skipping migrations (SKIP_MIGRATIONS=$SKIP_MIGRATIONS)"
fi

exec "$@"


