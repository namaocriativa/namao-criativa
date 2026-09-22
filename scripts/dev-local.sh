#!/usr/bin/env bash
# Sobe Postgres, Redis, landing-kit, API, studio e website na máquina.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

POSTGRES_PORT="${POSTGRES_PORT:-5433}"
REDIS_PORT="${REDIS_PORT:-6379}"
PLATFORM_PORT="${PLATFORM_PORT:-4000}"

LOCAL_DIR="$ROOT/.local"
PGDATA="$LOCAL_DIR/pgdata"
PG_RUN="$LOCAL_DIR/pg-run"
REDIS_DIR="$LOCAL_DIR/redis"
LOG_DIR="$LOCAL_DIR/log"

STARTED_PG=0
STARTED_REDIS=0
PG_PID=""
REDIS_PID=""
CONCURRENTLY_PID=""

die() {
  echo "dev-local: $*" >&2
  exit 1
}

find_bin() {
  local name="$1"
  shift
  if command -v "$name" >/dev/null 2>&1; then
    command -v "$name"
    return 0
  fi
  local formula prefix
  for formula in "$@"; do
    if command -v brew >/dev/null 2>&1; then
      prefix="$(brew --prefix "$formula" 2>/dev/null || true)"
      if [[ -n "$prefix" && -x "$prefix/bin/$name" ]]; then
        echo "$prefix/bin/$name"
        return 0
      fi
    fi
  done
  local extra
  for extra in \
    "/opt/homebrew/opt/postgresql@16/bin/$name" \
    "/usr/local/opt/postgresql@16/bin/$name" \
    "/opt/homebrew/opt/redis/bin/$name" \
    "/usr/local/opt/redis/bin/$name"; do
    if [[ -x "$extra" ]]; then
      echo "$extra"
      return 0
    fi
  done
  return 1
}

pg_ready() {
  "$PG_ISREADY" -h 127.0.0.1 -p "$POSTGRES_PORT" >/dev/null 2>&1
}

redis_ready() {
  [[ "$("$REDIS_CLI" -h 127.0.0.1 -p "$REDIS_PORT" ping 2>/dev/null || true)" == "PONG" ]]
}

wait_for() {
  local name="$1"
  local fn="$2"
  local i
  for i in $(seq 1 50); do
    if "$fn"; then
      return 0
    fi
    sleep 0.2
  done
  die "$name não ficou pronto a tempo"
}

cleanup() {
  local code=$?
  trap - EXIT INT TERM
  if [[ -n "$CONCURRENTLY_PID" ]]; then
    kill "$CONCURRENTLY_PID" 2>/dev/null || true
    wait "$CONCURRENTLY_PID" 2>/dev/null || true
  fi
  if [[ "$STARTED_REDIS" == 1 && -n "$REDIS_PID" ]]; then
    kill "$REDIS_PID" 2>/dev/null || true
    wait "$REDIS_PID" 2>/dev/null || true
  fi
  if [[ "$STARTED_PG" == 1 && -n "$PG_PID" ]]; then
    kill "$PG_PID" 2>/dev/null || true
    wait "$PG_PID" 2>/dev/null || true
  fi
  exit "$code"
}

trap cleanup EXIT INT TERM

command -v node >/dev/null 2>&1 || die "node não encontrado"
command -v npm >/dev/null 2>&1 || die "npm não encontrado"
[[ -d "$ROOT/node_modules" ]] || die "rode npm install na raiz do repo"

INITDB="$(find_bin initdb postgresql@16 postgresql@17 postgresql@15 postgresql)" || true
POSTGRES="$(find_bin postgres postgresql@16 postgresql@17 postgresql@15 postgresql)" || true
PG_ISREADY="$(find_bin pg_isready postgresql@16 postgresql@17 postgresql@15 postgresql)" || true
REDIS_SERVER="$(find_bin redis-server redis)" || true
REDIS_CLI="$(find_bin redis-cli redis)" || true

if [[ -z "$INITDB" || -z "$POSTGRES" || -z "$PG_ISREADY" || -z "$REDIS_SERVER" || -z "$REDIS_CLI" ]]; then
  die "Postgres 16 e Redis são obrigatórios. Instale com: brew install postgresql@16 redis"
fi

mkdir -p "$PG_RUN" "$REDIS_DIR" "$LOG_DIR"

if [[ ! -f "$ROOT/services/platform/.env" ]]; then
  cp "$ROOT/services/platform/.env.example" "$ROOT/services/platform/.env"
  echo "dev-local: criou services/platform/.env a partir do example"
fi

if pg_ready; then
  echo "dev-local: reusando Postgres em 127.0.0.1:${POSTGRES_PORT}"
else
  if [[ ! -f "$PGDATA/PG_VERSION" ]]; then
    echo "dev-local: iniciando cluster Postgres em .local/pgdata (porta ${POSTGRES_PORT})"
    "$INITDB" \
      -D "$PGDATA" \
      --auth-local=trust \
      --auth-host=trust \
      --username=namao \
      --encoding=UTF8 \
      --locale=en_US.UTF-8 \
      >/dev/null
  fi
  "$POSTGRES" \
    -D "$PGDATA" \
    -p "$POSTGRES_PORT" \
    -k "$PG_RUN" \
    -c listen_addresses=127.0.0.1 \
    >>"$LOG_DIR/postgres.log" 2>&1 &
  PG_PID=$!
  STARTED_PG=1
  wait_for "Postgres" pg_ready
  echo "dev-local: Postgres pronto em 127.0.0.1:${POSTGRES_PORT} (pid ${PG_PID})"
fi

if redis_ready; then
  echo "dev-local: reusando Redis em 127.0.0.1:${REDIS_PORT}"
else
  echo "dev-local: subindo Redis em 127.0.0.1:${REDIS_PORT}"
  "$REDIS_SERVER" \
    --port "$REDIS_PORT" \
    --bind 127.0.0.1 \
    --dir "$REDIS_DIR" \
    --save "" \
    --appendonly no \
    --protected-mode yes \
    --daemonize no \
    >>"$LOG_DIR/redis.log" 2>&1 &
  REDIS_PID=$!
  STARTED_REDIS=1
  wait_for "Redis" redis_ready
  echo "dev-local: Redis pronto em 127.0.0.1:${REDIS_PORT} (pid ${REDIS_PID})"
fi

export NODE_ENV=development
export PORT="$PLATFORM_PORT"
export PLATFORM_PORT
export DATABASE_URL="postgresql://namao:namao@127.0.0.1:${POSTGRES_PORT}/namao"
export REDIS_URL="redis://127.0.0.1:${REDIS_PORT}"
export EVOLUTION_MOCK=1
export PUBLIC_CHAT_API_ORIGIN="http://localhost:${PLATFORM_PORT}"

echo "dev-local: prisma migrate deploy"
npx prisma migrate deploy --schema=services/platform/prisma/schema.prisma
npx prisma generate --schema=services/platform/prisma/schema.prisma

echo "dev-local: build inicial do landing-kit"
npm run build -w @namao/landing-kit

echo
echo "dev-local: API      http://localhost:${PLATFORM_PORT}"
echo "dev-local: Studio   http://localhost:5173"
echo "dev-local: Website  http://localhost:5174"
echo "dev-local: logs     [kit] [platform] [studio] [website] (Postgres/Redis em .local/log/)"
echo "dev-local: Evolution mock (EVOLUTION_MOCK=1). Ctrl+C encerra os processos deste script."
echo

npx concurrently \
  --kill-others-on-fail \
  -n kit,platform,studio,website \
  -c cyan,blue,green,magenta \
  "npm run watch -w @namao/landing-kit" \
  "npm run start:dev -w @namao/platform" \
  "npm run dev -w @namao/studio" \
  "npm run dev -w @namao/website" &
CONCURRENTLY_PID=$!
wait "$CONCURRENTLY_PID"
