/**
 * Zero-Download Git Importer & Lazy File Fetcher
 * Features: GitHub, GitLab & Codeberg recursive Git tree ingestion,
 * On-demand lazy source code retrieval with memory cache and Code Viewer integration.
 */

  let isGitMode = false;
  let currentGitUrl = "";
  let currentGitBranch = "";
  let currentGitToken = "";

  function openGitImportModal() {
    document.getElementById('gitImportModal').classList.remove('hidden');
    // Ensure lucide icons are rendered in the modal if added dynamically
    if(window.lucide) {
      window.lucide.createIcons();
    }
  }

  function closeGitImportModal() {
    document.getElementById('gitImportModal').classList.add('hidden');
  }

  function setGitPreset(url) {
    document.getElementById('gitRepoUrl').value = url;
  }

  async function executeGitImport() {
    const url = document.getElementById('gitRepoUrl').value.trim();
    const branch = document.getElementById('gitRepoBranch').value.trim();
    const token = document.getElementById('gitRepoToken').value.trim();
    
    if (!url) {
      alert("Please enter a Git Repository URL.");
      return;
    }
    
    closeGitImportModal();
    const loadingStatus = document.getElementById('loadingStatus');
    const dropzoneView = document.getElementById('dropzoneView');
    
    if(loadingStatus) {
       loadingStatus.classList.remove('hidden');
       loadingStatus.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Analyzing Git Tree via API...</span>`;
    }
    
    isGitMode = true;
    currentGitUrl = url;
    currentGitBranch = branch;
    currentGitToken = token;
    
    try {
      // 1. Try Backend API first
      let apiEndpoint = `/api/git/tree?url=${encodeURIComponent(url)}`;
      if (branch) apiEndpoint += `&branch=${encodeURIComponent(branch)}`;
      
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      let response = await fetch(apiEndpoint, { headers }).catch(() => null);
      let data = null;
      
      if (response && response.ok) {
         data = await response.json();
      } else {
         // 2. Client-side Fallback (Mock data structure based on URL parsing for GitHub)
         console.warn("Backend API unavailable or failed. Using client-side GitHub API fallback.");
         const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
         if (match) {
           const owner = match[1];
           let repo = match[2];
           if (repo.endsWith('.git')) repo = repo.slice(0, -4);
           const githubApiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch || 'HEAD'}?recursive=1`;
           
           const ghResponse = await fetch(githubApiUrl, { headers });
           if (!ghResponse.ok) throw new Error("GitHub API failed.");
           const ghData = await ghResponse.json();
           
           // Convert GitHub tree to our expected format
           data = {
             project_name: `${owner}/${repo}`,
             summary: {
               total_files: ghData.tree.length,
               total_lines: 0,
               code_lines: 0,
               comment_lines: 0,
               blank_lines: 0,
               avg_complexity: 0,
               languages: {}
             },
             files: []
           };
           
           for(const item of ghData.tree) {
             if(item.type === "blob") {
               const parts = item.path.split('/');
               const name = parts[parts.length - 1];
               const ext = name.split('.').pop();
               
               // Try to determine language simply
               let lang = "Unknown";
               if(ext === "js" || ext === "jsx") lang = "JavaScript";
               else if(ext === "ts" || ext === "tsx") lang = "TypeScript";
               else if(ext === "py") lang = "Python";
               else if(ext === "rs") lang = "Rust";
               else if(ext === "go") lang = "Go";
               else if(ext === "html") lang = "HTML";
               else if(ext === "css") lang = "CSS";
               else if(ext === "json") lang = "JSON";
               else if(ext === "md") lang = "Markdown";
               
               data.summary.languages[lang] = (data.summary.languages[lang] || 0) + 100;
               
               data.files.push({
                 path: item.path,
                 name: name,
                 language: lang,
                 size_bytes: item.size || 1024,
                 lines: 100,
                 functions: [],
                 classes: [],
                 imports: [],
                 git_raw_url: `https://raw.githubusercontent.com/${owner}/${repo}/${branch || 'HEAD'}/${item.path}`
               });
             }
           }
         } else {
           throw new Error("Only GitHub URLs are supported in client-side fallback.");
         }
      }
      
      // Load into app
      window.loadAnalysisData(data);
      if (dropzoneView) {
        dropzoneView.classList.add('hidden');
      }
      
      console.log("Git Repository successfully imported:", data.project_name);
      alert(`Git Repository "${data.project_name}" erfolgreich geladen!`);
      
    } catch (e) {
      alert("Failed to import Git Repo: " + e.message);
      console.error(e);
    } finally {
      if(loadingStatus) loadingStatus.classList.add('hidden');
    }
  }

  // Intercept the file loading to fetch raw content lazily
  document.addEventListener('DOMContentLoaded', () => {
    // Wait for everything to initialize, then hook window.showFileContent & openFileInViewer
    setTimeout(() => {
      const originalShowFileContent = window.showFileContent || window.openFileInViewer;
      if(originalShowFileContent) {
        const wrappedFunction = async function(filePath, sym = null, line = null) {
          if(isGitMode && window.globalAnalysisData && window.globalAnalysisData.files) {
            // Find the file node
            const fileNode = window.globalAnalysisData.files.find(f => f.path === filePath);
            if(fileNode && fileNode.git_raw_url) {
               try {
                 // Try fetching content if not cached
                 if (!fileNode.content || (window.globalAnalysisData.file_contents && window.globalAnalysisData.file_contents[filePath]?.includes('CORENOW CODEBASE SNAPSHOT - METADATA PLACEHOLDER'))) {
                   const codeContentEl = document.getElementById('codeContent');
                   if (codeContentEl) codeContentEl.textContent = "Loading source code from remote...";
                   
                   const headers = {};
                   if (currentGitToken) headers['Authorization'] = `token ${currentGitToken}`;
                   
                   const res = await fetch(fileNode.git_raw_url, { headers });
                   if(res.ok) {
                     fileNode.content = await res.text();
                     if (window.globalAnalysisData.file_contents) {
                       window.globalAnalysisData.file_contents[filePath] = fileNode.content;
                     }
                   } else {
                     if (codeContentEl) codeContentEl.textContent = "Error loading source code: " + res.status;
                     return;
                   }
                 }
               } catch(e) {
                 const codeContentEl = document.getElementById('codeContent');
                 if (codeContentEl) codeContentEl.textContent = "Error loading source code.";
                 return;
               }
            }
          }
          if (typeof originalShowFileContent === 'function') {
            originalShowFileContent(filePath, sym, line);
          }
        };
        window.showFileContent = wrappedFunction;
        window.openFileInViewer = wrappedFunction;
      }
    }, 1000);
  });
</script>


// Attach to window
window.openGitImportModal = openGitImportModal;
window.closeGitImportModal = closeGitImportModal;
window.setGitPreset = setGitPreset;
window.startGitImport = startGitImport;
window.fetchGitFileContent = fetchGitFileContent;
