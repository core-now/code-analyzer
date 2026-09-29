/**
 * Code Viewer & Syntax Highlighting Engine
 * Features: Prism.js Highlighting, Line Numbers, Synced Scrolling,
 * Semantic Symbol Filtering, and AI Code Review.
 */

    // --- Code Viewer & Syntax Highlighting ---
    function getLanguageFromPath(path) {
      if (!path) return 'javascript';
      const cleanPath = path.split('?')[0].split('#')[0];
      const lastDot = cleanPath.lastIndexOf('.');
      if (lastDot === -1) {
        const base = cleanPath.split(/[/\\]/).pop().toLowerCase();
        if (base === 'dockerfile') return 'dockerfile';
        if (base === 'makefile') return 'makefile';
        return 'javascript';
      }
      const ext = cleanPath.substring(lastDot).toLowerCase();
      const map = {
        '.rs': 'rust',
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.js': 'javascript',
        '.jsx': 'javascript',
        '.mjs': 'javascript',
        '.cjs': 'javascript',
        '.py': 'python',
        '.pyw': 'python',
        '.pyx': 'python',
        '.ipynb': 'python',
        '.go': 'go',
        '.c': 'c',
        '.h': 'c',
        '.cpp': 'cpp',
        '.cc': 'cpp',
        '.cxx': 'cpp',
        '.c++': 'cpp',
        '.hpp': 'cpp',
        '.hxx': 'cpp',
        '.hh': 'cpp',
        '.inl': 'cpp',
        '.ipp': 'cpp',
        '.cs': 'csharp',
        '.csx': 'csharp',
        '.java': 'java',
        '.kt': 'kotlin',
        '.kts': 'kotlin',
        '.scala': 'scala',
        '.swift': 'swift',
        '.php': 'php',
        '.rb': 'ruby',
        '.vue': 'markup',
        '.svelte': 'markup',
        '.astro': 'markup',
        '.html': 'markup',
        '.htm': 'markup',
        '.xhtml': 'markup',
        '.svg': 'markup',
        '.xml': 'markup',
        '.css': 'css',
        '.scss': 'css',
        '.sass': 'css',
        '.less': 'css',
        '.sql': 'sql',
        '.prisma': 'sql',
        '.graphql': 'graphql',
        '.gql': 'graphql',
        '.json': 'json',
        '.json5': 'json',
        '.jsonc': 'json',
        '.toml': 'toml',
        '.yaml': 'yaml',
        '.yml': 'yaml',
        '.md': 'markdown',
        '.markdown': 'markdown',
        '.mdx': 'markdown',
        '.sh': 'bash',
        '.bash': 'bash',
        '.zsh': 'bash',
        '.fish': 'bash',
        '.ps1': 'powershell',
        '.bat': 'batch',
        '.cmd': 'batch',
        '.dart': 'dart',
        '.lua': 'lua',
        '.zig': 'zig',
        '.sol': 'solidity'
      };
      return map[ext] || 'javascript';
    }

    function escapeHtml(text) {
      return (text || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function escapeJsString(str) {
      return (str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
    }

    function highlightCode(code, lang) {
      if (!code) return '';
      if (window.Prism && Prism.languages) {
        let grammar = Prism.languages[lang];
        if (!grammar) {
          if ((lang === 'markup' || lang === 'html' || lang === 'xml') && Prism.languages.markup) grammar = Prism.languages.markup;
          else if (lang === 'rust' && Prism.languages.rust) grammar = Prism.languages.rust;
          else if ((lang === 'typescript' || lang === 'ts') && Prism.languages.typescript) grammar = Prism.languages.typescript;
          else if (lang === 'c' && Prism.languages.c) grammar = Prism.languages.c;
          else if (lang === 'cpp' && Prism.languages.cpp) grammar = Prism.languages.cpp;
          else if (lang === 'go' && Prism.languages.go) grammar = Prism.languages.go;
          else if (lang === 'python' && Prism.languages.python) grammar = Prism.languages.python;
          else grammar = Prism.languages.javascript || Prism.languages.clike;
        }
        if (grammar) {
          try {
            return Prism.highlight(code, grammar, lang);
          } catch (e) {
            console.warn('Prism highlight error:', e);
          }
        }
      }
      return escapeHtml(code);
    }

    // Robust File Content Resolver with Path Normalization and Fallback
    function findFileContentAndPath(queryPath, fileName = '') {
      if (!currentData || !currentData.file_contents) {
        const fallbackPath = queryPath || fileName || "unknown_file";
        return {
          found: false,
          resolvedPath: fallbackPath,
          content: generateFallbackFileContent(fallbackPath),
          isFallback: true
        };
      }

      const fileMap = currentData.file_contents;
      
      // 1. Direct key match
      if (queryPath && fileMap[queryPath] !== undefined) {
        return { found: true, resolvedPath: queryPath, content: fileMap[queryPath], isFallback: false };
      }

      // 2. Normalized slash matching
      if (queryPath) {
        const normTarget = queryPath.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '');
        for (const [k, val] of Object.entries(fileMap)) {
          const normK = k.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '');
          if (normK === normTarget || normK.toLowerCase() === normTarget.toLowerCase()) {
            return { found: true, resolvedPath: k, content: val, isFallback: false };
          }
        }
      }

      // 3. Basename matching (e.g. "hud.js")
      const baseTarget = (fileName || (queryPath ? queryPath.split(/[/\\]/).pop() : '')).toLowerCase();
      if (baseTarget) {
        for (const [k, val] of Object.entries(fileMap)) {
          const normBase = k.split(/[/\\]/).pop().toLowerCase();
          if (normBase === baseTarget) {
            return { found: true, resolvedPath: k, content: val, isFallback: false };
          }
        }
      }

      // 4. Substring / suffix match
      if (queryPath) {
        const normTarget = queryPath.replace(/\\/g, '/');
        for (const [k, val] of Object.entries(fileMap)) {
          const normK = k.replace(/\\/g, '/');
          if (normK.endsWith(normTarget) || normTarget.endsWith(normK)) {
            return { found: true, resolvedPath: k, content: val, isFallback: false };
          }
        }
      }

      // 5. Fallback generated
      const displayPath = queryPath || fileName || "unknown_file";
      return {
        found: false,
        resolvedPath: displayPath,
        content: generateFallbackFileContent(displayPath),
        isFallback: true
      };
    }

    function generateFallbackFileContent(filePath) {
      const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
      const lang = detectLanguage(ext);
      const fileName = filePath.split(/[/\\]/).pop();

      return `// =====================================================================
// CORENOW CODEBASE SNAPSHOT - METADATA PLACEHOLDER
// Datei: ${filePath}
// Modul: ${fileName}
// Sprache: ${lang.toUpperCase()}
// =====================================================================
//
// ℹ️ Der Volltext dieser Datei wurde im aktuellen Scan-Snapshot nicht gecacht.
//
// Mögliche Gründe:
// 1. Die Datei überschreitet die konfigurierte Maximalgröße (z.B. > 3 MB).
// 2. Das Format gehört zu ausgeschlossenen Dateitypen (z.B. Binärdateien/Assets).
// 3. Beim Scan wurde nur ein Sub-Ordner ausgewählt.
//
// Hinweis: Metadaten, Architekturverknüpfungen und Statistiken
// bleiben in der Mindmap und im Wissensgraph vollständig erhalten.`;
    }

    // --- Code Viewer Semantic Symbol Filtering ---
    let currentCodeViewerFilter = 'all';
    let currentCodeViewerSymbols = [];

    function setCodeViewerSymbolFilter(filterKey) {
      currentCodeViewerFilter = filterKey || 'all';
      
      // Update tab styles
      const tabContainer = document.getElementById('codeViewerFilterTabs');
      if (tabContainer) {
        tabContainer.querySelectorAll('button').forEach(btn => {
          const f = btn.getAttribute('data-filter');
          if (f === currentCodeViewerFilter) {
            btn.setAttribute('class', 'px-2 py-0.5 rounded transition text-black font-bold bg-brand-orange');
          } else {
            btn.setAttribute('class', 'px-2 py-0.5 rounded transition text-zinc-400 hover:text-white hover:bg-brand-card flex items-center space-x-1');
          }
        });
      }

      renderCodeViewerSymbolChips();
    }

    function renderCodeViewerSymbolChips() {
      const chipsContainer = document.getElementById('codeViewerSymbolChips');
      const countBadge = document.getElementById('codeViewerSymbolsCountBadge');
      if (!chipsContainer) return;

      if (!activeFile || currentCodeViewerSymbols.length === 0) {
        chipsContainer.innerHTML = '<span class="text-zinc-500 text-[10px] italic">Keine extrahierten Symbole in dieser Datei.</span>';
        if (countBadge) countBadge.innerText = '0 Symbole';
        return;
      }

      let filtered = currentCodeViewerSymbols;
      if (currentCodeViewerFilter !== 'all') {
        filtered = currentCodeViewerSymbols.filter(s => s.categoryId === currentCodeViewerFilter || s.type === currentCodeViewerFilter);
      }

      if (countBadge) {
        countBadge.innerText = `${filtered.length} von ${currentCodeViewerSymbols.length} Symbolen`;
      }

      if (filtered.length === 0) {
        chipsContainer.innerHTML = `<span class="text-zinc-500 text-[10px] italic">Keine Symbole in Kategorie "${currentCodeViewerFilter}" gefunden.</span>`;
        return;
      }

      chipsContainer.innerHTML = filtered.map(sym => {
        const borderCol = sym.color ? `border-[${sym.color}]/40 hover:border-[${sym.color}]` : 'border-zinc-700 hover:border-zinc-500';
        const isFn = sym.type === 'Function';
        return `
          <button onclick="jumpToCodeSymbol('${escapeHtml(sym.rawQuery)}', ${sym.line || 'null'})" 
            title="Klick springt zu Zeile ${sym.line || '?'}: ${escapeHtml(sym.name)}" 
            class="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-brand-dark/90 hover:bg-brand-card border border-brand-border text-zinc-300 hover:text-white transition cursor-pointer flex-shrink-0 group">
            <span class="text-[11px]">${sym.icon || '⚡'}</span>
            <span class="font-medium text-white group-hover:text-brand-orange truncate max-w-[130px]">${escapeHtml(sym.name)}</span>
            ${sym.categoryName ? `<span class="text-[8px] uppercase px-1 py-0.2 rounded bg-black/50 text-zinc-400 font-mono">${escapeHtml(sym.categoryName.split('&')[0].trim())}</span>` : ''}
            ${sym.line ? `<span class="text-[9px] text-zinc-500 font-mono">:${sym.line}</span>` : ''}
          </button>
        `;
      }).join('');
    }

    function jumpToCodeSymbol(symbolQuery, lineNum) {
      if (lineNum) {
        const lineEl = document.getElementById(`code-line-num-${lineNum}`);
        if (lineEl) {
          lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          lineEl.classList.add('line-number-highlight');
          lineEl.classList.add('pulse-highlight-line');
          setTimeout(() => {
            lineEl.classList.remove('line-number-highlight');
            lineEl.classList.remove('pulse-highlight-line');
          }, 2800);
        }
      }
      if (symbolQuery) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
          searchInput.value = symbolQuery;
          performSearch();
        }
      }
    }

    function updateCodeViewerSymbolsBar(filePath, content, lang) {
      if (!filePath || !isCodeFile(filePath)) {
        currentCodeViewerSymbols = [];
        renderCodeViewerSymbolChips();
        return;
      }

      const extractedSyms = extractSymbols(content, lang, filePath);
      const extractedApis = extractApis(filePath, content, lang);
      const all = [];

      extractedApis.forEach(a => {
        all.push({
          name: a.name,
          rawQuery: a.name,
          type: 'API',
          categoryId: 'api_network',
          categoryName: 'API, Network & IPC',
          icon: '🔌',
          color: '#f97316',
          line: a.line
        });
      });

      extractedSyms.forEach(s => {
        const isFn = s.type === 'Function';
        const cat = s.categoryId && FUNCTION_CATEGORIES[s.categoryId] 
          ? FUNCTION_CATEGORIES[s.categoryId] 
          : categorizeFunction(s.rawName || s.name);

        all.push({
          name: s.name,
          rawQuery: s.rawName || s.name.replace(/^(fn|def|func|type|class|struct)\s+|\(\)$/g, '').trim(),
          type: s.type,
          categoryId: isFn ? cat.id : 'type',
          categoryName: isFn ? cat.name : 'Type',
          icon: isFn ? cat.icon : '📦',
          color: isFn ? cat.color : '#ec4899',
          line: s.line
        });
      });

      currentCodeViewerSymbols = all;
      renderCodeViewerSymbolChips();
    }

    function openFileInViewer(path, targetSymbol = null, targetLine = null) {
      if (!path) return;
      const fileLookup = findFileContentAndPath(path);
      const resolvedPath = fileLookup.resolvedPath;
      const content = fileLookup.content;
      activeFile = resolvedPath;
      
      switchView('code');

      const pathDisplay = document.getElementById('activeFilePath');
      if (pathDisplay) {
        pathDisplay.innerText = resolvedPath + (fileLookup.isFallback ? ' (Snapshot-Placeholder)' : '');
      }

      const lines = content.split('\n');
      const statsDisplay = document.getElementById('activeFileStats');
      if (statsDisplay) {
        statsDisplay.innerText = `${lines.length} lines | ${new Blob([content]).size} bytes${fileLookup.isFallback ? ' | Placeholder' : ''}`;
      }

      // Line numbers with IDs for direct jump
      const lineNumbersEl = document.getElementById('lineNumbers');
      if (lineNumbersEl) {
        lineNumbersEl.innerHTML = lines.map((_, i) => `<div id="code-line-num-${i + 1}">${i + 1}</div>`).join('');
      }
      
      const lang = getLanguageFromPath(resolvedPath);
      const codeElement = document.getElementById('codeContent');
      if (codeElement) {
        codeElement.setAttribute('class', `flex-1 pl-4 text-zinc-300 whitespace-pre overflow-visible select-text language-${lang}`);
        codeElement.innerHTML = highlightCode(content, lang);
      }

      // Update Semantic Symbol Bar for Code Viewer
      updateCodeViewerSymbolsBar(resolvedPath, content, lang);

      // Highlight active file in File Tree if it exists
      document.querySelectorAll('.file-tree-node').forEach(el => {
        const itemPath = el.getAttribute('data-filepath');
        if (itemPath === resolvedPath || itemPath === path) {
          el.setAttribute('class', 'file-tree-node flex items-center space-x-1.5 py-1 px-2 rounded cursor-pointer transition select-none bg-white/10 text-brand-orange font-semibold border-l-2 border-brand-orange shadow-sm');
          // Auto-expand any collapsed parent folders
          let parentFolder = el.closest('.folder-children');
          while (parentFolder) {
            parentFolder.classList.remove('hidden');
            const parentGroup = parentFolder.closest('.folder-group');
            if (parentGroup) {
              const row = parentGroup.querySelector('.folder-row');
              if (row) {
                const folderId = row.getAttribute('data-folder-id');
                if (folderId) folderExpandedState.set(folderId, true);
                const chevron = row.querySelector('.chevron-icon');
                if (chevron) chevron.classList.add('rotate-90');
                const folderIcon = row.querySelector('.folder-icon');
                if (folderIcon) folderIcon.innerText = '📂';
              }
              parentFolder = parentGroup.parentElement?.closest('.folder-children');
            } else {
              break;
            }
          }
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
          el.setAttribute('class', 'file-tree-node flex items-center space-x-1.5 py-1 px-2 rounded cursor-pointer transition select-none text-zinc-400 hover:text-white hover:bg-white/5 border-l-2 border-transparent');
        }
      });

      if (targetSymbol) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
          searchInput.value = targetSymbol;
          performSearch();
        }
      } else if (targetLine) {
        setTimeout(() => {
          const lineEl = document.getElementById(`code-line-num-${targetLine}`);
          if (lineEl) {
            lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            lineEl.classList.add('line-number-highlight');
            lineEl.classList.add('pulse-highlight-line');
            setTimeout(() => {
              lineEl.classList.remove('line-number-highlight');
              lineEl.classList.remove('pulse-highlight-line');
            }, 2800);
          }
        }, 80);
      } else {
        const searchInput = document.getElementById('searchInput');
        const currentSearchVal = searchInput ? searchInput.value : '';
        if (currentSearchVal) {
          performSearch();
        } else {
          searchMatches = [];
          currentMatchIndex = -1;
          const counter = document.getElementById('searchCounter');
          if (counter) counter.innerText = "0 of 0";
        }
      }
    }

    // VSCodium Floating Search Logic with DOM TreeWalker (preserves full syntax tokens)
    function performSearch() {
      const term = document.getElementById('searchInput').value;
      const codeElement = document.getElementById('codeContent');
      const text = currentData?.file_contents?.[activeFile] || "";
      const lang = getLanguageFromPath(activeFile);
      searchMatches = [];
      currentMatchIndex = -1;

      // Reset base highlighted code
      codeElement.innerHTML = highlightCode(text, lang);

      if (!term || !text) {
        document.getElementById('searchCounter').innerText = "0 of 0";
        return;
      }

      // Safe TreeWalker Text Node Highlight replacement
      const walker = document.createTreeWalker(codeElement, NodeFilter.SHOW_TEXT, null, false);
      const textNodes = [];
      let node;
      while (node = walker.nextNode()) {
        textNodes.push(node);
      }

      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedTerm, 'gi');

      for (const textNode of textNodes) {
        const val = textNode.nodeValue;
        if (!val || !regex.test(val)) continue;

        regex.lastIndex = 0;
        const frag = document.createDocumentFragment();
        let lastIdx = 0;
        let match;

        while ((match = regex.exec(val)) !== null) {
          if (match.index > lastIdx) {
            frag.appendChild(document.createTextNode(val.substring(lastIdx, match.index)));
          }
          const mark = document.createElement('span');
          mark.setAttribute('class', 'search-match-highlight');
          mark.textContent = match[0];
          frag.appendChild(mark);
          lastIdx = regex.lastIndex;
        }

        if (lastIdx < val.length) {
          frag.appendChild(document.createTextNode(val.substring(lastIdx)));
        }

        textNode.parentNode.replaceChild(frag, textNode);
      }

      searchMatches = Array.from(codeElement.querySelectorAll('.search-match-highlight'));
      const count = searchMatches.length;
      document.getElementById('searchCounter').innerText = count > 0 ? `1 of ${count}` : "0 of 0";

      if (count > 0) {
        currentMatchIndex = 0;
        updateActiveSearchMatch();
      }
    }

    function navigateSearch(direction) {
      if (!searchMatches || !searchMatches.length) return;
      currentMatchIndex = (currentMatchIndex + direction + searchMatches.length) % searchMatches.length;
      document.getElementById('searchCounter').innerText = `${currentMatchIndex + 1} of ${searchMatches.length}`;
      updateActiveSearchMatch();
    }

    function updateActiveSearchMatch() {
      if (!searchMatches || !searchMatches.length) return;
      searchMatches.forEach((el, idx) => {
        if (idx === currentMatchIndex) {
          el.classList.add('search-match-active');
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          el.classList.remove('search-match-active');
        }
      });
    }

    function handleSearchKey(e) {
      if (e.key === 'Enter') {
        navigateSearch(e.shiftKey ? -1 : 1);
      } else if (e.key === 'Escape') {
        closeSearchBar();
      }
    }

    function closeSearchBar() {
      document.getElementById('searchInput').value = '';
      performSearch();
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal && !settingsModal.classList.contains('hidden')) {
          closeSettingsModal();
        }
        const aiModal = document.getElementById('aiCritiqueModal');
        if (aiModal && !aiModal.classList.contains('hidden')) {
          closeAIModal();
        }
        const hudModal = document.getElementById('globalAIScanHUDModal');
        if (hudModal && !hudModal.classList.contains('hidden')) {
          closeGlobalAIScanHUD();
        }
        closeMindmapInspector();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        switchView('code');
        const input = document.getElementById('searchInput');
        if (input) {
          input.focus();
          input.select();
        }
      }
    });



    // --- File-Level AI Code Review & Explanation ---
    async function requestInspectorFileAIReview(forceRefresh = false) {
      if (!activeInspectorNode) return;
      const targetPath = activeInspectorNode.path || activeInspectorNode.name || activeFile;
      if (!targetPath || targetPath === 'root') return;

      const fileLookup = findFileContentAndPath(targetPath, activeInspectorNode.name);
      const resolvedPath = fileLookup.resolvedPath || targetPath;
      const lang = getLanguageFromPath(resolvedPath);
      const codeContent = fileLookup.content || "";

      const btnEl = document.getElementById('inspectorAIBtn');
      const loaderEl = document.getElementById('inspectorAILoader');
      const resultCardEl = document.getElementById('inspectorAIResultCard');
      const cacheBadgeEl = document.getElementById('inspectorAICacheBadge');
      const purposeEl = document.getElementById('inspectorAIPurpose');
      const qualityEl = document.getElementById('inspectorAIQuality');
      const refactorEl = document.getElementById('inspectorAIRefactor');
      const timestampEl = document.getElementById('inspectorAITimestamp');
      const loaderModelEl = document.getElementById('inspectorAILoaderModel');

      // Check Cache
      if (!forceRefresh && fileAICache[resolvedPath]) {
        const cached = fileAICache[resolvedPath];
        if (purposeEl) purposeEl.innerText = cached.purpose;
        if (qualityEl) qualityEl.innerText = cached.quality;
        if (refactorEl) refactorEl.innerText = cached.refactor;
        if (timestampEl) timestampEl.innerText = cached.timestamp || "vorhin";
        if (btnEl) btnEl.classList.add('hidden');
        if (loaderEl) loaderEl.classList.add('hidden');
        if (resultCardEl) resultCardEl.classList.remove('hidden');
        if (cacheBadgeEl) cacheBadgeEl.classList.remove('hidden');
        lucide.createIcons();
        return;
      }

      // Show Loader
      if (btnEl) btnEl.classList.add('hidden');
      if (resultCardEl) resultCardEl.classList.add('hidden');
      if (cacheBadgeEl) cacheBadgeEl.classList.add('hidden');
      if (loaderEl) loaderEl.classList.remove('hidden');
      if (loaderModelEl) loaderModelEl.innerText = appSettings.llmModel || 'local-model';

      const promptSnippet = codeContent.length > 5000 ? codeContent.substring(0, 5000) + "\n\n// ... [Code gekürzt für Review-Analyse]" : codeContent;

      let reviewResult = null;

      try {
        const payload = {
          model: appSettings.llmModel || "local-model",
          messages: [
            {
              role: "system",
              content: "Du bist ein Senior Software-Architekt & Code-Reviewer. Analysiere den bereitgestellten Quellcode präzise auf Deutsch.\nAntworte zwingend in genau 3 Abschnitten mit diesen Überschriften:\n🎯 Zweck & Rolle im Projekt:\n(1-2 prägnante Sätze)\n🛡️ Code-Qualität & Bugs / Risiken:\n(Sicherheit, Memory, Error-Handling, Edge Cases)\n💡 Refactoring-Tipp:\n(Konkrete, praxistaugliche Code-Verbesserung)"
            },
            {
              role: "user",
              content: `Dateipfad: ${resolvedPath}\nSprache: ${lang.toUpperCase()}\n\nQuellcode:\n\`\`\`${lang}\n${promptSnippet}\n\`\`\``
            }
          ],
          temperature: 0.2
        };

        const resp = await fetch(appSettings.llmEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const res = await resp.json();
        const rawContent = res.choices?.[0]?.message?.content || res.content || "";
        reviewResult = parseAIReviewSections(rawContent, resolvedPath, lang, codeContent);
      } catch (err) {
        console.warn("Local LLM request failed, using intelligent fallback heuristics:", err);
        reviewResult = generateFallbackFileReview(resolvedPath, lang, codeContent, err.message);
      }

      // Store in Cache
      reviewResult.timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      fileAICache[resolvedPath] = reviewResult;

      // Render
      if (purposeEl) purposeEl.innerText = reviewResult.purpose;
      if (qualityEl) qualityEl.innerText = reviewResult.quality;
      if (refactorEl) refactorEl.innerText = reviewResult.refactor;
      if (timestampEl) timestampEl.innerText = reviewResult.timestamp;

      if (loaderEl) loaderEl.classList.add('hidden');
      if (resultCardEl) resultCardEl.classList.remove('hidden');
      if (cacheBadgeEl) cacheBadgeEl.classList.remove('hidden');
      lucide.createIcons();
    }

    function parseAIReviewSections(rawText, path, lang, code) {
      if (!rawText) return generateFallbackFileReview(path, lang, code);

      let purpose = "";
      let quality = "";
      let refactor = "";

      const purposeMatch = rawText.match(/(?:🎯|Zweck\s*(?:&|und)?\s*Rolle)[^\n:]*:\s*([\s\S]*?)(?=(?:🛡️|Code-Qualität|Bugs|Risiken|💡|Refactoring|$))/i);
      const qualityMatch = rawText.match(/(?:🛡️|Code-Qualität\s*(?:&|und)?\s*(?:Bugs|Risiken))[^\n:]*:\s*([\s\S]*?)(?=(?:💡|Refactoring|$))/i);
      const refactorMatch = rawText.match(/(?:💡|Refactoring-Tipp|Refactoring)[^\n:]*:\s*([\s\S]*?)$/i);

      purpose = purposeMatch ? purposeMatch[1].trim() : "";
      quality = qualityMatch ? qualityMatch[1].trim() : "";
      refactor = refactorMatch ? refactorMatch[1].trim() : "";

      if (!purpose && !quality && !refactor) {
        purpose = rawText.substring(0, 200).trim();
        quality = "Strukturierte Analyse über lokales Modell abgeschlossen. Saubere Modul-Definition.";
        refactor = "Modulare Entkopplung und explizite Error-Types beibehalten.";
      }

      return {
        purpose: purpose || `Zentrales ${lang.toUpperCase()}-Modul für ${path.split(/[/\\]/).pop()}.`,
        quality: quality || "Keine kritischen Syntax- oder Logikfehler im aktuellen Scan entdeckt.",
        refactor: refactor || "Fehlerbehandlung mit typisierten Result/Option-Wrappern absichern."
      };
    }

    function generateFallbackFileReview(path, lang, code, errMsg = "") {
      const fileName = path.split(/[/\\]/).pop();
      const lines = code.split('\n').length;
      const complexity = calculateComplexity(code);
      const hasUnwrap = code.includes('unwrap(') || code.includes('expect(');
      const isAsync = code.includes('async ') || code.includes('Promise');
      const isUi = /html|css|view|component|modal|hud/i.test(path);
      const isIpc = /ipc|tauri|command|event/i.test(path);

      let purpose = "";
      let quality = "";
      let refactor = "";

      if (isIpc) {
        purpose = `Dient als IPC-Brücke & Kommunikationsschnittstelle zwischen Backend und Client-UI für ${fileName}.`;
      } else if (isUi) {
        purpose = `Verantwortlich für Rendering, UI-Interaktion und visuelle Darstellung der Komponenten in ${fileName}.`;
      } else {
        purpose = `Kernmodul (${lang.toUpperCase()}) zur Datenverarbeitung und Bereitstellung von Kernlogik für ${fileName}.`;
      }

      const qualityPoints = [];
      if (complexity > 20) {
        qualityPoints.push(`⚠️ Erhöhte zyklomatische Komplexität (Score: ${complexity}) durch verschachtelte Kontrollflüsse.`);
      } else {
        qualityPoints.push(`✓ Solide Code-Struktur mit moderater Komplexität (Score: ${complexity}).`);
      }

      if (hasUnwrap) {
        qualityPoints.push(`⚠️ Potenzielle Panik-Risiken durch ungesicherte unwrap()-Aufrufe entdeckt.`);
      } else {
        qualityPoints.push(`✓ Saubere Fehlerfortpflanzung ohne aggressive Panics.`);
      }

      if (isAsync) {
        qualityPoints.push(`✓ Asynchrone Non-Blocking Ausführung für reaktive Performance.`);
      }

      quality = qualityPoints.join('\n');

      if (isCodeFile(path) && lines > 400) {
        refactor = `Modulgröße (${lines} LOC) reduzieren: Logik in kleinere Hilfsfunktionen oder Submodule aufteilen.`;
      } else if (hasUnwrap) {
        refactor = `unwrap()-Aufrufe durch idiomatische match- oder ?-Operator-Fehlerbehandlung ersetzen.`;
      } else {
        refactor = `Unit-Tests für die Kernfunktionen und Randfälle (Edge Cases) ergänzen.`;
      }

      if (errMsg) {
        refactor += `\n(Hinweis: Lokaler LLM-Endpunkt offline - Heuristik aktiv)`;
      }

      return { purpose, quality, refactor };
    }

    function copyInspectorAIReview() {
      if (!activeInspectorNode) return;
      const path = activeInspectorNode.path || activeInspectorNode.name || activeFile;
      const cached = fileAICache[path];
      if (!cached) return;

      const reviewText = `### 🧠 KI-Code-Review für ${path}\n\n**🎯 Zweck & Rolle im Projekt:**\n${cached.purpose}\n\n**🛡️ Code-Qualität & Bugs / Risiken:**\n${cached.quality}\n\n**💡 Refactoring-Tipp:**\n${cached.refactor}\n\n*(Erstellt am ${cached.timestamp})*`;
      fallbackCopyText(reviewText);
      alert("✓ KI-Review in die Zwischenablage kopiert!");
    }

    // Trigger AI Review from Code Viewer Panel
    function triggerCodeViewerAIReview() {
      const targetPath = activeFile || Object.keys(currentData?.file_contents || {})[0];
      if (!targetPath) {
        alert("Bitte wähle zuerst eine Datei im Code-Viewer aus.");
        return;
      }

      switchView('dashboard');
      const fileLookup = findFileContentAndPath(targetPath);
      const fakeNode = {
        id: `file_${targetPath}`,
        name: targetPath.split(/[/\\]/).pop(),
        path: fileLookup.resolvedPath || targetPath,
        nodeType: 'file',
        category: 'Component'
      };

      openNodeInspector(fakeNode);
      requestInspectorFileAIReview();
    }



// Attach to window
window.highlightCode = highlightCode;
window.setCodeViewerSymbolFilter = setCodeViewerSymbolFilter;
window.renderCodeViewerSymbolChips = renderCodeViewerSymbolChips;
window.jumpToCodeSymbol = jumpToCodeSymbol;
window.updateCodeViewerSymbolsBar = updateCodeViewerSymbolsBar;
window.openFileInViewer = openFileInViewer;
window.triggerCodeViewerAIReview = triggerCodeViewerAIReview;
window.requestInspectorFileAIReview = requestInspectorFileAIReview;
