#!/usr/bin/env bash
# IKAS — One-Command Fresh Setup
#
# Designed for a colleague who just cloned the repo. Idempotent: safe to re-run.
#
# What it does (in order):
#   1. Prereq check (docker, docker compose, node, npm)
#   2. .env setup — copies .env.example, prompts for ANTHROPIC_API_KEY if missing
#   3. Fresh start — docker compose down -v + up -d (wipes old volumes)
#   4. Waits for all services to be healthy
#   5. Verifies the auto-seed (37 users, 100+ findings, 200+ graph nodes)
#   6. Starts the frontend in the background (logs/frontend.log)
#   7. Prints a summary banner with all URLs
#
# Usage:
#   ./scripts/setup-fresh.sh           # interactive (prompts for API key if missing)
#   ANTHROPIC_API_KEY=sk-ant-... ./scripts/setup-fresh.sh   # non-interactive
#
# To stop everything: ./scripts/stop-fresh.sh

set -euo pipefail

# ── Cosmetics ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker/docker-compose.dev.yml"
ENV_FILE="$PROJECT_ROOT/.env"
ENV_EXAMPLE="$PROJECT_ROOT/.env.example"
LOG_DIR="$PROJECT_ROOT/logs"
FRONTEND_LOG="$LOG_DIR/frontend.log"
FRONTEND_PID_FILE="$PROJECT_ROOT/.frontend.pid"

step() { echo -e "\n${BLUE}${BOLD}▶ $1${NC}"; }
ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
err()  { echo -e "  ${RED}✗${NC} $1"; }
die()  { err "$1"; exit 1; }

echo -e "${BOLD}${BLUE}🚀 IKAS Fresh Setup${NC}"
echo    "   Project: $PROJECT_ROOT"

# ── Phase 1: Prereq check ─────────────────────────────────────────────────────
step "Phase 1/6: Voraussetzungen prüfen"

command -v docker >/dev/null 2>&1 || die "Docker fehlt. Installation: https://docs.docker.com/get-docker/"
ok "docker: $(docker --version | head -1)"

docker compose version >/dev/null 2>&1 || die "Docker Compose v2 fehlt (docker compose, nicht docker-compose)."
ok "docker compose: $(docker compose version --short)"

docker info >/dev/null 2>&1 || die "Docker-Daemon läuft nicht. Starte Docker Desktop / dockerd."
ok "Docker-Daemon läuft"

command -v node >/dev/null 2>&1 || die "Node fehlt. Brauche v18+. Empfehlung: nvm install --lts"
NODE_MAJOR=$(node --version | sed 's/v//' | cut -d. -f1)
[ "$NODE_MAJOR" -ge 18 ] || die "Node $NODE_MAJOR ist zu alt. Brauche v18+ für Next.js 15."
ok "node: $(node --version)"

command -v npm >/dev/null 2>&1 || die "npm fehlt."
ok "npm: $(npm --version)"

# Optional but useful for verification
command -v curl >/dev/null 2>&1 || die "curl fehlt — für Health-Checks nötig."
HAVE_JQ=0
if command -v jq >/dev/null 2>&1; then HAVE_JQ=1; fi

# ── Phase 2: .env setup ───────────────────────────────────────────────────────
step "Phase 2/6: .env-Konfiguration"

if [ ! -f "$ENV_FILE" ]; then
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  ok ".env aus .env.example erstellt"
else
  ok ".env existiert bereits"
fi

# Helper: get value of KEY from .env (handles spaces/quotes)
get_env() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e 's/^ *//' -e 's/ *$//'
}

# Helper: set KEY=VALUE in .env (idempotent — replaces or appends). macOS+Linux compatible.
set_env() {
  local key="$1"
  local value="$2"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    # Use a different sed delimiter to handle values with slashes/special chars.
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    rm -f "$ENV_FILE.bak"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

# Resolve API key: CLI env var wins, then .env, then prompt
ANTHROPIC_KEY="${ANTHROPIC_API_KEY:-}"
if [ -z "$ANTHROPIC_KEY" ]; then
  ANTHROPIC_KEY="$(get_env ANTHROPIC_API_KEY)"
fi

if [ -z "$ANTHROPIC_KEY" ] || [[ "$ANTHROPIC_KEY" == "your-"* ]]; then
  echo
  echo -e "  ${YELLOW}ANTHROPIC_API_KEY fehlt.${NC}"
  echo    "  Hol dir einen unter: https://console.anthropic.com/settings/keys"
  echo    "  Format: sk-ant-..."
  if [ -t 0 ]; then
    read -r -p "  Eingabe (oder Enter für später): " ANTHROPIC_KEY
  fi
  if [ -z "$ANTHROPIC_KEY" ]; then
    warn "Kein Key gesetzt. Setup läuft weiter, aber Chat/AI-Features funktionieren nicht."
    warn "Trage den Key später in .env ein und starte die Container neu."
  else
    set_env ANTHROPIC_API_KEY "$ANTHROPIC_KEY"
    ok "ANTHROPIC_API_KEY in .env gespeichert"
  fi
else
  ok "ANTHROPIC_API_KEY ist gesetzt"
fi

# Port-Konflikt-Check — frühzeitig abbrechen statt schrägem Failure später
PORTS_IN_USE=()
for port in 3001 3002 5433 7474 7687 8001 8002 8005 8080; do
  if lsof -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1; then
    PORTS_IN_USE+=("$port")
  fi
done
if [ ${#PORTS_IN_USE[@]} -gt 0 ]; then
  warn "Ports belegt: ${PORTS_IN_USE[*]}"
  warn "Mögliche Konflikte. Stop alte IKAS-Container? (docker compose down)"
  if [ -t 0 ]; then
    read -r -p "  ./scripts/stop-fresh.sh ausführen und fortfahren? [y/N] " yn
    if [[ "$yn" =~ ^[Yy]$ ]]; then
      "$PROJECT_ROOT/scripts/stop-fresh.sh" || true
    else
      die "Bitte Ports freimachen und nochmal starten."
    fi
  else
    warn "Nicht-interaktiv — fahre fort, mag aber failen."
  fi
fi

# ── Phase 3: Fresh start ──────────────────────────────────────────────────────
step "Phase 3/6: Frischer Container-Start (down -v + up -d)"

mkdir -p "$LOG_DIR"

# Stop+wipe old state. down -v ist der Kern-Unterschied zu start-dev.sh.
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down -v --remove-orphans >/dev/null 2>&1 || true
ok "Alte Volumes weggeräumt"

echo -n "  Container hochfahren"
if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d >/dev/null 2>&1; then
  echo -e " ${GREEN}✓${NC}"
else
  err "docker compose up fehlgeschlagen. Logs:"
  docker compose -f "$COMPOSE_FILE" logs --tail 30
  exit 1
fi

# ── Phase 4: Wait + verify ────────────────────────────────────────────────────
step "Phase 4/6: Auf Services warten"

# Generic wait-loop for HTTP health endpoints
wait_http() {
  local name="$1"
  local url="$2"
  local timeout="${3:-120}"
  local start=$(date +%s)
  echo -n "  $name "
  while true; do
    if curl -sf -o /dev/null --max-time 3 "$url"; then
      echo -e "${GREEN}✓${NC}"
      return 0
    fi
    local elapsed=$(($(date +%s) - start))
    if [ "$elapsed" -ge "$timeout" ]; then
      echo -e "${RED}✗ Timeout (${timeout}s)${NC}"
      warn "Letzte Logs:"
      local container="ikas-${name}"
      docker logs "$container" --tail 30 2>&1 | sed 's/^/    /' || true
      return 1
    fi
    sleep 2
    echo -n "."
  done
}

# Keycloak Master-Realm config endpoint (does not require auth, comes up after import-realm)
wait_http "keycloak"        "http://localhost:8080/realms/master/.well-known/openid-configuration" 180 || true
wait_http "neo4j"            "http://localhost:7474/" 60 || true
wait_http "ai-gateway"       "http://localhost:8005/health" 120 || true
wait_http "keycloak-mcp"     "http://localhost:8001/health" 60 || true
wait_http "neo4j-mcp"        "http://localhost:8002/health" 60 || true
wait_http "websocket-server" "http://localhost:3001/health" 60 || true

step "Phase 5/6: Seed-Verifikation"

# Give the seeder a moment more in case it lazy-runs after /health succeeds
sleep 3

USERS_JSON=$(curl -sf --max-time 5 http://localhost:8005/api/users || echo '{}')
if [ "$HAVE_JQ" = "1" ]; then
  USER_COUNT=$(echo "$USERS_JSON" | jq -r '.counts.total // 0')
else
  # Naive grep fallback
  USER_COUNT=$(echo "$USERS_JSON" | grep -oE '"total":[0-9]+' | head -1 | cut -d: -f2)
  USER_COUNT="${USER_COUNT:-0}"
fi
if [ "$USER_COUNT" -ge 30 ] 2>/dev/null; then
  ok "Keycloak-User: $USER_COUNT (erwartet 37)"
else
  warn "Nur $USER_COUNT User — Realm-Import noch nicht fertig? Probiere: docker logs ikas-keycloak --tail 50"
fi

FINDINGS_JSON=$(curl -sf --max-time 5 http://localhost:8005/api/security/findings || echo '{}')
if [ "$HAVE_JQ" = "1" ]; then
  FINDING_COUNT=$(echo "$FINDINGS_JSON" | jq -r '.total // 0')
else
  FINDING_COUNT=$(echo "$FINDINGS_JSON" | grep -oE '"total":[0-9]+' | head -1 | cut -d: -f2)
  FINDING_COUNT="${FINDING_COUNT:-0}"
fi
if [ "$FINDING_COUNT" -ge 50 ] 2>/dev/null; then
  ok "Security-Findings: $FINDING_COUNT (erwartet >100)"
elif [ "$FINDING_COUNT" -gt 0 ]; then
  warn "Findings vorhanden ($FINDING_COUNT) — eventuell läuft ein Scan noch. Im Frontend nochmal scannen."
else
  warn "Keine Findings — initialer Scan läuft eventuell noch. Im Frontend 'Vollständigen Scan starten' klicken."
fi

# ── Phase 6: Frontend ─────────────────────────────────────────────────────────
step "Phase 6/6: Frontend starten"

cd "$PROJECT_ROOT/frontend"

# Skip npm install if node_modules looks fresh enough
NEED_INSTALL=1
if [ -d node_modules ] && [ -f package-lock.json ] && [ -f node_modules/.package-lock.json ]; then
  if cmp -s package-lock.json node_modules/.package-lock.json 2>/dev/null; then
    NEED_INSTALL=0
  fi
fi
if [ "$NEED_INSTALL" = "1" ]; then
  echo "  npm install läuft (kann ~1-2 min dauern)..."
  npm install --silent --no-audit --no-fund 2>&1 | tail -5
  ok "Dependencies installiert"
else
  ok "node_modules ist aktuell — npm install übersprungen"
fi

# Stop a stale frontend if PID file exists
if [ -f "$FRONTEND_PID_FILE" ]; then
  OLD_PID=$(cat "$FRONTEND_PID_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    kill "$OLD_PID" 2>/dev/null || true
    sleep 1
  fi
  rm -f "$FRONTEND_PID_FILE"
fi

mkdir -p "$LOG_DIR"
: > "$FRONTEND_LOG"
PORT=3002 nohup npm run dev >"$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!
echo "$FRONTEND_PID" > "$FRONTEND_PID_FILE"
ok "Frontend gestartet (PID $FRONTEND_PID, Log: $FRONTEND_LOG)"

# Wait for frontend
echo -n "  Frontend bereit "
for i in $(seq 1 60); do
  if curl -sf -o /dev/null --max-time 2 http://localhost:3002; then
    echo -e "${GREEN}✓${NC}"
    break
  fi
  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo -e "${RED}✗ Frontend-Prozess gestorben${NC}"
    warn "Letzte Log-Zeilen:"
    tail -20 "$FRONTEND_LOG" | sed 's/^/    /'
    break
  fi
  sleep 1
  echo -n "."
done

# ── Summary banner ────────────────────────────────────────────────────────────
echo
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ✅ IKAS ist bereit${NC}"
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════════════════${NC}"
cat <<EOF

  ${BOLD}Frontend${NC}      http://localhost:3002
  ${BOLD}AI-Gateway${NC}    http://localhost:8005/health
  ${BOLD}Keycloak${NC}      http://localhost:8080         (admin / admin)
  ${BOLD}Neo4j${NC}         http://localhost:7474         (neo4j / password)
  ${BOLD}WebSocket${NC}     http://localhost:3001/health

  ${BOLD}Demo-Daten${NC}
  ─ 37 User in 3 Realms (corporate, customers, partners)
  ─ Passwort für alle Test-User: ${BOLD}Pass1234${NC}
  ─ Admin in corporate: ${BOLD}admin2 / Admin234${NC}
  ─ ~100 Security-Findings über Config/Fraud/OWASP/Compliance/Privilege

  ${BOLD}Logs${NC}
  ─ Frontend:    tail -f $FRONTEND_LOG
  ─ AI-Gateway:  docker logs -f ikas-ai-gateway
  ─ Keycloak:    docker logs -f ikas-keycloak

  ${BOLD}Stoppen${NC}
  ─ ./scripts/stop-fresh.sh

  ${BOLD}Demo zurücksetzen während Session${NC}
  ─ Im Frontend → Fixes-Tab → "↺ Demo zurücksetzen"

EOF
