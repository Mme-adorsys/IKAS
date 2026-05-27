# IKAS Setup — Quick Start für Kollegen

Komplettes IKAS-Setup in einem Befehl. Räumt alte Daten weg, baut frisch auf, startet alle Services + Frontend.

## Voraussetzungen

- **Docker** + **Docker Compose v2** (v2 = `docker compose ...` ohne Bindestrich)
- **Node.js v18+** und **npm**
- **Anthropic API Key** — kostenpflichtig, aber für Demo limitiert auf Haiku 4.5 (Cent-Bereich)
  - Hol dir einen unter: https://console.anthropic.com/settings/keys
- **8 GB freier RAM** (Postgres + Neo4j + Keycloak laufen parallel)
- **Ports frei**: 3001, 3002, 5433, 7474, 7687, 8001, 8002, 8005, 8080

## Installation in 3 Schritten

### 1. Repo clonen
```bash
git clone <repo-url>
cd IKAS
```

### 2. API-Key bereit halten
Das Skript fragt im Schritt 2 nach deinem Anthropic-Key, falls noch keiner in `.env` steht. Du kannst ihn auch vorab eintragen:
```bash
cp .env.example .env
# In .env: ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Setup laufen lassen
```bash
./scripts/setup-fresh.sh
```

Dauert **~3 Minuten** beim ersten Mal (Docker-Image-Downloads + Realm-Import + Neo4j-Seed + npm install).
Spätere Aufrufe (z.B. nach `stop-fresh.sh`) sind in ~1 Min durch.

Am Ende sind erreichbar:
| URL | Was |
|---|---|
| http://localhost:3002 | **Frontend** (IKAS Dashboard) |
| http://localhost:8005/health | AI-Gateway |
| http://localhost:8080 | Keycloak Admin Console (`admin` / `admin`) |
| http://localhost:7474 | Neo4j Browser (`neo4j` / `password`) |
| http://localhost:3001/health | WebSocket-Server |

## Stoppen

```bash
./scripts/stop-fresh.sh           # Container stoppen, Volumes bleiben (schneller Neustart)
./scripts/stop-fresh.sh --wipe    # alles weg, nächster setup-fresh.sh seedet komplett neu
```

## Demo-Daten

Nach dem Setup ist eingespielt:
- **37 Demo-User** in 3 Realms (`corporate` 20, `customers` 10, `partners` 7)
- Passwort für alle Test-User: `Pass1234`
- Admin im corporate-Realm: `admin2` / `Admin234`
- **~100 Security-Findings** verteilt über Config, Fraud, OWASP, Compliance, Privilege
- Synthetische Login-Events der letzten 72h (~400 benigne + Brute-Force-Patterns)
- Identity-Provider (Google, GitHub, Legacy-SAML), Auth-Flows mit/ohne MFA, Composite-Roles

## Demo zurücksetzen (während laufender Session)

Im Frontend → **Fixes-Tab** → Button **„↺ Demo zurücksetzen"**

Wipet den Neo4j-Graph und seedet neu — Auto-Fixes/Dismissals gehen verloren, alle Findings sind wieder da. Dauert ~5 Sekunden.

## Was die Demo zeigen kann

| Tab | Inhalt |
|---|---|
| Dashboard | System-Status + Quick-Actions |
| Chat | Claude Haiku 4.5 mit Tool-Calls in Keycloak/Neo4j (Cost-locked, max ~Cent pro Demo) |
| Benutzer | 37 User mit A-E Risk-Klassifikation, Edit/Disable/Find-Duplicates |
| Compliance | DSGVO + OWASP Findings mit echten Realm-Details |
| Sicherheit | Live World-Map mit Wien-Anchor, Identity-Graph, Privilege-Audit-Widgets, Threat-Gauge, Live-Intrusion-Detection |
| Analyse | 6 Analyse-Typen mit realem Backend-Trigger |
| **Fixes** | Priorisierte Empfehlungen nach Urgent/High/Medium/Low + **🔧 Auto-Fix** + **↺ Demo zurücksetzen** |
| Prompts | Klickbare Prompt-Library |

## Cost-Lock (wichtig)

Das Backend ist hart auf **Claude Haiku 4.5** gelocked (`IKAS_MODEL_ALLOWLIST` in `.env`).
Versehentliche Wechsel auf Opus/Sonnet sind blockiert (`POST /api/models/switch` returnt 403).

Im Frontend zeigt der Header-Badge **🟢 Haiku 4.5** dauerhaft das aktive Modell.

Zum Aufheben des Locks (z.B. für eigene Experimente): `IKAS_MODEL_ALLOWLIST=*` in `.env` setzen.

## Troubleshooting

### Ports belegt
```bash
lsof -i :8005,3002,8080,7474     # zeigt blockierende Prozesse
./scripts/stop-fresh.sh           # räumt alte IKAS-Container auf
```

### Keycloak unhealthy
```bash
docker logs ikas-keycloak --tail 50
```
Häufig: erster Start mit Realm-Import braucht 60-90s. Setup-Skript wartet bis zu 180s.

### Frontend zeigt nichts
```bash
tail -f logs/frontend.log
```
Falls Port 3002 belegt war, hat Next.js eventuell 3003 genommen — siehe Log.

### Seed unvollständig (weniger als 30 User)
```bash
docker logs ikas-ai-gateway --tail 100 | grep -i seed
```
Restart hilft meist: `./scripts/stop-fresh.sh --wipe && ./scripts/setup-fresh.sh`

### Anthropic-Key falsch
Symptom: Chat funktioniert nicht, alle anderen Tabs okay.
Fix: `.env` korrigieren, dann `./scripts/stop-fresh.sh && ./scripts/setup-fresh.sh`.

## Architektur

```
┌─────────────────┐
│ Frontend :3002  │  Next.js 15, Zustand, Tailwind
└────────┬────────┘
         │ REST + Socket.io
         ▼
┌─────────────────┐    ┌─────────────────┐
│ AI-Gateway      │    │ WebSocket       │
│ :8005           │    │ Server :3001    │
└────┬─────┬──────┘    └─────────────────┘
     │     │
     │     └──► Keycloak Admin REST (:8080)
     │
     ▼
┌─────────────────┐    ┌─────────────────┐
│ Keycloak-MCP    │    │ Neo4j-MCP       │
│ :8001           │    │ :8002           │
└────────┬────────┘    └────────┬────────┘
         │                      │
         ▼                      ▼
   Keycloak :8080        Neo4j :7687/:7474
   + Postgres :5433
```

## Hot-Reload für Entwicklung

Standardmäßig startet das Setup-Skript die **Produktions-Variante** vom AI-Gateway. Für Backend-Code-Changes ohne Container-Rebuild gibt's den Hot-Reload-Container:

```bash
docker compose -f docker/docker-compose.dev.yml stop ai-gateway
docker compose -f docker/docker-compose.dev.yml --profile hot up -d ai-gateway-hot
```

(Beide laufen auf Port 8005 — sind mutually exclusive.)

Frontend hat Hot-Reload bereits per `npm run dev` aktiv.
