#!/usr/bin/env bash
# init-f0.sh — one-click bootstrap for From Zero (F0) local dev
set -euo pipefail

### ── config ─────────────────────────────────────────────────────────────
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORCH_DIR="$ROOT_DIR/orchestrator"
LOG_DIR="$ROOT_DIR/logs"
WEB_PORT_DEFAULT="3000"
ORCH_PORT="8080"
ORCH_URL="http://localhost:${ORCH_PORT}"

### ── helpers ────────────────────────────────────────────────────────────
say() { printf "\033[1;36m%s\033[0m\n" "$*"; }
ok()  { printf "\033[1;32m✔ %s\033[0m\n" "$*"; }
warn(){ printf "\033[1;33m⚠ %s\033[0m\n" "$*"; }
err() { printf "\033[1;31m✖ %s\033[0m\n" "$*" >&2; }

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "Required command not found: $1"
    exit 1
  fi
}

kill_port() {
  local PORT="$1"
  local PIDS
  PIDS=$(lsof -i :"$PORT" -nP 2>/dev/null | awk 'NR>1 {print $2}' | sort -u || true)
  if [[ -n "${PIDS:-}" ]]; then
    warn "Killing processes on port $PORT: $PIDS"
    kill -9 $PIDS || true
    sleep 0.4
  fi
}

ensure_env_kv() {
  local FILE="$1" KEY="$2" VALUE="$3"
  if grep -qE "^${KEY}=" "$FILE" 2>/dev/null; then
    # keep existing
    :
  else
    echo "${KEY}=${VALUE}" >> "$FILE"
    ok "Added ${KEY} to $(basename "$FILE")"
  fi
}

### ── preflight ──────────────────────────────────────────────────────────
say "Preflight checks…"
need node
need pnpm
need git
need curl
[[ -d "$ORCH_DIR" ]] || { err "Missing directory: $ORCH_DIR"; exit 1; }
mkdir -p "$LOG_DIR"

# Optional: firebase CLI presence (not mandatory to run)
if command -v firebase >/dev/null 2>&1; then
  ok "firebase cli detected"
else
  warn "firebase cli not found (optional for this script)"
fi

### ── env prep ───────────────────────────────────────────────────────────
ENV_FILE="$ROOT_DIR/.env.local"
if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$ROOT_DIR/.env.local.example" ]]; then
    cp "$ROOT_DIR/.env.local.example" "$ENV_FILE"
    ok "Created .env.local from example"
  else
    touch "$ENV_FILE"
    ok "Created empty .env.local"
  fi
fi

ensure_env_kv "$ENV_FILE" "NEXT_PUBLIC_ORCHESTRATOR_URL" "$ORCH_URL"
ensure_env_kv "$ENV_FILE" "PORT" "$WEB_PORT_DEFAULT"

### ── free ports ─────────────────────────────────────────────────────────
say "Freeing required ports…"
kill_port "$ORCH_PORT"
kill_port "$WEB_PORT_DEFAULT"

### ── start orchestrator ─────────────────────────────────────────────────
say "Starting Orchestrator on :${ORCH_PORT}…"
GIT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
(
  cd "$ORCH_DIR"
  # Ensure tsx exists via pnpm if needed
  if ! command -v tsx >/dev/null 2>&1; then
    pnpm add -D tsx >/dev/null 2>&1 || true
  fi
  # Run and log
  GIT_COMMIT="$GIT_COMMIT" PORT="$ORCH_PORT" \
    pnpm start > "$LOG_DIR/orchestrator.log" 2>&1 &
  echo $! > "$LOG_DIR/orchestrator.pid"
)
ORCH_PID=$(cat "$LOG_DIR/orchestrator.pid" 2>/dev/null || echo "unknown")
ok "Orchestrator PID: $ORCH_PID"

### ── wait for health ────────────────────────────────────────────────────
say "Waiting for orchestrator health…"
for i in {1..30}; do
  if curl -fsS "$ORCH_URL/health" >/dev/null 2>&1; then
    ok "Orchestrator healthy at $ORCH_URL"
    break
  fi
  sleep 0.4
done

### ── start web (Next.js) ────────────────────────────────────────────────
say "Starting Web (Next.js)…"
(
  cd "$ROOT_DIR"
  pnpm dev > "$LOG_DIR/web.log" 2>&1 &
  echo $! > "$LOG_DIR/web.pid"
)
WEB_PID=$(cat "$LOG_DIR/web.pid" 2>/dev/null || echo "unknown")
ok "Web PID: $WEB_PID"

### ── open browser tabs (macOS) ─────────────────────────────────────────
if command -v open >/dev/null 2>&1; then
  open "$ORCH_URL/health" || true
  # Try the desired 3000 first; Next might bump to 3001/3002 automatically.
  open "http://localhost:${WEB_PORT_DEFAULT}" || true
fi

### ── summary ────────────────────────────────────────────────────────────
say "All set! Summary:"
echo "  Orchestrator:  $ORCH_URL    (logs: $LOG_DIR/orchestrator.log)"
echo "  Web (Next.js): http://localhost:${WEB_PORT_DEFAULT}  (may auto-bump if busy)"
echo
ok "Tip: If the web auto-switched to 3001/3002, just use the shown URL in the terminal."
ok "To stop quickly: pkill -f 'next dev'; pkill -f 'tsx src/index.ts'"

exit 0
