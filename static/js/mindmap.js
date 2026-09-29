/**
 * Interactive Collapsible Vis-Network Architecture Mindmap
 * Features: Satellite Hub-and-Spoke, Hierarchical Organigram, Cluster Layout,
 * Codebase Focus Dimming, Node Inspector, and Auto-Stabilization.
 */

    // --- Interactive Collapsible Vis-Network Architecture Mindmap / Satellite Hub-and-Spoke Graph (Option 2) ---
    let visNetworkInstance = null;
    let currentMindmapGraphData = null;
    let expandedNodesSet = new Set(['center-root']);
    let activeInspectorNode = null;
    let mindmapLayoutMode = 'satellite'; // 'satellite' (Option 2: Hub-and-Spoke Orbit), 'tree' (hierarchical), 'cluster' (force)
    let currentMindmapMode = 'satellite'; // 'satellite' (5-6 primary satellites) or 'heuristic' (folders)
    let isPhysicsFrozen = false;
    let physicsAutoFreezeTimer = null;
    let fileAICache = {}; // Local in-memory cache for file reviews

    const SATELLITE_DEFINITIONS = [
      {
        id: 'sat_frontend_ui',
        name: '🎨 Frontend & UI',
        rawName: 'Frontend & UI',
        color: '#38bdf8', // Sky Blue / Cyan
        icon: '🎨',
        category: 'Frontend & UI Presentation',
        keywords: ['ui', 'component', 'components', 'view', 'views', 'page', 'pages', 'theme', 'style', 'styles', 'css', 'scss', 'sass', 'less', 'tailwind', 'html', 'htm', 'tsx', 'jsx', 'frontend', 'app.ts', 'app.js', 'app.tsx', 'app.jsx', 'main.ts', 'main.js', 'svelte', 'vue', 'client', 'web', 'renderer', 'canvas', 'svg', 'hud', 'modal', 'card', 'badge']
      },
      {
        id: 'sat_backend_core',
        name: '⚙️ Backend & Core',
        rawName: 'Backend & Core',
        color: '#10b981', // Emerald Green
        icon: '⚙️',
        category: 'Backend & Core Processing',
        keywords: ['core', 'engine', 'main.rs', 'main.py', 'main.go', 'server', 'lib.rs', 'lib.py', 'handler', 'service', 'services', 'util', 'utils', 'helper', 'helpers', 'backend', 'calc', 'parser', 'worker', 'process', 'processor', 'logic', 'algorithm', 'ast', 'scanner', 'analyzer']
      },
      {
        id: 'sat_apis_commands',
        name: '🔌 APIs & Commands',
        rawName: 'APIs & Commands',
        color: '#f97316', // Orange
        icon: '🔌',
        category: 'APIs & Commands & IPC',
        keywords: ['api', 'apis', 'route', 'routes', 'endpoint', 'endpoints', 'command', 'commands', 'tauri', 'ipc', 'rpc', 'grpc', 'http', 'rest', 'graphql', 'socket', 'websocket', 'event', 'events', 'channel', 'channels', 'fetch', 'client.ts', 'client.js', 'request', 'response', 'controller', 'controllers']
      },
      {
        id: 'sat_state_storage',
        name: '🗄️ State & Storage',
        rawName: 'State & Storage',
        color: '#a855f7', // Purple
        icon: '🗄️',
        category: 'State, Database & Storage',
        keywords: ['state', 'store', 'stores', 'storage', 'db', 'database', 'sql', 'sqlite', 'postgres', 'mysql', 'mongo', 'redis', 'model', 'models', 'schema', 'schemas', 'entity', 'entities', 'repository', 'repo', 'cache', 'session', 'auth', 'token', 'jwt', 'reducer', 'zustand', 'redux', 'pinia', 'vuex', 'context', 'persistence', 'migration']
      },
      {
        id: 'sat_configs_build',
        name: '⚙️ Configs & Build',
        rawName: 'Configs & Build',
        color: '#eab308', // Amber / Yellow
        icon: '⚙️',
        category: 'Configs, Build & Tooling',
        keywords: ['config', 'configs', 'configuration', 'build', 'setup', 'script', 'scripts', 'cargo.toml', 'package.json', 'tsconfig', 'vite', 'webpack', 'rollup', 'tauri.conf', 'docker', 'dockerfile', 'compose', 'makefile', 'cmake', '.toml', '.json', '.yaml', '.yml', '.env', '.xml', '.ini', '.cfg', '.conf', 'ci', 'workflow', 'tool', 'tools', 'bundler', 'lock', 'gitignore']
      },
      {
        id: 'sat_docs_specs',
        name: '📝 Docs & Specs',
        rawName: 'Docs & Specs',
        color: '#ec4899', // Pink / Magenta
        icon: '📝',
        category: 'Documentation & Specifications',
        keywords: ['doc', 'docs', 'documentation', 'readme', 'spec', 'specs', 'specification', 'test', 'tests', 'spec.ts', 'test.rs', 'test.py', 'test_', '__tests__', 'guide', 'manual', 'changelog', 'license', 'contributing', 'todo', '.md', '.txt', '.pdf', 'bench', 'benchmark', 'summary']
      }
    ];

    function setMindmapMode(mode) {
      currentMindmapMode = mode;
      const btnHeuristic = document.getElementById('btnModeHeuristic');
      const btnSemantic = document.getElementById('btnModeSemanticAI');
      const btnRegenerate = document.getElementById('btnRegenerateAIMindmap');

      if (mode === 'semantic_ai' || mode === 'satellite') {
        if (btnSemantic) {
          btnSemantic.setAttribute('class', 'px-2.5 py-1 rounded text-xs font-mono font-bold transition bg-brand-orange text-black');
        }
        if (btnHeuristic) {
          btnHeuristic.setAttribute('class', 'px-2.5 py-1 rounded text-xs font-mono font-medium transition text-zinc-400 hover:text-white');
        }
        if (btnRegenerate) btnRegenerate.classList.remove('hidden');
      } else {
        if (btnHeuristic) {
          btnHeuristic.setAttribute('class', 'px-2.5 py-1 rounded text-xs font-mono font-bold transition bg-brand-orange text-black');
        }
        if (btnSemantic) {
          btnSemantic.setAttribute('class', 'px-2.5 py-1 rounded text-xs font-mono font-medium transition text-zinc-400 hover:text-white');
        }
        if (btnRegenerate) btnRegenerate.classList.add('hidden');
      }

      expandedNodesSet.clear();
      expandedNodesSet.add('center-root');
      renderMindmap(true);
      setTimeout(resetMindmapZoom, 250);
    }

    async function generateAIMindmapWithLLM(showFeedback = true) {
      expandedNodesSet.clear();
      expandedNodesSet.add('center-root');
      SATELLITE_DEFINITIONS.forEach(sat => expandedNodesSet.add(sat.id));
      renderMindmap(true);
      setTimeout(resetMindmapZoom, 250);
    }

    const mindmapParentMap = {};
    const mindmapChildrenMap = {};
    let isCodebaseMindmapDimmed = false;
    let selectedCodebaseNodeId = null;

    function getMindmapNodeById(nodeId) {
      if (!nodeId) return null;
      if (visNetworkInstance && visNetworkInstance.body && visNetworkInstance.body.data && visNetworkInstance.body.data.nodes) {
        const found = visNetworkInstance.body.data.nodes.get(nodeId);
        if (found) return found;
      }
      if (currentMindmapGraphData && currentMindmapGraphData.nodes) {
        return currentMindmapGraphData.nodes.get(nodeId);
      }
      return null;
    }

    function categorizeFileToSatellite(filePath, content) {
      const lowerPath = filePath.toLowerCase();
      const lowerContent = (content || '').substring(0, 2000).toLowerCase();

      // Extension & path strong heuristics
      if (['.md', '.txt', '.pdf', '.rst'].some(ext => lowerPath.endsWith(ext)) || lowerPath.includes('readme') || lowerPath.includes('changelog') || lowerPath.includes('license') || lowerPath.includes('docs/')) {
        return 'sat_docs_specs';
      }
      if (['.toml', '.json', '.yaml', '.yml', '.env', '.ini', '.cfg', '.conf', '.xml', '.lock', '.gitignore', '.editorconfig'].some(ext => lowerPath.endsWith(ext)) || lowerPath.includes('docker') || lowerPath.includes('cargo') || lowerPath.includes('package') || lowerPath.includes('tsconfig') || lowerPath.includes('vite.config') || lowerPath.includes('tauri.conf')) {
        return 'sat_configs_build';
      }
      if (lowerPath.includes('test') || lowerPath.includes('spec.') || lowerPath.includes('__test__') || lowerPath.includes('_test.')) {
        return 'sat_docs_specs';
      }
      if (lowerPath.includes('/api') || lowerPath.includes('api.') || lowerPath.includes('route') || lowerPath.includes('ipc') || lowerPath.includes('client.ts') || lowerPath.includes('client.js') || lowerPath.includes('commands') || lowerPath.includes('endpoint')) {
        return 'sat_apis_commands';
      }
      if (lowerPath.includes('state') || lowerPath.includes('store') || lowerPath.includes('db') || lowerPath.includes('database') || lowerPath.includes('model') || lowerPath.includes('schema') || lowerPath.includes('auth') || lowerPath.includes('session') || lowerPath.includes('entity') || lowerPath.includes('repo')) {
        return 'sat_state_storage';
      }
      if (lowerPath.includes('ui') || lowerPath.includes('component') || lowerPath.includes('views') || lowerPath.includes('pages') || lowerPath.includes('style') || lowerPath.includes('css') || lowerPath.includes('html') || lowerPath.endsWith('.tsx') || lowerPath.endsWith('.jsx') || lowerPath.endsWith('.vue') || lowerPath.endsWith('.svelte') || lowerPath.endsWith('app.ts') || lowerPath.endsWith('app.js')) {
        return 'sat_frontend_ui';
      }

      // Keyword scoring fallback
      let bestSat = 'sat_backend_core';
      let bestScore = -1;

      SATELLITE_DEFINITIONS.forEach(sat => {
        let score = 0;
        sat.keywords.forEach(kw => {
          if (lowerPath.includes(kw)) score += 4;
          if (lowerContent.includes(kw)) score += 1;
        });
        if (score > bestScore) {
          bestScore = score;
          bestSat = sat.id;
        }
      });

      return bestSat;
    }

    function buildSatelliteDataStructure() {
      if (!currentData) return [];

      const fileMap = currentData.file_contents || {};
      let allPaths = Object.keys(fileMap);

      if (allPaths.length === 0 && currentData.file_tree) {
        allPaths = [];
        const visitedTree = new Set();
        const pathStack = [{ node: currentData.file_tree, prefix: "" }];
        while (pathStack.length > 0) {
          const { node, prefix } = pathStack.pop();
          if (!node || visitedTree.has(node)) continue;
          visitedTree.add(node);
          if (node.type === 'file' || node.path) {
            allPaths.push(node.path || `${prefix}${node.name}`);
          }
          if (node.children) {
            const keys = Object.keys(node.children);
            for (let i = keys.length - 1; i >= 0; i--) {
              const k = keys[i];
              pathStack.push({
                node: node.children[k],
                prefix: prefix ? `${prefix}/${k}` : `${k}`
              });
            }
          }
        }
      }

      const satBuckets = {};
      SATELLITE_DEFINITIONS.forEach(sat => {
        satBuckets[sat.id] = {
          ...sat,
          files: [],
          subfolders: {},
          nodeType: 'satellite'
        };
      });

      allPaths.forEach((filePath, fIdx) => {
        const content = fileMap[filePath] || "";
        const satId = categorizeFileToSatellite(filePath, content);
        const fileName = filePath.split(/[/\\]/).pop();
        const lang = getLanguageFromPath(filePath);
        const isCode = isCodeFile(filePath);
        const extractedSyms = isCode ? extractSymbols(content, lang, filePath) : [];
        const extractedApis = isCode ? extractApis(filePath, content, lang) : [];

        const symChildren = [];
        extractedApis.forEach((a, i) => {
          symChildren.push({ 
            id: `sym_api_${fIdx}_${i}`, 
            name: a.name, 
            category: a.protocol || 'API', 
            type: 'API', 
            categoryId: 'api_network',
            categoryName: 'API, Network & IPC',
            icon: '🔌',
            color: '#f97316',
            line: a.line, 
            nodeType: 'symbol', 
            path: filePath 
          });
        });
        extractedSyms.forEach((s, i) => {
          const isFn = s.type === 'Function';
          const cat = s.categoryId && FUNCTION_CATEGORIES[s.categoryId]
            ? FUNCTION_CATEGORIES[s.categoryId]
            : (isFn ? categorizeFunction(s.rawName || s.name) : null);
          symChildren.push({ 
            id: `sym_${fIdx}_${i}`, 
            name: s.name, 
            category: isFn ? (cat ? `fn (${cat.name})` : s.type) : s.type, 
            type: s.type, 
            categoryId: isFn ? (cat ? cat.id : 'core_logic') : 'types_structs',
            categoryName: isFn ? (cat ? cat.name : 'Core Logic & Computation') : 'Types & Data Structures',
            icon: isFn ? (cat ? cat.icon : '⚡') : '📦',
            color: isFn ? (cat ? cat.color : '#63B22F') : '#ec4899',
            line: s.line, 
            nodeType: 'symbol', 
            path: filePath 
          });
        });

        const fileNode = {
          id: `file_${fIdx}_${filePath.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
          name: fileName,
          path: filePath,
          category: satBuckets[satId].category,
          domain: satBuckets[satId].name,
          color: satBuckets[satId].color,
          nodeType: 'file',
          symbols: symChildren,
          lines: (content.split('\n') || []).length
        };

        const parts = filePath.split(/[/\\]/);
        if (parts.length > 2) {
          const subfolderName = parts[parts.length - 2];
          if (!satBuckets[satId].subfolders[subfolderName]) {
            satBuckets[satId].subfolders[subfolderName] = {
              id: `sub_${satId}_${subfolderName}`,
              name: subfolderName,
              category: `Sub-Modul (${satBuckets[satId].name})`,
              color: satBuckets[satId].color,
              nodeType: 'layer',
              children: []
            };
          }
          satBuckets[satId].subfolders[subfolderName].children.push(fileNode);
        } else {
          satBuckets[satId].files.push(fileNode);
        }
      });

      const satellitesList = [];
      SATELLITE_DEFINITIONS.forEach(sat => {
        const bucket = satBuckets[sat.id];
        const subList = Object.values(bucket.subfolders || {});
        const children = [...subList, ...bucket.files];
        const totalFileCount = children.reduce((acc, c) => acc + (c.nodeType === 'layer' ? c.children.length : 1), 0);

        bucket.children = children;
        bucket.fileCount = totalFileCount;
        satellitesList.push(bucket);
      });

      return satellitesList;
    }

    function buildMindmapNetworkData() {
      if (!currentData) return { nodes: new vis.DataSet([]), edges: new vis.DataSet([]) };

      // Reset parent/children lookup tables
      for (const k in mindmapParentMap) delete mindmapParentMap[k];
      for (const k in mindmapChildrenMap) delete mindmapChildrenMap[k];

      const nodes = [];
      const edges = [];
      const rootTitle = currentData.project_name || "Mano Brangioji";
      const isSatellite = mindmapLayoutMode === 'satellite';

      // 1. CENTRAL ROOT NODE (HUB)
      nodes.push({
        id: 'center-root',
        label: ` [ 📦 ${rootTitle} ] `,
        shape: 'box',
        margin: { top: 14, bottom: 14, left: 24, right: 24 },
        borderWidth: 2.5,
        borderWidthSelected: 4,
        originalBorderWidth: 2.5,
        originalFontColor: '#FFFFFF',
        originalShadowColor: '#FF8000',
        originalShadow: { enabled: true, color: '#FF8000', size: 24, x: 0, y: 0 },
        color: {
          background: '#FF8000',
          border: '#FFFFFF',
          highlight: { background: '#FFA033', border: '#D9FF3D' },
          hover: { background: '#FFA033', border: '#FFFFFF' }
        },
        font: { color: '#FFFFFF', size: 15, face: 'Inter, sans-serif', bold: true },
        shadow: { enabled: true, color: '#FF8000', size: 24, x: 0, y: 0 },
        nodeType: 'root',
        name: rootTitle,
        path: 'root',
        level: 0,
        x: isSatellite ? 0 : undefined,
        y: isSatellite ? 0 : undefined,
        fixed: isSatellite ? { x: true, y: true } : undefined
      });

      mindmapChildrenMap['center-root'] = [];

      const satellites = buildSatelliteDataStructure();
      const N = satellites.length;
      const R1 = 280; // Satellite Orbit Radius (~260-300px)

      // 2. PRIMARY SATELLITES (Hub-and-Spoke Circle)
      satellites.forEach((sat, i) => {
        const satId = sat.id;
        const totalItems = sat.fileCount || 0;
        const isSatExpanded = expandedNodesSet.has(satId);
        const satBadge = isSatExpanded ? `[ -${totalItems} ]` : `[ +${totalItems} ]`;
        const satColor = sat.color || '#38bdf8';

        // Exact geometric angle: theta_i = 2*PI * i / N - PI/2
        const theta = (2 * Math.PI * i / N) - (Math.PI / 2);
        const satX = Math.round(R1 * Math.cos(theta));
        const satY = Math.round(R1 * Math.sin(theta));

        mindmapParentMap[satId] = 'center-root';
        mindmapChildrenMap['center-root'].push(satId);
        mindmapChildrenMap[satId] = [];

        nodes.push({
          id: satId,
          label: ` ${sat.name} ${satBadge} `,
          shape: 'box',
          margin: { top: 11, bottom: 11, left: 18, right: 18 },
          borderWidth: 2,
          borderWidthSelected: 3.5,
          originalBorderWidth: 2,
          originalFontColor: '#FFFFFF',
          originalShadowColor: satColor,
          originalShadow: { enabled: true, color: satColor, size: 14, x: 0, y: 0 },
          color: {
            background: satColor,
            border: '#FFFFFF',
            highlight: { background: satColor, border: '#D9FF3D' },
            hover: { background: satColor, border: '#FFFFFF' }
          },
          font: { color: '#FFFFFF', size: 13, face: 'Inter, sans-serif', bold: true },
          shadow: { enabled: true, color: satColor, size: 14, x: 0, y: 0 },
          nodeType: 'satellite',
          name: sat.name,
          rawName: sat.rawName,
          category: sat.category,
          path: sat.name,
          color: satColor,
          fileCount: totalItems,
          level: 1,
          x: isSatellite ? satX : undefined,
          y: isSatellite ? satY : undefined,
          fixed: isSatellite ? { x: true, y: true } : undefined
        });

        edges.push({
          id: `edge_root_${satId}`,
          from: 'center-root',
          to: satId,
          color: { color: satColor, highlight: '#D9FF3D' },
          originalColor: satColor,
          originalWidth: 2.5,
          originalOpacity: 0.9,
          width: 2.5,
          length: R1,
          smooth: { type: 'continuous', roundness: 0.2 }
        });

        // 3. OUTER ORBIT EXPANSION (Files / Subfolders)
        if (isSatExpanded && sat.children && sat.children.length > 0) {
          const children = sat.children;
          const M = children.length;
          const R2 = R1 + 240; // Outer arc distance ~520px
          const maxSpan = M === 1 ? 0 : Math.min(0.92, (M - 1) * 0.14);

          children.forEach((child, j) => {
            const childId = child.id;
            const isChildExpanded = expandedNodesSet.has(childId);
            const isSubfolder = child.nodeType === 'layer';

            mindmapParentMap[childId] = satId;
            mindmapChildrenMap[satId].push(childId);
            mindmapChildrenMap[childId] = [];

            const phi = M === 1 ? theta : (theta - (maxSpan / 2) + (j / (M - 1)) * maxSpan);
            const rChild = R2 + (j % 2 === 1 && M > 4 ? 55 : 0);
            const childX = Math.round(rChild * Math.cos(phi));
            const childY = Math.round(rChild * Math.sin(phi));

            if (isSubfolder) {
              const subItems = child.children || [];
              const subBadge = isChildExpanded ? `[ -${subItems.length} ]` : `[ +${subItems.length} ]`;
              const iconStr = isChildExpanded ? '📂' : '📁';

              nodes.push({
                id: childId,
                label: ` ${iconStr} ${child.name}/ ${subBadge} `,
                shape: 'box',
                margin: { top: 9, bottom: 9, left: 15, right: 15 },
                borderWidth: 1.5,
                borderWidthSelected: 3,
                originalBorderWidth: 1.5,
                originalFontColor: '#FFFFFF',
                originalShadowColor: satColor,
                originalShadow: { enabled: true, color: satColor, size: 8, x: 0, y: 0 },
                color: {
                  background: '#1f2937',
                  border: satColor,
                  highlight: { background: '#374151', border: '#D9FF3D' },
                  hover: { background: '#374151', border: '#FFFFFF' }
                },
                font: { color: '#FFFFFF', size: 11, face: 'JetBrains Mono, monospace', bold: true },
                shadow: { enabled: true, color: satColor, size: 8, x: 0, y: 0 },
                nodeType: 'layer',
                name: child.name,
                path: child.name,
                category: child.category,
                color: satColor,
                level: 2,
                x: isSatellite ? childX : undefined,
                y: isSatellite ? childY : undefined,
                fixed: isSatellite ? { x: true, y: true } : undefined
              });

              edges.push({
                id: `edge_${satId}_${childId}`,
                from: satId,
                to: childId,
                color: { color: satColor, highlight: '#D9FF3D' },
                originalColor: satColor,
                originalWidth: 1.8,
                originalOpacity: 0.85,
                width: 1.8,
                length: 160
              });

              // Subfolder files if expanded
              if (isChildExpanded && subItems.length > 0) {
                const K = subItems.length;
                const R3 = rChild + 190;
                const subSpan = K === 1 ? 0 : Math.min(0.55, (K - 1) * 0.11);

                subItems.forEach((subFile, k) => {
                  const subFileId = subFile.id;
                  const isSubFileExpanded = expandedNodesSet.has(subFileId);
                  const subSymCount = (subFile.symbols || []).length;
                  const fileBadge = subSymCount > 0 ? (isSubFileExpanded ? `[ -${subSymCount} ]` : `[ +${subSymCount} ]`) : '';

                  mindmapParentMap[subFileId] = childId;
                  mindmapChildrenMap[childId].push(subFileId);
                  mindmapChildrenMap[subFileId] = [];

                  const psi = K === 1 ? phi : (phi - (subSpan / 2) + (k / (K - 1)) * subSpan);
                  const rSub = R3 + (k % 2 === 1 && K > 3 ? 45 : 0);
                  const subX = Math.round(rSub * Math.cos(psi));
                  const subY = Math.round(rSub * Math.sin(psi));

                  nodes.push({
                    id: subFileId,
                    label: ` 📄 ${subFile.name} ${fileBadge} `.replace(/\s+/g, ' '),
                    shape: 'box',
                    margin: { top: 8, bottom: 8, left: 13, right: 13 },
                    borderWidth: 1.5,
                    borderWidthSelected: 3,
                    originalBorderWidth: 1.5,
                    originalFontColor: '#F4F4F5',
                    originalShadowColor: 'rgba(0,0,0,0.4)',
                    originalShadow: { enabled: true, color: 'rgba(0,0,0,0.35)', size: 6, x: 0, y: 0 },
                    color: {
                      background: '#18181b',
                      border: '#3f3f46',
                      highlight: { background: '#27272a', border: '#D9FF3D' },
                      hover: { background: '#222226', border: '#63B22F' }
                    },
                    font: { color: '#F4F4F5', size: 11, face: 'JetBrains Mono, monospace', bold: true },
                    shadow: { enabled: true, color: 'rgba(0,0,0,0.35)', size: 6, x: 0, y: 0 },
                    nodeType: 'file',
                    name: subFile.name,
                    path: subFile.path,
                    category: subFile.category,
                    symbols: subFile.symbols || [],
                    level: 3,
                    x: isSatellite ? subX : undefined,
                    y: isSatellite ? subY : undefined,
                    fixed: isSatellite ? { x: true, y: true } : undefined
                  });

                  edges.push({
                    id: `edge_${childId}_${subFileId}`,
                    from: childId,
                    to: subFileId,
                    color: { color: satColor, highlight: '#D9FF3D' },
                    originalColor: satColor,
                    originalWidth: 1.5,
                    originalOpacity: 0.8,
                    width: 1.5,
                    length: 140
                  });

                  // File symbols if expanded
                  if (isSubFileExpanded && subSymCount > 0) {
                    const S = subSymCount;
                    const R4 = rSub + 170;
                    const symSpan = S === 1 ? 0 : Math.min(0.45, (S - 1) * 0.09);

                    subFile.symbols.forEach((sym, sIdx) => {
                      const symId = sym.id;
                      mindmapParentMap[symId] = subFileId;
                      mindmapChildrenMap[subFileId].push(symId);

                      const omega = S === 1 ? psi : (psi - (symSpan / 2) + (sIdx / (S - 1)) * symSpan);
                      const rSym = R4 + (sIdx % 2 === 1 && S > 3 ? 35 : 0);
                      const symX = Math.round(rSym * Math.cos(omega));
                      const symY = Math.round(rSym * Math.sin(omega));
                      const isFunc = sym.type === 'Function' || (sym.name || '').startsWith('fn ') || (sym.name || '').startsWith('def ');
                      const symIcon = sym.icon || (isFunc ? '⚡' : (sym.type === 'API' ? '🔌' : '📦'));
                      const symBorderColor = sym.color || (isFunc ? 'rgba(99, 178, 47, 0.75)' : 'rgba(255, 142, 171, 0.75)');

                      nodes.push({
                        id: symId,
                        label: ` ${symIcon} ${sym.name} `,
                        shape: 'box',
                        margin: { top: 6, bottom: 6, left: 10, right: 10 },
                        borderWidth: 1,
                        borderWidthSelected: 2.5,
                        originalBorderWidth: 1,
                        originalFontColor: '#F4F4F5',
                        originalShadowColor: 'rgba(0,0,0,0.35)',
                        originalShadow: { enabled: true, color: 'rgba(0,0,0,0.35)', size: 5, x: 0, y: 0 },
                        color: {
                          background: '#121214',
                          border: symBorderColor,
                          highlight: { background: '#1c1c20', border: '#D9FF3D' },
                          hover: { background: '#1c1c20', border: symBorderColor }
                        },
                        font: { color: '#F4F4F5', size: 10, face: 'JetBrains Mono, monospace' },
                        shadow: { enabled: true, color: 'rgba(0,0,0,0.35)', size: 5, x: 0, y: 0 },
                        nodeType: 'symbol',
                        name: sym.name,
                        categoryId: sym.categoryId,
                        categoryName: sym.categoryName,
                        path: sym.path || subFile.path,
                        line: sym.line,
                        level: 4,
                        x: isSatellite ? symX : undefined,
                        y: isSatellite ? symY : undefined,
                        fixed: isSatellite ? { x: true, y: true } : undefined
                      });

                      edges.push({
                        id: `edge_${subFileId}_${symId}`,
                        from: subFileId,
                        to: symId,
                        color: { color: '#6b7280', highlight: '#D9FF3D' },
                        originalColor: '#6b7280',
                        originalWidth: 1.2,
                        originalOpacity: 0.7,
                        dashes: [4, 4],
                        width: 1.2,
                        length: 120
                      });
                    });
                  }
                });
              }

            } else {
              // Direct file under satellite
              const symCount = (child.symbols || []).length;
              const fileBadge = symCount > 0 ? (isChildExpanded ? `[ -${symCount} ]` : `[ +${symCount} ]`) : '';

              nodes.push({
                id: childId,
                label: ` 📄 ${child.name} ${fileBadge} `.replace(/\s+/g, ' '),
                shape: 'box',
                margin: { top: 8, bottom: 8, left: 14, right: 14 },
                borderWidth: 1.5,
                borderWidthSelected: 3,
                originalBorderWidth: 1.5,
                originalFontColor: '#F4F4F5',
                originalShadowColor: 'rgba(0,0,0,0.4)',
                originalShadow: { enabled: true, color: 'rgba(0,0,0,0.35)', size: 6, x: 0, y: 0 },
                color: {
                  background: '#18181b',
                  border: '#3f3f46',
                  highlight: { background: '#27272a', border: '#D9FF3D' },
                  hover: { background: '#222226', border: '#63B22F' }
                },
                font: { color: '#F4F4F5', size: 11, face: 'JetBrains Mono, monospace', bold: true },
                shadow: { enabled: true, color: 'rgba(0,0,0,0.35)', size: 6, x: 0, y: 0 },
                nodeType: 'file',
                name: child.name,
                path: child.path,
                category: child.category,
                symbols: child.symbols || [],
                level: 2,
                x: isSatellite ? childX : undefined,
                y: isSatellite ? childY : undefined,
                fixed: isSatellite ? { x: true, y: true } : undefined
              });

              edges.push({
                id: `edge_${satId}_${childId}`,
                from: satId,
                to: childId,
                color: { color: satColor, highlight: '#D9FF3D' },
                originalColor: satColor,
                originalWidth: 1.8,
                originalOpacity: 0.8,
                width: 1.8,
                length: 150
              });

              // File symbols if expanded
              if (isChildExpanded && symCount > 0) {
                const S = symCount;
                const R3 = rChild + 180;
                const symSpan = S === 1 ? 0 : Math.min(0.5, (S - 1) * 0.1);

                child.symbols.forEach((sym, sIdx) => {
                  const symId = sym.id;
                  mindmapParentMap[symId] = childId;
                  mindmapChildrenMap[childId].push(symId);

                  const psi = S === 1 ? phi : (phi - (symSpan / 2) + (sIdx / (S - 1)) * symSpan);
                  const rSym = R3 + (sIdx % 2 === 1 && S > 3 ? 40 : 0);
                  const symX = Math.round(rSym * Math.cos(psi));
                  const symY = Math.round(rSym * Math.sin(psi));
                    const isFunc = sym.type === 'Function' || (sym.name || '').startsWith('fn ') || (sym.name || '').startsWith('def ');
                    const symIcon = sym.icon || (isFunc ? '⚡' : (sym.type === 'API' ? '🔌' : '📦'));
                    const symBorderColor = sym.color || (isFunc ? 'rgba(99, 178, 47, 0.75)' : 'rgba(255, 142, 171, 0.75)');

                    nodes.push({
                      id: symId,
                      label: ` ${symIcon} ${sym.name} `,
                      shape: 'box',
                      margin: { top: 6, bottom: 6, left: 10, right: 10 },
                      borderWidth: 1,
                      borderWidthSelected: 2.5,
                      originalBorderWidth: 1,
                      originalFontColor: '#F4F4F5',
                      originalShadowColor: 'rgba(0,0,0,0.35)',
                      originalShadow: { enabled: true, color: 'rgba(0,0,0,0.35)', size: 5, x: 0, y: 0 },
                      color: {
                        background: '#121214',
                        border: symBorderColor,
                        highlight: { background: '#1c1c20', border: '#D9FF3D' },
                        hover: { background: '#1c1c20', border: symBorderColor }
                      },
                      font: { color: '#F4F4F5', size: 10, face: 'JetBrains Mono, monospace' },
                      shadow: { enabled: true, color: 'rgba(0,0,0,0.35)', size: 5, x: 0, y: 0 },
                      nodeType: 'symbol',
                      name: sym.name,
                      categoryId: sym.categoryId,
                      categoryName: sym.categoryName,
                      path: sym.path || child.path,
                      line: sym.line,
                      level: 3,
                      x: isSatellite ? symX : undefined,
                      y: isSatellite ? symY : undefined,
                      fixed: isSatellite ? { x: true, y: true } : undefined
                    });

                  edges.push({
                    id: `edge_${childId}_${symId}`,
                    from: childId,
                    to: symId,
                    color: { color: '#6b7280', highlight: '#D9FF3D' },
                    originalColor: '#6b7280',
                    originalWidth: 1.2,
                    originalOpacity: 0.7,
                    dashes: [4, 4],
                    width: 1.2,
                    length: 130
                  });
                });
              }
            }
          });
        }
      });

      currentMindmapGraphData = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
      return currentMindmapGraphData;
    }

    function getMindmapOptions() {
      if (mindmapLayoutMode === 'satellite') {
        return {
          nodes: {
            borderWidth: 2,
            borderWidthSelected: 3.5,
            shadow: {
              enabled: true,
              color: 'rgba(0,0,0,0.5)',
              size: 10,
              x: 0,
              y: 0
            },
            margin: 10,
            shapeProperties: {
              borderRadius: 8
            }
          },
          edges: {
            smooth: {
              type: 'continuous',
              roundness: 0.2
            },
            selectionWidth: 3.5,
            arrows: {
              to: {
                enabled: true,
                scaleFactor: 0.6
              }
            }
          },
          layout: {
            hierarchical: {
              enabled: false
            }
          },
          physics: {
            enabled: false
          },
          interaction: {
            hover: true,
            tooltipDelay: 120,
            zoomView: true,
            dragView: true,
            dragNodes: true,
            navigationButtons: false,
            keyboard: false,
            selectable: true,
            selectConnectedEdges: false
          }
        };
      }

      if (mindmapLayoutMode === 'tree') {
        return {
          nodes: {
            borderWidth: 2,
            borderWidthSelected: 3.5,
            shadow: {
              enabled: true,
              color: 'rgba(0,0,0,0.5)',
              size: 8,
              x: 0,
              y: 2
            },
            margin: 10,
            shapeProperties: {
              borderRadius: 8
            }
          },
          edges: {
            smooth: {
              type: 'cubicBezier',
              forceDirection: 'vertical',
              roundness: 0.45
            },
            selectionWidth: 3.5,
            arrows: {
              to: {
                enabled: true,
                scaleFactor: 0.65
              }
            }
          },
          layout: {
            hierarchical: {
              enabled: true,
              direction: 'UD',
              sortMethod: 'directed',
              levelSeparation: 150,
              nodeSpacing: 220,
              treeSpacing: 240,
              blockShifting: true,
              edgeMinimization: true,
              parentCentralization: true
            }
          },
          physics: {
            enabled: false
          },
          interaction: {
            hover: true,
            tooltipDelay: 150,
            zoomView: true,
            dragView: true,
            dragNodes: true,
            navigationButtons: false,
            keyboard: false,
            selectable: true,
            selectConnectedEdges: false
          }
        };
      }

      // Organic Cluster Mode: ForceAtlas2Based
      return {
        nodes: {
          borderWidth: 2,
          borderWidthSelected: 3.5,
          shadow: {
            enabled: true,
            color: 'rgba(0,0,0,0.4)',
            size: 8,
            x: 0,
            y: 0
          },
          margin: 10,
          shapeProperties: {
            borderRadius: 8
          }
        },
        edges: {
          smooth: { type: 'continuous', roundness: 0.25 },
          selectionWidth: 3,
          arrows: {
            to: {
              enabled: true,
              scaleFactor: 0.55
            }
          }
        },
        layout: {
          hierarchical: {
            enabled: false
          }
        },
        physics: {
          enabled: !isPhysicsFrozen,
          solver: 'forceAtlas2Based',
          forceAtlas2Based: {
            gravitationalConstant: -120,
            centralGravity: 0.008,
            springLength: 200,
            springConstant: 0.05,
            damping: 0.9,
            avoidOverlap: 1.0,
            nodeDistance: 200
          },
          stabilization: {
            enabled: true,
            iterations: 150,
            updateInterval: 25,
            fit: true
          }
        },
        interaction: {
          hover: true,
          tooltipDelay: 150,
          zoomView: true,
          dragView: true,
          dragNodes: true,
          navigationButtons: false,
          keyboard: false,
          selectable: true,
          selectConnectedEdges: false
        }
      };
    }

    function triggerMindmapAutoStabilize() {
      if (mindmapLayoutMode !== 'cluster' || isPhysicsFrozen || !visNetworkInstance) return;
      visNetworkInstance.setOptions({
        physics: {
          enabled: true,
          solver: 'forceAtlas2Based',
          forceAtlas2Based: {
            gravitationalConstant: -120,
            centralGravity: 0.008,
            springLength: 200,
            springConstant: 0.05,
            damping: 0.9,
            avoidOverlap: 1.0,
            nodeDistance: 200
          }
        }
      });
      clearTimeout(physicsAutoFreezeTimer);
      physicsAutoFreezeTimer = setTimeout(() => {
        if (!isPhysicsFrozen && mindmapLayoutMode === 'cluster' && visNetworkInstance) {
          visNetworkInstance.setOptions({ physics: { enabled: false } });
        }
      }, 500);
    }

    function applyCodebaseFocusDimming(focusedNodeId) {
      if (!visNetworkInstance) return;
      const allNodes = visNetworkInstance.body.data.nodes;
      const allEdges = visNetworkInstance.body.data.edges;
      if (!allNodes || !allEdges) return;

      if (!focusedNodeId) {
        clearCodebaseFocusDimming();
        return;
      }

      // 1. Collect Ancestors from focusedNode up to root (Cycle-safe)
      const activeNodeIds = new Set();
      const visitedAncestors = new Set();
      let curr = focusedNodeId;
      while (curr && !visitedAncestors.has(curr)) {
        visitedAncestors.add(curr);
        activeNodeIds.add(curr);
        curr = mindmapParentMap[curr];
      }

      // 2. Collect Descendants iteratively (Cycle-safe)
      const descStack = [focusedNodeId];
      const visitedDescendants = new Set([focusedNodeId]);
      while (descStack.length > 0) {
        const id = descStack.pop();
        const children = mindmapChildrenMap[id] || [];
        for (let i = 0; i < children.length; i++) {
          const childId = children[i];
          if (!visitedDescendants.has(childId)) {
            visitedDescendants.add(childId);
            activeNodeIds.add(childId);
            descStack.push(childId);
          }
        }
      }

      // 3. Collect active edges connecting nodes in activeNodeIds
      const activeEdgeIds = new Set();
      allEdges.forEach(edge => {
        if (activeNodeIds.has(edge.from) && activeNodeIds.has(edge.to)) {
          activeEdgeIds.add(edge.id);
        }
      });

      const nodeUpdates = [];
      allNodes.forEach(node => {
        const isTarget = node.id === focusedNodeId;
        const isActiveBranch = activeNodeIds.has(node.id);

        if (isActiveBranch) {
          nodeUpdates.push({
            id: node.id,
            opacity: 1.0,
            borderWidth: isTarget ? 3.5 : (node.originalBorderWidth || 2),
            shadow: {
              enabled: true,
              color: isTarget ? '#D9FF3D' : (node.originalShadowColor || '#FF8000'),
              size: isTarget ? 20 : 12,
              x: 0,
              y: 0
            },
            font: {
              ...node.font,
              color: node.originalFontColor || (node.font ? node.font.color : '#FFFFFF')
            }
          });
        } else {
          // Dim non-active branches & satellites to 15% opacity
          nodeUpdates.push({
            id: node.id,
            opacity: 0.15,
            borderWidth: 1,
            shadow: { enabled: false },
            font: {
              ...node.font,
              color: 'rgba(255, 255, 255, 0.15)'
            }
          });
        }
      });

      const edgeUpdates = [];
      allEdges.forEach(edge => {
        if (activeEdgeIds.has(edge.id)) {
          edgeUpdates.push({
            id: edge.id,
            color: { opacity: 1.0, color: '#FF8000', highlight: '#D9FF3D' },
            width: 3.5,
            shadow: { enabled: true, color: '#FF8000', size: 8 }
          });
        } else {
          edgeUpdates.push({
            id: edge.id,
            color: { opacity: 0.12, color: 'rgba(255, 255, 255, 0.12)' },
            width: 1,
            shadow: { enabled: false }
          });
        }
      });

      allNodes.update(nodeUpdates);
      allEdges.update(edgeUpdates);
      isCodebaseMindmapDimmed = true;
    }

    function clearCodebaseFocusDimming() {
      if (!visNetworkInstance || !isCodebaseMindmapDimmed) return;
      const allNodes = visNetworkInstance.body.data.nodes;
      const allEdges = visNetworkInstance.body.data.edges;
      if (!allNodes || !allEdges) return;

      const nodeUpdates = [];
      allNodes.forEach(node => {
        nodeUpdates.push({
          id: node.id,
          opacity: 1.0,
          borderWidth: node.originalBorderWidth || 2,
          shadow: node.originalShadow || { enabled: true, color: node.originalShadowColor || 'rgba(0,0,0,0.5)', size: 8, x: 0, y: 0 },
          font: {
            ...node.font,
            color: node.originalFontColor || (node.font ? node.font.color : '#FFFFFF')
          }
        });
      });

      const edgeUpdates = [];
      allEdges.forEach(edge => {
        edgeUpdates.push({
          id: edge.id,
          color: { opacity: edge.originalOpacity || 0.85, color: edge.originalColor || (edge.color ? edge.color.color : '#4b5563'), highlight: '#FF8000' },
          width: edge.originalWidth || 1.8,
          shadow: { enabled: false }
        });
      });

      allNodes.update(nodeUpdates);
      allEdges.update(edgeUpdates);
      isCodebaseMindmapDimmed = false;
    }

    function renderMindmap(forceRebuild = false) {
      if (!currentData || !currentData.mindmap) return;

      const container = document.getElementById('mindmap-network');
      if (!container) return;

      if (typeof vis === 'undefined') {
        container.innerHTML = `
          <div class="flex flex-col items-center justify-center h-full text-zinc-500 gap-3 p-8 text-center">
            <div class="text-3xl">⚠️</div>
            <div class="text-sm font-bold text-white">vis-network Bibliothek wird geladen...</div>
            <div class="text-xs font-mono">Prüfe ggf. die Internetverbindung zur CDN.</div>
          </div>
        `;
        return;
      }

      const graphData = buildMindmapNetworkData();
      const options = getMindmapOptions();

      if (!visNetworkInstance || forceRebuild) {
        if (visNetworkInstance && forceRebuild) {
          try { visNetworkInstance.destroy(); } catch (e) {}
          visNetworkInstance = null;
        }

        visNetworkInstance = new vis.Network(container, graphData, options);

        // Focus dimming on hover
        visNetworkInstance.on('hoverNode', function(params) {
          if (params.node) {
            applyCodebaseFocusDimming(params.node);
          }
        });

        visNetworkInstance.on('blurNode', function() {
          if (selectedCodebaseNodeId) {
            applyCodebaseFocusDimming(selectedCodebaseNodeId);
          } else {
            clearCodebaseFocusDimming();
          }
        });

        visNetworkInstance.on('click', function(params) {
          if (params.nodes && params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            selectedCodebaseNodeId = nodeId;
            applyCodebaseFocusDimming(nodeId);
            const clickedNode = getMindmapNodeById(nodeId);
            if (clickedNode) {
              handleMindmapNodeClick(clickedNode);
            }
          } else {
            selectedCodebaseNodeId = null;
            clearCodebaseFocusDimming();
            closeMindmapInspector();
          }
        });

        visNetworkInstance.on('doubleClick', function(params) {
          if (params.nodes && params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            const clickedNode = getMindmapNodeById(nodeId);
            if (!clickedNode) return;

            if (clickedNode.nodeType === 'file') {
              openFileInViewer(clickedNode.path || clickedNode.name, null);
            } else if (clickedNode.nodeType === 'symbol') {
              const symName = clickedNode.name?.replace(/^[⚡📦🔌\s]+/, '').replace(/\(\)$/, '').trim();
              openFileInViewer(clickedNode.path || clickedNode.name, symName);
            } else if (clickedNode.nodeType === 'layer' || clickedNode.nodeType === 'domain' || clickedNode.nodeType === 'satellite') {
              if (expandedNodesSet.has(clickedNode.id)) {
                expandedNodesSet.delete(clickedNode.id);
              } else {
                expandedNodesSet.add(clickedNode.id);
              }
              renderMindmap();
              setTimeout(() => {
                if (visNetworkInstance) visNetworkInstance.selectNodes([clickedNode.id]);
                resetMindmapZoom();
              }, 60);
            }
          }
        });

        visNetworkInstance.on('stabilized', function() {
          if (mindmapLayoutMode === 'cluster' && !isPhysicsFrozen && visNetworkInstance) {
            visNetworkInstance.setOptions({ physics: { enabled: false } });
          }
        });

        visNetworkInstance.on('dragEnd', function() {
          if (mindmapLayoutMode === 'cluster' && !isPhysicsFrozen && visNetworkInstance) {
            setTimeout(() => {
              if (!isPhysicsFrozen && visNetworkInstance) {
                visNetworkInstance.setOptions({ physics: { enabled: false } });
              }
            }, 300);
          }
        });

        setTimeout(resetMindmapZoom, 200);
      } else {
        visNetworkInstance.setData(graphData);
        visNetworkInstance.setOptions(options);
        triggerMindmapAutoStabilize();
        setTimeout(resetMindmapZoom, 150);
      }

      updateMindmapUIControls();
    }

    function setMindmapLayoutMode(mode) {
      mindmapLayoutMode = mode;
      renderMindmap(true);
      setTimeout(resetMindmapZoom, 250);
      updateMindmapUIControls();
    }

    function toggleMindmapLayoutMode() {
      if (mindmapLayoutMode === 'satellite') {
        setMindmapLayoutMode('tree');
      } else if (mindmapLayoutMode === 'tree') {
        setMindmapLayoutMode('cluster');
      } else {
        setMindmapLayoutMode('satellite');
      }
    }

    function toggleMindmapPhysicsFreeze() {
      if (mindmapLayoutMode !== 'cluster') {
        setMindmapLayoutMode('cluster');
        isPhysicsFrozen = false;
        return;
      }
      isPhysicsFrozen = !isPhysicsFrozen;
      if (visNetworkInstance) {
        visNetworkInstance.setOptions({ physics: { enabled: !isPhysicsFrozen } });
        if (!isPhysicsFrozen) {
          triggerMindmapAutoStabilize();
        }
      }
      updateMindmapUIControls();
    }

    function updateMindmapUIControls() {
      const btnSatellite = document.getElementById('btnMindmapLayoutSatellite');
      const btnTree = document.getElementById('btnMindmapLayoutTree');
      const btnCluster = document.getElementById('btnMindmapLayoutCluster');
      const physicsIcon = document.getElementById('mindmapPhysicsIcon');
      const physicsLabel = document.getElementById('mindmapPhysicsLabel');
      const physicsBtn = document.getElementById('btnMindmapPhysicsFreeze');

      const activeClass = 'px-2.5 py-1 rounded text-xs font-mono font-bold transition bg-brand-orange text-black';
      const inactiveClass = 'px-2.5 py-1 rounded text-xs font-mono font-medium transition text-zinc-400 hover:text-white';

      if (btnSatellite) btnSatellite.setAttribute('class', mindmapLayoutMode === 'satellite' ? activeClass : inactiveClass);
      if (btnTree) btnTree.setAttribute('class', mindmapLayoutMode === 'tree' ? activeClass : inactiveClass);
      if (btnCluster) btnCluster.setAttribute('class', mindmapLayoutMode === 'cluster' ? activeClass : inactiveClass);

      if (physicsBtn) {
        if (mindmapLayoutMode === 'cluster') {
          physicsBtn.classList.remove('hidden');
          physicsBtn.disabled = false;
          if (isPhysicsFrozen) {
            if (physicsIcon) physicsIcon.innerText = '⏹️';
            if (physicsLabel) physicsLabel.innerText = 'Eingefroren';
            physicsBtn.classList.add('border-amber-400/60', 'text-amber-300');
            physicsBtn.classList.remove('border-emerald-400/60', 'text-emerald-300');
          } else {
            if (physicsIcon) physicsIcon.innerText = '▶️';
            if (physicsLabel) physicsLabel.innerText = 'Physik aktiv';
            physicsBtn.classList.add('border-emerald-400/60', 'text-emerald-300');
            physicsBtn.classList.remove('border-amber-400/60', 'text-amber-300');
          }
        } else {
          physicsBtn.classList.add('hidden');
        }
      }
    }

    function handleMindmapNodeClick(node) {
      if (!node) return;
      const nodeId = node.id;

      if (node.nodeType === 'root') {
        if (expandedNodesSet.has('center-root')) {
          expandedNodesSet.delete('center-root');
        } else {
          expandedNodesSet.add('center-root');
        }
        renderMindmap();
      } else if (node.nodeType === 'layer' || node.nodeType === 'domain' || node.nodeType === 'satellite') {
        if (expandedNodesSet.has(nodeId)) {
          expandedNodesSet.delete(nodeId);
        } else {
          expandedNodesSet.add(nodeId);
        }
        renderMindmap();
      } else if (node.nodeType === 'file' && node.symbols && node.symbols.length > 0) {
        if (expandedNodesSet.has(nodeId)) {
          expandedNodesSet.delete(nodeId);
        } else {
          expandedNodesSet.add(nodeId);
        }
        renderMindmap();
      }

      // Ensure visual selection highlight (Glow & Border) is active on the network canvas
      if (visNetworkInstance && nodeId) {
        try {
          visNetworkInstance.selectNodes([nodeId]);
        } catch (e) {}
      }

      // Immediately open InfoPanel on the right side
      openNodeInspector(node);
    }

    function openNodeInspector(node) {
      if (!node) return;
      activeInspectorNode = node;
      const inspector = document.getElementById('mindmapNodeInspector');
      if (!inspector) return;

      const titleEl = document.getElementById('inspectorNodeTitle');
      const badgeEl = document.getElementById('inspectorCategoryBadge');
      const pathEl = document.getElementById('inspectorNodePath');
      const locEl = document.getElementById('inspectorLoc');
      const compEl = document.getElementById('inspectorComplexity');
      const searchSection = document.getElementById('inspectorSearchSection');
      const searchInput = document.getElementById('inspectorSearchInput');
      const previewSection = document.getElementById('inspectorCodePreviewSection');
      const snippetRangeEl = document.getElementById('inspectorSnippetRange');
      const lineNumbersEl = document.getElementById('inspectorLineNumbers');
      const codeContentEl = document.getElementById('inspectorCodeContent');
      const symbolsSection = document.getElementById('inspectorSymbolsSection');
      const symbolsCountEl = document.getElementById('inspectorSymbolsCount');
      const symbolsListEl = document.getElementById('inspectorSymbolsList');
      const descEl = document.getElementById('inspectorDescBox');
      const openBtn = document.getElementById('inspectorOpenBtn');
      const aiSection = document.getElementById('inspectorAISection');
      const aiBtn = document.getElementById('inspectorAIBtn');
      const aiLoader = document.getElementById('inspectorAILoader');
      const aiResultCard = document.getElementById('inspectorAIResultCard');
      const aiCacheBadge = document.getElementById('inspectorAICacheBadge');
      const aiPurpose = document.getElementById('inspectorAIPurpose');
      const aiQuality = document.getElementById('inspectorAIQuality');
      const aiRefactor = document.getElementById('inspectorAIRefactor');
      const aiTimestamp = document.getElementById('inspectorAITimestamp');

      titleEl.innerText = node.name || "Node Details";
      badgeEl.innerText = node.category || node.nodeType || "Node";
      pathEl.innerText = node.path || node.name || "Architecture Component";

      if (node.nodeType === 'file' || node.nodeType === 'symbol') {
        const filePath = node.path || node.name;
        const fileLookup = findFileContentAndPath(filePath, node.name);
        const resolvedPath = fileLookup.resolvedPath || filePath || node.name;
        const fileData = fileLookup.content;
        const lines = fileData.split('\n');
        const lang = getLanguageFromPath(resolvedPath);
        
        locEl.innerText = lines.length ? `${lines.length} LOC` : (node.lines || '-');
        
        // Detailed Complexity Calculation & Triggers
        const fileObjFromData = currentData?.files?.[resolvedPath];
        let fileTriggers = fileObjFromData?.complexity_triggers || [];
        let fileComplexityVal = fileObjFromData?.complexity;
        let isDataHeavy = fileObjFromData?.is_data_heavy;

        if (!fileTriggers || fileTriggers.length === 0) {
          const res = calculateComplexityWithTriggers(fileData || "");
          fileTriggers = res.triggers;
          fileComplexityVal = res.complexity;
          if (res.isDataHeavy) isDataHeavy = true;
        }

        compEl.innerText = fileLookup.isFallback ? '1' : (fileComplexityVal || 1);

        // Store active triggers globally for toggle
        currentInspectorTriggers = fileTriggers;
        currentInspectorPath = resolvedPath;

        // Render Inspector Refactoring Tip Banner
        const tipContainer = document.getElementById('inspectorRefactorTipContainer');
        const tipText = document.getElementById('inspectorRefactorTipText');
        if (tipContainer && tipText) {
          if (isDataHeavy || (fileData && fileData.includes('STORE_ITEMS'))) {
            tipText.innerText = '💡 Tipp: Reine Daten-Objekte (wie STORE_ITEMS) können als separate .json-Datei ausgelagert werden, um Code und Daten sauber zu trennen.';
            tipContainer.classList.remove('hidden');
          } else {
            tipContainer.classList.add('hidden');
          }
        }

        // Reset & Populate Complexity Triggers Section
        renderInspectorComplexityTriggers(fileTriggers, resolvedPath);

        // Show interactive sections
        if (searchSection) searchSection.classList.remove('hidden');
        if (previewSection) previewSection.classList.remove('hidden');
        if (symbolsSection) symbolsSection.classList.remove('hidden');
        if (openBtn) openBtn.classList.remove('hidden');
        if (aiSection) aiSection.classList.remove('hidden');
        if (searchInput) searchInput.value = "";

        // Check local AI Review Cache for this file
        if (fileAICache[resolvedPath]) {
          const cached = fileAICache[resolvedPath];
          if (aiPurpose) aiPurpose.innerText = cached.purpose;
          if (aiQuality) aiQuality.innerText = cached.quality;
          if (aiRefactor) aiRefactor.innerText = cached.refactor;
          if (aiTimestamp) aiTimestamp.innerText = cached.timestamp || "vorhin";
          if (aiBtn) aiBtn.classList.add('hidden');
          if (aiLoader) aiLoader.classList.add('hidden');
          if (aiResultCard) aiResultCard.classList.remove('hidden');
          if (aiCacheBadge) aiCacheBadge.classList.remove('hidden');
        } else {
          if (aiResultCard) aiResultCard.classList.add('hidden');
          if (aiLoader) aiLoader.classList.add('hidden');
          if (aiCacheBadge) aiCacheBadge.classList.add('hidden');
          if (aiBtn) aiBtn.classList.remove('hidden');
        }

        // 1. Code Snippet Preview (Syntax Highlighted with Line Numbers)
        let startIdx = 0;
        let targetLine = null;

        if (node.nodeType === 'symbol') {
          const rawSym = (node.name || "").replace(/^[⚡📦🔌\s]+/, '').replace(/\(\)$/, '').trim();
          let foundIdx = -1;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(rawSym)) {
              foundIdx = i;
              break;
            }
          }
          if (foundIdx >= 0) {
            startIdx = Math.max(0, foundIdx - 2);
            targetLine = foundIdx + 1;
          }
        }

        const endIdx = Math.min(lines.length, startIdx + 30);
        const snippetLines = lines.slice(startIdx, endIdx);
        const snippetCode = snippetLines.join('\n');

        if (snippetRangeEl) {
          snippetRangeEl.innerText = `${lang.toUpperCase()} (Z. ${lines.length ? startIdx + 1 : 0}–${endIdx})`;
        }

        if (lineNumbersEl) {
          lineNumbersEl.innerHTML = snippetLines.map((_, i) => {
            const lineNum = startIdx + i + 1;
            const isHighlighted = targetLine === lineNum;
            return `<div class="${isHighlighted ? 'text-brand-orange font-bold' : ''}">${lineNum}</div>`;
          }).join('');
        }

        if (codeContentEl) {
          codeContentEl.setAttribute('class', `flex-1 p-2 overflow-visible whitespace-pre leading-5 text-zinc-300 language-${lang}`);
          codeContentEl.innerHTML = highlightCode(snippetCode, lang);
        }

        // 2. Extracted Symbols & APIs Chips (grouped semantically by intent)
        const isCode = isCodeFile(filePath);
        const extractedSyms = (fileLookup.isFallback || !isCode) ? [] : extractSymbols(fileData, lang, filePath);
        const extractedApis = (fileLookup.isFallback || !isCode) ? [] : extractApis(filePath, fileData, lang);

        const allChips = [];
        extractedApis.forEach(api => {
          allChips.push({
            name: api.name,
            rawQuery: api.name,
            type: api.protocol || 'API',
            categoryId: 'api_network',
            categoryName: 'API, Network & IPC',
            icon: '🔌',
            color: '#f97316',
            line: api.line
          });
        });

        extractedSyms.forEach(sym => {
          const isFn = sym.type === 'Function';
          const cat = sym.categoryId && FUNCTION_CATEGORIES[sym.categoryId] 
            ? FUNCTION_CATEGORIES[sym.categoryId] 
            : (isFn ? categorizeFunction(sym.rawName || sym.name) : null);

          allChips.push({
            name: sym.name,
            rawQuery: sym.rawName || sym.name.replace(/^(fn|def|func|type|class|struct)\s+|\(\)$/g, '').trim(),
            type: sym.type,
            categoryId: isFn ? (cat ? cat.id : 'core_logic') : 'types_structs',
            categoryName: isFn ? (cat ? cat.name : 'Core Logic & Computation') : 'Types & Data Structures',
            icon: isFn ? (cat ? cat.icon : '⚡') : '📦',
            color: isFn ? (cat ? cat.color : '#63B22F') : '#ec4899',
            line: sym.line
          });
        });

        // Also add symbols from node definition if any
        if (node.symbols && Array.isArray(node.symbols) && node.symbols.length > 0 && allChips.length === 0) {
          node.symbols.forEach(sym => {
            const isFn = (sym.category || sym.type) === 'Function' || (sym.name || '').startsWith('fn ') || (sym.name || '').startsWith('def ');
            const raw = sym.name.replace(/^[⚡📦🔌\s]+/, '').replace(/\(\)$/, '').trim();
            const cat = isFn ? (sym.categoryId && FUNCTION_CATEGORIES[sym.categoryId] ? FUNCTION_CATEGORIES[sym.categoryId] : categorizeFunction(raw)) : null;
            allChips.push({
              name: sym.name,
              rawQuery: raw,
              type: sym.category || sym.type || (isFn ? 'Function' : 'Symbol'),
              categoryId: isFn ? (cat ? cat.id : 'core_logic') : (sym.type === 'API' ? 'api_network' : 'types_structs'),
              categoryName: isFn ? (cat ? cat.name : 'Core Logic & Computation') : (sym.type === 'API' ? 'API, Network & IPC' : 'Types & Data Structures'),
              icon: isFn ? (cat ? cat.icon : '⚡') : (sym.type === 'API' ? '🔌' : '📦'),
              color: isFn ? (cat ? cat.color : '#63B22F') : (sym.type === 'API' ? '#f97316' : '#ec4899'),
              line: sym.line || null
            });
          });
        }

        if (symbolsCountEl) symbolsCountEl.innerText = allChips.length;

        if (allChips.length > 0) {
          // Group symbols by categoryId
          const grouped = {};
          allChips.forEach(item => {
            const gId = item.categoryId || 'helpers_utils';
            if (!grouped[gId]) {
              grouped[gId] = {
                id: gId,
                name: item.categoryName || 'Helpers & Utilities',
                icon: item.icon || '⚡',
                color: item.color || '#eab308',
                items: []
              };
            }
            grouped[gId].items.push(item);
          });

          symbolsListEl.setAttribute('class', 'space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar');
          symbolsListEl.innerHTML = Object.values(grouped).map(group => {
            return `
              <div class="rounded-lg border border-brand-border/80 bg-brand-dark/80 overflow-hidden shadow-sm">
                <div class="px-2.5 py-1.5 bg-black/40 border-b border-brand-border/60 flex items-center justify-between text-[11px] font-mono">
                  <div class="flex items-center space-x-1.5">
                    <span>${group.icon}</span>
                    <span class="font-bold text-zinc-200">${escapeHtml(group.name)}</span>
                  </div>
                  <span class="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-white/10 text-brand-orange border border-brand-border/40">${group.items.length}</span>
                </div>
                <div class="p-1.5 flex flex-wrap gap-1.5">
                  ${group.items.map(item => `
                    <button onclick="openFileInViewer('${resolvedPath}', '${escapeHtml(item.rawQuery)}', ${item.line || 'null'})" 
                      title="Klick springt zur Definition in Z. ${item.line || '?'}" 
                      class="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono border border-brand-border hover:border-brand-orange bg-brand-card hover:bg-brand-card/90 text-zinc-300 hover:text-white transition cursor-pointer group">
                      <span class="font-medium text-white group-hover:text-brand-orange truncate max-w-[130px]">${escapeHtml(item.name)}</span>
                      ${item.line ? `<span class="text-[9px] text-zinc-500 font-mono">:${item.line}</span>` : ''}
                    </button>
                  `).join('')}
                </div>
              </div>
            `;
          }).join('');
        } else {
          symbolsListEl.setAttribute('class', 'flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-0.5');
          symbolsListEl.innerHTML = '<div class="text-[11px] text-zinc-500 italic py-1">Keine Symbole in dieser Datei extrahiert.</div>';
        }

        descEl.innerText = fileLookup.isFallback 
          ? `Datei-Metadaten im Workspace • Volltext-Placeholder geladen.`
          : `Sprache: ${lang.toUpperCase()} • Datei im Workspace geladen • ${lines.length} Zeilen Code.`;

      } else if (node.nodeType === 'layer' || node.nodeType === 'domain') {
        const directChildren = node.rawLayer?.children || [];
        
        // Count all descendant files iteratively (Cycle-safe)
        function countDescendantFiles(rootItem) {
          if (!rootItem) return 0;
          let count = 0;
          const stack = [rootItem];
          const visited = new Set();
          while (stack.length > 0) {
            const item = stack.pop();
            if (!item || visited.has(item)) continue;
            visited.add(item);
            if (item.nodeType === 'file' || (item.path && !item.children)) {
              count++;
            } else if (item.children && Array.isArray(item.children)) {
              for (let i = item.children.length - 1; i >= 0; i--) {
                stack.push(item.children[i]);
              }
            }
          }
          return count;
        }

        const totalFiles = countDescendantFiles(node.rawLayer);
        locEl.innerText = `${totalFiles} Datei${totalFiles === 1 ? '' : 'en'}`;
        compEl.innerText = node.nodeType === 'domain' ? 'KI-Domäne' : 'Ordner-Knoten';
        if (searchSection) searchSection.classList.add('hidden');
        if (previewSection) previewSection.classList.add('hidden');
        if (openBtn) openBtn.classList.add('hidden');
        if (aiSection) aiSection.classList.add('hidden');
        if (symbolsSection) symbolsSection.classList.remove('hidden');
        if (symbolsCountEl) symbolsCountEl.innerText = directChildren.length;
        
        if (directChildren.length > 0) {
          symbolsListEl.innerHTML = directChildren.map(child => {
            const isFile = child.nodeType === 'file' || (child.path && !child.children);
            const icon = isFile ? '📄' : '📁';
            const action = isFile ? `openFileInViewer('${child.path}')` : ``;
            return `
              <button ${isFile ? `onclick="${action}"` : ''} class="inline-flex items-center space-x-1.5 px-2 py-1 rounded-md text-[11px] font-mono border border-zinc-700 bg-brand-dark text-zinc-300 hover:text-white hover:border-brand-orange transition ${isFile ? 'cursor-pointer' : 'cursor-default'}">
                <span>${icon}</span>
                <span class="truncate max-w-[160px]">${escapeHtml(child.name)}</span>
              </button>
            `;
          }).join('');
        } else {
          symbolsListEl.innerHTML = '<div class="text-[11px] text-zinc-400">Klicke auf den Knoten, um Unterknoten aufzufächern.</div>';
        }
        descEl.innerText = `${node.nodeType === 'domain' ? 'Semantische Architektur-Domäne' : 'Verzeichnis-Knoten'}: ${node.name}.`;

      } else {
        locEl.innerText = `${currentData?.summary?.total_files || 0} Dateien`;
        compEl.innerText = `${currentData?.risk_radar?.health_score || 90}/100`;
        if (searchSection) searchSection.classList.add('hidden');
        if (previewSection) previewSection.classList.add('hidden');
        if (openBtn) openBtn.classList.add('hidden');
        if (aiSection) aiSection.classList.add('hidden');
        if (symbolsSection) symbolsSection.classList.remove('hidden');
        if (symbolsCountEl) symbolsCountEl.innerText = (currentData?.mindmap?.children || []).length;
        symbolsListEl.innerHTML = '<div class="text-[11px] text-zinc-400">Zentraler Architektur-Knotenpunkt der Anwendung.</div>';
        descEl.innerText = `Projekt: ${currentData?.project_name || 'Codebase'}`;
      }

      inspector.classList.remove('hidden');
      lucide.createIcons();
    }

    let currentInspectorTriggers = [];
    let currentInspectorPath = '';

    function toggleInspectorComplexityDetail() {
      const section = document.getElementById('inspectorComplexityTriggersSection');
      const hint = document.getElementById('inspectorComplexityToggleHint');
      if (!section) return;
      if (section.classList.contains('hidden')) {
        section.classList.remove('hidden');
        if (hint) hint.innerText = 'Schließen ▴';
      } else {
        section.classList.add('hidden');
        if (hint) hint.innerText = 'Fundstellen ▾';
      }
    }

    function renderInspectorComplexityTriggers(triggers, path) {
      const section = document.getElementById('inspectorComplexityTriggersSection');
      const countEl = document.getElementById('inspectorComplexityTriggersCount');
      const listEl = document.getElementById('inspectorComplexityTriggersList');
      const hint = document.getElementById('inspectorComplexityToggleHint');
      if (!section || !listEl) return;

      // Keep closed by default, show count
      section.classList.add('hidden');
      if (hint) hint.innerText = triggers && triggers.length ? `Fundstellen (${triggers.length}) ▾` : 'Fundstellen ▾';
      if (countEl) countEl.innerText = (triggers || []).length;

      if (!triggers || triggers.length === 0) {
        listEl.innerHTML = '<div class="text-[10px] text-zinc-500 italic py-1">Keine Verzweigungs-Fundstellen in dieser Datei.</div>';
        return;
      }

      listEl.innerHTML = triggers.slice(0, 25).map(tr => `
        <div class="p-1.5 rounded bg-brand-dark border border-brand-border hover:border-brand-orange/60 transition flex items-center justify-between gap-2 group">
          <div class="truncate flex-1 min-w-0">
            <div class="flex items-center space-x-1.5">
              <span class="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-400 font-bold">${escapeHtml(tr.type)}</span>
              <span class="text-[10px] text-zinc-400 font-mono">Z. ${tr.line}</span>
            </div>
            <div class="text-[10px] text-zinc-300 font-mono truncate mt-0.5" title="${escapeHtml(tr.snippet)}">${escapeHtml(tr.snippet)}</div>
          </div>
          <button onclick="openFileInViewer('${escapeJsString(path)}', null, ${tr.line})" class="px-2 py-1 rounded bg-brand-card hover:bg-brand-orange hover:text-black text-brand-orange border border-brand-orange/40 text-[10px] font-mono font-semibold flex items-center space-x-1 flex-shrink-0 transition cursor-pointer shadow-sm">
            <span>📍 Z. ${tr.line}</span>
          </button>
        </div>
      `).join('') + (triggers.length > 25 ? `<div class="text-[10px] text-zinc-500 text-center pt-1">+ ${triggers.length - 25} weitere Fundstellen</div>` : '');
    }



    // --- Mindmap Zoom & Node Actions ---
    function closeMindmapInspector() {
      const inspector = document.getElementById('mindmapNodeInspector');
      if (inspector) inspector.classList.add('hidden');
      activeInspectorNode = null;
    }

    function openInspectorFile() {
      if (activeInspectorNode && (activeInspectorNode.path || activeInspectorNode.name) && activeInspectorNode.path !== 'root') {
        const filePath = activeInspectorNode.path || activeInspectorNode.name;
        const targetSym = activeInspectorNode.nodeType === 'symbol' 
          ? activeInspectorNode.name?.replace(/^[⚡📦🔌\s]+/, '').replace(/\(\)$/, '').trim() 
          : null;
        openFileInViewer(filePath, targetSym);
      }
    }

    function copyInspectorPath() {
      if (!activeInspectorNode) return;
      const path = activeInspectorNode.path || activeInspectorNode.name;
      if (!path || path === 'root') return;
      
      const doCopy = () => {
        const label = document.getElementById('copyPathLabel');
        if (label) {
          const orig = label.innerText;
          label.innerText = '✓ Kopiert!';
          label.classList.add('text-emerald-400');
          setTimeout(() => {
            label.innerText = orig;
            label.classList.remove('text-emerald-400');
          }, 1500);
        }
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(path).then(doCopy).catch(() => {
          fallbackCopyText(path);
          doCopy();
        });
      } else {
        fallbackCopyText(path);
        doCopy();
      }
    }

    function fallbackCopyText(text) {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (err) {
        console.error('Fallback copy failed', err);
      }
      document.body.removeChild(textArea);
    }

    function executeInspectorSearch() {
      if (!activeInspectorNode) return;
      const input = document.getElementById('inspectorSearchInput');
      const term = input ? input.value.trim() : '';
      const path = activeInspectorNode.path;
      if (!path || path === 'root') return;
      
      openFileInViewer(path, term || null);
      if (term) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
    }

    function expandAllMindmapNodes() {
      if (!currentData) return;
      expandedNodesSet.add('center-root');

      const satellites = buildSatelliteDataStructure();
      satellites.forEach(sat => {
        expandedNodesSet.add(sat.id);
        (sat.children || []).forEach(child => {
          expandedNodesSet.add(child.id);
          if (child.children) {
            child.children.forEach(sub => expandedNodesSet.add(sub.id));
          }
        });
      });

      if (currentData.mindmap && currentData.mindmap.children) {
        const stack = [...currentData.mindmap.children];
        const visited = new Set();
        while (stack.length > 0) {
          const item = stack.pop();
          if (!item || visited.has(item)) continue;
          visited.add(item);
          if (item.id) expandedNodesSet.add(item.id);
          if (item.children && Array.isArray(item.children)) {
            for (let i = item.children.length - 1; i >= 0; i--) {
              stack.push(item.children[i]);
            }
          }
        }
      }

      renderMindmap();
      setTimeout(resetMindmapZoom, 200);
    }

    function collapseAllMindmapNodes() {
      expandedNodesSet.clear();
      expandedNodesSet.add('center-root');
      renderMindmap();
      setTimeout(resetMindmapZoom, 200);
    }

    function resetMindmapZoom() {
      if (visNetworkInstance) {
        visNetworkInstance.fit({
          animation: { duration: 500, easingFunction: 'easeInOutQuad' }
        });
      }
    }



// Attach to window
window.setMindmapMode = setMindmapMode;
window.generateAIMindmapWithLLM = generateAIMindmapWithLLM;
window.getMindmapNodeById = getMindmapNodeById;
window.buildMindmapNetworkData = buildMindmapNetworkData;
window.getMindmapOptions = getMindmapOptions;
window.triggerMindmapAutoStabilize = triggerMindmapAutoStabilize;
window.applyCodebaseFocusDimming = applyCodebaseFocusDimming;
window.clearCodebaseFocusDimming = clearCodebaseFocusDimming;
window.renderMindmap = renderMindmap;
window.setMindmapLayoutMode = setMindmapLayoutMode;
window.toggleMindmapLayoutMode = toggleMindmapLayoutMode;
window.toggleMindmapPhysicsFreeze = toggleMindmapPhysicsFreeze;
window.updateMindmapUIControls = updateMindmapUIControls;
window.handleMindmapNodeClick = handleMindmapNodeClick;
window.renderInspectorComplexityTriggers = renderInspectorComplexityTriggers;
window.closeMindmapInspector = closeMindmapInspector;
window.openInspectorFile = openInspectorFile;
window.copyInspectorPath = copyInspectorPath;
window.fallbackCopyText = fallbackCopyText;
window.executeInspectorSearch = executeInspectorSearch;
window.expandAllMindmapNodes = expandAllMindmapNodes;
window.collapseAllMindmapNodes = collapseAllMindmapNodes;
window.resetMindmapZoom = resetMindmapZoom;
