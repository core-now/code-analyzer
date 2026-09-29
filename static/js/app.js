/**
 * Codebase Knowledge Base - Main Application Orchestrator
 * Manages global application state, event listeners, UI renderers,
 * ingestion pipelines, project snapshots, and theme synchronizations.
 */

    // --- Global Analysis Ingestion & Single Render Execution Pipeline ---
    let isRenderingAnalyzedCodebase = false;
    window.__pendingAnalysisData = null;

    function renderAnalyzedCodebase(data) {
      if (!data) return;
      if (isRenderingAnalyzedCodebase) {
        console.warn("[renderAnalyzedCodebase] Render lock active - skipping re-entrant call.");
        return;
      }
      isRenderingAnalyzedCodebase = true;
      try {
        // Normalize files array to file_contents map if needed (e.g. from Git API tree)
        if (Array.isArray(data.files) && !data.file_contents) {
          data.file_contents = {};
          data.files.forEach(f => {
            if (f && f.path) {
              data.file_contents[f.path] = f.content || (typeof generateFallbackFileContent === 'function' ? generateFallbackFileContent(f.path) : "");
            }
          });
        }

        // Reconstruct file_tree if missing
        if (!data.file_tree && (data.file_contents || data.files)) {
          const fileMap = data.file_contents || {};
          const reconstructedTree = { name: "root", type: "directory", children: {} };
          Object.keys(fileMap).forEach(p => {
            const parts = p.split(/[\/\\]/);
            let curr = reconstructedTree;
            parts.forEach((part, idx) => {
              if (idx === parts.length - 1) {
                curr.children[part] = {
                  name: part,
                  type: "file",
                  path: p,
                  language: typeof getLanguageFromPath === 'function' ? getLanguageFromPath(p) : 'text',
                  lines: typeof fileMap[p] === 'string' ? fileMap[p].split('\n').length : 100
                };
              } else {
                curr.children[part] = curr.children[part] || { name: part, type: "directory", children: {} };
                curr = curr.children[part];
              }
            });
          });
          data.file_tree = reconstructedTree;
        }

        currentData = data;
        window.globalAnalysisData = data;

        if (window.codeCityApp && typeof window.codeCityApp.buildCity === 'function') {
          window.codeCityApp.buildCity(data);
        }
        const dropzone = document.getElementById('dropzoneView');
        if (dropzone) dropzone.classList.add('hidden');
        const projBadge = document.getElementById('projectBadge');
        if (projBadge) projBadge.classList.remove('hidden');
        const projName = document.getElementById('projectNameDisplay');
        if (projName) projName.innerText = data.project_name || "Repository";

        // Populate Metrics
        const totalLoc = document.getElementById('totalLocDisplay');
        if (totalLoc) totalLoc.innerText = data.summary?.code_lines?.toLocaleString() || (data.summary?.total_lines?.toLocaleString() || 0);
        const fileBadge = document.getElementById('fileCountBadge');
        if (fileBadge) fileBadge.innerText = `${data.summary?.total_files || Object.keys(data.file_contents || data.files || {}).length} files`;
        
        const langStr = Object.entries(data.summary?.languages || {}).map(([l, c]) => `${l}: ${c}`).join(' | ');
        const langList = document.getElementById('languagesListDisplay');
        if (langList) langList.innerText = langStr;

        // Render Risk Analysis & Health Cards
        if (typeof renderRiskAnalysis === 'function') {
          renderRiskAnalysis(data.risk_radar, data);
        }

        // Render API Catalog
        if (typeof renderApiCatalog === 'function') {
          renderApiCatalog(data.api_catalog);
        }

        // Render Tree & Mindmap
        if (typeof renderFileTree === 'function') {
          renderFileTree(data.file_tree);
        }
        if (typeof renderMindmap === 'function') {
          renderMindmap();
        }
        if (window.lucide && typeof lucide.createIcons === 'function') {
          lucide.createIcons();
        }

        // Open first file if available
        const firstPath = Object.keys(data.file_contents || {})[0];
        if (firstPath && typeof openFileInViewer === 'function') {
          openFileInViewer(firstPath);
        }
      } catch (err) {
        console.error("Error in renderAnalyzedCodebase:", err);
      } finally {
        isRenderingAnalyzedCodebase = false;
      }
    }

    // Expose single canonical entry points (strictly iterative, no recursion)
    window.renderAnalyzedCodebase = renderAnalyzedCodebase;
    window.loadAnalysisData = function(data) { renderAnalyzedCodebase(data); };
    window.ingestAnalysisData = function(data) { renderAnalyzedCodebase(data); };
    window.__handleIncomingData = function(data) { renderAnalyzedCodebase(data); };
    function ingestAnalysisData(data) { renderAnalyzedCodebase(data); }
    function loadAnalysisData(data) { renderAnalyzedCodebase(data); }
    window.safeJsonStringify = function(obj, space = 2) {
      const seen = new WeakSet();
      return JSON.stringify(obj, (key, value) => {
        if (key === 'parent' || key === '__parent') return undefined;
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return undefined; // Break cycle
          }
          seen.add(value);
        }
        return value;
      }, space);
    };

    // --- Application Settings & Persistence ---
    const DEFAULT_SETTINGS = {
      themeMode: "dark",
      llmEndpoint: "http://localhost:8084/v1/chat/completions",
      llmModel: "local-model",
      llmBatchSize: 30,
      ignorePaths: ".git, node_modules, target, dist, build, .idea, .vscode, .fleet, .eclipse, .agents, .agent, .claude, .gemini, .cursor, .windsurf, .copilot, .github, .gitlab, .gitea, .devcontainer, .husky, .changeset, coverage, __pycache__, .venv, env, vendor, .next, .nuxt, .turbo",
      complexityThreshold: 20,
      excludeDocs: true,
      theme: "#FF8000",
      cityCustomTexture: null
    };

    const THEME_PALETTES = {
      '#FF8000': { name: 'CORENOW Amber', hex: '#FF8000', glow: 'rgba(255, 128, 0, 0.35)', glowSoft: 'rgba(255, 128, 0, 0.25)' },
      '#D9FF3D': { name: 'Cyber Neon', hex: '#D9FF3D', glow: 'rgba(217, 255, 61, 0.35)', glowSoft: 'rgba(217, 255, 61, 0.25)' },
      '#63B22F': { name: 'Emerald Wave', hex: '#63B22F', glow: 'rgba(99, 178, 47, 0.35)', glowSoft: 'rgba(99, 178, 47, 0.25)' },
      '#FF8EAB': { name: 'Synth Pink', hex: '#FF8EAB', glow: 'rgba(255, 142, 171, 0.35)', glowSoft: 'rgba(255, 142, 171, 0.25)' },
      '#3B82F6': { name: 'Slate Blue', hex: '#3B82F6', glow: 'rgba(59, 130, 246, 0.35)', glowSoft: 'rgba(59, 130, 246, 0.25)' }
    };

    let appSettings = { ...DEFAULT_SETTINGS };

    function loadSettings() {
      try {
        const saved = localStorage.getItem('corenow_codebase_settings');
        if (saved) {
          appSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
        }
      } catch (e) {
        console.warn("Could not load settings from localStorage:", e);
        appSettings = { ...DEFAULT_SETTINGS };
      }
      applyTheme(appSettings.theme);
      if (appSettings.themeMode === "light") { setAppThemeMode("light"); } else { setAppThemeMode("dark"); }
    }

    function saveSettingsToStorage() {
      try {
        localStorage.setItem('corenow_codebase_settings', JSON.stringify(appSettings));
      } catch (e) {
        console.warn("Could not save settings to localStorage:", e);
      }
    }

    function isLightModeActive() {
      return document.documentElement.classList.contains('light') || (appSettings && appSettings.themeMode === 'light');
    }

    function toggleGlobalAppTheme() {
      const currentlyLight = document.documentElement.classList.contains('light');
      const newMode = currentlyLight ? 'dark' : 'light';
      setAppThemeMode(newMode);
    }

    function setAppThemeMode(mode) {
      const isLight = mode === 'light';
      if (isLight) {
        document.documentElement.classList.add('light');
        document.body.classList.add('light');
      } else {
        document.documentElement.classList.remove('light');
        document.body.classList.remove('light');
      }

      if (appSettings) {
        appSettings.themeMode = mode;
        saveSettingsToStorage();
      }

      // Update Global Header Toggle Button
      const icon = document.getElementById('globalThemeIcon');
      const text = document.getElementById('globalThemeText');
      if (icon) {
        icon.setAttribute('data-lucide', isLight ? 'moon' : 'sun');
        icon.setAttribute('class', isLight ? 'w-3.5 h-3.5 text-indigo-500' : 'w-3.5 h-3.5 text-amber-400');
      }
      if (text) {
        text.innerText = isLight ? 'Dark Mode' : 'Light Mode';
      }

      // Update Settings Modal Theme Mode Toggle UI if present
      updateSettingsThemeModeUI(mode);

      // Sync with 3D City Theme if initialized
      if (window.codeCityApp && typeof window.codeCityApp.setTheme === 'function') {
        window.codeCityApp.setTheme(isLight ? 'light' : 'cyberpunk');
      }

      // Re-render Lucide icons
      if (window.lucide && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
      }
    }

    function updateSettingsThemeModeUI(mode) {
      const isLight = mode === 'light';
      const btnLight = document.getElementById('btnSettingThemeLight');
      const btnDark = document.getElementById('btnSettingThemeDark');
      if (btnLight && btnDark) {
        if (isLight) {
          btnLight.className = 'flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl border border-brand-orange bg-amber-500/10 text-amber-500 font-mono text-xs font-bold ring-1 ring-brand-orange shadow-sm transition';
          btnDark.className = 'flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl border border-brand-border/80 bg-brand-card hover:border-zinc-500 text-zinc-400 font-mono text-xs transition';
        } else {
          btnDark.className = 'flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl border border-brand-orange bg-indigo-500/10 text-indigo-400 font-mono text-xs font-bold ring-1 ring-brand-orange shadow-sm transition';
          btnLight.className = 'flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl border border-brand-border/80 bg-brand-card hover:border-zinc-500 text-zinc-400 font-mono text-xs transition';
        }
      }
    }

    function applyTheme(colorHex) {
      const palette = THEME_PALETTES[colorHex] || THEME_PALETTES['#FF8000'];
      document.documentElement.style.setProperty('--brand-orange', palette.hex);
      document.documentElement.style.setProperty('--brand-orange-glow', palette.glow);
      document.documentElement.style.setProperty('--brand-glow', palette.glowSoft);
      
      if (currentData && !document.getElementById('view-dashboard')?.classList.contains('hidden')) {
        renderMindmap();
      }
    }

    function renderThemePicker() {
      const grid = document.getElementById('themePickerGrid');
      if (!grid) return;
      grid.innerHTML = Object.entries(THEME_PALETTES).map(([hex, info]) => {
        const isSelected = appSettings.theme === hex;
        return `
          <div onclick="selectThemeColor('${hex}')" class="cursor-pointer p-2.5 rounded-xl border transition flex flex-col items-center space-y-2 ${isSelected ? 'border-brand-orange bg-brand-dark ring-1 ring-brand-orange shadow-md' : 'border-brand-border/80 bg-brand-card hover:border-zinc-500'}">
            <div class="w-7 h-7 rounded-full flex items-center justify-center shadow-inner" style="background-color: ${hex}">
              ${isSelected ? '<i data-lucide="check" class="w-4 h-4 text-black font-bold"></i>' : ''}
            </div>
            <div class="text-[11px] font-mono font-medium text-center text-zinc-300 leading-tight">${info.name}</div>
          </div>
        `;
      }).join('');
      lucide.createIcons();
    }

    function selectThemeColor(hex) {
      appSettings.theme = hex;
      applyTheme(hex);
      renderThemePicker();
    }

    function updateCityCustomTextureUI() {
      const previewImg = document.getElementById('cityCustomTexturePreviewImg');
      const placeholder = document.getElementById('cityCustomTexturePlaceholder');
      const statusText = document.getElementById('cityCustomTextureStatus');

      if (appSettings.cityCustomTexture) {
        if (previewImg) {
          previewImg.src = appSettings.cityCustomTexture;
          previewImg.classList.remove('hidden');
        }
        if (placeholder) placeholder.classList.add('hidden');
        if (statusText) {
          statusText.innerText = '✨ Eigene Custom-Textur aktiv';
          statusText.setAttribute('class', 'text-[10px] font-mono text-brand-orange');
        }
      } else {
        if (previewImg) {
          previewImg.src = '';
          previewImg.classList.add('hidden');
        }
        if (placeholder) placeholder.classList.remove('hidden');
        if (statusText) {
          statusText.innerText = '⚡ Prozeduraler Cyber-Circuit aktiv';
          statusText.setAttribute('class', 'text-[10px] font-mono text-emerald-400');
        }
      }
    }

    function handleCityCustomTextureUpload(input) {
      if (!input.files || input.files.length === 0) return;
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        appSettings.cityCustomTexture = dataUrl;
        saveSettingsToStorage();
        updateCityCustomTextureUI();
        if (window.codeCityApp) {
          window.codeCityApp.applyCustomTexture(dataUrl);
        }
      };
      reader.readAsDataURL(file);
    }

    function clearCityCustomTexture() {
      appSettings.cityCustomTexture = null;
      saveSettingsToStorage();
      updateCityCustomTextureUI();
      const fileInput = document.getElementById('cityCustomTextureFileInput');
      if (fileInput) fileInput.value = '';
      if (window.codeCityApp) {
        window.codeCityApp.applyCustomTexture(null);
      }
    }

    function initCityCustomTextureDragAndDrop() {
      const dropZone = document.getElementById('cityCustomTextureDropZone');
      if (!dropZone) return;

      ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropZone.classList.add('border-brand-orange', 'bg-brand-card');
        }, false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropZone.classList.remove('border-brand-orange', 'bg-brand-card');
        }, false);
      });

      dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files.length > 0) {
          const fileInput = document.getElementById('cityCustomTextureFileInput');
          if (fileInput) {
            fileInput.files = dt.files;
            handleCityCustomTextureUpload(fileInput);
          }
        }
      }, false);
    }

    function setLLMPreset(preset) {
      const endpointInput = document.getElementById('setting-llm-endpoint');
      const modelInput = document.getElementById('setting-llm-model');
      if (preset === 'local-ollama') {
        if (endpointInput) endpointInput.value = 'http://localhost:11434/v1/chat/completions';
        if (modelInput && (!modelInput.value || modelInput.value === 'local-model')) modelInput.value = 'qwen2.5-coder:7b';
      } else if (preset === 'docker-ollama') {
        if (endpointInput) endpointInput.value = 'http://ollama:11434/v1/chat/completions';
        if (modelInput && (!modelInput.value || modelInput.value === 'local-model')) modelInput.value = 'qwen2.5-coder:7b';
      } else if (preset === 'backend-proxy') {
        if (endpointInput) endpointInput.value = 'http://localhost:8084/v1/chat/completions';
        if (modelInput && (!modelInput.value || modelInput.value === 'local-model')) modelInput.value = 'qwen2.5-coder:7b';
      }
    }

    function openSettingsModal() {
      const modal = document.getElementById('settingsModal');
      if (!modal) return;
      
      document.getElementById('setting-llm-endpoint').value = appSettings.llmEndpoint || DEFAULT_SETTINGS.llmEndpoint;
      document.getElementById('setting-llm-model').value = appSettings.llmModel || DEFAULT_SETTINGS.llmModel;
      document.getElementById('setting-llm-batch').value = appSettings.llmBatchSize || DEFAULT_SETTINGS.llmBatchSize;
      document.getElementById('setting-ignore-paths').value = appSettings.ignorePaths || DEFAULT_SETTINGS.ignorePaths;
      
      const compSlider = document.getElementById('setting-complexity-threshold');
      compSlider.value = appSettings.complexityThreshold || DEFAULT_SETTINGS.complexityThreshold;
      updateComplexityBadge(compSlider.value);
      
      document.getElementById('setting-exclude-docs').checked = appSettings.excludeDocs !== false;
      
      renderThemePicker();
      updateSettingsThemeModeUI(appSettings.themeMode || (document.documentElement.classList.contains('light') ? 'light' : 'dark'));
      updateCityCustomTextureUI();
      initCityCustomTextureDragAndDrop();
      modal.classList.remove('hidden');
    }

    function closeSettingsModal() {
      const modal = document.getElementById('settingsModal');
      if (modal) modal.classList.add('hidden');
    }

    function updateComplexityBadge(val) {
      const badge = document.getElementById('complexityValueBadge');
      if (badge) {
        badge.innerText = `Warnung ab ${val}`;
      }
    }

    function saveAndApplySettings() {
      appSettings.llmEndpoint = document.getElementById('setting-llm-endpoint').value.trim() || DEFAULT_SETTINGS.llmEndpoint;
      appSettings.llmModel = document.getElementById('setting-llm-model').value.trim() || DEFAULT_SETTINGS.llmModel;
      appSettings.llmBatchSize = parseInt(document.getElementById('setting-llm-batch').value, 10) || DEFAULT_SETTINGS.llmBatchSize;
      appSettings.ignorePaths = document.getElementById('setting-ignore-paths').value.trim() || DEFAULT_SETTINGS.ignorePaths;
      appSettings.complexityThreshold = parseInt(document.getElementById('setting-complexity-threshold').value, 10) || DEFAULT_SETTINGS.complexityThreshold;
      appSettings.excludeDocs = document.getElementById('setting-exclude-docs').checked;

      saveSettingsToStorage();
      applyTheme(appSettings.theme);
      if (window.codeCityApp && appSettings.cityCustomTexture) {
        window.codeCityApp.applyCustomTexture(appSettings.cityCustomTexture);
      }
      closeSettingsModal();

      if (currentData && currentData.file_contents) {
        buildClientSideAnalysis(currentData.project_name || 'Codebase', currentData.file_contents);
      }
    }

    function resetSettingsToDefault() {
      appSettings = { ...DEFAULT_SETTINGS };
      saveSettingsToStorage();
      applyTheme(appSettings.theme);
      clearCityCustomTexture();
      openSettingsModal();
    }

    function getIgnoredDirsSet() {
      const dirs = new Set(IGNORED_DIRS);
      const custom = (appSettings.ignorePaths || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      custom.forEach(d => dirs.add(d));
      return dirs;
    }

    // --- Application State ---
    let currentData = null;
    let activeFile = null;
    let searchMatches = [];
    let currentMatchIndex = -1;
    let d3Zoom = null;

    // --- Toast Notification System ---
    function showToast(message, type = 'info') {
      let container = document.getElementById('globalToastContainer');
      if (!container) {
        container = document.createElement('div');
        container.id = 'globalToastContainer';
        container.className = 'fixed bottom-5 right-5 z-[9999] flex flex-col space-y-2 pointer-events-none max-w-sm';
        document.body.appendChild(container);
      }
      const toast = document.createElement('div');
      const isSuccess = type === 'success';
      const isError = type === 'error';
      const borderClass = isSuccess ? 'border-[#63B22F]/80 bg-[#142010]/95 text-[#63B22F]' :
                          isError ? 'border-rose-500/80 bg-[#251014]/95 text-rose-300' :
                          'border-brand-border bg-brand-dark/95 text-white';
      toast.className = `px-4 py-3 rounded-xl border shadow-2xl font-mono text-xs flex items-center space-x-2.5 pointer-events-auto transition-all duration-300 transform opacity-0 translate-y-3 ${borderClass}`;
      const icon = isSuccess ? '✓' : (isError ? '⚠️' : 'ℹ️');
      toast.innerHTML = `<span class="font-bold text-sm">${icon}</span><span class="leading-tight">${escapeHtml(message)}</span>`;
      container.appendChild(toast);
      requestAnimationFrame(() => {
        toast.classList.remove('opacity-0', 'translate-y-3');
      });
      setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-3');
        setTimeout(() => toast.remove(), 350);
      }, 4500);
    }



    // --- Projects & Snapshot Drawer ---
    function openProjectsDrawer() {
      if (!authState.user) {
        if (typeof requireAuthOrPro === 'function') {
          requireAuthOrPro('Projekte & Snapshots Cloud-Speicher', () => {
            const modal = document.getElementById('projectsDrawerModal');
            if (modal) modal.classList.remove('hidden');
            fetchAndRenderProjectsList();
          });
        } else {
          openAuthModal('login');
        }
        return;
      }
      const modal = document.getElementById('projectsDrawerModal');
      if (modal) modal.classList.remove('hidden');
      fetchAndRenderProjectsList();
    }

    function closeProjectsDrawer() {
      const modal = document.getElementById('projectsDrawerModal');
      if (modal) modal.classList.add('hidden');
    }

    async function fetchAndRenderProjectsList() {
      const container = document.getElementById('projectsListContainer');
      if (!container) return;
      container.innerHTML = '<div class="text-center py-6 text-zinc-500 font-mono text-xs">Lade Projekte...</div>';

      try {
        const res = await fetch('/api/projects', {
          headers: getAuthHeaders()
        });
        if (!res.ok) {
          container.innerHTML = '<div class="text-rose-400 p-4 text-center font-mono text-xs">Fehler beim Laden der Projekte.</div>';
          return;
        }
        const data = await res.json();
        const projects = data.projects || [];

        if (projects.length === 0) {
          container.innerHTML = `
            <div class="text-center py-10 space-y-2 border border-dashed border-brand-border rounded-xl p-6 bg-brand-dark/50">
              <i data-lucide="folder-x" class="w-8 h-8 text-zinc-600 mx-auto"></i>
              <div class="text-zinc-400 text-xs font-mono">Keine Projekte in der Datenbank gefunden.</div>
              <div class="text-[11px] text-zinc-500 font-mono">Scanne eine Codebase und klicke oben auf 'Snapshot anlegen'.</div>
            </div>
          `;
          if (window.lucide) lucide.createIcons();
          return;
        }

        container.innerHTML = projects.map(p => {
          const isOwner = authState.user && p.user_id === authState.user.id;
          const formattedDate = p.updated_at ? new Date(p.updated_at).toLocaleString('de-DE') : 'Vor Kurzem';
          return `
            <div class="p-3.5 rounded-xl bg-brand-dark/95 border border-brand-border hover:border-brand-orange/60 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center space-x-2">
                  <span class="text-xs font-bold text-white font-mono truncate">${escapeHtml(p.name)}</span>
                  ${p.is_public ? '<span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-500/40">Öffentlich</span>' : '<span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">Privat</span>'}
                  ${isOwner ? '<span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#63B22F]/20 text-[#63B22F] border border-[#63B22F]/40">Mein Projekt</span>' : `<span class="text-[9px] text-zinc-500 font-mono">von ${escapeHtml(p.owner || 'Community')}</span>`}
                </div>
                ${p.description ? `<p class="text-[11px] text-zinc-400 font-mono truncate mt-0.5">${escapeHtml(p.description)}</p>` : ''}
                <div class="text-[10px] text-zinc-500 font-mono mt-1 flex items-center space-x-2">
                  <span>Zuletzt aktualisiert: ${formattedDate}</span>
                </div>
              </div>
              <div class="flex items-center space-x-1.5 flex-shrink-0">
                <button onclick="loadProjectById('${p.id}')" class="px-2.5 py-1.5 rounded bg-brand-dark border border-brand-orange text-brand-orange hover:bg-brand-orange hover:text-black font-bold text-xs font-mono transition flex items-center space-x-1">
                  <i data-lucide="play" class="w-3 h-3"></i>
                  <span>Laden</span>
                </button>
                ${isOwner ? `
                  <button onclick="generateShareLink('${p.id}')" class="px-2 py-1.5 rounded bg-brand-dark border border-sky-500/40 text-sky-400 hover:bg-sky-500 hover:text-black text-xs font-mono transition flex items-center space-x-1" title="Share-Link erstellen">
                    <i data-lucide="share-2" class="w-3 h-3"></i>
                    <span>Teilen</span>
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('');

        if (window.lucide) lucide.createIcons();
      } catch (err) {
        container.innerHTML = `<div class="text-rose-400 p-4 text-center font-mono text-xs">Verbindungsfehler: ${err.message}</div>`;
      }
    }

    async function loadProjectById(projectId) {
      showLoadingStatus("Lade Projekt aus MSSQL/Datenbank...");
      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          headers: getAuthHeaders()
        });
        if (!res.ok) {
          alert("Fehler beim Abrufen des Projekts.");
          hideLoadingStatus();
          return;
        }
        const project = await res.json();
        if (project.snapshot && project.snapshot.metrics) {
          const analysisData = project.snapshot.metrics;
          analysisData.project_name = project.name;
          ingestAnalysisData(analysisData);
          closeProjectsDrawer();
          alert(`Projekt "${project.name}" erfolgreich geladen!`);
        } else {
          alert("Keine Snapshot-Metriken im Projekt gefunden.");
        }
      } catch (err) {
        alert("Ladefehler: " + err.message);
      } finally {
        hideLoadingStatus();
      }
    }

    async function generateShareLink(projectId) {
      try {
        const res = await fetch(`/api/projects/${projectId}/share`, {
          method: 'POST',
          headers: getAuthHeaders()
        });
        if (!res.ok) {
          alert("Share-Token konnte nicht generiert werden.");
          return;
        }
        const data = await res.json();
        const fullUrl = `${window.location.origin}/app?share=${data.share_token}`;
        navigator.clipboard.writeText(fullUrl);
        alert(`Share-Link kopiert:\n${fullUrl}\n\nJeder mit diesem Link kann diesen Snapshot einsehen!`);
      } catch (err) {
        alert("Fehler: " + err.message);
      }
    }

    async function executeSaveCurrentProject() {
      if (!authState.user) {
        openAuthModal('login');
        return;
      }
      if (!currentData) {
        alert("Bitte lade oder analysiere zuerst ein Projekt.");
        return;
      }

      const nameInput = document.getElementById('saveProjectNameInput');
      const isPublicCheck = document.getElementById('saveProjectPublicCheckbox');
      const name = (nameInput && nameInput.value.trim()) || currentData.project_name || 'Codebase Snapshot';
      const isPublic = isPublicCheck ? isPublicCheck.checked : false;

      try {
        showLoadingStatus("Speichere Snapshot in MSSQL/Datenbank...");
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            name: name,
            description: `Snapshot mit ${currentData.summary?.total_files || 0} Dateien und ${currentData.summary?.code_lines || 0} LOC`,
            is_public: isPublic,
            metrics: currentData,
            file_tree: currentData.file_tree
          })
        });

        if (!res.ok) {
          const err = await res.json();
          alert("Fehler beim Speichern: " + (err.error || "Unbekannter Fehler"));
          return;
        }

        const project = await res.json();
        alert(`Projekt "${project.name}" erfolgreich in der Datenbank gesichert!`);
        fetchAndRenderProjectsList();
      } catch (err) {
        alert("Speicherfehler: " + err.message);
      } finally {
        hideLoadingStatus();
      }
    }

    function saveCurrentProjectToCloud() {
      if (!authState.user) {
        if (typeof requireAuthOrPro === 'function') {
          requireAuthOrPro('Cloud Snapshot Speicherung (MSSQL / SQLite)', () => openProjectsDrawer());
        } else {
          openAuthModal('login');
        }
        return;
      }
      openProjectsDrawer();
    }

    // Helper: URL Parameter Check for ?share=token
    async function checkShareUrlParameter() {
      const urlParams = new URLSearchParams(window.location.search);
      const shareToken = urlParams.get('share');
      if (shareToken) {
        showLoadingStatus("Lade geteilten Snapshot...");
        try {
          const res = await fetch(`/api/share/${shareToken}`);
          if (res.ok) {
            const project = await res.json();
            if (project.snapshot && project.snapshot.metrics) {
              const data = project.snapshot.metrics;
              data.project_name = project.name;
              ingestAnalysisData(data);
              alert(`Öffentlicher Snapshot "${project.name}" erfolgreich geladen!`);
            }
          }
        } catch (err) {
          console.warn("Share token loading error:", err);
        } finally {
          hideLoadingStatus();
        }
      }
    }

    // Escape HTML Helper
    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
      );
    }

    // Initialize Settings, Auth & Icons
    loadSettings();
    lucide.createIcons();
    checkAuthConfig();
    checkUrlAuthParams();
    checkAuthSession();
    checkShareUrlParameter();

    // View Switching
    function switchView(viewName) {
      ['dashboard', 'city', 'code', 'radar', 'api'].forEach(v => {
        const el = document.getElementById(`view-${v}`);
        const btn = document.getElementById(`nav-${v}`);
        if (!el || !btn) return;
        if (v === viewName) {
          el.classList.remove('hidden');
          btn.classList.add('bg-brand-dark', 'text-brand-orange', 'border-brand-orange');
          btn.classList.remove('border-transparent', 'text-zinc-400');
        } else {
          el.classList.add('hidden');
          btn.classList.remove('bg-brand-dark', 'text-brand-orange', 'border-brand-orange');
          btn.classList.add('border-transparent', 'text-zinc-400');
        }
      });
      if (viewName === 'dashboard' && currentData) {
        setTimeout(renderMindmap, 50);
      } else if (viewName === 'city' && currentData) {
        setTimeout(() => {
          if (window.codeCityApp) {
            window.codeCityApp.onViewActivated();
          } else {
            initCodeCity();
          }
        }, 50);
      }
    }



    // --- Demo Dataset (Rust/Tauri/TS Stack) ---
    function loadDemoCodebase() {
      const demoData = {
        project_name: "Tauri-Mano-Brangioji-Core",
        summary: {
          total_files: 5,
          total_lines: 480,
          code_lines: 390,
          comment_lines: 45,
          blank_lines: 45,
          avg_complexity: 12.4,
          languages: { "Rust": 230, "TypeScript": 120, "CSS": 40 }
        },
        mindmap: {
          id: "root",
          name: "Mano Brangioji Architecture",
          category: "Project Architecture",
          children: [
            {
              id: "dir_src-tauri",
              name: "src-tauri",
              path: "src-tauri",
              category: "Directory",
              nodeType: "layer",
              children: [
                {
                  id: "dir_src-tauri/src",
                  name: "src",
                  path: "src-tauri/src",
                  category: "Directory",
                  nodeType: "layer",
                  children: [
                    {
                      id: "src-tauri/src/main.rs",
                      name: "main.rs",
                      path: "src-tauri/src/main.rs",
                      category: "Component",
                      nodeType: "file",
                      children: [
                        { id: "src-tauri/src/main.rs#fn init_app", name: "fn init_app()", path: "src-tauri/src/main.rs", category: "Function" },
                        { id: "src-tauri/src/main.rs#fn scan_repo", name: "fn scan_repo()", path: "src-tauri/src/main.rs", category: "Function" }
                      ]
                    },
                    {
                      id: "dir_src-tauri/src/auth",
                      name: "auth",
                      path: "src-tauri/src/auth",
                      category: "Directory",
                      nodeType: "layer",
                      children: [
                        {
                          id: "src-tauri/src/auth/session.rs",
                          name: "session.rs",
                          path: "src-tauri/src/auth/session.rs",
                          category: "Component",
                          nodeType: "file",
                          children: [
                            { id: "src-tauri/src/auth/session.rs#struct SessionManager", name: "struct SessionManager", path: "src-tauri/src/auth/session.rs", category: "Type" }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              id: "dir_src",
              name: "src",
              path: "src",
              category: "Directory",
              nodeType: "layer",
              children: [
                {
                  id: "src/app.ts",
                  name: "app.ts",
                  path: "src/app.ts",
                  category: "Component",
                  nodeType: "file",
                  children: [
                    { id: "src/app.ts#fn mountApp", name: "function mountApp()", path: "src/app.ts", category: "Function" }
                  ]
                },
                {
                  id: "dir_src/components",
                  name: "components",
                  path: "src/components",
                  category: "Directory",
                  nodeType: "layer",
                  children: [
                    {
                      id: "dir_src/components/ui",
                      name: "ui",
                      path: "src/components/ui",
                      category: "Directory",
                      nodeType: "layer",
                      children: [
                        {
                          id: "src/components/ui/button.tsx",
                          name: "button.tsx",
                          path: "src/components/ui/button.tsx",
                          category: "Component",
                          nodeType: "file",
                          children: [
                            { id: "src/components/ui/button.tsx#Button", name: "const Button", path: "src/components/ui/button.tsx", category: "Function" }
                          ]
                        }
                      ]
                    }
                  ]
                },
                {
                  id: "dir_src/api",
                  name: "api",
                  path: "src/api",
                  category: "Directory",
                  nodeType: "layer",
                  children: [
                    {
                      id: "src/api/client.ts",
                      name: "client.ts",
                      path: "src/api/client.ts",
                      category: "Component",
                      nodeType: "file",
                      children: [
                        { id: "src/api/client.ts#fn invokeTauri", name: "function invokeTauri()", path: "src/api/client.ts", category: "Function" }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        },
        risk_radar: {
          health_score: 92,
          metrics: { high_complexity_files: 1, large_files: 0, low_documentation_files: 0 },
          alerts: [
            { level: "info", title: "Clean Async Architecture", path: "src-tauri/src/main.rs", description: "Standard Tauri IPC commands detected with bounded memory limits." }
          ]
        },
        api_catalog: [
          { protocol: "Tauri IPC", name: "scan_repo", handler: "scan_repo", path: "src-tauri/src/main.rs", type: "Command" },
          { protocol: "Tauri IPC", name: "init_app", handler: "init_app", path: "src-tauri/src/main.rs", type: "Command" }
        ],
        file_tree: {
          name: "root",
          type: "directory",
          children: {
            "src-tauri": {
              name: "src-tauri",
              type: "directory",
              children: {
                "src": {
                  name: "src",
                  type: "directory",
                  children: {
                    "main.rs": { name: "main.rs", type: "file", path: "src-tauri/src/main.rs", language: "Rust", lines: 140, complexity: 14 },
                    "auth.rs": { name: "auth.rs", type: "file", path: "src-tauri/src/auth.rs", language: "Rust", lines: 90, complexity: 8 }
                  }
                }
              }
            },
            "src": {
              name: "src",
              type: "directory",
              children: {
                "app.ts": { name: "app.ts", type: "file", path: "src/app.ts", language: "TypeScript", lines: 70, complexity: 5 },
                "api": {
                  name: "api",
                  type: "directory",
                  children: {
                    "client.ts": { name: "client.ts", type: "file", path: "src/api/client.ts", language: "TypeScript", lines: 50, complexity: 4 }
                  }
                }
              }
            }
          }
        },
        file_contents: {
          "src-tauri/src/main.rs": `// Prevents additional console window on Windows in release\n#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]\n\nuse tauri::Manager;\n\n#[tauri::command]\nasync fn scan_repo(path: String) -> Result<String, String> {\n    println!("Scanning repository at: {}", path);\n    Ok("Scan completed successfully".into())\n}\n\n#[tauri::command]\nfn init_app() -> String {\n    "CORENOW Engine Ready".into()\n}\n\nfn main() {\n    tauri::Builder::default()\n        .invoke_handler(tauri::generate_handler![scan_repo, init_app])\n        .run(tauri::generate_context!())\n        .expect("error while running tauri application");\n}`,
          "src-tauri/src/auth.rs": `pub struct SessionManager {\n    pub token: String,\n    pub is_authenticated: bool,\n}\n\nimpl SessionManager {\n    pub fn new() -> Self {\n        Self { token: String::new(), is_authenticated: false }\n    }\n}`,
          "src/app.ts": `import { invokeTauri } from "./api/client";\n\nexport function mountApp(): void {\n    console.log("CORENOW Knowledge Base UI Mounted");\n    invokeTauri("init_app");\n}`,
          "src/api/client.ts": `import { invoke } from "@tauri-apps/api/core";\n\nexport async function invokeTauri(cmd: string, args?: any): Promise<any> {\n    return await invoke(cmd, args);\n}`
        }
      };

      ingestAnalysisData(demoData);
    }



    // --- Helper Constants for Filtering ---
    const IGNORED_DIRS = new Set([
      // VCS & Repositories
      '.git', '.svn', '.hg',
      // Agent, Prompt & AI Tool Configurations
      '.agents', '.agent', '.claude', '.gemini', '.cursor', '.windsurf', '.copilot',
      // CI/CD, Git Hooks & Devcontainers
      '.github', '.gitlab', '.gitea', '.devcontainer', '.husky', '.changeset',
      // IDE & Editor Configurations
      '.vscode', '.idea', '.fleet', '.eclipse',
      // Dependencies & Package Managers
      'node_modules', 'vendor',
      // Build Outputs, Compilers & Framework Caches
      'target', 'dist', 'build', 'out', 'bin', 'obj', '.cargo', 'coverage',
      '__pycache__', '.venv', 'venv', 'env',
      '.next', '.nuxt', '.turbo', '.svelte-kit', '.cache'
    ]);

    const IGNORED_EXTENSIONS = new Set([
      'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'avif', 'tiff', 'tif', 'psd', 'raw', 'heic', 'svg',
      'mp4', 'webm', 'avi', 'mov', 'mkv', 'flv', 'wmv', 'm4v', '3gp',
      'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma',
      'exe', 'dll', 'so', 'dylib', 'bin', 'iso', 'img', 'dmg', 'class', 'pyc', 'pyo', 'wasm', 'o', 'a', 'lib',
      'zip', 'tar', 'gz', 'tgz', 'bz2', 'xz', '7z', 'rar',
      'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
      'ttf', 'otf', 'woff', 'woff2', 'eot',
      'db', 'sqlite', 'sqlite3', 'lockb', 'ds_store'
    ]);

    function isIgnoredFile(filename) {
      if (!filename || filename.startsWith('.')) return true;
      const lower = filename.toLowerCase();
      if (lower === '.ds_store' || lower === 'thumbs.db') return true;
      const dotIdx = lower.lastIndexOf('.');
      if (dotIdx !== -1) {
        const ext = lower.substring(dotIdx + 1);
        if (IGNORED_EXTENSIONS.has(ext)) return true;
      }
      return false;
    }

    function showLoadingStatus(msg) {
      const el = document.getElementById('loadingStatus');
      const txt = document.getElementById('loadingStatusText');
      if (el && txt) {
        txt.innerText = msg;
        el.classList.remove('hidden');
      }
    }

    function hideLoadingStatus() {
      const el = document.getElementById('loadingStatus');
      if (el) el.classList.add('hidden');
    }

    // --- Modern Directory Picker with Fallback ---
    async function openDirectoryPicker() {
      // 1. Try Modern File System Access API
      if (window.showDirectoryPicker) {
        try {
          const dirHandle = await window.showDirectoryPicker();
          await handleDirectoryHandle(dirHandle);
          return;
        } catch (err) {
          if (err.name === 'AbortError') return; // User cancelled
          console.warn('showDirectoryPicker failed or permission denied, trying fallback:', err);
        }
      }
      
      // 2. Fallback to HTML5 directory input
      const input = document.getElementById('folderInput') || document.getElementById('dirPicker');
      if (input) {
        input.click();
      }
    }

    // Process FileSystemDirectoryHandle (Modern API)
    async function handleDirectoryHandle(dirHandle) {
      showLoadingStatus(`Reading ${dirHandle.name}...`);
      const filesMap = {};
      const projectName = dirHandle.name || "Local_Project";
      const ignoredDirs = getIgnoredDirsSet();
      const MAX_DEPTH = 30;

      try {
        // Iterative BFS queue to prevent any recursion call-stack overflows
        const queue = [{ handle: dirHandle, path: "", depth: 0 }];
        const visitedHandles = new Set();

        while (queue.length > 0) {
          const { handle, path, depth } = queue.shift();
          if (depth > MAX_DEPTH) continue;

          try {
            for await (const [name, entry] of handle.entries()) {
              if (ignoredDirs.has(name.toLowerCase())) continue;
              const entryPath = path ? `${path}/${name}` : name;

              if (entry.kind === 'directory') {
                if (depth + 1 <= MAX_DEPTH) {
                  queue.push({ handle: entry, path: entryPath, depth: depth + 1 });
                }
              } else if (entry.kind === 'file') {
                if (!isIgnoredFile(name)) {
                  try {
                    const file = await entry.getFile();
                    if (file.size <= 3 * 1024 * 1024) { // Up to 3MB per file
                      const text = await file.text();
                      filesMap[entryPath] = text;
                    }
                  } catch (e) {
                    console.warn(`Could not read file ${entryPath}:`, e);
                  }
                }
              }
            }
          } catch (iterErr) {
            console.warn(`Could not iterate directory ${path || handle.name}:`, iterErr);
          }
        }

        hideLoadingStatus();
        if (Object.keys(filesMap).length === 0) {
          alert("No supported code files found in selected directory.");
          return;
        }
        buildClientSideAnalysis(projectName, filesMap);
      } catch (err) {
        hideLoadingStatus();
        console.error("Directory scan error:", err);
        alert("Failed to read folder: " + err.message);
      }
    }

    // --- ZIP and Folder Handlers ---
    async function handleZipSelect(event) {
      const file = event.target?.files?.[0] || event;
      if (!file) return;

      showLoadingStatus(`Decompressing ${file.name}...`);
      try {
        const jszip = new JSZip();
        const zip = await jszip.loadAsync(file);
        const filesMap = {};
        const ignoredDirs = getIgnoredDirsSet();

        for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
          if (zipEntry.dir) continue;
          
          const parts = relativePath.split(/[/\\]/);
          const hasIgnoredDir = parts.slice(0, -1).some(seg => ignoredDirs.has(seg.toLowerCase()));
          if (hasIgnoredDir) continue;

          const fileName = parts[parts.length - 1];
          if (isIgnoredFile(fileName)) continue;

          try {
            const content = await zipEntry.async("string");
            // Normalize path (strip top level folder if all files share root folder)
            const normPath = parts.length > 1 ? parts.slice(1).join('/') : relativePath;
            filesMap[normPath] = content;
          } catch (e) {
            console.warn(`Error reading zip entry ${relativePath}:`, e);
          }
        }

        hideLoadingStatus();
        buildClientSideAnalysis(file.name.replace(/\.zip$/i, ''), filesMap);
      } catch (err) {
        hideLoadingStatus();
        console.error("ZIP read error:", err);
        alert("Failed to extract ZIP: " + err.message);
      }
    }

    async function handleFolderSelect(event) {
      const files = event.target.files;
      if (!files || !files.length) return;

      showLoadingStatus(`Indexing ${files.length} files...`);
      const filesMap = {};
      let projectName = "Local_Folder";
      const ignoredDirs = getIgnoredDirsSet();

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const relPath = file.webkitRelativePath || file.name;
          const parts = relPath.split(/[/\\]/);

          if (i === 0 && file.webkitRelativePath && parts.length > 0) {
            projectName = parts[0];
          }

          const hasIgnoredDir = parts.slice(0, -1).some(seg => ignoredDirs.has(seg.toLowerCase()));
          if (hasIgnoredDir) continue;

          const fileName = parts[parts.length - 1];
          if (isIgnoredFile(fileName)) continue;

          if (file.size <= 3 * 1024 * 1024) {
            const text = await file.text();
            const normPath = parts.length > 1 ? parts.slice(1).join('/') : relPath;
            filesMap[normPath] = text;
          }
        }

        hideLoadingStatus();
        if (Object.keys(filesMap).length === 0) {
          alert("No supported code files found in selected folder.");
          return;
        }
        buildClientSideAnalysis(projectName, filesMap);
      } catch (err) {
        hideLoadingStatus();
        console.error("Folder read error:", err);
        alert("Failed to read folder: " + err.message);
      } finally {
        event.target.value = '';
      }
    }

    // --- Drag & Drop Support ---
    const dropzoneBox = document.getElementById('dropzoneBox');
    if (dropzoneBox) {
      ['dragenter', 'dragover'].forEach(eventName => {
        window.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzoneBox.classList.add('border-brand-orange', 'bg-brand-anthracite');
        }, false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        window.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzoneBox.classList.remove('border-brand-orange', 'bg-brand-anthracite');
        }, false);
      });

      window.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const items = e.dataTransfer?.items;
        if (items && items.length > 0) {
          const firstItem = items[0];
          // If modern FileSystemHandle is available in dataTransfer
          if (firstItem.getAsFileSystemHandle) {
            try {
              const handle = await firstItem.getAsFileSystemHandle();
              if (handle && handle.kind === 'directory') {
                await handleDirectoryHandle(handle);
                return;
              }
            } catch (err) {
              console.log("getAsFileSystemHandle fallback:", err);
            }
          }
          
          // webkitGetAsEntry fallback
          if (firstItem.webkitGetAsEntry) {
            const entry = firstItem.webkitGetAsEntry();
            if (entry && entry.isDirectory) {
              await readWebkitDirectoryEntry(entry);
              return;
            }
          }
        }

        // File drop fallback
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          const firstFile = files[0];
          if (firstFile.name.toLowerCase().endsWith('.zip')) {
            handleZipSelect(firstFile);
          } else {
            handleFolderSelect({ target: { files: files } });
          }
        }
      });
    }

    async function readWebkitDirectoryEntry(dirEntry) {
      showLoadingStatus(`Reading ${dirEntry.name}...`);
      const filesMap = {};
      const ignoredDirs = getIgnoredDirsSet();
      const MAX_DEPTH = 30;

      // Iterative directory reader reader with chunked readEntries and queue to prevent call-stack overflow
      async function readAllEntriesFromReader(dirReader) {
        const allEntries = [];
        while (true) {
          const chunk = await new Promise((resolve) => {
            dirReader.readEntries(
              (results) => resolve(results || []),
              () => resolve([])
            );
          });
          if (!chunk || chunk.length === 0) break;
          allEntries.push(...chunk);
        }
        return allEntries;
      }

      try {
        const queue = [{ entry: dirEntry, path: "", depth: 0 }];
        const visited = new Set();

        while (queue.length > 0) {
          const { entry, path, depth } = queue.shift();
          if (depth > MAX_DEPTH) continue;

          if (entry.isFile) {
            if (!isIgnoredFile(entry.name)) {
              await new Promise((resolve) => {
                entry.file(async (file) => {
                  if (file.size <= 3 * 1024 * 1024) {
                    try {
                      const text = await file.text();
                      const fullPath = path ? `${path}/${entry.name}` : entry.name;
                      filesMap[fullPath] = text;
                    } catch (e) {
                      console.warn(`Error reading ${entry.name}:`, e);
                    }
                  }
                  resolve();
                }, () => resolve());
              });
            }
          } else if (entry.isDirectory) {
            if (ignoredDirs.has(entry.name.toLowerCase())) continue;
            const nextPath = path ? `${path}/${entry.name}` : (path === "" && entry === dirEntry ? "" : entry.name);
            
            // Avoid loops on identical full path
            const visitedKey = (entry.fullPath || nextPath || entry.name).toLowerCase();
            if (visited.has(visitedKey)) continue;
            visited.add(visitedKey);

            if (depth + 1 <= MAX_DEPTH) {
              const dirReader = entry.createReader();
              const children = await readAllEntriesFromReader(dirReader);
              for (const child of children) {
                if (child.isDirectory && ignoredDirs.has(child.name.toLowerCase())) {
                  continue;
                }
                queue.push({ entry: child, path: nextPath, depth: depth + 1 });
              }
            }
          }
        }

        hideLoadingStatus();
        if (Object.keys(filesMap).length === 0) {
          alert("No supported code files found in dropped directory.");
          return;
        }
        buildClientSideAnalysis(dirEntry.name, filesMap);
      } catch (err) {
        hideLoadingStatus();
        console.error("Webkit dir read failed:", err);
        alert("Failed to read folder: " + err.message);
      }
    }

    // --- Client-Side Code Parsing & Analysis ---
    function detectLanguage(ext) {
      if (!ext) return 'Other';
      const cleanExt = ext.startsWith('.') ? ext.toLowerCase() : '.' + ext.toLowerCase();
      const map = {
        // Rust
        '.rs': 'Rust',
        
        // C & C++ (Distinct mapping and exact extension matching)
        '.cpp': 'C++',
        '.cxx': 'C++',
        '.cc': 'C++',
        '.c++': 'C++',
        '.cp': 'C++',
        '.hpp': 'C++',
        '.hxx': 'C++',
        '.hh': 'C++',
        '.h++': 'C++',
        '.inl': 'C++',
        '.ipp': 'C++',
        '.tpp': 'C++',
        '.c': 'C',
        '.h': 'C',
        
        // C#
        '.cs': 'C#',
        '.csx': 'C#',

        // Java / JVM
        '.java': 'Java',
        '.kt': 'Kotlin',
        '.kts': 'Kotlin',
        '.scala': 'Scala',
        '.sc': 'Scala',
        '.groovy': 'Groovy',
        '.gvy': 'Groovy',
        '.clj': 'Clojure',
        '.cljs': 'Clojure',

        // Apple Ecosystem
        '.swift': 'Swift',
        '.m': 'Objective-C',
        '.mm': 'Objective-C++',

        // Go
        '.go': 'Go',

        // Python
        '.py': 'Python',
        '.pyw': 'Python',
        '.pyx': 'Python',
        '.pxd': 'Python',
        '.ipynb': 'Jupyter Notebook',

        // TypeScript & JavaScript
        '.ts': 'TypeScript',
        '.tsx': 'TypeScript React',
        '.js': 'JavaScript',
        '.jsx': 'React JS',
        '.mjs': 'JavaScript',
        '.cjs': 'JavaScript',

        // Web Frameworks
        '.vue': 'Vue',
        '.svelte': 'Svelte',
        '.astro': 'Astro',

        // Web Markup & Styling
        '.html': 'HTML',
        '.htm': 'HTML',
        '.xhtml': 'HTML',
        '.css': 'CSS',
        '.scss': 'SCSS',
        '.sass': 'Sass',
        '.less': 'Less',
        '.styl': 'Stylus',

        // Backend Web / Scripting
        '.php': 'PHP',
        '.phtml': 'PHP',
        '.php4': 'PHP',
        '.php5': 'PHP',
        '.php7': 'PHP',
        '.rb': 'Ruby',
        '.erb': 'Ruby',
        '.rake': 'Ruby',
        '.gemspec': 'Ruby',
        '.lua': 'Lua',
        '.dart': 'Dart',
        '.pl': 'Perl',
        '.pm': 'Perl',
        '.r': 'R',
        '.jl': 'Julia',
        '.ex': 'Elixir',
        '.exs': 'Elixir',
        '.erl': 'Erlang',
        '.hrl': 'Erlang',
        '.hs': 'Haskell',
        '.lhs': 'Haskell',
        '.zig': 'Zig',
        '.nim': 'Nim',
        '.sol': 'Solidity',
        '.v': 'V',
        '.d': 'D',
        '.pas': 'Pascal',
        '.pp': 'Pascal',
        '.f': 'Fortran',
        '.f90': 'Fortran',
        '.f95': 'Fortran',
        '.asm': 'Assembly',
        '.s': 'Assembly',

        // Shell & Terminal Scripting
        '.sh': 'Shell',
        '.bash': 'Bash',
        '.zsh': 'Zsh',
        '.fish': 'Fish',
        '.ps1': 'PowerShell',
        '.psm1': 'PowerShell',
        '.psd1': 'PowerShell',
        '.bat': 'Batch',
        '.cmd': 'Batch',

        // Database & Query Languages
        '.sql': 'SQL',
        '.psql': 'SQL',
        '.mysql': 'SQL',
        '.prisma': 'Prisma',
        '.graphql': 'GraphQL',
        '.gql': 'GraphQL',

        // Data & Configuration Formats
        '.json': 'JSON',
        '.json5': 'JSON5',
        '.jsonc': 'JSON',
        '.toml': 'TOML',
        '.yaml': 'YAML',
        '.yml': 'YAML',
        '.xml': 'XML',
        '.svg': 'SVG',
        '.ini': 'INI',
        '.cfg': 'Config',
        '.conf': 'Config',
        '.config': 'Config',
        '.env': 'Env Config',
        '.properties': 'Properties',
        '.csv': 'CSV',
        '.tsv': 'TSV',

        // Documentation & Text
        '.md': 'Markdown',
        '.markdown': 'Markdown',
        '.mdown': 'Markdown',
        '.mkd': 'Markdown',
        '.mdx': 'MDX',
        '.rst': 'reStructuredText',
        '.txt': 'Text',
        '.pdf': 'PDF',
        '.adoc': 'AsciiDoc',

        // DevOps, Build & Cloud
        '.dockerfile': 'Dockerfile',
        'dockerfile': 'Dockerfile',
        '.tf': 'Terraform',
        '.tfvars': 'Terraform',
        '.proto': 'Protocol Buffers',
        '.wasm': 'WebAssembly',
        '.wat': 'WebAssembly'
      };
      return map[cleanExt] || 'Other';
    }

    const CODE_EXTENSIONS = new Set([
      '.rs', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.pyw', '.pyx', '.ipynb',
      '.go', '.c', '.cpp', '.cc', '.cxx', '.c++', '.cp', '.h', '.hpp', '.hxx', '.hh', '.h++',
      '.cs', '.csx', '.java', '.kt', '.kts', '.scala', '.sc', '.groovy', '.swift', '.m', '.mm',
      '.php', '.phtml', '.rb', '.erb', '.rake', '.lua', '.dart', '.sh', '.bash', '.zsh', '.fish',
      '.ps1', '.psm1', '.vue', '.svelte', '.astro', '.sql', '.prisma', '.graphql', '.gql',
      '.zig', '.nim', '.sol', '.ex', '.exs', '.erl', '.hs', '.jl', '.r', '.pl', '.pm',
      '.asm', '.s', '.proto', '.wasm', '.wat', '.v', '.d', '.pas', '.clj', '.cljs'
    ]);

    const PROGRAM_LOGIC_EXTENSIONS = new Set([
      '.rs', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go', '.c', '.cpp', '.cc', '.cxx',
      '.cs', '.java', '.kt', '.swift', '.php', '.rb', '.lua', '.dart', '.zig', '.nim', '.sol', '.ex', '.erl', '.hs'
    ]);

    const UI_TEMPLATE_EXTENSIONS = new Set([
      '.html', '.htm', '.vue', '.svelte', '.astro', '.jsx', '.tsx'
    ]);

    const NON_CODE_EXTENSIONS = new Set([
      '.md', '.markdown', '.mdown', '.mkd', '.mdx', '.rst', '.txt', '.adoc',
      '.json', '.json5', '.jsonc', '.toml', '.yaml', '.yml', '.xml',
      '.csv', '.tsv', '.lock', '.lockb', '.env', '.svg', '.css', '.scss', '.sass', '.less', '.styl',
      '.ini', '.cfg', '.conf', '.config', '.properties', '.log', '.map',
      '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.bmp', '.woff', '.woff2', '.ttf', '.eot'
    ]);

    function isCodeFile(filename) {
      if (!filename || typeof filename !== 'string') return false;
      const clean = filename.split('?')[0].split('#')[0];
      const lastDot = clean.lastIndexOf('.');
      if (lastDot === -1) return false;
      const ext = clean.substring(lastDot).toLowerCase();
      if (NON_CODE_EXTENSIONS.has(ext)) return false;
      return CODE_EXTENSIONS.has(ext);
    }

    function calculateComplexityWithTriggers(content) {
      if (!content) return { complexity: 1, triggers: [], isDataHeavy: false };
      const lines = content.split('\n');
      const triggers = [];
      const branchRules = [
        { type: 'if / else if', regex: /\b(if|else\s+if|elif)\b/g },
        { type: 'else', regex: /\belse\b/g },
        { type: 'match / switch', regex: /\b(match|switch)\b/g },
        { type: 'case', regex: /\bcase\b/g },
        { type: 'loop (for/while)', regex: /\b(for|while|loop)\b/g },
        { type: 'catch / except', regex: /\b(catch|except|try)\b/g },
        { type: 'ternary (?:)', regex: /(?<![a-zA-Z0-9_$])\?(?![?.a-zA-Z0-9_$])/g },
        { type: 'nullish (??)', regex: /\?\?/g },
        { type: 'logical AND (&&)', regex: /&&/g },
        { type: 'logical OR (||)', regex: /\|\|/g }
      ];

      let branchCount = 0;
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;
        branchRules.forEach(rule => {
          const matches = trimmed.match(rule.regex);
          if (matches) {
            branchCount += matches.length;
            triggers.push({
              line: idx + 1,
              type: rule.type,
              snippet: trimmed.substring(0, 100)
            });
          }
        });
      });

      const isDataHeavy = content.includes('STORE_ITEMS') || (lines.length > 150 && (content.split('{').length + content.split('[').length > 25) && (content.split('id:').length + content.split('"id"').length > 10));

      return {
        complexity: Math.max(1, branchCount + 1),
        triggers: triggers,
        isDataHeavy: isDataHeavy
      };
    }

    function calculateComplexity(content) {
      return calculateComplexityWithTriggers(content).complexity;
    }

    // --- Semantic Function Roles & Intent Categories ---
    const FUNCTION_CATEGORIES = {
      auth_security: {
        id: "auth_security",
        name: "Auth & Security",
        shortName: "Auth",
        icon: "🔐",
        color: "#ef4444",
        borderClass: "border-red-500/40 hover:border-red-400",
        bgClass: "bg-red-500/10",
        textClass: "text-red-400",
        badgeClass: "bg-red-500/20 text-red-300 border-red-500/40",
        keywords: ["auth", "login", "logout", "token", "jwt", "hash", "crypto", "permission", "verify", "sanitize", "password", "signature", "credential", "session", "oauth", "access", "protect"]
      },
      api_network: {
        id: "api_network",
        name: "API, Network & IPC",
        shortName: "API & IPC",
        icon: "📡",
        color: "#f97316",
        borderClass: "border-orange-500/40 hover:border-orange-400",
        bgClass: "bg-orange-500/10",
        textClass: "text-orange-400",
        badgeClass: "bg-orange-500/20 text-orange-300 border-orange-500/40",
        keywords: ["fetch", "request", "api", "endpoint", "webhook", "invoke", "command", "socket", "send", "post", "get", "listen", "rpc", "http", "ws", "msg", "route", "dispatch", "emit", "broadcast"]
      },
      data_state: {
        id: "data_state",
        name: "Data & State Management",
        shortName: "Data & State",
        icon: "🗄️",
        color: "#a855f7",
        borderClass: "border-purple-500/40 hover:border-purple-400",
        bgClass: "bg-purple-500/10",
        textClass: "text-purple-400",
        badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/40",
        keywords: ["save", "load", "db", "store", "cache", "persist", "update_state", "set_", "get_", "query", "delete", "insert", "sync", "commit", "find", "read", "write", "record", "state", "repo"]
      },
      ui_theme: {
        id: "ui_theme",
        name: "UI, Theme & Rendering",
        shortName: "UI & Theme",
        icon: "🎨",
        color: "#38bdf8",
        borderClass: "border-sky-500/40 hover:border-sky-400",
        bgClass: "bg-sky-500/10",
        textClass: "text-sky-400",
        badgeClass: "bg-sky-500/20 text-sky-300 border-sky-500/40",
        keywords: ["render", "draw", "theme", "modal", "view", "dom", "component", "animate", "toggle", "display", "click", "event", "dialog", "style", "paint", "toast", "badge", "inspector", "menu"]
      },
      core_logic: {
        id: "core_logic",
        name: "Core Logic & Computation",
        shortName: "Core Logic",
        icon: "⚙️",
        color: "#63B22F",
        borderClass: "border-[#63B22F]/40 hover:border-[#63B22F]",
        bgClass: "bg-[#63B22F]/10",
        textClass: "text-[#63B22F]",
        badgeClass: "bg-[#63B22F]/20 text-[#D9FF3D] border-[#63B22F]/40",
        keywords: ["calculate", "compute", "process", "transform", "parse", "validate", "execute", "resolve", "evaluate", "analyze", "scan", "aggregate", "build", "compile", "generate", "match", "filter"]
      },
      helpers_utils: {
        id: "helpers_utils",
        name: "Helpers & Utilities",
        shortName: "Helpers & Util",
        icon: "🛠️",
        color: "#eab308",
        borderClass: "border-yellow-500/40 hover:border-yellow-400",
        bgClass: "bg-yellow-500/10",
        textClass: "text-yellow-400",
        badgeClass: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
        keywords: ["format", "convert", "helper", "util", "debounce", "throttle", "sleep", "clamp", "escape", "clean", "truncate", "clone", "merge", "normalize", "slug", "random", "delay"]
      },
      lifecycle_setup: {
        id: "lifecycle_setup",
        name: "Lifecycle & Setup",
        shortName: "Lifecycle",
        icon: "🧪",
        color: "#ec4899",
        borderClass: "border-pink-500/40 hover:border-pink-400",
        bgClass: "bg-pink-500/10",
        textClass: "text-pink-400",
        badgeClass: "bg-pink-500/20 text-pink-300 border-pink-500/40",
        keywords: ["init", "setup", "mount", "destroy", "cleanup", "constructor", "start", "stop", "boot", "dispose", "teardown", "reset", "open", "close", "bind", "unbind", "listen"]
      }
    };

    function categorizeFunction(fnName) {
      if (!fnName) return FUNCTION_CATEGORIES.helpers_utils;
      const clean = fnName.replace(/^(fn|def|func)\s+|\(\)$/g, '').trim();
      const s1 = clean.replace(/(.)([A-Z][a-z]+)/g, '$1_$2');
      const normalized = s1.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
      const tokens = new Set(normalized.split(/[^a-z0-9]+/).filter(Boolean));

      let bestCat = null;
      let bestScore = 0;

      for (const [catId, catInfo] of Object.entries(FUNCTION_CATEGORIES)) {
        let score = 0;
        for (const kw of catInfo.keywords) {
          if (tokens.has(kw)) {
            score += 3;
          } else if (normalized.startsWith(kw) || normalized.endsWith(kw)) {
            score += 2;
          } else if (normalized.includes(kw)) {
            score += 1;
          }
        }
        if (score > bestScore) {
          bestScore = score;
          bestCat = catInfo;
        }
      }

      return bestCat && bestScore > 0 ? bestCat : FUNCTION_CATEGORIES.helpers_utils;
    }

    function extractSymbols(content, lang, path = '') {
      const symbols = [];
      if (!content) return symbols;
      if (path && !isCodeFile(path)) return symbols;
      const normLang = (lang || '').toLowerCase();
      if (normLang.includes('markdown') || normLang === 'md' || normLang.includes('text') || normLang.includes('json') || normLang.includes('toml') || normLang.includes('yaml') || normLang.includes('xml')) {
        return symbols;
      }
      const lines = content.split('\n');

      lines.forEach((line, lineIdx) => {
        const trimmed = line.trim();
        const lineNum = lineIdx + 1;

        if (normLang.includes('rust') || normLang === 'rs') {
          const fnMatch = trimmed.match(/(?:pub\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)/);
          if (fnMatch) {
            const cat = categorizeFunction(fnMatch[1]);
            symbols.push({ name: `fn ${fnMatch[1]}()`, rawName: fnMatch[1], type: 'Function', categoryId: cat.id, categoryName: cat.name, icon: cat.icon, color: cat.color, line: lineNum });
          }
          const structMatch = trimmed.match(/(?:pub\s+)?(?:struct|enum|trait|type)\s+([a-zA-Z0-9_]+)/);
          if (structMatch) symbols.push({ name: `type ${structMatch[1]}`, rawName: structMatch[1], type: 'Type', line: lineNum });
        } else if (normLang.includes('typescript') || normLang.includes('javascript') || normLang === 'ts' || normLang === 'js') {
          const fnMatch = trimmed.match(/(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)/) ||
                          trimmed.match(/(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\(/);
          if (fnMatch) {
            const cat = categorizeFunction(fnMatch[1]);
            symbols.push({ name: `fn ${fnMatch[1]}()`, rawName: fnMatch[1], type: 'Function', categoryId: cat.id, categoryName: cat.name, icon: cat.icon, color: cat.color, line: lineNum });
          }
          const classMatch = trimmed.match(/(?:export\s+)?(?:class|interface|type)\s+([a-zA-Z0-9_]+)/);
          if (classMatch) symbols.push({ name: `type ${classMatch[1]}`, rawName: classMatch[1], type: 'Type', line: lineNum });
        } else if (normLang.includes('python') || normLang === 'py') {
          const fnMatch = trimmed.match(/^def\s+([a-zA-Z0-9_]+)/);
          if (fnMatch) {
            const cat = categorizeFunction(fnMatch[1]);
            symbols.push({ name: `def ${fnMatch[1]}()`, rawName: fnMatch[1], type: 'Function', categoryId: cat.id, categoryName: cat.name, icon: cat.icon, color: cat.color, line: lineNum });
          }
          const classMatch = trimmed.match(/^class\s+([a-zA-Z0-9_]+)/);
          if (classMatch) symbols.push({ name: `class ${classMatch[1]}`, rawName: classMatch[1], type: 'Type', line: lineNum });
        } else if (normLang.includes('go')) {
          const fnMatch = trimmed.match(/^func\s+(?:\([^)]+\)\s+)?([a-zA-Z0-9_]+)/);
          if (fnMatch) {
            const cat = categorizeFunction(fnMatch[1]);
            symbols.push({ name: `func ${fnMatch[1]}()`, rawName: fnMatch[1], type: 'Function', categoryId: cat.id, categoryName: cat.name, icon: cat.icon, color: cat.color, line: lineNum });
          }
          const typeMatch = trimmed.match(/^type\s+([a-zA-Z0-9_]+)\s+(?:struct|interface)/);
          if (typeMatch) symbols.push({ name: `type ${typeMatch[1]}`, rawName: typeMatch[1], type: 'Type', line: lineNum });
        } else if (normLang.includes('c') || normLang.includes('cpp')) {
          const fnMatch = trimmed.match(/(?:[a-zA-Z0-9_:]+\s+)+([a-zA-Z0-9_]+)\s*\([^)]*\)\s*\{/);
          if (fnMatch && !['if', 'for', 'while', 'switch', 'catch'].includes(fnMatch[1])) {
            const cat = categorizeFunction(fnMatch[1]);
            symbols.push({ name: `fn ${fnMatch[1]}()`, rawName: fnMatch[1], type: 'Function', categoryId: cat.id, categoryName: cat.name, icon: cat.icon, color: cat.color, line: lineNum });
          }
          const classMatch = trimmed.match(/(?:class|struct|enum)\s+([a-zA-Z0-9_]+)/);
          if (classMatch) symbols.push({ name: `type ${classMatch[1]}`, rawName: classMatch[1], type: 'Type', line: lineNum });
        }
      });

      return symbols.slice(0, 30);
    }

    function extractApis(path, content, lang) {
      const apis = [];
      if (!content) return apis;
      if (path && !isCodeFile(path)) return apis;
      const normLang = (lang || '').toLowerCase();
      if (normLang.includes('markdown') || normLang === 'md' || normLang.includes('text') || normLang.includes('json') || normLang.includes('toml') || normLang.includes('yaml') || normLang.includes('xml')) {
        return apis;
      }

      const EXCLUDED_CALLERS = new Set([
        'params', 'searchparams', 'urlparams', 'queryparams', 'headers', 'reqheaders', 'resheaders',
        'map', 'this', 'self', 'dict', 'data', 'store', 'cache', 'config', 'settings', 'options', 'opt',
        'env', 'formdata', 'props', 'state', 'row', 'record', 'node', 'schema', 'doc', 'query', 'args',
        'cookies', 'form', 'payload', 'body', 'ctx', 'context', 'localstorage', 'sessionstorage',
        'req', 'res', 'response', 'request', 'meta', 'attributes', 'attrs', 'values', 'json_data', 'session',
        'usermap'
      ]);

      const lines = content.split('\n');
      const seenRoutes = new Set();

      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        const lineNum = idx + 1;
        if (!trimmed || (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || (trimmed.startsWith('#') && !trimmed.startsWith('#[')))) {
          return;
        }

        // 1. Tauri Commands (Rust)
        if (trimmed.includes('#[tauri::command]') || trimmed.includes('#[command]')) {
          let fnMatch = trimmed.match(/(?:pub(?:\([^\)]+\))?\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)/);
          let targetLine = lineNum;
          if (!fnMatch && idx + 1 < lines.length) {
            const nextLine = lines[idx + 1].trim();
            fnMatch = nextLine.match(/(?:pub(?:\([^\)]+\))?\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)/);
            if (fnMatch) targetLine = lineNum + 1;
          }
          if (fnMatch) {
            const cmdName = fnMatch[1];
            const key = `Tauri IPC:${cmdName}:${targetLine}`;
            if (!seenRoutes.has(key)) {
              seenRoutes.add(key);
              apis.push({
                protocol: 'Tauri IPC',
                name: cmdName,
                endpoint: cmdName,
                method: 'IPC',
                handler: cmdName,
                path: path,
                type: 'Command',
                line: targetLine
              });
            }
          }
        }

        // 2. Tauri Frontend Invoke
        const invokeMatches = [...trimmed.matchAll(/invoke(?:<[^>]+>)?\(\s*["']([^"']+)["']/g)];
        invokeMatches.forEach(invMatch => {
          const cmdName = invMatch[1];
          const key = `Tauri Invoke:${cmdName}:${lineNum}`;
          if (!seenRoutes.has(key)) {
            seenRoutes.add(key);
            apis.push({
              protocol: 'Tauri Invoke',
              name: cmdName,
              endpoint: cmdName,
              method: 'INVOKE',
              handler: cmdName,
              path: path,
              type: 'Client Call',
              line: lineNum
            });
          }
        });

        // 3. Rust Actix / Rocket / Poem / Axum annotations & routes
        const rustMacroMatch = trimmed.match(/#\[(get|post|put|delete|patch|head|options)\s*\(\s*["'](\/[^"']*)["']\s*\)\]/i);
        if (rustMacroMatch) {
          const method = rustMacroMatch[1].toUpperCase();
          const endpoint = rustMacroMatch[2];
          const name = `${method} ${endpoint}`;
          const key = `REST API:${name}:${lineNum}`;
          if (!seenRoutes.has(key)) {
            seenRoutes.add(key);
            apis.push({
              protocol: 'REST API',
              name: name,
              endpoint: endpoint,
              method: method,
              handler: path,
              path: path,
              type: 'Route',
              line: lineNum
            });
          }
        }

        const rustRouteAttrMatch = trimmed.match(/#\[route\s*\(\s*["'](\/[^"']*)["']\s*,\s*method\s*=\s*["']([A-Z]+)["']\s*\)\]/i);
        if (rustRouteAttrMatch) {
          const endpoint = rustRouteAttrMatch[1];
          const method = rustRouteAttrMatch[2].toUpperCase();
          const name = `${method} ${endpoint}`;
          const key = `REST API:${name}:${lineNum}`;
          if (!seenRoutes.has(key)) {
            seenRoutes.add(key);
            apis.push({
              protocol: 'REST API',
              name: name,
              endpoint: endpoint,
              method: method,
              handler: path,
              path: path,
              type: 'Route',
              line: lineNum
            });
          }
        }

        const axumRouteMatch = trimmed.match(/\.route\s*\(\s*["'](\/[^"']*)["']\s*,\s*(get|post|put|delete|patch|options|head)\s*\(/i);
        if (axumRouteMatch) {
          const endpoint = axumRouteMatch[1];
          const method = axumRouteMatch[2].toUpperCase();
          const name = `${method} ${endpoint}`;
          const key = `REST API:${name}:${lineNum}`;
          if (!seenRoutes.has(key)) {
            seenRoutes.add(key);
            apis.push({
              protocol: 'REST API',
              name: name,
              endpoint: endpoint,
              method: method,
              handler: path,
              path: path,
              type: 'Route',
              line: lineNum
            });
          }
        }

        // 4. Rust Reqwest calls
        const reqwestMatches = [...trimmed.matchAll(/reqwest::(?:Client::new\(\)\.)?(get|post|put|delete|patch)\s*\(\s*["'](\/[^"']*|https?:\/\/[^"']*)["']/gi)];
        reqwestMatches.forEach(m => {
          const method = m[1].toUpperCase();
          const endpoint = m[2];
          const name = `${method} ${endpoint}`;
          const key = `HTTP Client:${name}:${lineNum}`;
          if (!seenRoutes.has(key)) {
            seenRoutes.add(key);
            apis.push({
              protocol: 'HTTP Client',
              name: name,
              endpoint: endpoint,
              method: method,
              handler: path,
              path: path,
              type: 'Client Call',
              line: lineNum
            });
          }
        });

        // 5. Rust web_sys
        const webSysMatch = trimmed.match(/(?:web_sys::)?Request::new_with_str\s*\(\s*["'](\/[^"']*|https?:\/\/[^"']*)["']/i);
        if (webSysMatch) {
          const endpoint = webSysMatch[1];
          const name = `REQUEST ${endpoint}`;
          const key = `HTTP Client:${name}:${lineNum}`;
          if (!seenRoutes.has(key)) {
            seenRoutes.add(key);
            apis.push({
              protocol: 'HTTP Client',
              name: name,
              endpoint: endpoint,
              method: 'REQUEST',
              handler: path,
              path: path,
              type: 'Client Call',
              line: lineNum
            });
          }
        }

        // 6. Python FastAPI / Flask / Bottle decorators
        const pyDecMatch = trimmed.match(/@(?:app|router|api|bp|blueprint|server|v1|v2)\.(get|post|put|delete|patch|options|head)\s*\(\s*["'](\/[^"']*)["']/i);
        if (pyDecMatch) {
          const method = pyDecMatch[1].toUpperCase();
          const endpoint = pyDecMatch[2];
          const name = `${method} ${endpoint}`;
          const key = `REST API:${name}:${lineNum}`;
          if (!seenRoutes.has(key)) {
            seenRoutes.add(key);
            apis.push({
              protocol: 'REST API',
              name: name,
              endpoint: endpoint,
              method: method,
              handler: path,
              path: path,
              type: 'Route',
              line: lineNum
            });
          }
        }

        const pyRouteDecMatch = trimmed.match(/@(?:app|router|api|bp|blueprint)\.route\s*\(\s*["'](\/[^"']*)["'](?:\s*,\s*methods\s*=\s*\[([^\]]+)\])?/i);
        if (pyRouteDecMatch) {
          const endpoint = pyRouteDecMatch[1];
          const methodsRaw = pyRouteDecMatch[2];
          const methods = methodsRaw ? methodsRaw.split(',').map(m => m.replace(/['"\s]/g, '').toUpperCase()).filter(Boolean) : ['GET'];
          methods.forEach(method => {
            const name = `${method} ${endpoint}`;
            const key = `REST API:${name}:${lineNum}`;
            if (!seenRoutes.has(key)) {
              seenRoutes.add(key);
              apis.push({
                protocol: 'REST API',
                name: name,
                endpoint: endpoint,
                method: method,
                handler: path,
                path: path,
                type: 'Route',
                line: lineNum
              });
            }
          });
        }

        // 7. JS / TS Router / Client calls (Express, Fastify, Hono, Axios, Requests, etc.)
        const jsRouterMatches = [...trimmed.matchAll(/(?:^|[^\w$.])(app|router|server|api|apiClient|client|axios|http|requests|httpx)\.(get|post|put|delete|patch|head|options)\s*\(\s*[`"'](\/[^`"']*|https?:\/\/[^`"']+)[`"']/gi)];
        jsRouterMatches.forEach(m => {
          const caller = m[1].toLowerCase();
          const method = m[2].toUpperCase();
          const endpoint = m[3];

          if (EXCLUDED_CALLERS.has(caller)) return;
          if (!endpoint.startsWith('/') && !endpoint.startsWith('http://') && !endpoint.startsWith('https://')) return;

          const isClient = ['axios', 'http', 'requests', 'httpx', 'client', 'apiclient'].includes(caller);
          const protocol = isClient ? 'HTTP Client' : `HTTP ${method}`;
          const name = `${method} ${endpoint}`;
          const key = `${protocol}:${name}:${lineNum}`;
          if (!seenRoutes.has(key)) {
            seenRoutes.add(key);
            apis.push({
              protocol: protocol,
              name: name,
              endpoint: endpoint,
              method: method,
              handler: path,
              path: path,
              type: isClient ? 'Client Call' : 'Route',
              line: lineNum
            });
          }
        });

        // 8. Fetch calls
        const fetchMatches = [...trimmed.matchAll(/(?:^|[^\w$.])fetch\s*\(\s*[`"'](\/[^`"']*|https?:\/\/[^`"']+)[`"']/gi)];
        fetchMatches.forEach(m => {
          const endpoint = m[1];
          if (!endpoint.startsWith('/') && !endpoint.startsWith('http://') && !endpoint.startsWith('https://')) return;
          const name = `FETCH ${endpoint}`;
          const key = `HTTP Client:${name}:${lineNum}`;
          if (!seenRoutes.has(key)) {
            seenRoutes.add(key);
            apis.push({
              protocol: 'HTTP Client',
              name: name,
              endpoint: endpoint,
              method: 'FETCH',
              handler: path,
              path: path,
              type: 'Client Call',
              line: lineNum
            });
          }
        });

        // 9. NestJS Decorators
        const nestMatches = [...trimmed.matchAll(/@(Get|Post|Put|Delete|Patch|Options|Head|All)\s*\(\s*[`"']([^`"']*)[`"']\s*\)/g)];
        nestMatches.forEach(m => {
          const method = m[1].toUpperCase();
          let endpoint = m[2].trim();
          if (!endpoint.startsWith('/')) endpoint = `/${endpoint}`;
          const name = `${method} ${endpoint}`;
          const key = `REST API:${name}:${lineNum}`;
          if (!seenRoutes.has(key)) {
            seenRoutes.add(key);
            apis.push({
              protocol: `HTTP ${method}`,
              name: name,
              endpoint: endpoint,
              method: method,
              handler: path,
              path: path,
              type: 'Route',
              line: lineNum
            });
          }
        });
      });

      return apis;
    }

    function buildClientSideAnalysis(projectName, filesMap) {
      const paths = Object.keys(filesMap).sort();
      let totalLines = 0;
      let totalCode = 0;
      let totalComments = 0;
      let totalBlanks = 0;
      let highComplexityCount = 0;
      let totalComplexity = 0;
      let totalCodeFiles = 0;
      const langMap = {};
      const fileTree = { name: "root", type: "directory", children: {} };
      const allApis = [];
      const alerts = [];
      const modulesByDir = {};

      paths.forEach(p => {
        const content = filesMap[p];
        const linesArr = content.split('\n');
        const linesCount = linesArr.length;
        
        let fileComments = 0;
        let fileBlanks = 0;
        let fileCode = 0;

        linesArr.forEach(l => {
          const trimmed = l.trim();
          if (!trimmed) fileBlanks++;
          else if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*')) fileComments++;
          else fileCode++;
        });

        const isCode = isCodeFile(p);
        const isDoc = !isCode;

        if (appSettings.excludeDocs && isDoc) {
          // Exclude documentation and config files from code metrics
          totalLines += linesCount;
        } else {
          totalLines += linesCount;
          totalCode += fileCode;
          totalComments += fileComments;
          totalBlanks += fileBlanks;
        }

        const ext = p.substring(p.lastIndexOf('.'));
        const lang = detectLanguage(ext);
        langMap[lang] = (langMap[lang] || 0) + linesCount;

        const complexityThreshold = Number(appSettings.complexityThreshold) || 20;
        const compRes = isCode ? calculateComplexityWithTriggers(content) : { complexity: 0, triggers: [], isDataHeavy: false };
        const complexity = compRes.complexity;

        if (isCode) {
          totalCodeFiles++;
          totalComplexity += complexity;
          if (complexity > complexityThreshold) {
            highComplexityCount++;
            const tip = (compRes.isDataHeavy || content.includes('STORE_ITEMS'))
              ? '💡 Tipp: Reine Daten-Objekte (wie STORE_ITEMS) können als separate .json-Datei ausgelagert werden, um Code und Daten sauber zu trennen.'
              : '';
            alerts.push({
              level: complexity > (complexityThreshold * 1.8) ? 'danger' : 'warning',
              title: `High Cyclomatic Complexity (${complexity})`,
              path: p,
              description: `File has numerous branching conditions (${complexity} > threshold ${complexityThreshold}). Consider modular refactoring.`,
              complexity: complexity,
              triggers: compRes.triggers.slice(0, 20),
              total_triggers: compRes.triggers.length,
              refactoring_tip: tip
            });
          } else if (compRes.isDataHeavy) {
            alerts.push({
              level: 'info',
              title: `Data-Heavy Module Pattern`,
              path: p,
              description: `Large inline data structures detected in source code.`,
              refactoring_tip: '💡 Tipp: Reine Daten-Objekte (wie STORE_ITEMS) können als separate .json-Datei ausgelagert werden, um Code und Daten sauber zu trennen.'
            });
          }
        }

        const cleanPath = p.split('?')[0].split('#')[0];
        const lastDotIdx = cleanPath.lastIndexOf('.');
        const fileExt = lastDotIdx !== -1 ? cleanPath.substring(lastDotIdx).toLowerCase() : '';

        if (PROGRAM_LOGIC_EXTENSIONS.has(fileExt) && linesCount > 400) {
          alerts.push({
            level: 'warning',
            title: `Large Module Size (${linesCount} LOC)`,
            path: p,
            description: `File exceeds recommended 400 LOC threshold for maintainability. Consider modular refactoring.`
          });
        } else if (UI_TEMPLATE_EXTENSIONS.has(fileExt) && linesCount > 800) {
          alerts.push({
            level: 'warning',
            title: `Large UI Template (${linesCount} LOC)`,
            path: p,
            description: `UI template exceeds 800 LOC. Consider breaking down into modular sub-components.`
          });
        }

        // Extract Symbols & APIs strictly only for real source code files
        const symbols = isCode ? extractSymbols(content, lang, p) : [];
        const apis = isCode ? extractApis(p, content, lang) : [];
        apis.forEach(a => allApis.push(a));

        // Build File Tree
        const parts = p.split(/[\/\\]/);
        let curr = fileTree;
        parts.forEach((part, idx) => {
          if (idx === parts.length - 1) {
            curr.children[part] = {
              name: part,
              type: "file",
              path: p,
              language: lang,
              lines: linesCount,
              complexity: complexity,
              symbols: symbols
            };
          } else {
            curr.children[part] = curr.children[part] || { name: part, type: "directory", children: {} };
            curr = curr.children[part];
          }
        });
      });

      // Compute Health Score
      const avgComplexity = totalCodeFiles ? Math.round((totalComplexity / totalCodeFiles) * 10) / 10 : 0;
      const penalty = Math.min(45, (highComplexityCount * 6) + (alerts.length * 2));
      const healthScore = Math.max(55, 100 - penalty);

      if (alerts.length === 0) {
        alerts.push({
          level: 'info',
          title: 'Clean Architecture Pattern',
          path: projectName,
          description: 'No critical complexity hotspots or oversized files detected.'
        });
      }

      // Build N-Depth Mindmap Hierarchy (Iterative & Cycle-Safe)
      function convertFileTreeToMindmap(treeNode, currentPath = '') {
        if (!treeNode || !treeNode.children) return [];
        const rootResult = [];
        const visited = new Set();
        
        const stack = [{
          node: treeNode,
          currentPath: currentPath,
          targetArray: rootResult
        }];
        
        while (stack.length > 0) {
          const current = stack[stack.length - 1];
          
          if (!current.itemsToProcess) {
            if (visited.has(current.node)) {
              stack.pop();
              continue;
            }
            visited.add(current.node);
            
            const keys = Object.keys(current.node.children || {}).sort((a, b) => {
              const itemA = current.node.children[a];
              const itemB = current.node.children[b];
              if (itemA.type !== itemB.type) {
                return itemA.type === 'directory' ? -1 : 1;
              }
              return a.localeCompare(b);
            });
            
            current.itemsToProcess = keys.map(k => current.node.children[k]);
            current.idx = 0;
          }
          
          if (current.idx < current.itemsToProcess.length) {
            const item = current.itemsToProcess[current.idx++];
            const fullPath = current.currentPath ? `${current.currentPath}/${item.name}` : item.name;
            
            if (item.type === 'directory') {
              const dirObj = {
                id: `dir_${fullPath}`,
                name: item.name,
                path: fullPath,
                category: "Directory",
                nodeType: "layer",
                children: []
              };
              current.targetArray.push(dirObj);
              stack.push({
                node: item,
                currentPath: fullPath,
                targetArray: dirObj.children
              });
            } else {
              const syms = (item.symbols || []).map(s => ({
                id: `${item.path}#${s.name}`,
                name: s.name,
                path: item.path,
                category: s.type,
                type: s.type,
                line: s.line
              }));
              current.targetArray.push({
                id: item.path,
                name: item.name,
                path: item.path,
                category: "Component",
                nodeType: "file",
                children: syms
              });
            }
          } else {
            stack.pop();
          }
        }
        
        return rootResult;
      }

      const mindmapChildren = convertFileTreeToMindmap(fileTree);

      const analysis = {
        project_name: projectName,
        summary: {
          total_files: paths.length,
          total_lines: totalLines,
          code_lines: totalCode,
          comment_lines: totalComments,
          blank_lines: totalBlanks,
          avg_complexity: avgComplexity,
          languages: langMap
        },
        file_tree: fileTree,
        mindmap: {
          id: "root",
          name: projectName,
          category: "Project Architecture",
          children: mindmapChildren
        },
        risk_radar: {
          health_score: healthScore,
          metrics: {
            high_complexity_files: highComplexityCount,
            large_files: alerts.filter(a => a.title.includes('Large Module') || a.title.includes('Large UI Template')).length,
            low_documentation_files: 0
          },
          alerts: alerts
        },
        api_catalog: allApis,
        file_contents: filesMap
      };

      ingestAnalysisData(analysis);
    }

    // --- Ingest Data & Render Components (Alias to centralized renderAnalyzedCodebase) ---
    window._internalIngestAnalysisData = renderAnalyzedCodebase;
    if (window.__pendingAnalysisData) {
      const _pData = window.__pendingAnalysisData;
      window.__pendingAnalysisData = null;
      renderAnalyzedCodebase(_pData);
    }

    // --- Risk & Health Radar / Analysis Renderer ---
    function renderRiskAnalysis(riskRadarData, fullData) {
      const radar = riskRadarData || currentData?.risk_radar || {};
      const data = fullData || currentData || {};

      const healthDisplay = document.getElementById('healthScoreDisplay');
      if (healthDisplay) {
        healthDisplay.innerText = `${radar.health_score ?? 90} / 100`;
      }

      const compDisplay = document.getElementById('highComplexityDisplay');
      if (compDisplay) {
        compDisplay.innerText = radar.metrics?.high_complexity_files ?? 0;
      }

      const alertsContainer = document.getElementById('riskAlertsContainer');
      if (!alertsContainer) return;

      const alertsList = radar.alerts || [];
      if (alertsList.length === 0) {
        alertsContainer.innerHTML = '<div class="text-xs text-zinc-500">No critical risks identified.</div>';
        return;
      }

      alertsContainer.innerHTML = alertsList.map((a, alertIdx) => {
        const alertId = `risk-alert-${alertIdx}`;
        const isComplexity = (a.title || '').includes('Cyclomatic Complexity');
        
        // Triggers list from alert or fallback to file analysis
        let triggers = a.triggers || [];
        if ((!triggers || triggers.length === 0) && isComplexity && data.file_contents?.[a.path] && typeof calculateComplexityWithTriggers === 'function') {
          const res = calculateComplexityWithTriggers(data.file_contents[a.path]);
          triggers = res.triggers;
        }
        const hasTriggers = triggers && triggers.length > 0;
        const hasTip = !!a.refactoring_tip;

        return `
          <div class="rounded-lg bg-brand-dark border border-brand-border overflow-hidden transition hover:border-brand-orange/60">
            <div class="p-3.5 flex items-start space-x-3">
              <i data-lucide="${a.level === 'danger' ? 'alert-octagon' : (a.level === 'info' ? 'info' : 'alert-triangle')}" class="w-4 h-4 ${a.level === 'danger' ? 'text-rose-500' : (a.level === 'info' ? 'text-sky-400' : 'text-brand-orange')} mt-0.5 flex-shrink-0"></i>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-2 flex-wrap">
                  <div class="text-xs font-semibold text-white flex items-center gap-2">
                    <span>${escapeHtml(a.title || '')}</span>
                    <span class="text-zinc-500 font-mono text-[11px] hover:text-brand-orange cursor-pointer" onclick="openFileInViewer('${escapeJsString(a.path || '')}')">${escapeHtml(a.path || '')}</span>
                  </div>
                  <div class="flex items-center space-x-2">
                    <button onclick="openFileInViewer('${escapeJsString(a.path || '')}')" class="px-2 py-0.5 rounded bg-brand-card hover:bg-brand-orange hover:text-black text-brand-orange border border-brand-orange/40 text-[10px] font-mono transition cursor-pointer">
                      Datei öffnen ↗
                    </button>
                    ${hasTriggers ? `
                      <button onclick="toggleRiskAlertTriggers('${alertId}')" class="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-300 border border-brand-border text-[10px] font-mono transition flex items-center space-x-1 cursor-pointer">
                        <span>${triggers.length} Fundstellen</span>
                        <span id="${alertId}-arrow" class="text-[9px]">▾</span>
                      </button>
                    ` : ''}
                  </div>
                </div>
                <div class="text-xs text-zinc-400 mt-1">${escapeHtml(a.description || '')}</div>

                ${hasTip ? `
                  <div class="mt-2 p-2 rounded bg-[#63B22F]/10 border border-[#63B22F]/40 text-[#D9FF3D] text-[11px] font-mono flex items-start space-x-2">
                    <span class="text-xs">💡</span>
                    <span class="text-zinc-200">${escapeHtml(a.refactoring_tip)}</span>
                  </div>
                ` : ''}
              </div>
            </div>

            ${hasTriggers ? `
              <div id="${alertId}-triggers" class="hidden border-t border-brand-border/60 bg-black/40 p-2.5 space-y-1.5">
                <div class="text-[10px] font-mono uppercase text-zinc-400 font-semibold flex items-center justify-between">
                  <span>Erfasste Verzweigungs-Fundstellen (${triggers.length})</span>
                  <span class="text-[9px] text-zinc-500">Klick auf Zeile öffnet Code-Viewer</span>
                </div>
                <div class="space-y-1 max-h-48 overflow-y-auto pr-1 custom-scrollbar text-[11px] font-mono">
                  ${triggers.slice(0, 20).map(tr => `
                    <div class="p-1.5 rounded bg-brand-dark/80 border border-brand-border/80 hover:border-brand-orange/50 transition flex items-center justify-between gap-2 group">
                      <div class="truncate flex-1 min-w-0">
                        <div class="flex items-center space-x-1.5">
                          <span class="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-400 font-bold">${escapeHtml(tr.type || '')}</span>
                          <span class="text-[10px] text-zinc-400 font-mono">Z. ${tr.line}</span>
                        </div>
                        <div class="text-[10px] text-zinc-300 font-mono truncate mt-0.5" title="${escapeHtml(tr.snippet || '')}">${escapeHtml(tr.snippet || '')}</div>
                      </div>
                      <button onclick="openFileInViewer('${escapeJsString(a.path || '')}', null, ${tr.line})" class="px-2 py-1 rounded bg-brand-card hover:bg-brand-orange hover:text-black text-brand-orange border border-brand-orange/40 text-[10px] font-mono font-semibold flex items-center space-x-1 flex-shrink-0 transition cursor-pointer shadow-sm">
                        <span>📍 Zu Zeile ${tr.line} springen</span>
                      </button>
                    </div>
                  `).join('')}
                  ${triggers.length > 20 ? `<div class="text-[10px] text-zinc-500 text-center pt-1">+ ${triggers.length - 20} weitere Fundstellen</div>` : ''}
                </div>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
      
      if (window.lucide && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
      }
    }

    function renderRiskRadar(riskRadarData, fullData) {
      return renderRiskAnalysis(riskRadarData, fullData);
    }
    window.renderRiskAnalysis = renderRiskAnalysis;
    window.renderRiskRadar = renderRiskRadar;

    // --- API Catalog Renderer ---
    function renderApiCatalog(catalogData) {
      const catalog = catalogData || currentData?.api_catalog || [];
      const countBadge = document.getElementById('apiCountBadge');
      if (countBadge) {
        countBadge.innerText = `${catalog.length} endpoints`;
      }
      
      const apiBody = document.getElementById('apiCatalogTableBody');
      if (!apiBody) return;

      apiBody.innerHTML = catalog.map(item => {
        const lineParam = item.line ? item.line : 'null';
        const displayPath = item.path + (item.line ? `:${item.line}` : '');
        return `
          <tr class="hover:bg-brand-dark/50 transition">
            <td class="py-2.5 px-4"><span class="px-2 py-0.5 rounded bg-brand-orange/20 text-brand-orange text-[10px] font-bold">${escapeHtml(item.protocol || '')}</span></td>
            <td class="py-2.5 px-4 font-semibold text-white">${escapeHtml(item.name || '')}</td>
            <td class="py-2.5 px-4 text-zinc-400 cursor-pointer hover:text-brand-orange font-mono text-xs" onclick="openFileInViewer('${escapeJsString(item.path || '')}', null, ${lineParam})">
              ${escapeHtml(displayPath)} ↗
            </td>
          </tr>
        `;
      }).join('') || '<tr><td colspan="3" class="py-4 text-center text-zinc-500">No public API endpoints detected.</td></tr>';
    }

    function toggleRiskAlertTriggers(alertId) {
      const container = document.getElementById(`${alertId}-triggers`);
      const arrow = document.getElementById(`${alertId}-arrow`);
      if (!container) return;
      if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        if (arrow) arrow.innerText = '▴';
      } else {
        container.classList.add('hidden');
        if (arrow) arrow.innerText = '▾';
      }
    }

    // --- VSCode Style File Icons & Folders ---
    const folderExpandedState = new Map();

    function getFileIconInfo(filename) {
      const lower = (filename || '').toLowerCase();
      const ext = lower.includes('.') ? lower.substring(lower.lastIndexOf('.')) : '';

      if (lower === 'dockerfile' || lower.startsWith('dockerfile.')) return { icon: 'container', color: '#2496ED', emoji: '🐳' };
      if (lower === 'makefile') return { icon: 'file-cog', color: '#f59e0b', emoji: '⚙️' };
      if (lower.endsWith('.lock') || lower.endsWith('.lockb')) return { icon: 'lock', color: '#71717a', emoji: '🔒' };
      if (lower.startsWith('.env')) return { icon: 'key', color: '#0060AC', emoji: '🔑' };
      if (lower.startsWith('.git')) return { icon: 'git-branch', color: '#F05138', emoji: '🌿' };

      switch (ext) {
        // Rust
        case '.rs':
          return { icon: 'cpu', color: '#FF8000', emoji: '🦀' };
        // TypeScript & React
        case '.ts':
          return { icon: 'file-code-2', color: '#3178C6', emoji: '🔷' };
        case '.tsx':
          return { icon: 'file-code-2', color: '#38BDF8', emoji: '⚛️' };
        // JavaScript
        case '.js':
        case '.mjs':
        case '.cjs':
          return { icon: 'file-code', color: '#F59E0B', emoji: '🟨' };
        case '.jsx':
          return { icon: 'file-code', color: '#61DAFB', emoji: '⚛️' };
        // Python
        case '.py':
        case '.pyw':
        case '.pyx':
          return { icon: 'file-code-2', color: '#3572A5', emoji: '🐍' };
        case '.ipynb':
          return { icon: 'file-code-2', color: '#DA5B0B', emoji: '📓' };
        // C & C++ (Fixed: Distinct C++ from CSS!)
        case '.cpp':
        case '.cc':
        case '.cxx':
        case '.c++':
        case '.cp':
        case '.hpp':
        case '.hxx':
        case '.hh':
        case '.h++':
        case '.inl':
        case '.ipp':
        case '.tpp':
          return { icon: 'file-code', color: '#00599C', emoji: '⚡' };
        case '.c':
        case '.h':
          return { icon: 'file-code', color: '#555555', emoji: '🇨' };
        // C#
        case '.cs':
        case '.csx':
          return { icon: 'file-code', color: '#178600', emoji: '🎯' };
        // Java & JVM
        case '.java':
          return { icon: 'coffee', color: '#B07219', emoji: '☕' };
        case '.kt':
        case '.kts':
          return { icon: 'file-code', color: '#A97BFF', emoji: '🟣' };
        case '.scala':
        case '.sc':
          return { icon: 'file-code', color: '#DC322F', emoji: '🔴' };
        // Apple / Swift
        case '.swift':
          return { icon: 'file-code', color: '#F05138', emoji: '🕊️' };
        // Go
        case '.go':
          return { icon: 'file-code-2', color: '#00ADD8', emoji: '🐹' };
        // PHP
        case '.php':
        case '.phtml':
          return { icon: 'file-code', color: '#4F5D95', emoji: '🐘' };
        // Ruby
        case '.rb':
        case '.erb':
        case '.rake':
          return { icon: 'file-code', color: '#CC342D', emoji: '💎' };
        // Web Components
        case '.vue':
          return { icon: 'file-code', color: '#41B883', emoji: '💚' };
        case '.svelte':
          return { icon: 'file-code', color: '#FF3E00', emoji: '🧡' };
        case '.astro':
          return { icon: 'file-code', color: '#FF5D01', emoji: '🚀' };
        // HTML & Styling
        case '.html':
        case '.htm':
        case '.xhtml':
          return { icon: 'globe', color: '#E34F26', emoji: '🌐' };
        case '.css':
          return { icon: 'palette', color: '#563D7C', emoji: '🎨' };
        case '.scss':
        case '.sass':
          return { icon: 'palette', color: '#EC4899', emoji: '💅' };
        case '.less':
        case '.styl':
          return { icon: 'palette', color: '#1D365D', emoji: '🎨' };
        // Shell & Terminal
        case '.sh':
        case '.bash':
        case '.zsh':
          return { icon: 'terminal', color: '#89E051', emoji: '🐚' };
        case '.ps1':
        case '.psm1':
        case '.psd1':
          return { icon: 'terminal', color: '#012456', emoji: '💻' };
        case '.bat':
        case '.cmd':
          return { icon: 'terminal', color: '#C1F12E', emoji: '⚙️' };
        // Database & Query
        case '.sql':
        case '.psql':
        case '.mysql':
          return { icon: 'database', color: '#E38C00', emoji: '🗄️' };
        case '.prisma':
          return { icon: 'database', color: '#2D3748', emoji: '🔺' };
        case '.graphql':
        case '.gql':
          return { icon: 'database', color: '#E10098', emoji: '🕸️' };
        // Data & Config
        case '.json':
        case '.json5':
        case '.jsonc':
          return { icon: 'file-json', color: '#CBCB41', emoji: '📋' };
        case '.toml':
          return { icon: 'settings', color: '#9C4221', emoji: '📐' };
        case '.yaml':
        case '.yml':
          return { icon: 'settings', color: '#CB171E', emoji: '📝' };
        case '.xml':
          return { icon: 'file-code', color: '#0060AC', emoji: '📑' };
        case '.svg':
          return { icon: 'image', color: '#FFB13B', emoji: '🖼️' };
        case '.ini':
        case '.conf':
        case '.config':
        case '.properties':
          return { icon: 'settings', color: '#6E7681', emoji: '⚙️' };
        // Docs & Markdown
        case '.md':
        case '.markdown':
        case '.mdx':
          return { icon: 'file-text', color: '#94A3B8', emoji: '📝' };
        // Other Languages
        case '.dart':
          return { icon: 'file-code', color: '#00B4AB', emoji: '🎯' };
        case '.zig':
          return { icon: 'file-code', color: '#F7A41D', emoji: '⚡' };
        case '.lua':
          return { icon: 'file-code', color: '#000080', emoji: '🌙' };
        case '.sol':
          return { icon: 'file-code', color: '#AA6746', emoji: '⛓️' };
        case '.ex':
        case '.exs':
          return { icon: 'file-code', color: '#6E4A7E', emoji: '💧' };
        case '.tf':
        case '.tfvars':
          return { icon: 'container', color: '#7B42BC', emoji: '☁️' };
        default:
          return { icon: 'file', color: '#a1a1aa', emoji: '📄' };
      }
    }

    // --- File Tree Renderer ---
    function renderFileTree(treeNode) {
      const node = treeNode || currentData?.file_tree;
      const container = document.getElementById('fileTreeContainer');
      if (!container) return;
      container.innerHTML = '';
      if (!node) return;

      let folderCounter = 0;

      function buildTreeHTML(rootNode) {
        if (!rootNode || !rootNode.children) return '';
        const visited = new Set();
        
        const stack = [{
          node: rootNode,
          depth: 0,
          currentPath: '',
          chunks: []
        }];
        
        while (stack.length > 0) {
          const current = stack[stack.length - 1];
          
          if (!current.itemsToProcess) {
            if (visited.has(current.node)) {
              stack.pop();
              continue;
            }
            visited.add(current.node);
            
            const keys = Object.keys(current.node.children || {}).sort((a, b) => {
              const itemA = current.node.children[a];
              const itemB = current.node.children[b];
              if (itemA.type !== itemB.type) {
                return itemA.type === 'directory' ? -1 : 1;
              }
              return a.localeCompare(b);
            });
            
            current.itemsToProcess = keys.map(k => current.node.children[k]);
            current.idx = 0;
          }
          
          if (current.idx < current.itemsToProcess.length) {
            const item = current.itemsToProcess[current.idx++];
            const padding = current.depth * 14 + 6;
            const nodePath = current.currentPath ? `${current.currentPath}/${item.name}` : item.name;
            
            if (item.type === 'directory') {
              const folderId = `folder-node-${++folderCounter}`;
              if (!folderExpandedState.has(folderId)) {
                folderExpandedState.set(folderId, false); // Folded / collapsed by default
              }
              const isExpanded = folderExpandedState.get(folderId);
              
              const openHtml = `
                <div class="folder-group mb-0.5">
                  <div onclick="toggleFolder('${folderId}')" data-folder-id="${folderId}" class="folder-row flex items-center space-x-1.5 py-1 px-2 hover:bg-white/5 rounded cursor-pointer text-zinc-300 hover:text-white font-medium transition select-none group" style="padding-left: ${padding}px">
                    <span class="chevron-icon text-[10px] text-zinc-500 group-hover:text-brand-orange w-3.5 flex items-center justify-center transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}">▶</span>
                    <span class="folder-icon text-xs">${isExpanded ? '📂' : '📁'}</span>
                    <span class="truncate text-[11px]">${item.name}</span>
                  </div>
                  <div id="${folderId}-children" class="folder-children ${isExpanded ? '' : 'hidden'}">`;
                  
              const closeHtml = `
                  </div>
                </div>
              `;
              
              current.chunks.push(openHtml);
              
              const childFrame = {
                node: item,
                depth: current.depth + 1,
                currentPath: nodePath,
                chunks: [],
                parentFrame: current,
                closeHtml: closeHtml
              };
              stack.push(childFrame);
            } else {
              const isCurrent = activeFile === item.path || (activeFile && (activeFile === nodePath || activeFile.endsWith('/' + item.name)));
              const iconInfo = getFileIconInfo(item.name);
              const activeClasses = isCurrent 
                ? 'bg-white/10 text-brand-orange font-semibold border-l-2 border-brand-orange shadow-sm' 
                : 'text-zinc-400 hover:text-white hover:bg-white/5 border-l-2 border-transparent';

              const fileHtml = `
                <div data-filepath="${item.path || nodePath}" onclick="openFileInViewer('${item.path || nodePath}')" class="file-tree-node flex items-center space-x-1.5 py-1 px-2 rounded cursor-pointer transition select-none ${activeClasses}" style="padding-left: ${padding}px" title="${item.path || nodePath}">
                  <span class="file-emoji text-xs flex-shrink-0">${iconInfo.emoji}</span>
                  <span class="truncate text-[11px]">${item.name}</span>
                </div>
              `;
              current.chunks.push(fileHtml);
            }
          } else {
            const finishedFrame = stack.pop();
            const finishedHtml = finishedFrame.chunks.join('');
            if (finishedFrame.parentFrame) {
              finishedFrame.parentFrame.chunks.push(finishedHtml);
              finishedFrame.parentFrame.chunks.push(finishedFrame.closeHtml);
            } else {
              return finishedHtml;
            }
          }
        }
        return '';
      }

      container.innerHTML = buildTreeHTML(treeNode);
      lucide.createIcons();
    }

    function toggleFolder(folderId) {
      const childrenEl = document.getElementById(`${folderId}-children`);
      const rowEl = document.querySelector(`[data-folder-id="${folderId}"]`);
      if (!childrenEl || !rowEl) return;

      const isHidden = childrenEl.classList.contains('hidden');
      if (isHidden) {
        childrenEl.classList.remove('hidden');
        folderExpandedState.set(folderId, true);
        const chevron = rowEl.querySelector('.chevron-icon');
        if (chevron) chevron.classList.add('rotate-90');
        const folderIcon = rowEl.querySelector('.folder-icon');
        if (folderIcon) folderIcon.innerText = '📂';
      } else {
        childrenEl.classList.add('hidden');
        folderExpandedState.set(folderId, false);
        const chevron = rowEl.querySelector('.chevron-icon');
        if (chevron) chevron.classList.remove('rotate-90');
        const folderIcon = rowEl.querySelector('.folder-icon');
        if (folderIcon) folderIcon.innerText = '📁';
      }
    }

    function collapseAllFolders() {
      document.querySelectorAll('.folder-children').forEach(el => {
        el.classList.add('hidden');
      });
      document.querySelectorAll('.folder-row').forEach(row => {
        const folderId = row.getAttribute('data-folder-id');
        if (folderId) folderExpandedState.set(folderId, false);
        const chevron = row.querySelector('.chevron-icon');
        if (chevron) chevron.classList.remove('rotate-90');
        const folderIcon = row.querySelector('.folder-icon');
        if (folderIcon) folderIcon.innerText = '📁';
      });
    }

    function expandAllFolders() {
      document.querySelectorAll('.folder-children').forEach(el => {
        el.classList.remove('hidden');
      });
      document.querySelectorAll('.folder-row').forEach(row => {
        const folderId = row.getAttribute('data-folder-id');
        if (folderId) folderExpandedState.set(folderId, true);
        const chevron = row.querySelector('.chevron-icon');
        if (chevron) chevron.classList.add('rotate-90');
        const folderIcon = row.querySelector('.folder-icon');
        if (folderIcon) folderIcon.innerText = '📂';
      });
    }

    function toggleMainNavBar(expand) {
      const nav = document.getElementById('mainNavBar');
      const expandBtn = document.getElementById('btnExpandNavBar');
      if (!nav) return;
      
      const shouldExpand = (typeof expand === 'boolean') ? expand : (nav.classList.contains('w-0') || nav.classList.contains('hidden'));
      
      if (shouldExpand) {
        nav.classList.remove('w-0', 'border-r-0', 'p-0', 'py-0', 'opacity-0', 'pointer-events-none');
        nav.classList.add('w-16', 'border-r', 'py-4');
        if (expandBtn) expandBtn.classList.add('hidden');
      } else {
        nav.classList.remove('w-16', 'border-r', 'py-4');
        nav.classList.add('w-0', 'border-r-0', 'p-0', 'py-0', 'opacity-0', 'pointer-events-none');
        if (expandBtn) expandBtn.classList.remove('hidden');
      }
      
      if (window.lucide) {
        lucide.createIcons();
      }
    }

    function toggleExplorerSidebar(expand) {
      const sidebar = document.getElementById('explorerSidebar');
      const expandBtn = document.getElementById('btnExpandExplorer');
      if (!sidebar) return;
      
      const shouldExpand = (typeof expand === 'boolean') ? expand : (sidebar.classList.contains('w-0') || sidebar.classList.contains('hidden'));
      
      if (shouldExpand) {
        sidebar.classList.remove('w-0', 'border-r-0', 'opacity-0', 'pointer-events-none');
        sidebar.classList.add('w-72', 'border-r');
        if (expandBtn) expandBtn.classList.add('hidden');
      } else {
        sidebar.classList.remove('w-72', 'border-r');
        sidebar.classList.add('w-0', 'border-r-0', 'opacity-0', 'pointer-events-none');
        if (expandBtn) expandBtn.classList.remove('hidden');
      }
      
      if (window.lucide) {
        lucide.createIcons();
      }
    }



    // =========================================================================
    // INTENT-FUNKTIONS-KLASSIFIZIERUNG & SEMANTISCHE ROLLEN
    // =========================================================================
    const INTENT_ROLES_CONFIG = {
      Auth: { id: "Auth", name: "Auth & Security", icon: "🔐", color: "#ef4444", keywords: ["auth", "login", "logout", "token", "jwt", "session", "password", "permission", "role", "authenticate", "authorize", "hash_password", "verify_token", "oauth", "credential", "security", "protect", "secret", "crypto_key"] },
      API: { id: "API", name: "API & Commands", icon: "⚡", color: "#38bdf8", keywords: ["api", "route", "endpoint", "command", "ipc", "http", "fetch", "request", "post", "get", "put", "delete", "handler", "controller", "serve", "listen", "webhook", "router", "client", "response", "emit", "tauri"] },
      Data: { id: "Data", name: "Data & State", icon: "🗄️", color: "#a855f7", keywords: ["store", "state", "db", "database", "sql", "sqlite", "postgres", "model", "schema", "entity", "repo", "repository", "query", "persist", "cache", "migration", "save", "load", "fetch_data", "insert", "update", "delete_record", "redis", "table"] },
      UI: { id: "UI", name: "UI & Presentation", icon: "🎨", color: "#ff8000", keywords: ["render", "view", "component", "button", "modal", "dialog", "drawer", "input", "form", "layout", "template", "screen", "page", "widget", "toast", "menu", "sidebar", "navbar", "css", "style", "theme", "html", "dom", "jsx", "tsx", "display", "draw", "canvas", "animate", "bubble"] },
      Core: { id: "Core", name: "Core & Business Logic", icon: "⚙️", color: "#63b22f", keywords: ["engine", "process", "execute", "run", "calculate", "compute", "parse", "transform", "analyze", "evaluate", "dispatch", "orchestrate", "aggregate", "compile", "generate", "validate", "pipeline", "service", "domain", "strategy", "algorithm", "worker"] },
      Utils: { id: "Utils", name: "Utils & Helpers", icon: "🛠️", color: "#eab308", keywords: ["util", "helper", "format", "convert", "sanitize", "escape", "clean", "truncate", "debounce", "throttle", "sleep", "clamp", "normalize", "random", "hash", "string", "date", "math", "slug", "pad", "diff", "clone", "merge"] },
      Lifecycle: { id: "Lifecycle", name: "Lifecycle & Setup", icon: "🧪", color: "#ec4899", keywords: ["init", "setup", "start", "stop", "boot", "mount", "unmount", "destroy", "cleanup", "dispose", "teardown", "constructor", "reset", "open", "close", "bind", "unbind", "hook", "signal", "main", "entry", "register", "unregister"] }
    };

    function categorizeFunctionIntentJs(fnName) {
      if (!fnName) return INTENT_ROLES_CONFIG.Utils;
      const clean = fnName.replace(/^(fn|def|func)\s+|\(\)$/g, '').trim();
      const s1 = clean.replace(/(.)([A-Z][a-z]+)/g, '$1_$2');
      const normalized = s1.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
      const tokens = normalized.split(/[^a-z0-9]+/);

      let bestRole = "Utils";
      let bestScore = 0;

      for (const [rKey, rDef] of Object.entries(INTENT_ROLES_CONFIG)) {
        let score = 0;
        for (const kw of rDef.keywords) {
          if (tokens.includes(kw)) score += 3;
          else if (normalized.startsWith(kw) || normalized.endsWith(kw)) score += 2;
          else if (normalized.includes(kw)) score += 1;
        }
        if (score > bestScore) {
          bestScore = score;
          bestRole = rKey;
        }
      }
      return INTENT_ROLES_CONFIG[bestRole];
    }

    function detectFileIntentRoleJs(path, content, symbols) {
      const breakdown = { Auth: 0, API: 0, Data: 0, UI: 0, Core: 0, Utils: 0, Lifecycle: 0 };
      if (symbols && symbols.functions) {
        symbols.functions.forEach(fn => {
          const r = categorizeFunctionIntentJs(fn);
          breakdown[r.id] = (breakdown[r.id] || 0) + 1;
        });
      }

      let dominant = "Core";
      let maxCount = 0;
      for (const [rId, cnt] of Object.entries(breakdown)) {
        if (cnt > maxCount) {
          maxCount = cnt;
          dominant = rId;
        }
      }

      if (maxCount === 0) {
        const lowerP = (path || '').toLowerCase();
        if (['auth', 'session', 'login', 'jwt', 'token', 'secret'].some(k => lowerP.includes(k))) dominant = "Auth";
        else if (['api', 'route', 'endpoint', 'ipc', 'command', 'http', 'client'].some(k => lowerP.includes(k))) dominant = "API";
        else if (['db', 'store', 'state', 'schema', 'model', 'sql', 'entity', 'repo'].some(k => lowerP.includes(k))) dominant = "Data";
        else if (['ui', 'view', 'component', 'page', 'style', 'css', 'html', 'jsx', 'tsx'].some(k => lowerP.includes(k))) dominant = "UI";
        else if (['init', 'setup', 'boot', 'mount', 'main'].some(k => lowerP.includes(k))) dominant = "Lifecycle";
        else if (['util', 'helper', 'format', 'tool', 'convert'].some(k => lowerP.includes(k))) dominant = "Utils";
        else dominant = isCodeFile(path) ? "Core" : "Utils";
      }

      return { dominantRole: dominant, breakdown };
    }

    // =========================================================================
    // SHA-256 HASHING & INKREMENTELLES DIFF-CACHING
    // =========================================================================
    async function calculateSHA256(text, prefix = "") {
      const full = prefix + "\n" + (text || "");
      try {
        if (window.crypto && window.crypto.subtle) {
          const msgBuffer = new TextEncoder().encode(full);
          const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }
      } catch (e) {}

      // Fast fallback hash
      let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
      for (let i = 0; i < full.length; i++) {
        const ch = full.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
      }
      h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
      h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
      return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, '0');
    }

    function createModuleBatchesJs(fileList, batchSize = 6) {
      const dirGroups = {};
      fileList.forEach(f => {
        const p = f.path;
        const parts = p.split('/');
        let groupKey = parts.length > 1 ? parts[0] : 'root';
        if (parts.length > 2) groupKey = `${parts[0]}/${parts[1]}`;
        if (!dirGroups[groupKey]) dirGroups[groupKey] = [];
        dirGroups[groupKey].append ? dirGroups[groupKey].append(f) : dirGroups[groupKey].push(f);
      });

      const batches = [];
      let chunkIdx = 1;

      for (const [groupName, files] of Object.entries(dirGroups)) {
        for (let i = 0; i < files.length; i += batchSize) {
          const sliceFiles = files.slice(i, i + batchSize);
          const batchId = `batch_${chunkIdx}_${groupName.replace(/[^a-zA-Z0-9_]/g, '_')}`;
          batches.push({
            batch_id: batchId,
            module_name: groupName,
            file_count: sliceFiles.length,
            files: sliceFiles.map(f => f.path),
            file_hashes: Object.fromEntries(sliceFiles.map(f => [f.path, f.sha256 || ''])),
            total_loc: sliceFiles.reduce((acc, f) => acc + (f.code_lines || f.total_lines || 0), 0),
            intent_roles: Array.from(new Set(sliceFiles.map(f => f.intent_role || 'Core')))
          });
          chunkIdx++;
        }
      }
      return batches;
    }

    // =========================================================================
    // GESTAFFELTE KI-BATCH-PIPELINE & LIVE-HUD
    // =========================================================================
    let aiBatchState = {
      running: false,
      paused: false,
      aborted: false,
      currentIndex: 0,
      batches: [],
      cache: {},
      deltaStats: { cached: 0, scanned: 0, total: 0 },
      intentCounts: { Auth: 0, API: 0, Data: 0, UI: 0, Core: 0, Utils: 0, Lifecycle: 0 },
      bubbleInterval: null
    };

    function openGlobalAIScanHUD() {
      if (!currentData) {
        alert("Bitte lade zuerst eine Codebase oder ein Demo-Repo.");
        return;
      }

      const modal = document.getElementById('globalAIScanHUDModal');
      const projLabel = document.getElementById('hudTargetProject');
      const modelBadge = document.getElementById('hudModelBadge');

      const fileCount = Object.keys(currentData.file_contents || {}).length;
      if (projLabel) projLabel.innerText = `Ziel-Projekt: ${currentData.project_name || 'Codebase'} (${fileCount} Dateien)`;
      if (modelBadge) modelBadge.innerText = appSettings.llmModel || 'local-model';

      if (modal) modal.classList.remove('hidden');
      lucide.createIcons();
    }

    function closeGlobalAIScanHUD() {
      const modal = document.getElementById('globalAIScanHUDModal');
      if (modal) modal.classList.add('hidden');
      if (aiBatchState.bubbleInterval) {
        clearInterval(aiBatchState.bubbleInterval);
        aiBatchState.bubbleInterval = null;
      }
    }

    async function runGlobalAIScanHUDExecution() {
      if (!currentData) return;
      await startStagedAIBatchPipeline();
    }

    async function startStagedAIBatchPipeline() {
      const allFiles = Object.keys(currentData.file_contents || {});
      if (allFiles.length === 0) return;

      const fileObjList = allFiles.map(p => {
        const content = currentData.file_contents[p] || '';
        const cachedMeta = currentData.files?.[p] || {};
        const intentInfo = detectFileIntentRoleJs(p, content, cachedMeta.symbols);
        return {
          path: p,
          content: content,
          language: cachedMeta.language || getLanguageFromPath(p),
          total_lines: content.split('\n').length,
          code_lines: cachedMeta.code_lines || content.split('\n').length,
          complexity: cachedMeta.complexity || calculateComplexity(content),
          intent_role: intentInfo.dominantRole,
          intent_breakdown: intentInfo.breakdown,
          sha256: cachedMeta.sha256 || ''
        };
      });

      // Compute SHA-256 for each file asynchronously
      for (const f of fileObjList) {
        if (!f.sha256) {
          f.sha256 = await calculateSHA256(f.content, f.path);
        }
      }

      // Check Cache for 0ms skip (localStorage & in-memory)
      const loadedCache = {};
      let cachedCount = 0;
      fileObjList.forEach(f => {
        const cacheKey = `codebase_file_cache_${f.sha256}`;
        const stored = localStorage.getItem(cacheKey);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            loadedCache[f.path] = parsed;
            cachedCount++;
          } catch (e) {}
        }
      });

      const batches = createModuleBatchesJs(fileObjList, appSettings.llmBatchSize || 6);

      aiBatchState = {
        running: true,
        paused: false,
        aborted: false,
        currentIndex: 0,
        batches: batches,
        fileObjects: fileObjList,
        cache: loadedCache,
        deltaStats: {
          cached: cachedCount,
          scanned: fileObjList.length - cachedCount,
          total: fileObjList.length
        },
        intentCounts: { Auth: 0, API: 0, Data: 0, UI: 0, Core: 0, Utils: 0, Lifecycle: 0 },
        bubbleInterval: null
      };

      // Aggregate live intent counts
      fileObjList.forEach(f => {
        const r = f.intent_role || 'Core';
        aiBatchState.intentCounts[r] = (aiBatchState.intentCounts[r] || 0) + 1;
      });

      // Update UI HUD
      const liveStatusBadge = document.getElementById('hudLiveStatusBadge');
      const restartBtn = document.getElementById('hudRestartBtn');
      const pauseBtn = document.getElementById('hudPauseBtn');
      const abortBtn = document.getElementById('hudAbortBtn');
      const deltaBadge = document.getElementById('hudDeltaBadge');
      const errorBox = document.getElementById('hudErrorBox');
      const scannedListEl = document.getElementById('hudScannedModulesList');
      const finalReportSec = document.getElementById('hudFinalReportSection');

      if (restartBtn) restartBtn.disabled = true;
      if (pauseBtn) { pauseBtn.classList.remove('hidden'); pauseBtn.innerText = '⏸️ Pause'; }
      if (abortBtn) abortBtn.classList.remove('hidden');
      if (errorBox) errorBox.classList.add('hidden');
      if (finalReportSec) finalReportSec.classList.add('hidden');
      if (scannedListEl) scannedListEl.innerHTML = '';

      if (liveStatusBadge) {
        liveStatusBadge.innerText = 'GESTAGELTER BATCH-SCAN LÄUFT...';
        liveStatusBadge.setAttribute('class', 'text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse font-bold');
      }

      if (deltaBadge) {
        deltaBadge.classList.remove('hidden');
        deltaBadge.innerText = `⚡ ${cachedCount} Cache-Hits (0ms) • ${fileObjList.length - cachedCount} Delta-Scans`;
      }

      updateHUDIntentBadges();

      const thoughtContainer = document.getElementById('hudThoughtBubblesContainer');
      const thoughts = [
        "🧠 Parsing Datei-Hierarchien & Module...",
        "⚡ Analysiere IPC-Kommandos & Endpunkte...",
        "🛡️ Prüfe Memory Safety & Rust Concurrency...",
        "📊 Berechne Cyclomatic Complexity & Hotspots...",
        "💾 Evaluiere State Management & Persistenz...",
        "💡 Synthetisiere Intent-Rollen & Architektur..."
      ];

      let tIdx = 0;
      if (aiBatchState.bubbleInterval) clearInterval(aiBatchState.bubbleInterval);
      aiBatchState.bubbleInterval = setInterval(() => {
        if (thoughtContainer && aiBatchState.running && !aiBatchState.paused) {
          tIdx = (tIdx + 1) % thoughts.length;
          thoughtContainer.innerHTML = `
            <div class="thought-bubble px-3 py-1.5 rounded-full bg-brand-dark/95 border border-brand-orange text-brand-orange text-xs font-mono shadow-[0_0_15px_rgba(255,128,0,0.4)] flex items-center space-x-1.5">
              <span>${thoughts[tIdx]}</span>
            </div>
          `;
        }
      }, 2200);

      runAIBatchExecutionLoop();
    }

    async function runAIBatchExecutionLoop() {
      const progressBar = document.getElementById('hudProgressBar');
      const progressPercent = document.getElementById('hudProgressPercent');
      const currentModuleEl = document.getElementById('hudCurrentScanningModule');
      const scannedListEl = document.getElementById('hudScannedModulesList');
      const scannedCountEl = document.getElementById('hudScannedCount');
      const batchCounterEl = document.getElementById('hudBatchCounter');
      const liveReportEl = document.getElementById('hudLiveReportContent');
      const totalBatches = aiBatchState.batches.length;

      while (aiBatchState.running && aiBatchState.currentIndex < totalBatches) {
        if (aiBatchState.aborted) break;
        if (aiBatchState.paused) {
          await new Promise(r => setTimeout(r, 400));
          continue;
        }

        const bIdx = aiBatchState.currentIndex;
        const batch = aiBatchState.batches[bIdx];
        const percent = Math.round(((bIdx) / totalBatches) * 85);

        if (progressBar) progressBar.style.width = `${percent}%`;
        if (progressPercent) progressPercent.innerText = `${percent}%`;
        if (batchCounterEl) batchCounterEl.innerText = `Batch ${bIdx + 1} / ${totalBatches}`;
        if (currentModuleEl) currentModuleEl.innerText = `Analysiere Modul: ${batch.module_name} (${batch.file_count} Dateien, ${batch.total_loc} LOC)...`;

        // Check if all files in this batch are already cached
        const allBatchFilesCached = batch.files.every(p => !!aiBatchState.cache[p]);
        let batchResult = null;

        if (allBatchFilesCached) {
          // 0ms instant skip!
          batchResult = {
            module_summary: `Modul '${batch.module_name}' aus Cache (0ms) geladen.`,
            intent_critique: "Inkrementeller Cache-Snapshot verifiziert.",
            risks: [],
            quality_score: 95,
            cached: true
          };
        } else {
          // Query Local LLM with Retry Logic
          batchResult = await callLocalLLMBatchWithRetries(batch, currentData.project_name || 'Codebase');

          // Save files in cache
          batch.files.forEach(p => {
            const fObj = aiBatchState.fileObjects.find(f => f.path === p);
            if (fObj && fObj.sha256) {
              const cacheEntry = {
                path: p,
                sha256: fObj.sha256,
                intent_role: fObj.intent_role,
                module_name: batch.module_name,
                timestamp: new Date().toISOString()
              };
              aiBatchState.cache[p] = cacheEntry;
              try {
                localStorage.setItem(`codebase_file_cache_${fObj.sha256}`, JSON.stringify(cacheEntry));
              } catch (e) {}
            }
          });
        }

        // Add to scanned modules log UI
        if (scannedListEl) {
          const item = document.createElement('div');
          item.setAttribute('class', 'flex items-center justify-between p-1.5 rounded bg-brand-card/90 border border-brand-border/60 text-zinc-300');
          const isCached = batchResult.cached ? '⚡ 0ms' : '🧠 LLM';
          item.innerHTML = `
            <span class="truncate max-w-[150px]">✓ ${batch.module_name}</span>
            <span class="text-[9px] uppercase px-1 py-0.2 rounded bg-brand-dark text-brand-orange">${isCached}</span>
          `;
          scannedListEl.appendChild(item);
          scannedListEl.scrollTop = scannedListEl.scrollHeight;
        }

        if (scannedCountEl) scannedCountEl.innerText = `${bIdx + 1} / ${totalBatches}`;
        if (liveReportEl && batchResult.module_summary) {
          liveReportEl.innerText = `[Batch ${bIdx + 1}/${totalBatches} - ${batch.module_name}]\n${batchResult.module_summary}\n\n• Intent-Rollen: ${batch.intent_roles.join(', ')}\n• Bewertung: ${batchResult.intent_critique || 'Modular und kohärent.'}`;
        }

        aiBatchState.currentIndex++;
        await new Promise(r => setTimeout(r, 60));
      }

      if (aiBatchState.aborted) return;
      finishAIBatchScan();
    }

    async function callLocalLLMBatchWithRetries(batch, projectName) {
      const maxRetries = 3;
      const endpoint = appSettings.llmEndpoint || "http://127.0.0.1:8084/v1/chat/completions";
      const model = appSettings.llmModel || "local-model";

      const prompt = `Analysiere dieses Codebase-Modul:\nProjekt: ${projectName}\nModul: ${batch.module_name}\nDateien: ${batch.files.join(', ')}\nLOC: ${batch.total_loc}\nIntent-Rollen: ${batch.intent_roles.join(', ')}\n\nAntworte zwingend in reinem JSON mit Schema:\n{"module_summary": "...", "intent_critique": "...", "risks": ["..."], "quality_score": 90}`;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        if (aiBatchState.aborted) break;
        while (aiBatchState.paused) {
          await new Promise(r => setTimeout(r, 400));
          if (aiBatchState.aborted) break;
        }
        if (aiBatchState.aborted) break;

        try {
          const resp = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: model,
              messages: [
                { role: "system", content: "Du bist ein Senior Software Architekt. Antworte ausschließlich mit reinem, validem JSON." },
                { role: "user", content: prompt }
              ],
              temperature: 0.2,
              response_format: { type: "json_object" }
            })
          });

          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const res = await resp.json();
          const contentStr = res.choices?.[0]?.message?.content || "";
          try {
            return JSON.parse(contentStr);
          } catch (e) {
            const m = contentStr.match(/\{[\s\S]*\}/);
            if (m) return JSON.parse(m[0]);
            throw new Error("Invalid JSON response format");
          }
        } catch (err) {
          console.warn(`Batch ${batch.batch_id} Versuch ${attempt}/${maxRetries} fehlgeschlagen:`, err.message);
          if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, 400 * attempt));
          }
        }
      }

      // Fallback Heuristic Synthesis (never hard crash!)
      return synthesizeFallbackBatchJs(batch);
    }

    function synthesizeFallbackBatchJs(batch) {
      return {
        module_summary: `Modul '${batch.module_name}' mit ${batch.file_count} Dateien und ${batch.total_loc} LOC.`,
        intent_critique: `Gekapselte Verantwortlichkeiten mit Intent-Rollen: ${batch.intent_roles.join(', ')}.`,
        risks: ["Unit-Tests für Randfälle und Error-Mapping ausbauen"],
        quality_score: 90,
        fallback: true
      };
    }

    function updateHUDIntentBadges() {
      const container = document.getElementById('hudIntentBadges');
      if (!container) return;
      const counts = aiBatchState.intentCounts;
      container.innerHTML = `
        <span class="px-2 py-0.5 rounded bg-red-950/40 border border-red-500/40 text-red-400 text-[10px]">🔐 Auth: ${counts.Auth || 0}</span>
        <span class="px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-500/40 text-cyan-400 text-[10px]">⚡ API: ${counts.API || 0}</span>
        <span class="px-2 py-0.5 rounded bg-purple-950/40 border border-purple-500/40 text-purple-400 text-[10px]">🗄️ Data: ${counts.Data || 0}</span>
        <span class="px-2 py-0.5 rounded bg-orange-950/40 border border-orange-500/40 text-orange-400 text-[10px]">🎨 UI: ${counts.UI || 0}</span>
        <span class="px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/40 text-emerald-400 text-[10px]">⚙️ Core: ${counts.Core || 0}</span>
        <span class="px-2 py-0.5 rounded bg-yellow-950/40 border border-yellow-500/40 text-yellow-400 text-[10px]">🛠️ Utils: ${counts.Utils || 0}</span>
        <span class="px-2 py-0.5 rounded bg-pink-950/40 border border-pink-500/40 text-pink-400 text-[10px]">🧪 Lifecycle: ${counts.Lifecycle || 0}</span>
      `;
    }

    function togglePauseAIScanHUD() {
      const btn = document.getElementById('hudPauseBtn');
      if (aiBatchState.paused) {
        aiBatchState.paused = false;
        if (btn) btn.innerText = '⏸️ Pause';
      } else {
        aiBatchState.paused = true;
        if (btn) btn.innerText = '▶️ Fortsetzen';
      }
    }

    function cancelAIScanHUD(continueAsQuick = false) {
      aiBatchState.aborted = true;
      aiBatchState.running = false;
      if (aiBatchState.bubbleInterval) clearInterval(aiBatchState.bubbleInterval);
      if (continueAsQuick) {
        finishAIBatchScan();
      } else {
        closeGlobalAIScanHUD();
      }
    }

    function retryAIScanHUD() {
      const errorBox = document.getElementById('hudErrorBox');
      if (errorBox) errorBox.classList.add('hidden');
      aiBatchState.aborted = false;
      aiBatchState.running = true;
      runAIBatchExecutionLoop();
    }

    async function finishAIBatchScan() {
      aiBatchState.running = false;
      if (aiBatchState.bubbleInterval) {
        clearInterval(aiBatchState.bubbleInterval);
        aiBatchState.bubbleInterval = null;
      }

      const progressBar = document.getElementById('hudProgressBar');
      const progressPercent = document.getElementById('hudProgressPercent');
      const currentModuleEl = document.getElementById('hudCurrentScanningModule');
      const liveReportEl = document.getElementById('hudLiveReportContent');
      const finalReportSec = document.getElementById('hudFinalReportSection');
      const archSummaryEl = document.getElementById('hudArchSummary');
      const riskSummaryEl = document.getElementById('hudRiskSummary');
      const refactorSummaryEl = document.getElementById('hudRefactorSummary');
      const liveStatusBadge = document.getElementById('hudLiveStatusBadge');
      const restartBtn = document.getElementById('hudRestartBtn');
      const pauseBtn = document.getElementById('hudPauseBtn');
      const abortBtn = document.getElementById('hudAbortBtn');
      const thoughtContainer = document.getElementById('hudThoughtBubblesContainer');

      if (progressBar) progressBar.style.width = '100%';
      if (progressPercent) progressPercent.innerText = '100%';
      if (currentModuleEl) currentModuleEl.innerText = '✓ Gestaffelte KI-Batch-Pipeline abgeschlossen!';
      if (pauseBtn) pauseBtn.classList.add('hidden');
      if (abortBtn) abortBtn.classList.add('hidden');
      if (restartBtn) restartBtn.disabled = false;

      const totalFiles = Object.keys(currentData.file_contents || {}).length;
      const arch = `Modulare Schichtenarchitektur mit ${totalFiles} Modulen in ${aiBatchState.batches.length} Chunks. Klare Rollenteilung über Intent-Rollen.`;
      const risk = `Health-Score stabil bei ${currentData?.risk_radar?.health_score || 92}/100. Delta-Scans abgeschlossen (Cached: ${aiBatchState.deltaStats.cached}, Delta: ${aiBatchState.deltaStats.scanned}).`;
      const refact = `Error-Typen im IPC-Kanal standardisieren und automatisierte E2E-Tests für Kernmodule beibehalten.`;

      if (archSummaryEl) archSummaryEl.innerText = arch;
      if (riskSummaryEl) riskSummaryEl.innerText = risk;
      if (refactorSummaryEl) refactorSummaryEl.innerText = refact;
      if (finalReportSec) finalReportSec.classList.remove('hidden');

      if (liveReportEl) {
        liveReportEl.innerText = `✓ Gestaffelte KI-Batch-Pipeline erfolgreich abgeschlossen!\n\n` +
          `• Verarbeitete Batches: ${aiBatchState.batches.length} Module\n` +
          `• Inkrementelle Cache-Hits: ${aiBatchState.deltaStats.cached} Dateien (0ms)\n` +
          `• Neu analysierte Delta-Dateien: ${aiBatchState.deltaStats.scanned}\n` +
          `• Erkannte Intent-Rollen: Auth (${aiBatchState.intentCounts.Auth || 0}), API (${aiBatchState.intentCounts.API || 0}), Data (${aiBatchState.intentCounts.Data || 0}), UI (${aiBatchState.intentCounts.UI || 0}), Core (${aiBatchState.intentCounts.Core || 0}), Utils (${aiBatchState.intentCounts.Utils || 0}), Lifecycle (${aiBatchState.intentCounts.Lifecycle || 0})`;
      }

      if (liveStatusBadge) {
        liveStatusBadge.innerText = 'ABGESCHLOSSEN';
        liveStatusBadge.setAttribute('class', 'text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold');
      }

      if (thoughtContainer) {
        thoughtContainer.innerHTML = `
          <div class="thought-bubble px-3 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-400 text-emerald-300 text-xs font-mono shadow-[0_0_15px_rgba(99,178,47,0.4)] flex items-center space-x-1.5">
            <span>✓ Alle Modul-Batches & Architektur-Synthese erfolgreich verarbeitet!</span>
          </div>
        `;
      }

      // Update currentData summary with intent info
      if (currentData.summary) {
        currentData.summary.intent_summary = aiBatchState.intentCounts;
      }
      lucide.createIcons();
    }

    // =========================================================================
    // EXPORT & SOFORT-WIEDERHERSTELLUNG (PERSISTENCE)
    // =========================================================================
    function exportAnalysisResultsJSON() {
      if (!currentData) {
        alert("Bitte lade zuerst eine Codebase oder ein Demo-Projekt, bevor du exportierst.");
        return;
      }

      const exportSnapshot = {
        project_name: currentData.project_name || "Codebase_Analysis",
        timestamp: new Date().toISOString(),
        version: "2.0.0",
        summary: currentData.summary,
        file_tree: currentData.file_tree,
        mindmap: currentData.mindmap,
        risk_radar: currentData.risk_radar,
        api_catalog: currentData.api_catalog,
        module_batches: currentData.module_batches || aiBatchState.batches || [],
        files: currentData.files || {},
        file_contents: currentData.file_contents || {},
        file_ai_cache: fileAICache || {},
        intent_summary: currentData.summary?.intent_summary || aiBatchState.intentCounts || {}
      };

      const jsonStr = (typeof window.safeJsonStringify === 'function') 
        ? window.safeJsonStringify(exportSnapshot, 2) 
        : JSON.stringify(exportSnapshot, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `codebase_analysis_results_${(currentData.project_name || 'project').toLowerCase().replace(/[^a-z0-9]/g, '_')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    function handleImportJsonFile(event) {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          importAnalysisResultsJSON(parsed);
        } catch (err) {
          alert(`Fehler beim Einlesen der Analyse-JSON: ${err.message}`);
        }
      };
      reader.readAsText(file);
      event.target.value = "";
    }

    function importAnalysisResultsJSON(data) {
      if (!data || (!data.files && !data.file_contents)) {
        alert("Ungültiges Analyse-JSON-Format: Keine Datei-Strukturen gefunden.");
        return;
      }

      const startTime = performance.now();

      if (data.file_ai_cache) {
        fileAICache = { ...fileAICache, ...data.file_ai_cache };
      }

      // Reconstruct file_tree if missing
      if (!data.file_tree && (data.file_contents || data.files)) {
        const fileMap = data.file_contents || data.files || {};
        const paths = Object.keys(fileMap);
        const reconstructedTree = { name: "root", type: "directory", children: {} };
        paths.forEach(p => {
          const parts = p.split(/[\/\\]/);
          let curr = reconstructedTree;
          parts.forEach((part, idx) => {
            if (idx === parts.length - 1) {
              curr.children[part] = {
                name: part,
                type: "file",
                path: p,
                language: typeof getLanguageFromPath === 'function' ? getLanguageFromPath(p) : 'text',
                lines: typeof fileMap[p] === 'string' ? fileMap[p].split('\n').length : 0
              };
            } else {
              curr.children[part] = curr.children[part] || { name: part, type: "directory", children: {} };
              curr = curr.children[part];
            }
          });
        });
        data.file_tree = reconstructedTree;
      }

      // Ingest and render all components (City, Metrics, Alerts, API Catalog, FileTree, Mindmap)
      ingestAnalysisData(data);

      const elapsed = Math.round(performance.now() - startTime);
      console.log(`[+] Codebase Snapshot in ${elapsed}ms erfolgreich wiederhergestellt!`);
    }



    // --- AI Architecture Critique Modal ---
    async function triggerAICritique() {
      if (!currentData) {
        alert("Please load a codebase or demo repo first.");
        return;
      }

      const modal = document.getElementById('aiCritiqueModal');
      const content = document.getElementById('aiCritiqueContent');
      modal.classList.remove('hidden');
      content.innerText = `Connecting to CORENOW AI Engine (${appSettings.llmEndpoint})...\nModel: ${appSettings.llmModel}`;

      try {
        const payload = {
          model: appSettings.llmModel || "local-model",
          messages: [
            {
              role: "system",
              content: "You are CORENOW AI Codebase Architect. Analyze the provided codebase architectural graph, health score, APIs, and complexity."
            },
            {
              role: "user",
              content: JSON.stringify({
                project: currentData.project_name,
                summary: currentData.summary,
                risk_radar: currentData.risk_radar,
                api_catalog: (currentData.api_catalog || []).slice(0, appSettings.llmBatchSize || 30)
              })
            }
          ]
        };

        const resp = await fetch(appSettings.llmEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        const res = await resp.json();
        const analysisText = res.choices?.[0]?.message?.content || res.analysis || JSON.stringify(res, null, 2);
        content.innerText = analysisText;
      } catch (e) {
        content.innerText = `CORENOW AI Engine (${appSettings.llmEndpoint}) Offline / Fallback Mode:\n\n- Architecture: Clean modular layered architecture with clear component boundaries.\n- Complexity: Risk radar monitored with threshold ${appSettings.complexityThreshold}.\n- Strengths: High cohesion in IPC communication routines & bounded memory.\n- Recommendations: Ensure robust error mapping on command boundaries and expand integration tests.\n\n(Network Note: ${e.message})`;
      }
    }

    function closeAIModal() {
      document.getElementById('aiCritiqueModal').classList.add('hidden');
    }
  

    // =========================================================================
    // =========================================================================
    // 🏙️ 3D CODE-CITY METROPOLIS (Three.js r128 Engine - High Performance Ultra Edition)
    // Single Draw Call Merged Highways & Ground Tracks, Batched Traffic Points Buffer,
    // 2-Tier Throttled Spatial Raycasting, Instanced Low-Poly Decos & Gateways,
    // Capped Pixel Ratio, Disabled Matrix Auto-Updates & Hierarchical Filter Sidebar


// --- App Bootstrap & Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 Codebase Knowledge Base initialized.");
  if (typeof loadSettings === 'function') loadSettings();
  if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
  if (typeof checkAuthConfig === 'function') checkAuthConfig();
  if (typeof checkUrlAuthParams === 'function') checkUrlAuthParams();
  if (typeof checkAuthSession === 'function') checkAuthSession();
  if (typeof checkShareUrlParameter === 'function') checkShareUrlParameter();
});

// Attach to window
window.renderAnalyzedCodebase = renderAnalyzedCodebase;
window.ingestAnalysisData = ingestAnalysisData;
window.loadAnalysisData = loadAnalysisData;
window.showToast = showToast;
window.showLoadingStatus = showLoadingStatus;
window.hideLoadingStatus = hideLoadingStatus;
window.toggleGlobalAppTheme = toggleGlobalAppTheme;
window.setAppThemeMode = setAppThemeMode;
window.renderThemePicker = renderThemePicker;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.saveAndApplySettings = saveAndApplySettings;
window.openProjectsDrawer = openProjectsDrawer;
window.closeProjectsDrawer = closeProjectsDrawer;
window.executeSaveCurrentProject = executeSaveCurrentProject;
window.saveCurrentProjectToCloud = saveCurrentProjectToCloud;
window.fetchAndRenderProjectsList = fetchAndRenderProjectsList;
window.loadDemoCodebase = loadDemoCodebase;
window.openDirectoryPicker = openDirectoryPicker;
window.handleFolderSelect = handleFolderSelect;
window.handleZipFile = handleZipFile;
window.initDragAndDrop = initDragAndDrop;
window.renderRiskAnalysis = renderRiskAnalysis;
window.renderRiskRadar = renderRiskRadar;
window.renderApiCatalog = renderApiCatalog;
window.renderFileTree = renderFileTree;
window.openGlobalAIScanHUD = openGlobalAIScanHUD;
window.closeGlobalAIScanHUD = closeGlobalAIScanHUD;
window.runGlobalAIScanHUDExecution = runGlobalAIScanHUDExecution;
window.togglePauseAIScanHUD = togglePauseAIScanHUD;
window.cancelAIScanHUD = cancelAIScanHUD;
window.retryAIScanHUD = retryAIScanHUD;
window.exportAnalysisResultsJSON = exportAnalysisResultsJSON;
window.handleImportJsonFile = handleImportJsonFile;
window.importAnalysisResultsJSON = importAnalysisResultsJSON;
window.openAIModal = openAIModal;
window.closeAIModal = closeAIModal;
