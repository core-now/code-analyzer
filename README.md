# 🏙️ CoreNow Code Intelligence & Codebase Analyzer

<p align="center">
  <img src="assets/ai-matrix-city.svg" alt="CoreNow Code Intelligence 3D Matrix City" width="100%" />
</p>

[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Ollama](https://img.shields.io/badge/Ollama-Qwen2.5--Coder%207B-000000?logo=ollama&logoColor=white)](https://ollama.com/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Database](https://img.shields.io/badge/MSSQL%20%2F%20SQLite-Multi--User-63B22F?logo=microsoft-sql-server&logoColor=white)](https://www.microsoft.com/sql-server)
[![UI](https://img.shields.io/badge/Three.js-3D%20CodeCity-FF8000?logo=three.js&logoColor=white)](https://threejs.org/)

Ein ganzheitliches, KI-gestütztes Tool zur statischen Code-Analyse, 3D-Metropolen-Visualisierung (Three.js), AST-Klassifikation, Multi-User Projekt- & Snapshot-Verwaltung (MSSQL / SQLite) und tiefgehenden Architektur-Audits mit lokalen LLMs (BYO-Ollama).

---

## 🌟 Hauptfunktionen & Features

- **👥 Multi-User & Rollen-Authentifizierung**: JWT-basierte Benutzerverwaltung mit Registrierung, Login, Profilverwaltung und Berechtigungsstufen.
- **🗄️ MSSQL & SQLite Dual-Engine**: Nahtlose Anbindung an Microsoft SQL Server mit automatischem lokalem SQLite-Fallback (`analyzer.db`).
- **📸 Snapshot- & Projekt-Management**: Speichern und Wiederherstellen vollständiger Codebase-Zustände inklusive Struktur, Metriken, LOC und 3D-City-Layout.
- **🔗 Public Share-Links**: Ein-Klick-Generierung von unveränderlichen Share-Tokens für Teamkollegen und Stakeholder (`/app?share={token}`).
- **🦙 BYO-Ollama & Multi-LLM**: Flexible Konfiguration eigener lokaler oder entfernter LLM-Endpunkte (Port 11434, Docker oder HTTP-Proxy).
- **🌆 3D CodeCity Metropolis**: Interaktive 3D-Stadt (Dateien als Gebäude, Höhe = LOC, Grundfläche = Komplexität, Farbe = semantische Rolle, Laser-Highways & Traffic-Impulse).
- **⚡ 0ms Delta-Cache (SHA-256)**: Inkrementelle Hashing-Architektur sorgt für blitzschnelle Wiederholungs-Scans ohne redundante Neuberechnung.
- **🎯 Semantische Intent-Rollen**: Automatische Zuordnung von Funktionen & Modulen zu Rollen (*Auth & Security*, *API & Commands*, *Data & State*, *UI & Presentation*, *Core Logic*, *Utils*, *Lifecycle*).

---

## 🚀 Quickstart mit Docker & Docker Compose

Der Standard-Container ist **ultra-leichtgewichtig** (enthält nur den Webserver + DB-Layer, keine schweren KI-Modelle auf dem VPS). Ollama läuft standardmäßig client-seitig bei den Usern zu Hause (**BYO-Ollama**).

### 1. Standard-Start (Leichtgewichtiger Webserver & UI)

```bash
docker compose up -d
```

Nach dem Start:
- **Web-Interface**: [http://localhost:8084/app](http://localhost:8084/app)
- **API Status**: [http://localhost:8084/api/status](http://localhost:8084/api/status)

### 2. Optional: Lokales Ollama & 7B-Modell mit Docker starten

Falls du Ollama dennoch direkt im Docker-Verbund auf einer lokalen Workstation mit GPU hosten möchtest:

```bash
docker compose --profile with-ollama up -d
```

### 3. Stoppen

```bash
docker compose down
```

---

## 🗄️ MSSQL & Datenbank-Konfiguration

Der Analyzer unterstützt nativ Microsoft SQL Server (2016+, Azure SQL) und wechselt bei Nicht-Erreichbarkeit transparent auf SQLite:

### Environment-Variablen in `.env` oder `docker-compose.yml`:

```env
DB_SERVER=mssql.internal.corp
DB_PORT=1433
DB_USER=sa
DB_SECRET=DeinSicheresPasswort
DB_NAME=AnalyzerDB
AUTH_SECRET=super-secure-jwt-salt-key-9988
```

### Manuelles MSSQL Schema anlegen

Das vollständige DDL-Skript findest du in [`db_schema.sql`](db_schema.sql). Es erstellt automatisch:
1. `users` (id, username, email, password_hash, role, is_active, created_at, last_login)
2. `projects` (id, user_id, name, description, is_public, share_token, created_at, updated_at)
3. `project_snapshots` (id, project_id, version, metrics_json, file_tree_json, created_at)

---

## 🦙 BYO-Ollama (Bring Your Own Ollama)

Du kannst jedes beliebige lokale oder remote gehostete Ollama-Setup nutzen:

1. Klicke im Web-Interface oben rechts auf **⚙️ Settings**.
2. Wähle eines der **Quick Presets**:
   - `🦙 Lokales Ollama (Port 11434)` -> `http://localhost:11434/v1/chat/completions`
   - `🐳 Docker Ollama` -> `http://ollama:11434/v1/chat/completions`
   - `⚡ Analyzer Proxy` -> `http://localhost:8084/v1/chat/completions`
3. Gib dein gewünschtes Modell ein (z.B. `qwen2.5-coder:7b`, `deepseek-coder:6.7b` oder `llama3.1:8b`).

---

## 📂 Eigenes Projekt / Codebase mounten

Um ein beliebiges lokales Projekt im Analyzer zu untersuchen, binde den Pfad deines Projekts als Volume in `/workspace` ein:

```yaml
    volumes:
      - /pfad/zu/deinem/projekt:/workspace
```

---

## 🛠️ REST-API Endpunkte

### Authentifizierung & Benutzer
- `POST /api/auth/register` – Benutzer registrieren (`{ username, email, password }`).
- `POST /api/auth/login` – Login & JWT-Token abrufen (`{ username, password }`).
- `GET /api/auth/me` – Profil des aktuell angemeldeten Benutzers.
- `POST /api/auth/logout` – Session beenden.

### Projekte & Snapshots
- `GET /api/projects` – Eigene und öffentliche Community-Projekte auflisten.
- `POST /api/projects` – Neues Projekt & Architektur-Snapshot speichern.
- `GET /api/projects/{id}` – Projekt-Details und Snapshot-Daten abrufen.
- `POST /api/projects/{id}/share` – Öffentlichen Share-Token erzeugen.
- `GET /api/share/{token}` – Öffentlicher Snapshot-Zugriff ohne Login.

### Codebase Scanning & KI-Audits
- `POST /api/scan-local` – Startet lokalen Scan eines Ordnerpfads (`{"path": "/workspace"}`).
- `POST /api/scan-zip` – Akzeptiert binäre ZIP-Payloads zur On-the-Fly-Analyse.
- `POST /api/batch-analysis` – Übergibt einen Modul-Batch an das LLM für tiefes Refactoring-Feedback.
- `POST /api/llm-critique` – Erzeugt eine ganzheitliche Architekturbewertung für die gesamte Codebase.
- `GET /api/status` – Statusprüfung von Engine, DB-Typ (MSSQL/SQLite) und LLM.

---

## 🎨 Styleguide Farben

- **Green**: `#63B22F`
- **Dark Gray**: `#414141`
- **Neon**: `#D9FF3D`
- **Pink**: `#FF8EAB`
