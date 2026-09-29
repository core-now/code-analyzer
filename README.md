# 🏙️ CoreNow Code Intelligence & Codebase Analyzer

[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Ollama](https://img.shields.io/badge/Ollama-Qwen2.5--Coder%207B-000000?logo=ollama&logoColor=white)](https://ollama.com/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![UI](https://img.shields.io/badge/Three.js-3D%20CodeCity-FF8000?logo=three.js&logoColor=white)](https://threejs.org/)

Ein ganzheitliches, KI-gestütztes Tool zur statischen Code-Analyse, 3D-Metropolen-Visualisierung (Three.js), AST-Klassifikation und tiefgehenden Architektur-Audits mit lokalen LLMs.

---
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="100%" height="100%" style="background-color: #020804; font-family: 'Courier New', Courier, monospace;">
  <defs>
    <!-- Glow Filters -->
    <filter id="neon-glow-green" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="neon-glow-cyan" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="10" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- 3D Building Gradients (Matrix Green) -->
    <linearGradient id="top-face" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00ff66" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#00aa44" stop-opacity="0.9" />
    </linearGradient>
    <linearGradient id="left-face" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#00aa44" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#005522" stop-opacity="0.8" />
    </linearGradient>
    <linearGradient id="right-face" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#007733" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#003311" stop-opacity="0.9" />
    </linearGradient>

    <!-- AI Core Gradients (Cyan) -->
    <linearGradient id="core-top" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00ffff" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#00aaaa" stop-opacity="0.9" />
    </linearGradient>
    <linearGradient id="core-left" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#00aaaa" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#005555" stop-opacity="0.8" />
    </linearGradient>
    <linearGradient id="core-right" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#007777" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#003333" stop-opacity="0.9" />
    </linearGradient>

    <!-- Matrix Rain Pattern -->
    <pattern id="matrix-rain" width="100" height="200" patternUnits="userSpaceOnUse">
      <text x="10" y="20" fill="#00ff00" opacity="0.15" font-size="14">010010</text>
      <text x="30" y="60" fill="#00ff00" opacity="0.25" font-size="14">110100</text>
      <text x="70" y="100" fill="#00ff00" opacity="0.1" font-size="14">001101</text>
      <text x="20" y="150" fill="#00ff00" opacity="0.2" font-size="14">101011</text>
      <text x="80" y="180" fill="#00ff00" opacity="0.3" font-size="14">011000</text>
    </pattern>

    <!-- Reusable Isometric Building -->
    <g id="iso-building">
      <!-- Right face -->
      <polygon points="0,25 40,5 40,65 0,85" fill="url(#right-face)" stroke="#00ff00" stroke-width="0.5"/>
      <!-- Left face -->
      <polygon points="0,25 -40,5 -40,65 0,85" fill="url(#left-face)" stroke="#00ff00" stroke-width="0.5"/>
      <!-- Top face -->
      <polygon points="0,25 -40,5 0,-15 40,5" fill="url(#top-face)" stroke="#00ffaa" stroke-width="1"/>
    </g>

    <!-- Reusable AI Core Building -->
    <g id="iso-core">
      <polygon points="0,40 60,10 60,100 0,130" fill="url(#core-right)" stroke="#00ffff" stroke-width="1"/>
      <polygon points="0,40 -60,10 -60,100 0,130" fill="url(#core-left)" stroke="#00ffff" stroke-width="1"/>
      <polygon points="0,40 -60,10 0,-20 60,10" fill="url(#core-top)" stroke="#ffffff" stroke-width="2"/>
    </g>
  </defs>

  <!-- Background Pattern -->
  <rect width="100%" height="100%" fill="url(#matrix-rain)">
    <animate attributeName="y" from="-200" to="0" dur="10s" repeatCount="indefinite" />
  </rect>

  <style>
    .data-stream {
      stroke-dasharray: 15 10;
      animation: flow 2s linear infinite;
    }
    .data-stream-reverse {
      stroke-dasharray: 10 15;
      animation: flow-reverse 3s linear infinite;
    }
    @keyframes flow {
      from { stroke-dashoffset: 100; }
      to { stroke-dashoffset: 0; }
    }
    @keyframes flow-reverse {
      from { stroke-dashoffset: 0; }
      to { stroke-dashoffset: 100; }
    }
    .hover-float {
      animation: float 4s ease-in-out infinite;
    }
    .hover-float-delay {
      animation: float 4s ease-in-out infinite 2s;
    }
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-15px); }
    }
    .pulse-text {
      animation: blink 2s infinite;
    }
    @keyframes blink {
      0%, 100% { opacity: 1; text-shadow: 0 0 10px #00ffff; }
      50% { opacity: 0.5; text-shadow: none; }
    }
    .falling-code {
      animation: code-fall linear infinite;
    }
    @keyframes code-fall {
      0% { transform: translateY(-50px); opacity: 0; }
      10% { opacity: 1; }
      90% { opacity: 1; }
      100% { transform: translateY(200px); opacity: 0; }
    }
  </style>

  <!-- ================= MINDMAP CONNECTIONS ================= -->
  <g fill="none" stroke-width="3" filter="url(#neon-glow-green)">
    <!-- Core to Frontend -->
    <path d="M 600,400 L 300,250" stroke="#00ff66" class="data-stream"/>
    <path d="M 600,410 L 300,260" stroke="#00ff66" opacity="0.3" class="data-stream-reverse" stroke-width="1"/>
    
    <!-- Core to Backend -->
    <path d="M 600,400 L 900,250" stroke="#00ff66" class="data-stream"/>
    <path d="M 600,410 L 900,260" stroke="#00ff66" opacity="0.3" class="data-stream-reverse" stroke-width="1"/>
    
    <!-- Core to Database -->
    <path d="M 600,400 L 250,550" stroke="#00ff66" class="data-stream"/>
    
    <!-- Core to Security -->
    <path d="M 600,400 L 950,550" stroke="#00ff66" class="data-stream"/>
    
    <!-- Core to Utils (Top) -->
    <path d="M 600,400 L 600,150" stroke="#00ff66" class="data-stream"/>
  </g>

  <!-- Radar / Scanning Rings around AI Core -->
  <g transform="translate(600, 400) scale(1, 0.5)" filter="url(#neon-glow-cyan)">
    <circle cx="0" cy="0" r="150" fill="none" stroke="#00ffff" stroke-width="2" opacity="0.5">
      <animate attributeName="r" values="50; 300" dur="3s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.8; 0" dur="3s" repeatCount="indefinite" />
    </circle>
    <circle cx="0" cy="0" r="80" fill="none" stroke="#00ffff" stroke-width="1" opacity="0.5">
      <animate attributeName="r" values="50; 200" dur="3s" begin="1.5s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.8; 0" dur="3s" begin="1.5s" repeatCount="indefinite" />
    </circle>
  </g>

  <!-- ================= CITY NODES (3D BUILDINGS) ================= -->

  <!-- Node 1: Utils (Top Center) -->
  <g transform="translate(600, 150)" class="hover-float-delay">
    <use href="#iso-building" />
    <text x="0" y="-30" fill="#00ffaa" font-weight="bold" font-size="16" text-anchor="middle" filter="url(#neon-glow-green)">>_ SERVICES</text>
    <text x="0" y="-15" fill="#00ffaa" opacity="0.7" font-size="12" text-anchor="middle">v2.1.4</text>
  </g>

  <!-- Node 2: Frontend (Top Left) -->
  <g transform="translate(300, 250)" class="hover-float">
    <use href="#iso-building" transform="scale(1.2)" />
    <!-- Additional small blocks -->
    <use href="#iso-building" transform="translate(-40, 20) scale(0.6)" />
    <use href="#iso-building" transform="translate(40, 20) scale(0.8)" />
    <text x="0" y="-45" fill="#00ffaa" font-weight="bold" font-size="16" text-anchor="middle" filter="url(#neon-glow-green)">[UI_COMPONENTS]</text>
    <text x="0" y="-30" fill="#00ffaa" opacity="0.7" font-size="12" text-anchor="middle">React/Vue Matrix</text>
  </g>

  <!-- Node 3: Backend (Top Right) -->
  <g transform="translate(900, 250)" class="hover-float">
    <use href="#iso-building" transform="scale(1.4)" />
    <use href="#iso-building" transform="translate(45, -20) scale(0.7)" />
    <text x="0" y="-50" fill="#00ffaa" font-weight="bold" font-size="16" text-anchor="middle" filter="url(#neon-glow-green)">[API_GATEWAY]</text>
    <text x="0" y="-35" fill="#00ffaa" opacity="0.7" font-size="12" text-anchor="middle">Node.js Core</text>
  </g>

  <!-- Node 4: Database (Bottom Left) -->
  <g transform="translate(250, 550)" class="hover-float-delay">
    <use href="#iso-building" transform="scale(1.5)" />
    <!-- Stacked DB look -->
    <use href="#iso-building" transform="translate(0, -30) scale(1.5)" />
    <use href="#iso-building" transform="translate(0, -60) scale(1.5)" />
    <text x="0" y="-95" fill="#00ffaa" font-weight="bold" font-size="16" text-anchor="middle" filter="url(#neon-glow-green)">[(DB_CLUSTER)]</text>
    <text x="0" y="-80" fill="#00ffaa" opacity="0.7" font-size="12" text-anchor="middle">PostgreSQL / Redis</text>
  </g>

  <!-- Node 5: Security (Bottom Right) -->
  <g transform="translate(950, 550)" class="hover-float-delay">
    <use href="#iso-building" transform="scale(1.1)" />
    <use href="#iso-building" transform="translate(-40, 20) scale(1.1)" />
    <use href="#iso-building" transform="translate(40, -20) scale(1.1)" />
    <text x="0" y="-45" fill="#00ffaa" font-weight="bold" font-size="16" text-anchor="middle" filter="url(#neon-glow-green)">{AUTH_PROTOCOLS}</text>
    <text x="0" y="-30" fill="#00ffaa" opacity="0.7" font-size="12" text-anchor="middle">JWT / OAuth2</text>
  </g>

  <!-- ================= CENTRAL AI ANALYZER CORE ================= -->
  <g transform="translate(600, 390)" filter="url(#neon-glow-cyan)" class="hover-float">
    <!-- Base shadow / connection pad -->
    <ellipse cx="0" cy="50" rx="90" ry="45" fill="#003333" opacity="0.6"/>
    
    <use href="#iso-core" transform="scale(1.3)" />
    
    <!-- Core floating data rings -->
    <ellipse cx="0" cy="-40" rx="80" ry="40" fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="10 5">
      <animateTransform attributeName="transform" type="rotate" from="0 0 -40" to="360 0 -40" dur="10s" repeatCount="indefinite" />
    </ellipse>
    <ellipse cx="0" cy="-40" rx="60" ry="30" fill="none" stroke="#00ffff" stroke-width="1.5" stroke-dasharray="5 15">
      <animateTransform attributeName="transform" type="rotate" from="360 0 -40" to="0 0 -40" dur="7s" repeatCount="indefinite" />
    </ellipse>

    <!-- AI Core Text -->
    <text x="0" y="-80" fill="#ffffff" font-weight="bold" font-size="24" text-anchor="middle" class="pulse-text">AI_CODE_ANALYZER</text>
    <text x="0" y="-60" fill="#00ffff" font-size="14" text-anchor="middle">SYS.INSPECT(CODEBASE)</text>
    
    <!-- Animated scanning laser on the core -->
    <polygon points="-78,13 0,-26 78,13 0,52" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.8">
      <animate attributeName="points" 
               values="-78,13 0,-26 78,13 0,52; -78,91 0,52 78,91 0,130; -78,13 0,-26 78,13 0,52" 
               dur="4s" repeatCount="indefinite"/>
    </polygon>
  </g>

  <!-- ================= FLOATING MATRIX DATA (Foreground Overlay) ================= -->
  <g font-size="12" fill="#00ff66" opacity="0.8">
    <text x="200" y="0" class="falling-code" style="animation-duration: 4s;">0x1A4F</text>
    <text x="450" y="-50" class="falling-code" style="animation-duration: 6s; animation-delay: 1s;">function init()</text>
    <text x="750" y="-20" class="falling-code" style="animation-duration: 5s; animation-delay: 2s;">analyze_ast()</text>
    <text x="1050" y="-80" class="falling-code" style="animation-duration: 7s; animation-delay: 0.5s;">sys_metrics</text>
    <text x="150" y="-100" class="falling-code" style="animation-duration: 5.5s; animation-delay: 2.5s;">class NeuralNet</text>
  </g>
</svg>

## 🌟 Hauptfunktionen & Features

- **🌆 3D CodeCity Metropolis**: Visuelle Darstellung der Codebase als interaktive 3D-Stadt (Dateien als Gebäude, Höhe = LOC, Grundfläche = Komplexität, Farbe = semantische Rolle).
- **⚡ 0ms Delta-Cache (SHA-256)**: Inkrementelle Hashing-Architektur sorgt für blitzschnelle Wiederholungs-Scans ohne redundante Neuberechnung.
- **🎯 Semantische Intent-Rollen**: Automatische Zuordnung von Funktionen & Modulen zu Rollen (*Auth & Security*, *API & Commands*, *Data & State*, *UI & Presentation*, *Core Logic*, *Utils*, *Lifecycle*).
- **🤖 Lokale LLM-Integration**: Vollständig integrierter OpenAI-kompatibler Endpunkt (Ollama mit z.B. `qwen2.5-coder:7b`, `deepseek-coder` oder `llama3`).
- **📦 Staged Module Batches**: Chunks (4–8 Dateien) werden für gezielte Reviews mit Qualitäts-Scores und Risiko-Audits an das LLM übergeben.
- **📁 Multi-Format Ingestion**: Scannen lokaler Ordner oder direkter Upload von `.zip`-Archiven im Web-Interface.

---

## 🚀 Quickstart mit Docker & Docker Compose

Mit Docker Compose startest du die gesamte Plattform (Code-Analyzer Web-App + Ollama LLM + Automatischer Model-Download) mit einem einzigen Befehl.

### 1. Starten

```bash
docker compose up -d
```

Nach dem Start:
- **Web-Interface**: [http://localhost:8084/app](http://localhost:8084/app)
- **API Status**: [http://localhost:8084/api/status](http://localhost:8084/api/status)
- **Ollama Engine**: [http://localhost:11434](http://localhost:11434)

> Beim ersten Start lädt der `ollama-model-init`-Container automatisch das empfohlene 7B-Coder-Modell (`qwen2.5-coder:7b`) herunter.

### 2. Stoppen

```bash
docker compose down
```

---

## 📂 Eigenes Projekt / Codebase mounten

Um ein beliebiges lokales Projekt im Analyzer zu untersuchen, binde den Pfad deines Projekts als Volume in `/workspace` ein:

### Option A: In `docker-compose.yml` anpassen

```yaml
    volumes:
      - /pfad/zu/deinem/projekt:/workspace
```

### Option B: Direkt per `docker run` ausführen

```bash
# 1. Docker-Image bauen
docker build -t code-analyzer:latest .

# 2. Container mit gemountetem Projekt starten
docker run -d \
  --name code-analyzer \
  -p 8084:8084 \
  -v /pfad/zu/deinem/projekt:/workspace \
  -e LLM_URL=http://host.docker.internal:11434/v1/chat/completions \
  -e LLM_MODEL=qwen2.5-coder:7b \
  code-analyzer:latest
```

Sobald der Container läuft, kannst du im Web-UI `/workspace` als Pfad angeben oder über die API scannen:

```bash
curl -X POST http://localhost:8084/api/scan-local \
  -H "Content-Type: application/json" \
  -d '{"path": "/workspace", "use_cache": true}'
```

---

## 🧠 LLM-Konfiguration & Modelle

Standardmäßig ist `qwen2.5-coder:7b` vorkonfiguriert. Du kannst jedes beliebiges Modell in Ollama verwenden:

### Alternatives Modell herunterladen & nutzen

```bash
# In den Ollama-Container einloggen und Modell laden:
docker exec -it code-analyzer-ollama ollama pull deepseek-coder:6.7b
# oder
docker exec -it code-analyzer-ollama ollama pull llama3:8b
```

Passe anschließend die Umgebungsvariable in `docker-compose.yml` an:
```yaml
      - LLM_MODEL=deepseek-coder:6.7b
```

### ⚡ GPU-Beschleunigung (NVIDIA)

Wenn du das **NVIDIA Container Toolkit** installiert hast, aktiviere die GPU-Unterstützung in `docker-compose.yml`:

```yaml
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
```

---

## ⚙️ Ports & Umgebungsvariablen

### Ports

| Port | Service | Beschreibung |
|---|---|---|
| `8084` | **Code-Analyzer** | Web-Frontend (`/app`) und REST-API |
| `11434` | **Ollama** | OpenAI-kompatibler LLM-Server |

### Umgebungsvariablen

| Variable | Standardwert | Beschreibung |
|---|---|---|
| `PORT` | `8084` | HTTP-Port des Analyzer-Servers |
| `LLM_URL` | `http://ollama:11434/v1/chat/completions` | Zieladresse des LLM-Endpoints |
| `LLM_MODEL` | `qwen2.5-coder:7b` | Name des verwendeten LLM-Modells |
| `CACHE_FILE` | `/workspace/.codebase_cache.json` | Speicherpfad für den SHA-256 Inkrementell-Cache |
| `RESULTS_FILE` | `/workspace/.codebase_results.json` | Speicherpfad für Analyse-Ergebnisse |

---

## 🛠️ REST-API Endpunkte

- `GET /app` – Web-Benutzeroberfläche (3D-Viewer, Mindmap, AST-Details, Code-Viewer).
- `GET /api/status` – Statusprüfung und Konfigurationsübersicht.
- `POST /api/scan-local` – Startet lokalen Scan eines Ordnerpfads (`{"path": "/workspace"}`).
- `POST /api/scan-zip` – Akzeptiert binäre ZIP-Payloads zur On-the-Fly-Analyse.
- `POST /api/batch-analysis` – Übergibt einen Modul-Batch an das LLM für tiefes Refactoring-Feedback.
- `POST /api/llm-critique` – Erzeugt eine ganzheitliche Architekturbewertung für die gesamte Codebase.
- `GET /api/analysis` – Liefert das aktuelle Analyseergebnis im JSON-Format.

---

## 🔍 Troubleshooting

- **Ollama antwortet langsam oder bricht ab**: 
  - Vergewissere dich, dass Docker ausreichend RAM zugewiesen ist (mindestens 8 GB für 7B-Modelle empfohlen).
  - Bei fehlender GPU fällt Ollama automatisch auf CPU-Inferenz zurück.
- **Keine Analyse im Browser sichtbar**: 
  - Klicke im Dashboard auf `Scan Directory` und trage `/workspace` ein.
- **Modell-Download hängt**:
  - Prüfe den Status mit `docker logs -f code-analyzer-model-init`.
