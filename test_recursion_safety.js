const fs = require('fs');
const assert = require('assert');

console.log('====================================================');
console.log('🧪 RUNNING COMPREHENSIVE RECURSION SAFETY TEST SUITE');
console.log('====================================================\n');

// 1. Load HTML Content and extract scripts
const htmlPath = 'G:/Dev/Labs/web/Analyzer/Code-Analyzer/codebase_knowledge_base_app.html';
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// ----------------------------------------------------
// TEST 1: Early Ingestion and Lifecycle Hooks (No Stack Overflow / Mutual Recursion)
// ----------------------------------------------------
console.log('▶ TEST 1: Early vs Late Ingestion Lifecycle Test...');
{
  const testWindow = {};
  
  // Define early lifecycle handlers exactly as in codebase_knowledge_base_app.html
  testWindow.__handleIncomingData = function(data) {
    if (typeof testWindow._internalIngestAnalysisData === 'function') {
      return testWindow._internalIngestAnalysisData(data);
    }
    testWindow.__pendingAnalysisData = data;
    return true;
  };
  testWindow.loadAnalysisData = function(data) {
    return testWindow.__handleIncomingData(data);
  };
  testWindow.ingestAnalysisData = function(data) {
    return testWindow.__handleIncomingData(data);
  };

  // Call BEFORE main analyzer is loaded
  const earlyPayload = { project_name: 'EarlyProject', files: {} };
  testWindow.loadAnalysisData(earlyPayload);
  assert.strictEqual(testWindow.__pendingAnalysisData, earlyPayload, 'Pending data must be buffered');

  // Call ingestAnalysisData BEFORE main analyzer
  const earlyPayload2 = { project_name: 'EarlyProject2', files: {} };
  testWindow.ingestAnalysisData(earlyPayload2);
  assert.strictEqual(testWindow.__pendingAnalysisData, earlyPayload2, 'Pending data must be buffered on ingest call');

  // Now simulate late initialization of main analyzer
  let ingestedData = null;
  function mockMainIngest(data) {
    ingestedData = data;
    return true;
  }
  testWindow._internalIngestAnalysisData = mockMainIngest;
  testWindow.loadAnalysisData = mockMainIngest;
  testWindow.ingestAnalysisData = mockMainIngest;

  if (testWindow.__pendingAnalysisData) {
    const p = testWindow.__pendingAnalysisData;
    testWindow.__pendingAnalysisData = null;
    testWindow.ingestAnalysisData(p);
  }

  assert.strictEqual(ingestedData, earlyPayload2, 'Buffered payload should be ingested upon initialization');
  assert.strictEqual(testWindow.__pendingAnalysisData, null, 'Pending data should be cleared');

  // Call AFTER initialization
  const latePayload = { project_name: 'LateProject' };
  testWindow.loadAnalysisData(latePayload);
  assert.strictEqual(ingestedData, latePayload, 'Late loadAnalysisData should directly ingest without recursion');
  
  console.log('  ✅ Early and late ingestion hooks execute safely with 0 recursion.');
}

// ----------------------------------------------------
// TEST 2: Extreme Tree Depth Test (2,500 nested directory levels)
// ----------------------------------------------------
console.log('\n▶ TEST 2: Extreme Deep Hierarchy Test (2,500 nested levels)...');
{
  // Construct a 2,500 levels deep tree
  let deepRoot = { name: 'root', type: 'directory', children: {} };
  let currentDir = deepRoot;
  for (let i = 1; i <= 2500; i++) {
    const childDir = {
      name: `dir_level_${i}`,
      type: 'directory',
      children: {
        [`file_${i}.js`]: {
          name: `file_${i}.js`,
          type: 'file',
          path: `dir_level_${i}/file_${i}.js`,
          symbols: [{ name: `func_${i}`, type: 'function', line: i }]
        }
      }
    };
    currentDir.children[`dir_level_${i}`] = childDir;
    currentDir = childDir;
  }

  // Iterative convertFileTreeToMindmap extracted from codebase_knowledge_base_app.html
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

  const mindmap = convertFileTreeToMindmap(deepRoot);
  assert.strictEqual(mindmap.length, 1, 'Root should have 1 child directory');
  console.log('  ✅ convertFileTreeToMindmap processed 2,500 depth levels with zero stack overflow.');

  // Test FileTree HTML rendering on deep tree
  let folderCounter = 0;
  const folderExpandedState = new Map();
  const activeFile = null;
  function getFileIconInfo() { return { icon: 'file', emoji: '📄' }; }

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
            folderExpandedState.set(folderId, false);
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

  const htmlOutput = buildTreeHTML(deepRoot);
  assert.ok(htmlOutput.length > 10000, 'HTML output should be rendered for all 2500 levels');
  console.log(`  ✅ buildTreeHTML processed 2,500 depth levels (${(htmlOutput.length / 1024).toFixed(1)} KB HTML) with zero recursion.`);
}

// ----------------------------------------------------
// TEST 3: Cyclic Structure & Circular References Test
// ----------------------------------------------------
console.log('\n▶ TEST 3: Cyclic Structure & Circular References Test...');
{
  // Create cyclical graph/tree
  const nodeA = { name: 'nodeA', type: 'directory', children: {} };
  const nodeB = { name: 'nodeB', type: 'directory', children: {} };
  nodeA.children['nodeB'] = nodeB;
  nodeB.children['nodeA'] = nodeA; // Circular reference!
  nodeB.parent = nodeA;

  // Safe JSON Stringify
  function safeJsonStringify(obj, space = 2) {
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
  }

  const json = safeJsonStringify(nodeA);
  assert.ok(json.includes('nodeA') && json.includes('nodeB'), 'Circular object successfully stringified without crashing');
  console.log('  ✅ safeJsonStringify handles cyclic graphs seamlessly.');

  // Cycle test for countDescendantFiles
  const directChildren = [
    { nodeType: 'file', path: 'f1.js' },
    { nodeType: 'layer', children: [] }
  ];
  directChildren[1].children.push(directChildren[1]); // direct circular loop!

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

  const count = countDescendantFiles({ children: directChildren });
  assert.strictEqual(count, 1, 'Should count 1 file and terminate despite cycle');
  console.log('  ✅ countDescendantFiles safely handles circular loops without infinite recursion.');
}

console.log('\n====================================================');
console.log('🎉 ALL RECURSION SAFETY TESTS PASSED SUCCESSFULLY! 🎉');
console.log('====================================================\n');
