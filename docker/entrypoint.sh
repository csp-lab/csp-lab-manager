#!/bin/sh
# Rewrite Compose hostnames, apply migrations, seed the superadmin, then start the server.
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set." >&2
  exit 1
fi

secret="${BETTER_AUTH_SECRET:-}"
password="${SEED_ADMIN_PASSWORD:-}"
username=$(printf '%s' "${SEED_ADMIN_USERNAME:-}" | tr '[:upper:]' '[:lower:]')

if [ "${#secret}" -lt 32 ]; then
  echo "Set BETTER_AUTH_SECRET to at least 32 characters." >&2
  exit 1
fi

if [ "${#password}" -lt 8 ]; then
  echo "Set SEED_ADMIN_PASSWORD to at least 8 characters." >&2
  exit 1
fi

if ! printf '%s' "$username" | grep -Eq '^[a-z0-9_]{3,20}$'; then
  echo "Set SEED_ADMIN_USERNAME to 3-20 letters, numbers, or underscores." >&2
  exit 1
fi
export SEED_ADMIN_USERNAME="$username"

case "$DATABASE_URL" in
  *@localhost:*)
    DATABASE_URL=$(printf '%s' "$DATABASE_URL" | sed 's/@localhost:/@postgres:/')
    export DATABASE_URL
    ;;
esac

if [ -n "${REDIS_URL:-}" ]; then
  case "$REDIS_URL" in
    *@localhost:*|*://localhost:*)
      REDIS_URL=$(printf '%s' "$REDIS_URL" | sed 's/@localhost:/@valkey:/; s#://localhost:#://valkey:#')
      export REDIS_URL
      ;;
  esac
fi

/opt/prisma-cli/node_modules/.bin/prisma migrate deploy --schema=/app/prisma/schema.prisma
node /app/seed.mjs
exec node /app/server.js
