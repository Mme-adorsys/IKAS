#!/usr/bin/env bash
# IKAS — Stop everything started by setup-fresh.sh
#
# Stops the frontend (if running), then brings down all compose services.
# Volumes are kept by default so the next setup-fresh.sh can be quick — pass
# --wipe to delete them too.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker/docker-compose.dev.yml"
ENV_FILE="$PROJECT_ROOT/.env"
FRONTEND_PID_FILE="$PROJECT_ROOT/.frontend.pid"

WIPE=0
if [ "${1:-}" = "--wipe" ] || [ "${1:-}" = "-v" ]; then
  WIPE=1
fi

echo -e "${BLUE}▶ Stopping IKAS${NC}"

# Frontend
if [ -f "$FRONTEND_PID_FILE" ]; then
  PID=$(cat "$FRONTEND_PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    # Kill the npm-run-dev process and its `next` child.
    pkill -P "$PID" 2>/dev/null || true
    kill "$PID" 2>/dev/null || true
    sleep 1
    if kill -0 "$PID" 2>/dev/null; then
      kill -9 "$PID" 2>/dev/null || true
    fi
    echo -e "  ${GREEN}✓${NC} Frontend gestoppt (PID $PID)"
  else
    echo -e "  ${YELLOW}⚠${NC} Frontend-PID $PID nicht mehr aktiv"
  fi
  rm -f "$FRONTEND_PID_FILE"
fi

# Catch any orphaned `next` processes
if pgrep -f "next dev" >/dev/null 2>&1; then
  pkill -f "next dev" 2>/dev/null || true
  echo -e "  ${GREEN}✓${NC} Verbleibende next-dev-Prozesse aufgeräumt"
fi

# Docker
COMPOSE_ARGS=(-f "$COMPOSE_FILE")
if [ -f "$ENV_FILE" ]; then
  COMPOSE_ARGS+=(--env-file "$ENV_FILE")
fi

if [ "$WIPE" = "1" ]; then
  echo -e "  ${YELLOW}Wiping volumes${NC} — beim nächsten Start wird neu geseedet"
  docker compose "${COMPOSE_ARGS[@]}" down -v --remove-orphans
else
  docker compose "${COMPOSE_ARGS[@]}" down --remove-orphans
fi
echo -e "  ${GREEN}✓${NC} Container gestoppt"

echo -e "${GREEN}✅ Done${NC}"
