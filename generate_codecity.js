const fs = require('fs');

const jsCode = `
    // =========================================================================
    // 🏙️ 3D CODE-CITY METROPOLIS (Three.js r128 Engine)
    // Cyber-Style Ground Streets, Manhattan Routing, Instanced Low-Poly Trees & Deko,
    // Shared Materials, Memory Disposal & Interactive Filter Sidebar
    // =========================================================================

    class CodeCityMetropolis {
      constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2(-9999, -9999);
        this.animFrameId = null;

        // Data & Scene Objects
        this.data = null;
        this.districts = []; // [{ name, path, bounds, plateMesh, labelSprite, x, z, width, depth }]
        this.buildings = []; // [{ mesh, edgesMesh, beaconMesh, labelSprite, spireMesh, fileData, district, langColor, height, width, x, z, loc, complexity, risk }]
        this.buildingMap = new Map(); // path -> buildingObj
        this.highways = []; // [{ curve, tubeMesh, particles: [{ mesh, t, speed }], sourcePath, targetPath, importName }]
        this.labels = []; // all canvas sprites
        this.raycastTargets = []; // strictly visible building meshes for fast raycasting
        this.instancedMeshes = []; // [treeCrowns, treeTrunks, streetBollards]

        // Interaction State
        this.hoveredBuilding = null;
        this.hoveredHighway = null;
        this.selectedBuilding = null;
        this.isolatedBuilding = null;
        this.isFlying = false;
        this.flyState = null;
        this.sidebarOpen = false;

        // Filter State
        this.searchQuery = '';
        this.minLoc = 0;
        this.activeDistricts = new Set();
        this.activeLanguages = new Set();
        this.availableDistricts = [];
        this.availableLanguages = [];

        // Settings
        this.trafficEnabled = true;
        this.decoEnabled = true;
        this.labelsEnabled = true;
        this.theme = 'cyberpunk'; // 'cyberpunk' | 'dark_studio'

        // Styleguide Colors
        this.styleColors = {
          green: 0x63B22F,
          darkGray: 0x414141,
          neon: 0xD9FF3D,
          pink: 0xFF8EAB,
          orange: 0xFF8000,
          bgDark: 0x07080c,
          cardDark: 0x18181b
        };

        // Language Colors Palette
        this.langColors = {
          'Rust': 0xFF8000,
          'TypeScript': 0x38BDF8,
          'JavaScript': 0xF59E0B,
          'Python': 0x10B981,
          'CSS': 0xEC4899,
          'HTML': 0xEC4899,
          'Go': 0x06B6D4,
          'C': 0x6366F1,
          'C++': 0x6366F1,
          'SQL': 0xA855F7,
          'JSON': 0x64748B,
          'TOML': 0x64748B,
          'YAML': 0x64748B,
          'Markdown': 0x94A3B8,
          'Default': 0x63B22F
        };

        // Procedural Textures & Shared Materials Cache
        this.windowTextures = {};
        this.sharedBuildingMaterials = {};
        this.sharedEdgeMaterials = {};
        this.dimBuildingMaterial = null;
        this.gridFloor = null;
        this.ambientLight = null;
        this.dirLight1 = null;
        this.dirLight2 = null;
        this.rimLightCyan = null;
        this.rimLightOrange = null;

        this.init();
      }

      init() {
        if (!this.container || typeof THREE === 'undefined') return;

        // 1. Scene with Deep Cyber Fog (Viewport distance culling)
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.styleColors.bgDark);
        this.scene.fog = new THREE.FogExp2(this.styleColors.bgDark, 0.0018);

        // Dimensions
        const width = this.container.clientWidth || window.innerWidth - 64;
        const height = this.container.clientHeight || window.innerHeight - 56;

        // 2. Camera (Isometric High-Tech Perspective)
        this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 4000);
        this.camera.position.set(160, 180, 220);

        // 3. Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.25;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Attach canvas
        this.container.innerHTML = '';
        this.container.appendChild(this.renderer.domElement);

        // 4. OrbitControls
        if (typeof THREE.OrbitControls !== 'undefined') {
          this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
          this.controls.enableDamping = true;
          this.controls.dampingFactor = 0.06;
          this.controls.screenSpacePanning = true;
          this.controls.minDistance = 12;
          this.controls.maxDistance = 1200;
          this.controls.maxPolarAngle = Math.PI / 2.05; // Prevent camera sinking under floor
          this.controls.target.set(0, 5, 0);
        }

        // 5. Shared Dim Material for Filtered Out Buildings
        this.dimBuildingMaterial = new THREE.MeshStandardMaterial({
          color: 0x111318,
          roughness: 0.9,
          metalness: 0.1,
          transparent: true,
          opacity: 0.12,
          depthWrite: false
        });

        // 6. Lighting & Base Ground
        this.setupLights();
        this.setupFloor();

        // 7. Event Listeners
        window.addEventListener('resize', this.onResize.bind(this));
        this.container.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.container.addEventListener('click', this.onClick.bind(this));
        this.container.addEventListener('mouseleave', this.onMouseLeave.bind(this));

        // 8. Start Animation Loop
        this.animate = this.animate.bind(this);
        this.animate();
      }

      setupLights() {
        // Soft Cyber Ambient
        this.ambientLight = new THREE.AmbientLight(0x1a2238, 1.4);
        this.scene.add(this.ambientLight);

        // Key Sun / Directional Light with Soft Shadows
        this.dirLight1 = new THREE.DirectionalLight(0xfff5ea, 1.6);
        this.dirLight1.position.set(180, 260, 140);
        this.dirLight1.castShadow = true;
        this.dirLight1.shadow.mapSize.width = 2048;
        this.dirLight1.shadow.mapSize.height = 2048;
        this.dirLight1.shadow.camera.near = 10;
        this.dirLight1.shadow.camera.far = 1000;
        const d = 300;
        this.dirLight1.shadow.camera.left = -d;
        this.dirLight1.shadow.camera.right = d;
        this.dirLight1.shadow.camera.top = d;
        this.dirLight1.shadow.camera.bottom = -d;
        this.dirLight1.shadow.bias = -0.0005;
        this.scene.add(this.dirLight1);

        // Cyber Rim Lights (Cyan & Neon Orange)
        this.rimLightCyan = new THREE.DirectionalLight(0x00d2ff, 1.1);
        this.rimLightCyan.position.set(-200, 120, -180);
        this.scene.add(this.rimLightCyan);

        this.rimLightOrange = new THREE.DirectionalLight(this.styleColors.orange, 1.2);
        this.rimLightOrange.position.set(200, 100, -200);
        this.scene.add(this.rimLightOrange);
      }

      setupFloor() {
        // Base dark ground plate
        const floorGeo = new THREE.PlaneGeometry(2400, 2400);
        const floorMat = new THREE.MeshStandardMaterial({
          color: 0x050608,
          roughness: 0.95,
          metalness: 0.2
        });
        const floorMesh = new THREE.Mesh(floorGeo, floorMat);
        floorMesh.rotation.x = -Math.PI / 2;
        floorMesh.position.y = -1.2;
        floorMesh.receiveShadow = true;
        floorMesh.frustumCulled = true;
        this.scene.add(floorMesh);

        // Glowing Cyber Highway Matrix Grid
        this.gridFloor = new THREE.GridHelper(1200, 120, this.styleColors.neon, 0x182030);
        this.gridFloor.position.y = -1.1;
        this.gridFloor.material.opacity = 0.4;
        this.gridFloor.material.transparent = true;
        this.gridFloor.frustumCulled = true;
        this.scene.add(this.gridFloor);
      }

      getLanguageColor(lang) {
        if (!lang) return this.langColors['Default'];
        for (const [key, color] of Object.entries(this.langColors)) {
          if (lang.toLowerCase().includes(key.toLowerCase())) {
            return color;
          }
        }
        return this.langColors['Default'];
      }

      createWindowTexture(hexColor) {
        if (this.windowTextures[hexColor]) return this.windowTextures[hexColor];

        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // Dark skyscraper facade base
        ctx.fillStyle = '#12141a';
        ctx.fillRect(0, 0, 128, 256);

        // Accent color for illuminated windows
        const c = new THREE.Color(hexColor);
        const colorRgba = 'rgba(' + Math.round(c.r * 255) + ', ' + Math.round(c.g * 255) + ', ' + Math.round(c.b * 255) + ', 0.85)';
        const dimRgba = 'rgba(' + Math.round(c.r * 255) + ', ' + Math.round(c.g * 255) + ', ' + Math.round(c.b * 255) + ', 0.2)';

        const cols = 6;
        const rows = 16;
        const padX = 4;
        const padY = 4;
        const cellW = (128 - (cols + 1) * padX) / cols;
        const cellH = (256 - (rows + 1) * padY) / rows;

        for (let r = 0; r < rows; r++) {
          for (let col = 0; col < cols; col++) {
            const isLit = (Math.sin(r * 3.7 + col * 5.1) > -0.15);
            ctx.fillStyle = isLit ? colorRgba : (Math.random() > 0.4 ? dimRgba : '#080a0e');
            ctx.fillRect(
              padX + col * (cellW + padX),
              padY + r * (cellH + padY),
              cellW,
              cellH
            );
          }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 2);
        this.windowTextures[hexColor] = texture;
        return texture;
      }

      // Shared Building Material Cache per Language Hex
      getSharedBuildingMaterial(langColorHex) {
        if (this.sharedBuildingMaterials[langColorHex]) {
          return this.sharedBuildingMaterials[langColorHex];
        }
        const windowTex = this.createWindowTexture(langColorHex);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x181a20,
          roughness: 0.25,
          metalness: 0.75,
          map: windowTex,
          emissive: new THREE.Color(langColorHex),
          emissiveIntensity: 0.15
        });
        this.sharedBuildingMaterials[langColorHex] = mat;
        return mat;
      }

      // Shared Edge Material Cache per Language Hex
      getSharedEdgeMaterial(langColorHex) {
        if (this.sharedEdgeMaterials[langColorHex]) {
          return this.sharedEdgeMaterials[langColorHex];
        }
        const mat = new THREE.LineBasicMaterial({
          color: langColorHex,
          linewidth: 2,
          transparent: true,
          opacity: 0.85
        });
        this.sharedEdgeMaterials[langColorHex] = mat;
        return mat;
      }

      createCanvasTextSprite(text, subText, accentHex, isDistrict = false) {
        const canvas = document.createElement('canvas');
        canvas.width = isDistrict ? 512 : 384;
        canvas.height = isDistrict ? 128 : 96;
        const ctx = canvas.getContext('2d');

        // Rounded pill background
        ctx.fillStyle = isDistrict ? 'rgba(20, 20, 24, 0.94)' : 'rgba(15, 15, 18, 0.92)';
        const rad = isDistrict ? 20 : 16;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, rad);
        } else {
          ctx.rect(4, 4, canvas.width - 8, canvas.height - 8);
        }
        ctx.fill();

        // Neon border
        const c = new THREE.Color(accentHex);
        ctx.strokeStyle = 'rgba(' + Math.round(c.r * 255) + ', ' + Math.round(c.g * 255) + ', ' + Math.round(c.b * 255) + ', 0.85)';
        ctx.lineWidth = isDistrict ? 5 : 3.5;
        ctx.stroke();

        // Glow
        ctx.shadowColor = 'rgba(' + Math.round(c.r * 255) + ', ' + Math.round(c.g * 255) + ', ' + Math.round(c.b * 255) + ', 0.6)';
        ctx.shadowBlur = 10;

        // Primary Text
        ctx.fillStyle = '#ffffff';
        ctx.font = isDistrict ? 'bold 36px "JetBrains Mono", monospace' : 'bold 28px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvas.width / 2, isDistrict ? 46 : 38);

        // Sub Text (LOC or file count)
        if (subText) {
          ctx.fillStyle = isDistrict ? '#D9FF3D' : '#FF8000';
          ctx.font = isDistrict ? '600 24px "JetBrains Mono", monospace' : '600 20px "JetBrains Mono", monospace';
          ctx.fillText(subText, canvas.width / 2, isDistrict ? 88 : 70);
        }

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
          depthTest: true
        });
        const sprite = new THREE.Sprite(spriteMat);
        const scale = isDistrict ? 22 : 12;
        sprite.scale.set(scale, scale * (canvas.height / canvas.width), 1);
        sprite.frustumCulled = true;
        return sprite;
      }

      buildCity(data) {
        if (!data) return;
        this.data = data;

        // 1. Clean previous scene objects & dispose memory
        this.clearCity();

        // 2. Extract normalized files list
        const fileList = this.extractNormalizedFiles(data);
        if (fileList.length === 0) return;

        // 3. Group files by district (parent folder)
        const districtsMap = new Map();
        fileList.forEach(file => {
          const parts = file.path.split('/');
          const dirPath = parts.length > 1 ? parts.slice(0, -1).join('/') : 'root';
          if (!districtsMap.has(dirPath)) {
            districtsMap.set(dirPath, []);
          }
          districtsMap.get(dirPath).push(file);
        });

        // 4. Calculate district layout & dimensions
        const districtArray = Array.from(districtsMap.entries()).map(([dirPath, files]) => {
          const count = files.length;
          const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
          const rows = Math.max(1, Math.ceil(count / cols));
          const cellSize = 26;
          const padding = 20;
          const width = cols * cellSize + padding * 2;
          const depth = rows * cellSize + padding * 2;
          return {
            dirPath,
            name: dirPath === 'root' ? '📦 root' : '📁 ' + dirPath,
            files,
            cols,
            rows,
            cellSize,
            width,
            depth,
            x: 0,
            z: 0
          };
        });

        // 5. Position districts in an organized macro-grid
        this.arrangeDistricts(districtArray);

        // Track Tree & Deco Placements for InstancedMesh
        const treeCrownTransforms = [];
        const bollardTransforms = [];

        // 6. Construct District Plates, Buildings & Collect Deco Positions
        districtArray.forEach(district => {
          this.createDistrictPlate(district, treeCrownTransforms, bollardTransforms);
          this.createDistrictBuildings(district);
        });

        // 7. Construct Low-Poly Instanced Trees & Deco (1 Draw Call for all trees!)
        this.createInstancedDeco(treeCrownTransforms, bollardTransforms);

        // 8. Construct Cyber-Style Ground Highways & Data Impulse Traffic
        this.createCyberGroundHighways(fileList);

        // 9. Update Filter Sidebar, Badges & Raycast Targets
        this.setupFilterSidebar(districtArray, fileList);
        this.updateRaycastTargets();

        // 10. Frame overview camera
        this.resetCamera(false);
      }

      extractNormalizedFiles(data) {
        const list = [];
        const seen = new Set();

        if (data.files && typeof data.files === 'object') {
          for (const [path, fileObj] of Object.entries(data.files)) {
            const normPath = path.replace(/\\\\/g, '/');
            if (!seen.has(normPath)) {
              seen.add(normPath);
              list.push({
                path: normPath,
                language: fileObj.language || (typeof getLanguageFromPath === 'function' ? getLanguageFromPath(normPath) : 'Default'),
                code_lines: fileObj.code_lines || fileObj.lines || fileObj.total_lines || 40,
                total_lines: fileObj.total_lines || fileObj.code_lines || 40,
                complexity: fileObj.complexity || 1,
                risk_score: fileObj.risk_score || 0,
                symbols: fileObj.symbols || { functions: [], classes: [], structs: [], interfaces: [], imports: [] },
                intent_role: fileObj.intent_role || 'Core',
                content: data.file_contents?.[normPath] || ''
              });
            }
          }
        }

        // Fallback from file_contents if files map is sparse
        if (list.length === 0 && data.file_contents) {
          for (const [path, content] of Object.entries(data.file_contents)) {
            const normPath = path.replace(/\\\\/g, '/');
            if (!seen.has(normPath)) {
              seen.add(normPath);
              const lang = typeof getLanguageFromPath === 'function' ? getLanguageFromPath(normPath) : 'Default';
              const lines = content ? content.split('\\n').length : 30;
              const syms = typeof extractSymbols === 'function' ? extractSymbols(content, lang, normPath) : [];
              list.push({
                path: normPath,
                language: lang,
                code_lines: lines,
                total_lines: lines,
                complexity: 1,
                risk_score: 0,
                symbols: { functions: syms, classes: [], structs: [], interfaces: [], imports: [] },
                intent_role: 'Core',
                content: content
              });
            }
          }
        }

        return list;
      }

      arrangeDistricts(districts) {
        const total = districts.length;
        const macroCols = Math.max(1, Math.ceil(Math.sqrt(total)));
        const districtMargin = 38;

        let curX = 0;
        let curZ = 0;
        let maxRowHeight = 0;
        let rowDistricts = [];

        districts.forEach((d, idx) => {
          rowDistricts.push(d);
          curX += d.width + districtMargin;
          maxRowHeight = Math.max(maxRowHeight, d.depth);

          if (rowDistricts.length >= macroCols || idx === total - 1) {
            let rowXOffset = -curX / 2;
            rowDistricts.forEach(rd => {
              rd.x = rowXOffset + rd.width / 2;
              rd.z = curZ + rd.depth / 2;
              rowXOffset += rd.width + districtMargin;
            });
            curZ += maxRowHeight + districtMargin;
            curX = 0;
            maxRowHeight = 0;
            rowDistricts = [];
          }
        });

        // Center all districts around origin (0, 0)
        const centerZOffset = -curZ / 2;
        districts.forEach(d => {
          d.z += centerZOffset;
        });
      }

      createDistrictPlate(district, treeCrownTransforms, bollardTransforms) {
        // 1. Base district plate (Dark Chamfered Platform)
        const plateGeo = new THREE.BoxGeometry(district.width, 1.8, district.depth);
        const plateMat = new THREE.MeshStandardMaterial({
          color: 0x14161c,
          roughness: 0.85,
          metalness: 0.35
        });
        const plateMesh = new THREE.Mesh(plateGeo, plateMat);
        plateMesh.position.set(district.x, 0.0, district.z);
        plateMesh.receiveShadow = true;
        plateMesh.frustumCulled = true;
        this.scene.add(plateMesh);

        // 2. Glowing Neon Border (Cyber Green / Orange)
        const edgesGeo = new THREE.EdgesGeometry(plateGeo);
        const edgesMat = new THREE.LineBasicMaterial({
          color: this.styleColors.neon,
          linewidth: 2,
          transparent: true,
          opacity: 0.65
        });
        const edgesMesh = new THREE.LineSegments(edgesGeo, edgesMat);
        edgesMesh.frustumCulled = true;
        plateMesh.add(edgesMesh);

        // 3. District Label Billboard
        const districtLabel = this.createCanvasTextSprite(
          district.name,
          district.files.length + ' Files',
          this.styleColors.neon,
          true
        );
        districtLabel.position.set(district.x, 1.5, district.z + district.depth / 2 + 8);
        this.scene.add(districtLabel);
        this.labels.push(districtLabel);

        // 4. Collect Tree & Neon Bollard positions along district border corners & green alleys
        const halfW = district.width / 2;
        const halfD = district.depth / 2;

        // Place Low-Poly Trees along district outer borders (avoiding center where buildings stand)
        const cornerOffsets = [
          [-halfW + 6, -halfD + 6],
          [halfW - 6, -halfD + 6],
          [-halfW + 6, halfD - 6],
          [halfW - 6, halfD - 6],
          [0, -halfD + 5],
          [0, halfD - 5],
          [-halfW + 5, 0],
          [halfW - 5, 0]
        ];

        cornerOffsets.forEach(([ox, oz]) => {
          const tx = district.x + ox;
          const tz = district.z + oz;
          const scale = 0.85 + Math.random() * 0.4;
          const rotY = Math.random() * Math.PI * 2;
          treeCrownTransforms.push({ x: tx, y: 1.0, z: tz, scale, rotY });
        });

        // Place Neon Bollards / Lanterns at plate corners
        const bollardOffsets = [
          [-halfW + 2, -halfD + 2],
          [halfW - 2, -halfD + 2],
          [-halfW + 2, halfD - 2],
          [halfW - 2, halfD - 2]
        ];

        bollardOffsets.forEach(([ox, oz]) => {
          bollardTransforms.push({ x: district.x + ox, y: 0.9, z: district.z + oz });
        });

        this.districts.push({
          name: district.name,
          path: district.dirPath,
          plateMesh,
          districtLabel,
          x: district.x,
          z: district.z,
          width: district.width,
          depth: district.depth,
          files: district.files
        });
      }

      createDistrictBuildings(district) {
        const startX = district.x - district.width / 2 + district.cellSize / 2 + 18;
        const startZ = district.z - district.depth / 2 + district.cellSize / 2 + 18;

        district.files.forEach((file, index) => {
          const col = index % district.cols;
          const row = Math.floor(index / district.cols);
          const posX = startX + col * district.cellSize;
          const posZ = startZ + row * district.cellSize;

          // Compute Metrics
          const loc = file.code_lines || file.total_lines || 30;
          const complexity = file.complexity || 1;
          const risk = file.risk_score || (complexity > 18 ? 35 : 0);
          const langColorHex = this.getLanguageColor(file.language);

          // Proportional Height
          const height = Math.min(85, Math.max(6.0, Math.log2(Math.max(loc, 4)) * 7.2 - 10));

          // Base footprint size
          const symCount = (file.symbols?.functions?.length || 0) + (file.symbols?.classes?.length || 0) + (file.symbols?.structs?.length || 0);
          const baseSize = Math.min(17.0, Math.max(9.5, 9.5 + symCount * 0.4 + Math.min(complexity * 0.15, 3.5)));

          // Building Geometry & Shared Material
          const buildingGeo = new THREE.BoxGeometry(baseSize, height, baseSize);
          const buildingMat = this.getSharedBuildingMaterial(langColorHex);

          const buildingMesh = new THREE.Mesh(buildingGeo, buildingMat);
          buildingMesh.position.set(posX, height / 2 + 0.9, posZ);
          buildingMesh.castShadow = true;
          buildingMesh.receiveShadow = true;
          buildingMesh.frustumCulled = true;
          this.scene.add(buildingMesh);

          // Shared Neon Edge Outline
          const edgesGeo = new THREE.EdgesGeometry(buildingGeo);
          const edgesMat = this.getSharedEdgeMaterial(langColorHex);
          const edgesMesh = new THREE.LineSegments(edgesGeo, edgesMat);
          edgesMesh.frustumCulled = true;
          buildingMesh.add(edgesMesh);

          // Rooftop Spire for Skyscrapers (> 220 LOC)
          let spireMesh = null;
          if (loc > 220) {
            const spireGeo = new THREE.CylinderGeometry(0.2, 0.55, 7.0, 6);
            const spireMat = new THREE.MeshBasicMaterial({ color: langColorHex });
            spireMesh = new THREE.Mesh(spireGeo, spireMat);
            spireMesh.position.set(0, height / 2 + 3.5, 0);
            spireMesh.frustumCulled = true;
            buildingMesh.add(spireMesh);

            // Antenna Tip Beacon
            const tipGeo = new THREE.SphereGeometry(0.45, 6, 6);
            const tipMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const tipMesh = new THREE.Mesh(tipGeo, tipMat);
            tipMesh.position.set(0, 3.5, 0);
            tipMesh.frustumCulled = true;
            spireMesh.add(tipMesh);
          }

          // Pulsing Risk / Hazard Beacon (Pink #FF8EAB / Rose)
          let beaconMesh = null;
          if (complexity > 18 || risk > 25) {
            const beaconGeo = new THREE.SphereGeometry(0.9, 8, 8);
            const beaconMat = new THREE.MeshBasicMaterial({
              color: this.styleColors.pink,
              transparent: true,
              opacity: 0.95
            });
            beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
            beaconMesh.position.set(0, height / 2 + (spireMesh ? 8.0 : 1.2), 0);
            beaconMesh.frustumCulled = true;
            buildingMesh.add(beaconMesh);
          }

          // 2D/3D Floating Billboard Label
          const fileName = file.path.split('/').pop();
          const labelSprite = this.createCanvasTextSprite(fileName, loc + ' LOC', langColorHex, false);
          labelSprite.position.set(posX, height + 1.0 + (spireMesh ? 10.0 : 4.5), posZ);
          this.scene.add(labelSprite);
          this.labels.push(labelSprite);

          // Store Building Reference
          const buildingObj = {
            mesh: buildingMesh,
            edgesMesh,
            beaconMesh,
            spireMesh,
            labelSprite,
            fileData: file,
            district: district.dirPath,
            langColor: langColorHex,
            height,
            width: baseSize,
            x: posX,
            z: posZ,
            loc,
            complexity,
            risk
          };

          buildingMesh.userData = { type: 'building', buildingObj };
          this.buildings.push(buildingObj);
          this.buildingMap.set(file.path, buildingObj);
        });
      }

      // =======================================================================
      // Low-Poly City Elements (Trees & Bollards) with THREE.InstancedMesh
      // Single Draw Call for hundreds of Trees!
      // =======================================================================
      createInstancedDeco(treeTransforms, bollardTransforms) {
        // 1. Instanced Trees (Crowns + Trunks)
        if (treeTransforms && treeTransforms.length > 0) {
          const count = treeTransforms.length;

          // Tree Crown: Low-Poly Emerald Green Cone (#63B22F)
          const crownGeo = new THREE.ConeGeometry(1.2, 2.6, 5);
          const crownMat = new THREE.MeshStandardMaterial({
            color: this.styleColors.green,
            roughness: 0.65,
            metalness: 0.1,
            flatShading: true
          });
          const crownInstanced = new THREE.InstancedMesh(crownGeo, crownMat, count);
          crownInstanced.castShadow = true;
          crownInstanced.receiveShadow = true;
          crownInstanced.frustumCulled = true;

          // Tree Trunk: Low-Poly Dark Cylinder (#414141)
          const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 1.2, 5);
          const trunkMat = new THREE.MeshStandardMaterial({
            color: this.styleColors.darkGray,
            roughness: 0.9,
            metalness: 0.1,
            flatShading: true
          });
          const trunkInstanced = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
          trunkInstanced.castShadow = true;
          trunkInstanced.receiveShadow = true;
          trunkInstanced.frustumCulled = true;

          const matrix = new THREE.Matrix4();
          const position = new THREE.Vector3();
          const rotation = new THREE.Euler();
          const quaternion = new THREE.Quaternion();
          const scale = new THREE.Vector3();

          treeTransforms.forEach((t, i) => {
            // Trunk Matrix (Base at ground y=0.6)
            position.set(t.x, 0.6, t.z);
            rotation.set(0, t.rotY, 0);
            quaternion.setFromEuler(rotation);
            scale.set(t.scale, t.scale, t.scale);
            matrix.compose(position, quaternion, scale);
            trunkInstanced.setMatrixAt(i, matrix);

            // Crown Matrix (Top at y=2.0 * scale)
            position.set(t.x, 1.8 * t.scale, t.z);
            matrix.compose(position, quaternion, scale);
            crownInstanced.setMatrixAt(i, matrix);
          });

          crownInstanced.instanceMatrix.needsUpdate = true;
          trunkInstanced.instanceMatrix.needsUpdate = true;

          crownInstanced.userData = { type: 'deco_trees' };
          trunkInstanced.userData = { type: 'deco_trees' };

          this.scene.add(crownInstanced);
          this.scene.add(trunkInstanced);
          this.instancedMeshes.push(crownInstanced, trunkInstanced);
        }

        // 2. Instanced Neon Bollards / Street Lanterns (#D9FF3D Emissive)
        if (bollardTransforms && bollardTransforms.length > 0) {
          const count = bollardTransforms.length;
          const bollardGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.6, 5);
          const bollardMat = new THREE.MeshStandardMaterial({
            color: 0x22242c,
            roughness: 0.4,
            metalness: 0.8,
            emissive: new THREE.Color(this.styleColors.neon),
            emissiveIntensity: 0.45
          });
          const bollardInstanced = new THREE.InstancedMesh(bollardGeo, bollardMat, count);
          bollardInstanced.frustumCulled = true;

          const matrix = new THREE.Matrix4();
          const position = new THREE.Vector3();
          const quaternion = new THREE.Quaternion();
          const scale = new THREE.Vector3(1, 1, 1);

          bollardTransforms.forEach((b, i) => {
            position.set(b.x, b.y, b.z);
            matrix.compose(position, quaternion, scale);
            bollardInstanced.setMatrixAt(i, matrix);
          });

          bollardInstanced.instanceMatrix.needsUpdate = true;
          bollardInstanced.userData = { type: 'deco_bollards' };

          this.scene.add(bollardInstanced);
          this.instancedMeshes.push(bollardInstanced);
        }
      }

      // =======================================================================
      // Cyber-Style Ground Streets with 90° Manhattan Orthogonal Routing
      // =======================================================================
      createCyberGroundHighways(fileList) {
        const highwayPairs = [];
        const seenPairs = new Set();

        fileList.forEach(sourceFile => {
          const imports = this.extractFileImports(sourceFile);
          imports.forEach(impName => {
            const targetBuilding = this.resolveImportTarget(impName, sourceFile.path);
            if (targetBuilding && targetBuilding.fileData.path !== sourceFile.path) {
              const pairKey = sourceFile.path + '-->' + targetBuilding.fileData.path;
              if (!seenPairs.has(pairKey)) {
                seenPairs.add(pairKey);
                highwayPairs.push({
                  source: this.buildingMap.get(sourceFile.path),
                  target: targetBuilding,
                  importName: impName
                });
              }
            }
          });
        });

        const groundY = 0.18; // Ground level street line

        highwayPairs.forEach(pair => {
          if (!pair.source || !pair.target) return;

          const x1 = pair.source.x;
          const z1 = pair.source.z;
          const x2 = pair.target.x;
          const z2 = pair.target.z;

          // Manhattan Orthogonal Routing Points with Filleted 90° Corners
          const dx = x2 - x1;
          const dz = z2 - z1;
          const points = [];

          points.push(new THREE.Vector3(x1, groundY, z1));

          if (Math.abs(dx) > 3 && Math.abs(dz) > 3) {
            // Midpoint Orthogonal Step (Z then X or X then Z)
            const midZ = z1 + dz * 0.5;
            const midX = x1 + dx * 0.5;

            // Filleted waypoints for smooth rounded 90° turns
            points.push(new THREE.Vector3(x1, groundY, midZ));
            points.push(new THREE.Vector3(x2, groundY, midZ));
          } else if (Math.abs(dx) > 2) {
            points.push(new THREE.Vector3(x2, groundY, z1));
          } else if (Math.abs(dz) > 2) {
            points.push(new THREE.Vector3(x1, groundY, z2));
          }

          points.push(new THREE.Vector3(x2, groundY, z2));

          // Create Smooth CatmullRom Curve along Manhattan Waypoints
          const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.15);

          // Glowing Cyber Street Tube
          const dist = Math.sqrt(dx * dx + dz * dz);
          const segments = Math.max(16, Math.min(80, Math.round(dist * 0.8)));
          const tubeGeo = new THREE.TubeGeometry(curve, segments, 0.32, 6, false);
          const tubeMat = new THREE.MeshBasicMaterial({
            color: this.styleColors.neon,
            transparent: true,
            opacity: 0.65,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          });
          const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
          tubeMesh.frustumCulled = true;
          tubeMesh.userData = {
            type: 'highway',
            sourcePath: pair.source.fileData.path,
            targetPath: pair.target.fileData.path,
            importName: pair.importName
          };
          this.scene.add(tubeMesh);

          // Animated Data Energy Packets rushing along the Cyber Ground Streets
          const particles = [];
          const packetCount = Math.max(1, Math.min(3, Math.round(dist / 65)));
          for (let i = 0; i < packetCount; i++) {
            const packetGeo = new THREE.SphereGeometry(0.65, 6, 6);
            const packetMat = new THREE.MeshBasicMaterial({
              color: this.styleColors.pink,
              transparent: true,
              opacity: 0.95,
              blending: THREE.AdditiveBlending
            });
            const packetMesh = new THREE.Mesh(packetGeo, packetMat);
            packetMesh.frustumCulled = true;
            this.scene.add(packetMesh);

            particles.push({
              mesh: packetMesh,
              t: (i / packetCount) + Math.random() * 0.15,
              speed: 0.0035 + Math.random() * 0.002
            });
          }

          this.highways.push({
            curve,
            tubeMesh,
            particles,
            sourcePath: pair.source.fileData.path,
            targetPath: pair.target.fileData.path,
            importName: pair.importName
          });
        });
      }

      extractFileImports(file) {
        const results = [];
        if (file.symbols && Array.isArray(file.symbols.imports)) {
          file.symbols.imports.forEach(imp => results.push(imp));
        }

        if (file.content) {
          const content = file.content;
          const jsMatches = content.matchAll(/(?:import|from)\\s+['"]([^'"]+)['"]/g);
          for (const m of jsMatches) results.push(m[1]);

          const rsMatches = content.matchAll(/use\\s+([a-zA-Z0-9_:]+);/g);
          for (const m of rsMatches) results.push(m[1]);

          const pyMatches = content.matchAll(/(?:from\\s+([a-zA-Z0-9_.]+)\\s+import|import\\s+([a-zA-Z0-9_.]+))/g);
          for (const m of pyMatches) results.push(m[1] || m[2]);
        }

        return Array.from(new Set(results));
      }

      resolveImportTarget(importStr, sourcePath) {
        if (!importStr) return null;
        const cleanImp = importStr.replace(/^crate::/, '').replace(/^super::/, '').replace(/^[./]+/, '');
        const impBase = cleanImp.split('/').pop().split('::').pop().replace(/\\.[a-zA-Z0-9]+$/, '');

        for (const [path, building] of this.buildingMap.entries()) {
          if (path.includes(cleanImp) || path.toLowerCase().endsWith(cleanImp.toLowerCase())) {
            return building;
          }
          const fileBase = path.split('/').pop().replace(/\\.[a-zA-Z0-9]+$/, '');
          if (fileBase && impBase && fileBase.toLowerCase() === impBase.toLowerCase()) {
            return building;
          }
        }
        return null;
      }

      // =======================================================================
      // Interactive City Filter Sidebar
      // =======================================================================
      setupFilterSidebar(districts, files) {
        // Collect Available Languages
        const langCounts = {};
        files.forEach(f => {
          const l = f.language || 'Default';
          langCounts[l] = (langCounts[l] || 0) + 1;
        });

        this.availableLanguages = Object.keys(langCounts).sort();
        this.activeLanguages = new Set(this.availableLanguages);

        // Collect Available Districts
        this.availableDistricts = districts.map(d => d.path);
        this.activeDistricts = new Set(this.availableDistricts);

        // Populate Languages Filter in Sidebar
        const langListEl = document.getElementById('cityLangFilterList');
        const langCountBadge = document.getElementById('cityLangFilterCount');
        if (langCountBadge) langCountBadge.innerText = this.availableLanguages.length;

        if (langListEl) {
          langListEl.innerHTML = this.availableLanguages.map(lang => {
            const hex = '#' + (this.getLanguageColor(lang)).toString(16).padStart(6, '0');
            const count = langCounts[lang];
            return \`
              <label class="flex items-center justify-between p-1.5 rounded-lg hover:bg-brand-card cursor-pointer transition select-none text-[11px]">
                <div class="flex items-center space-x-2 min-w-0">
                  <input type="checkbox" data-lang="\${escapeHtml(lang)}" checked onchange="window.codeCityApp && window.codeCityApp.onLanguageCheckboxChange(this)" class="accent-brand-orange rounded" />
                  <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color: \${hex};"></span>
                  <span class="text-zinc-200 truncate font-semibold">\${escapeHtml(lang)}</span>
                </div>
                <span class="text-zinc-500 font-mono text-[10px] ml-1">(\${count})</span>
              </label>
            \`;
          }).join('');
        }

        // Populate Districts Filter in Sidebar
        const distListEl = document.getElementById('cityDistrictFilterList');
        const distCountBadge = document.getElementById('cityDistrictFilterCount');
        if (distCountBadge) distCountBadge.innerText = districts.length;

        if (distListEl) {
          distListEl.innerHTML = districts.map(d => {
            const shortName = d.path === 'root' ? 'root' : d.path;
            return \`
              <div class="flex items-center justify-between p-1.5 rounded-lg hover:bg-brand-card transition select-none text-[11px] group">
                <label class="flex items-center space-x-2 min-w-0 flex-1 cursor-pointer">
                  <input type="checkbox" data-district="\${escapeHtml(d.path)}" checked onchange="window.codeCityApp && window.codeCityApp.onDistrictCheckboxChange(this)" class="accent-brand-orange rounded" />
                  <i data-lucide="folder" class="w-3.5 h-3.5 text-amber-400 flex-shrink-0"></i>
                  <span class="text-zinc-200 truncate">\${escapeHtml(shortName)}</span>
                </label>
                <div class="flex items-center space-x-1.5 ml-1">
                  <span class="text-zinc-500 font-mono text-[10px]">(\${d.files.length})</span>
                  <button onclick="window.codeCityApp && window.codeCityApp.focusDistrict('\${escapeHtml(d.path)}')" title="Distrikt anfliegen" class="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-brand-border text-zinc-400 hover:text-white transition">
                    <i data-lucide="eye" class="w-3 h-3 text-brand-orange"></i>
                  </button>
                </div>
              </div>
            \`;
          }).join('');
        }

        // Initialize Lucide Icons in dynamically injected elements
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
          lucide.createIcons();
        }

        // Update Top HUD stats
        this.updateHUDStats();
      }

      toggleSidebar(forceState = null) {
        const sidebar = document.getElementById('cityFilterSidebar');
        if (!sidebar) return;
        this.sidebarOpen = (forceState !== null) ? forceState : !this.sidebarOpen;

        if (this.sidebarOpen) {
          sidebar.classList.remove('-translate-x-[115%]');
          sidebar.classList.add('translate-x-0');
        } else {
          sidebar.classList.add('-translate-x-[115%]');
          sidebar.classList.remove('translate-x-0');
        }
      }

      onSearchInput(query) {
        this.searchQuery = (query || '').toLowerCase().trim();
        // Sync both inputs
        const topSearch = document.getElementById('citySearchInput');
        const sideSearch = document.getElementById('citySidebarSearchInput');
        if (topSearch && topSearch.value !== query) topSearch.value = query;
        if (sideSearch && sideSearch.value !== query) sideSearch.value = query;

        this.applyFilters();
      }

      clearSearch() {
        this.onSearchInput('');
      }

      onMinLocChange(val) {
        this.minLoc = parseInt(val, 10) || 0;
        const display = document.getElementById('cityMinLocDisplay');
        const slider = document.getElementById('cityMinLocSlider');
        if (display) display.innerText = '≥ ' + this.minLoc + ' LOC';
        if (slider && slider.value != this.minLoc) slider.value = this.minLoc;

        this.applyFilters();
      }

      onLanguageCheckboxChange(cb) {
        const lang = cb.dataset.lang;
        if (cb.checked) {
          this.activeLanguages.add(lang);
        } else {
          this.activeLanguages.delete(lang);
        }
        this.applyFilters();
      }

      onDistrictCheckboxChange(cb) {
        const dist = cb.dataset.district;
        if (cb.checked) {
          this.activeDistricts.add(dist);
        } else {
          this.activeDistricts.delete(dist);
        }
        this.applyFilters();
      }

      selectAllFilters(visible) {
        if (visible) {
          this.activeLanguages = new Set(this.availableLanguages);
          this.activeDistricts = new Set(this.availableDistricts);
          this.minLoc = 0;
          this.searchQuery = '';
        } else {
          this.activeLanguages.clear();
          this.activeDistricts.clear();
        }

        // Update UI checkboxes
        document.querySelectorAll('#cityLangFilterList input[type="checkbox"]').forEach(cb => {
          cb.checked = visible;
        });
        document.querySelectorAll('#cityDistrictFilterList input[type="checkbox"]').forEach(cb => {
          cb.checked = visible;
        });
        const slider = document.getElementById('cityMinLocSlider');
        const display = document.getElementById('cityMinLocDisplay');
        if (slider) slider.value = 0;
        if (display) display.innerText = '≥ 0 LOC';

        this.applyFilters();
      }

      resetAllFilters() {
        this.selectAllFilters(true);
        this.clearSearch();
      }

      toggleAllLanguages() {
        const allActive = this.activeLanguages.size === this.availableLanguages.length;
        if (allActive) {
          this.activeLanguages.clear();
        } else {
          this.activeLanguages = new Set(this.availableLanguages);
        }
        document.querySelectorAll('#cityLangFilterList input[type="checkbox"]').forEach(cb => {
          cb.checked = !allActive;
        });
        this.applyFilters();
      }

      toggleAllDistricts() {
        const allActive = this.activeDistricts.size === this.availableDistricts.length;
        if (allActive) {
          this.activeDistricts.clear();
        } else {
          this.activeDistricts = new Set(this.availableDistricts);
        }
        document.querySelectorAll('#cityDistrictFilterList input[type="checkbox"]').forEach(cb => {
          cb.checked = !allActive;
        });
        this.applyFilters();
      }

      applyFilters() {
        let visibleCount = 0;

        this.buildings.forEach(b => {
          const path = b.fileData.path.toLowerCase();
          const matchesSearch = !this.searchQuery || path.includes(this.searchQuery);
          const matchesLoc = b.loc >= this.minLoc;
          const matchesLang = this.activeLanguages.has(b.fileData.language || 'Default');
          const matchesDistrict = this.activeDistricts.has(b.district);

          const isVisible = matchesSearch && matchesLoc && matchesLang && matchesDistrict;

          if (isVisible) {
            visibleCount++;
            b.mesh.visible = true;
            b.mesh.material = this.getSharedBuildingMaterial(b.langColor);
            b.edgesMesh.visible = true;
            if (b.labelSprite) b.labelSprite.visible = this.labelsEnabled;
            if (b.beaconMesh) b.beaconMesh.visible = true;
            if (b.spireMesh) b.spireMesh.visible = true;
          } else {
            // Soft ghosted/hidden mode
            b.mesh.visible = false;
            b.edgesMesh.visible = false;
            if (b.labelSprite) b.labelSprite.visible = false;
            if (b.beaconMesh) b.beaconMesh.visible = false;
            if (b.spireMesh) b.spireMesh.visible = false;
          }
        });

        // Update Highways visibility based on connected buildings
        this.highways.forEach(h => {
          const srcBuilding = this.buildingMap.get(h.sourcePath);
          const tgtBuilding = this.buildingMap.get(h.targetPath);
          const hwVisible = this.trafficEnabled && srcBuilding && tgtBuilding && srcBuilding.mesh.visible && tgtBuilding.mesh.visible;
          h.tubeMesh.visible = hwVisible;
          h.particles.forEach(p => { p.mesh.visible = hwVisible; });
        });

        // Update Filter Badge in Top Bar
        const isFiltered = (this.searchQuery !== '') || (this.minLoc > 0) ||
          (this.activeLanguages.size < this.availableLanguages.length) ||
          (this.activeDistricts.size < this.availableDistricts.length);

        const badge = document.getElementById('cityActiveFilterBadge');
        if (badge) {
          if (isFiltered) {
            badge.classList.remove('hidden');
          } else {
            badge.classList.add('hidden');
          }
        }

        // Update Footer Status
        const total = this.buildings.length;
        const statusText = document.getElementById('cityFilterStatusText');
        const statusPercent = document.getElementById('cityFilterStatusPercent');
        if (statusText) statusText.innerText = 'Sichtbar: ' + visibleCount + ' / ' + total + ' Gebäude';
        if (statusPercent) {
          const pct = total > 0 ? Math.round((visibleCount / total) * 100) : 0;
          statusPercent.innerText = pct + '%';
        }

        // Update raycasting targets strictly to visible meshes
        this.updateRaycastTargets();
      }

      updateRaycastTargets() {
        this.raycastTargets = [];
        this.buildings.forEach(b => {
          if (b.mesh.visible) {
            this.raycastTargets.push(b.mesh);
          }
        });
      }

      updateHUDStats() {
        const buildingCountBadge = document.getElementById('cityBuildingCountBadge');
        if (buildingCountBadge) {
          buildingCountBadge.innerText = this.buildings.length + ' Towers';
        }

        const summaryStats = document.getElementById('citySummaryStats');
        if (summaryStats) {
          const totalLoc = this.buildings.reduce((acc, b) => acc + (b.loc || 0), 0);
          summaryStats.innerText = 'Metropolis: ' + this.districts.length + ' Districts | ' + totalLoc.toLocaleString() + ' LOC | ' + this.highways.length + ' Cyber Highways';
        }
      }

      // =======================================================================
      // Animation Loop & Performance
      // =======================================================================
      animate() {
        this.animFrameId = requestAnimationFrame(this.animate);

        const time = Date.now() * 0.001;

        // Update Controls
        if (this.controls) {
          this.controls.update();
        }

        // Smooth Camera Flight (Lerp)
        if (this.isFlying && this.flyState) {
          const elapsed = Date.now() - this.flyState.startTime;
          const progress = Math.min(1.0, elapsed / this.flyState.duration);
          const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic

          this.camera.position.lerpVectors(this.flyState.startCam, this.flyState.targetCam, ease);
          this.controls.target.lerpVectors(this.flyState.startTarget, this.flyState.targetLook, ease);

          if (progress >= 1.0) {
            this.isFlying = false;
            this.flyState = null;
          }
        }

        // Animate Data Impulses along Cyber Ground Streets
        if (this.trafficEnabled) {
          this.highways.forEach(h => {
            if (!h.tubeMesh.visible) return;

            if (this.isolatedBuilding && h.sourcePath !== this.isolatedBuilding.fileData.path && h.targetPath !== this.isolatedBuilding.fileData.path) {
              h.tubeMesh.visible = false;
              h.particles.forEach(p => { p.mesh.visible = false; });
              return;
            }

            h.particles.forEach(p => {
              p.t = (p.t + p.speed) % 1.0;
              const pos = h.curve.getPointAt(p.t);
              p.mesh.position.copy(pos);

              // Pulsing particle scale
              const pulse = 0.8 + 0.35 * Math.sin(p.t * Math.PI * 4 + time * 6);
              p.mesh.scale.set(pulse, pulse, pulse);
            });
          });
        }

        // Animate Risk Hazard Beacons
        this.buildings.forEach(b => {
          if (b.beaconMesh && b.beaconMesh.visible) {
            const flash = 0.4 + 0.6 * Math.sin(time * 7.5);
            b.beaconMesh.material.opacity = flash;
            b.beaconMesh.scale.set(1 + flash * 0.25, 1 + flash * 0.25, 1 + flash * 0.25);
          }
        });

        // Render Scene with Frustum Culling
        if (this.renderer && this.scene && this.camera) {
          this.renderer.render(this.scene, this.camera);
        }
      }

      // =======================================================================
      // Optimized Raycasting & Hover / Click Handling
      // =======================================================================
      onMouseMove(event) {
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        if (!this.camera || !this.scene || this.raycastTargets.length === 0) return;

        // Strictly raycast only against visible building meshes (Ultra Fast!)
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.raycastTargets, false);

        let hitBuilding = null;
        if (intersects.length > 0) {
          const hit = intersects[0];
          if (hit.object.userData?.type === 'building') {
            hitBuilding = hit.object.userData.buildingObj;
          }
        }

        // Hover Building Emissive Highlighting
        if (hitBuilding !== this.hoveredBuilding) {
          if (this.hoveredBuilding && this.hoveredBuilding !== this.selectedBuilding) {
            this.hoveredBuilding.mesh.scale.set(1, 1, 1);
          }
          this.hoveredBuilding = hitBuilding;
          if (this.hoveredBuilding) {
            this.hoveredBuilding.mesh.scale.set(1.04, 1.01, 1.04);
          }
        }

        // Tooltip Mini-HUD
        const tooltip = document.getElementById('cityHoverTooltip');
        const content = document.getElementById('cityHoverContent');

        if (hitBuilding && tooltip && content) {
          tooltip.classList.remove('hidden');
          tooltip.style.left = Math.min(window.innerWidth - 300, event.clientX + 16) + 'px';
          tooltip.style.top = Math.min(window.innerHeight - 200, event.clientY + 16) + 'px';

          const f = hitBuilding.fileData;
          const langHex = '#' + hitBuilding.langColor.toString(16).padStart(6, '0');
          const symCount = (f.symbols?.functions?.length || 0) + (f.symbols?.classes?.length || 0) + (f.symbols?.structs?.length || 0);

          content.innerHTML = \`
            <div class="flex items-center justify-between gap-2 border-b border-brand-border/60 pb-1.5 mb-1.5">
              <span class="font-bold text-white truncate">\${escapeHtml(f.path.split('/').pop())}</span>
              <span class="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide" style="background-color: \${langHex}; color: #000;">\${escapeHtml(f.language)}</span>
            </div>
            <div class="text-[10px] text-zinc-400 truncate mb-2">📁 \${escapeHtml(hitBuilding.district)}</div>
            <div class="grid grid-cols-2 gap-1.5 text-[11px] mb-2">
              <div class="bg-brand-card/70 p-1.5 rounded border border-brand-border/50">
                <span class="text-zinc-500 text-[10px]">Lines:</span>
                <span class="font-bold text-white ml-1">\${hitBuilding.loc} LOC</span>
              </div>
              <div class="bg-brand-card/70 p-1.5 rounded border border-brand-border/50">
                <span class="text-zinc-500 text-[10px]">Complexity:</span>
                <span class="font-bold \${hitBuilding.complexity > 15 ? 'text-rose-400' : 'text-brand-orange'} ml-1">\${hitBuilding.complexity}</span>
              </div>
            </div>
            <div class="flex items-center justify-between text-[10px] text-zinc-400">
              <span>Symbols: <strong class="text-cyan-400">\${symCount}</strong></span>
              <span class="text-brand-orange font-semibold">🖱️ Click to inspect</span>
            </div>
          \`;
        } else if (tooltip) {
          tooltip.classList.add('hidden');
        }
      }

      onMouseLeave() {
        const tooltip = document.getElementById('cityHoverTooltip');
        if (tooltip) tooltip.classList.add('hidden');
        if (this.hoveredBuilding && this.hoveredBuilding !== this.selectedBuilding) {
          this.hoveredBuilding.mesh.scale.set(1, 1, 1);
          this.hoveredBuilding = null;
        }
      }

      onClick(event) {
        if (!this.camera || !this.scene || this.raycastTargets.length === 0) return;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.raycastTargets, false);

        let clickedBuilding = null;
        if (intersects.length > 0) {
          const hit = intersects[0];
          if (hit.object.userData?.type === 'building') {
            clickedBuilding = hit.object.userData.buildingObj;
          }
        }

        if (clickedBuilding) {
          this.selectBuilding(clickedBuilding);
          this.flyToBuilding(clickedBuilding);
        }
      }

      selectBuilding(buildingObj) {
        if (this.selectedBuilding) {
          this.selectedBuilding.mesh.scale.set(1, 1, 1);
        }

        this.selectedBuilding = buildingObj;
        this.selectedBuilding.mesh.scale.set(1.06, 1.02, 1.06);

        this.openInspector(buildingObj);
      }

      openInspector(buildingObj) {
        const drawer = document.getElementById('cityInspectorDrawer');
        if (!drawer) return;

        const f = buildingObj.fileData;
        const fileName = f.path.split('/').pop();
        const langHex = '#' + buildingObj.langColor.toString(16).padStart(6, '0');

        document.getElementById('cityDrawerFileName').innerText = fileName;
        document.getElementById('cityDrawerFilePath').innerText = f.path;

        const langBadge = document.getElementById('cityDrawerLangBadge');
        if (langBadge) {
          langBadge.innerText = f.language;
          langBadge.style.backgroundColor = langHex;
        }

        const riskBadge = document.getElementById('cityDrawerRiskBadge');
        if (riskBadge) {
          if (buildingObj.complexity > 18 || buildingObj.risk > 25) {
            riskBadge.classList.remove('hidden');
          } else {
            riskBadge.classList.add('hidden');
          }
        }

        document.getElementById('cityDrawerLOC').innerText = buildingObj.loc;
        document.getElementById('cityDrawerComplexity').innerText = buildingObj.complexity;

        const symsList = document.getElementById('cityDrawerSymbolsList');
        const allSyms = [
          ...(f.symbols?.functions || []).map(s => typeof s === 'string' ? s : s.name),
          ...(f.symbols?.classes || []),
          ...(f.symbols?.structs || []),
          ...(f.symbols?.interfaces || [])
        ];
        document.getElementById('cityDrawerSymbols').innerText = allSyms.length;

        if (symsList) {
          if (allSyms.length === 0) {
            symsList.innerHTML = '<div class="text-zinc-500 text-[10px]">Keine Symbole extrahiert</div>';
          } else {
            symsList.innerHTML = allSyms.map(s => \`
              <div class="px-2 py-1 rounded bg-brand-card border border-brand-border/40 text-zinc-300 truncate text-[10px]">
                \${escapeHtml(s)}
              </div>
            \`).join('');
          }
        }

        // Connected highways
        const highwaysList = document.getElementById('cityDrawerHighwaysList');
        const highwayCount = document.getElementById('cityDrawerHighwayCount');
        const connectedHighways = this.highways.filter(h => h.sourcePath === f.path || h.targetPath === f.path);

        if (highwayCount) highwayCount.innerText = connectedHighways.length + ' links';

        if (highwaysList) {
          if (connectedHighways.length === 0) {
            highwaysList.innerHTML = '<div class="text-zinc-500 text-[10px]">Keine direkten Straßen-Verbindungen</div>';
          } else {
            highwaysList.innerHTML = connectedHighways.map(h => {
              const isSource = h.sourcePath === f.path;
              const other = isSource ? h.targetPath.split('/').pop() : h.sourcePath.split('/').pop();
              return \`
                <div class="px-2 py-1 rounded bg-brand-card/80 border border-brand-border/40 text-[10px] flex items-center justify-between gap-1">
                  <span class="\${isSource ? 'text-[#D9FF3D]' : 'text-sky-400'}">\${isSource ? '➔ OUT' : '⬅ IN'}</span>
                  <span class="text-white truncate font-semibold">\${escapeHtml(other)}</span>
                  <span class="text-zinc-500 text-[9px] truncate">\${escapeHtml(h.importName)}</span>
                </div>
              \`;
            }).join('');
          }
        }

        drawer.classList.remove('hidden');
      }

      closeInspector() {
        const drawer = document.getElementById('cityInspectorDrawer');
        if (drawer) drawer.classList.add('hidden');
        if (this.selectedBuilding) {
          this.selectedBuilding.mesh.scale.set(1, 1, 1);
          this.selectedBuilding = null;
        }
        this.isolatedBuilding = null;
      }

      openCurrentFileInCodeViewer() {
        if (!this.selectedBuilding) return;
        const path = this.selectedBuilding.fileData.path;
        if (typeof openFileInViewer === 'function') {
          openFileInViewer(path);
        } else if (typeof switchView === 'function') {
          switchView('code');
        }
      }

      isolateBuildingHighways() {
        if (!this.selectedBuilding) return;
        if (this.isolatedBuilding === this.selectedBuilding) {
          this.isolatedBuilding = null;
        } else {
          this.isolatedBuilding = this.selectedBuilding;
        }
      }

      flyToBuilding(buildingObj) {
        if (!buildingObj || !this.camera || !this.controls) return;

        const targetLook = new THREE.Vector3(buildingObj.x, buildingObj.height / 2 + 1.0, buildingObj.z);
        const targetCam = new THREE.Vector3(buildingObj.x + 35, buildingObj.height + 25, buildingObj.z + 45);

        this.smoothCameraFlight(targetCam, targetLook, 650);
      }

      flyToCurrentBuilding() {
        if (this.selectedBuilding) {
          this.flyToBuilding(this.selectedBuilding);
        }
      }

      focusDistrict(districtPath) {
        if (!districtPath) {
          this.resetCamera();
          return;
        }
        const district = this.districts.find(d => d.path === districtPath);
        if (!district) return;

        const targetLook = new THREE.Vector3(district.x, 2, district.z);
        const targetCam = new THREE.Vector3(district.x + district.width * 0.8, district.width * 0.9, district.z + district.depth * 0.9);

        this.smoothCameraFlight(targetCam, targetLook, 750);
      }

      resetCamera(smooth = true) {
        if (!this.camera || !this.controls) return;

        const targetCam = new THREE.Vector3(160, 180, 220);
        const targetLook = new THREE.Vector3(0, 5, 0);

        if (smooth) {
          this.smoothCameraFlight(targetCam, targetLook, 700);
        } else {
          this.camera.position.copy(targetCam);
          this.controls.target.copy(targetLook);
        }
        this.isolatedBuilding = null;
      }

      smoothCameraFlight(targetCam, targetLook, duration = 600) {
        this.isFlying = true;
        this.flyState = {
          startTime: Date.now(),
          duration: duration,
          startCam: this.camera.position.clone(),
          targetCam: targetCam,
          startTarget: this.controls.target.clone(),
          targetLook: targetLook
        };
      }

      // =======================================================================
      // Toolbar Toggles
      // =======================================================================
      toggleTraffic() {
        this.trafficEnabled = !this.trafficEnabled;
        const badge = document.getElementById('cityTrafficBadge');
        const btn = document.getElementById('btnCityTrafficToggle');

        if (badge) {
          badge.innerText = this.trafficEnabled ? 'ON' : 'OFF';
          badge.className = 'text-[10px] ml-0.5 font-bold ' + (this.trafficEnabled ? 'text-[#D9FF3D]' : 'text-zinc-500');
        }
        if (btn) {
          if (this.trafficEnabled) {
            btn.classList.add('bg-brand-orange/20', 'text-brand-orange', 'border-brand-orange/60');
          } else {
            btn.classList.remove('bg-brand-orange/20', 'text-brand-orange', 'border-brand-orange/60');
          }
        }

        this.highways.forEach(h => {
          h.tubeMesh.visible = this.trafficEnabled;
          h.particles.forEach(p => { p.mesh.visible = this.trafficEnabled; });
        });
      }

      toggleDeco() {
        this.decoEnabled = !this.decoEnabled;
        const badge = document.getElementById('cityDecoBadge');
        const btn = document.getElementById('btnCityDecoToggle');

        if (badge) {
          badge.innerText = this.decoEnabled ? 'ON' : 'OFF';
          badge.className = 'text-[10px] ml-0.5 font-bold ' + (this.decoEnabled ? 'text-[#63B22F]' : 'text-zinc-500');
        }
        if (btn) {
          if (this.decoEnabled) {
            btn.classList.add('bg-[#63B22F]/20', 'text-[#63B22F]', 'border-[#63B22F]/50');
          } else {
            btn.classList.remove('bg-[#63B22F]/20', 'text-[#63B22F]', 'border-[#63B22F]/50');
          }
        }

        this.instancedMeshes.forEach(mesh => {
          mesh.visible = this.decoEnabled;
        });
      }

      toggleLabels() {
        this.labelsEnabled = !this.labelsEnabled;
        const badge = document.getElementById('cityLabelsBadge');
        if (badge) {
          badge.innerText = this.labelsEnabled ? 'ON' : 'OFF';
          badge.className = 'text-[10px] ml-0.5 font-bold ' + (this.labelsEnabled ? 'text-cyan-400' : 'text-zinc-500');
        }
        this.labels.forEach(l => {
          l.visible = this.labelsEnabled;
        });
      }

      toggleTheme() {
        this.theme = (this.theme === 'cyberpunk') ? 'dark_studio' : 'cyberpunk';
        const textEl = document.getElementById('cityThemeText');
        const iconEl = document.getElementById('cityThemeIcon');

        if (this.theme === 'cyberpunk') {
          if (textEl) textEl.innerText = 'Cyberpunk';
          if (iconEl) iconEl.className = 'w-3.5 h-3.5 text-amber-400';
          this.scene.background = new THREE.Color(this.styleColors.bgDark);
          this.scene.fog = new THREE.FogExp2(this.styleColors.bgDark, 0.0018);
          if (this.gridFloor) this.gridFloor.visible = true;
          if (this.ambientLight) this.ambientLight.color.setHex(0x1a2238);
          if (this.rimLightCyan) this.rimLightCyan.intensity = 1.1;
          if (this.rimLightOrange) this.rimLightOrange.intensity = 1.2;
        } else {
          if (textEl) textEl.innerText = 'Dark Studio';
          if (iconEl) iconEl.className = 'w-3.5 h-3.5 text-sky-400';
          this.scene.background = new THREE.Color(0x18181b);
          this.scene.fog = new THREE.FogExp2(0x18181b, 0.0015);
          if (this.gridFloor) this.gridFloor.visible = false;
          if (this.ambientLight) this.ambientLight.color.setHex(0x3f3f46);
          if (this.rimLightCyan) this.rimLightCyan.intensity = 0.5;
          if (this.rimLightOrange) this.rimLightOrange.intensity = 0.5;
        }
      }

      // =======================================================================
      // Clean Memory Disposal (VRAM & Garbage Collection)
      // =======================================================================
      clearCity() {
        // Dispose & remove buildings
        this.buildings.forEach(b => {
          if (b.mesh) {
            this.scene.remove(b.mesh);
            if (b.mesh.geometry) b.mesh.geometry.dispose();
          }
          if (b.edgesMesh && b.edgesMesh.geometry) b.edgesMesh.geometry.dispose();
          if (b.spireMesh && b.spireMesh.geometry) b.spireMesh.geometry.dispose();
          if (b.beaconMesh && b.beaconMesh.geometry) b.beaconMesh.geometry.dispose();
          if (b.labelSprite) {
            this.scene.remove(b.labelSprite);
            if (b.labelSprite.material.map) b.labelSprite.material.map.dispose();
            if (b.labelSprite.material) b.labelSprite.material.dispose();
          }
        });
        this.buildings = [];
        this.buildingMap.clear();
        this.raycastTargets = [];

        // Dispose & remove instanced meshes (Trees & Bollards)
        this.instancedMeshes.forEach(mesh => {
          this.scene.remove(mesh);
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) mesh.material.dispose();
        });
        this.instancedMeshes = [];

        // Dispose & remove districts
        this.districts.forEach(d => {
          if (d.plateMesh) {
            this.scene.remove(d.plateMesh);
            if (d.plateMesh.geometry) d.plateMesh.geometry.dispose();
            if (d.plateMesh.material) d.plateMesh.material.dispose();
          }
          if (d.districtLabel) {
            this.scene.remove(d.districtLabel);
            if (d.districtLabel.material.map) d.districtLabel.material.map.dispose();
            if (d.districtLabel.material) d.districtLabel.material.dispose();
          }
        });
        this.districts = [];

        // Dispose & remove highways & particles
        this.highways.forEach(h => {
          if (h.tubeMesh) {
            this.scene.remove(h.tubeMesh);
            if (h.tubeMesh.geometry) h.tubeMesh.geometry.dispose();
            if (h.tubeMesh.material) h.tubeMesh.material.dispose();
          }
          h.particles.forEach(p => {
            this.scene.remove(p.mesh);
            if (p.mesh.geometry) p.mesh.geometry.dispose();
            if (p.mesh.material) p.mesh.material.dispose();
          });
        });
        this.highways = [];
        this.labels = [];

        this.hoveredBuilding = null;
        this.selectedBuilding = null;
        this.isolatedBuilding = null;
        this.closeInspector();
      }

      disposeScene() {
        if (this.animFrameId) {
          cancelAnimationFrame(this.animFrameId);
          this.animFrameId = null;
        }

        this.clearCity();

        // Dispose Procedural Window Textures
        for (const k in this.windowTextures) {
          if (this.windowTextures[k]) this.windowTextures[k].dispose();
        }
        this.windowTextures = {};

        // Dispose Shared Materials
        for (const k in this.sharedBuildingMaterials) {
          if (this.sharedBuildingMaterials[k]) this.sharedBuildingMaterials[k].dispose();
        }
        this.sharedBuildingMaterials = {};

        for (const k in this.sharedEdgeMaterials) {
          if (this.sharedEdgeMaterials[k]) this.sharedEdgeMaterials[k].dispose();
        }
        this.sharedEdgeMaterials = {};

        if (this.dimBuildingMaterial) {
          this.dimBuildingMaterial.dispose();
          this.dimBuildingMaterial = null;
        }

        // Dispose Grid Floor
        if (this.gridFloor) {
          this.scene.remove(this.gridFloor);
          if (this.gridFloor.geometry) this.gridFloor.geometry.dispose();
          if (this.gridFloor.material) this.gridFloor.material.dispose();
          this.gridFloor = null;
        }

        // Dispose Controls & Renderer
        if (this.controls) {
          this.controls.dispose();
          this.controls = null;
        }
        if (this.renderer) {
          this.renderer.dispose();
          if (this.renderer.domElement && this.renderer.domElement.parentNode) {
            this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
          }
          this.renderer = null;
        }
      }

      onResize() {
        if (!this.container || !this.renderer || !this.camera) return;
        const width = this.container.clientWidth || window.innerWidth - 64;
        const height = this.container.clientHeight || window.innerHeight - 56;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
      }

      onViewActivated() {
        this.onResize();
        if (!this.data && currentData) {
          this.buildCity(currentData);
        }
      }
    }

    // Global Instance
    function initCodeCity() {
      if (!window.codeCityApp) {
        window.codeCityApp = new CodeCityMetropolis('cityCanvasContainer');
        if (typeof currentData !== 'undefined' && currentData) {
          window.codeCityApp.buildCity(currentData);
        }
      } else {
        window.codeCityApp.onViewActivated();
      }
    }
`;

fs.writeFileSync('generated_codecity_class.js', jsCode);
console.log('Saved generated_codecity_class.js');
