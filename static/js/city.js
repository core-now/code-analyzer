/**
 * 3D Cyber City Metropolis Engine
 * Powered by Three.js & OrbitControls.
 * Features: Procedural Buildings, District Grids, Laser Highways, Traffic Pulse,
 * Street View Exploration, Weather/Glow Shaders, Custom Textures, Raycasting & Inspector.
 */

class CodeCityMetropolis {
      constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.animFrameId = null;

        // Data & Hierarchy References
        this.data = null;
        this.buildings = [];
        this.buildingMap = new Map();
        this.districts = [];
        this.districtMap = new Map();
        this.districtTreeRoot = null;
        this.labels = [];
        this.instancedMeshes = [];
        this.districtPlateMeshes = [];
        this.highwaysEnabled = true;
        this.coreMonumentObjects = [];

        // Performance & Single Draw Call Objects
        this.highwayLineSegments = null;
        this.highwayHighlightLineSegments = null;
        this.groundLineSegments = null;
        this.trafficParticlesMesh = null;
        this.trafficParticleList = [];
        this.highwayDataList = [];
        this.districtConnections = [];
        this.tempVec3 = new THREE.Vector3();

        // Living Cyber Atmosphere References
        this.cyberParticles = null;
        this.radarMesh = null;
        this.radarMaterial = null;

        // Interaction & Throttled Spatial Raycasting State
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2(-999, -999);
        this.mouseRaw = { x: -999, y: -999 };
        this.mouseDirty = false;
        this.lastRaycastTime = 0;
        this.raycastThrottleInterval = 65; // ~15 fps raycasting throttler
        this.hoveredBuilding = null;
        this.selectedBuilding = null;
        this.hoveredDistrict = null;
        this.activeDistrict = null;
        this.isolatedBuilding = null;
        this.selectionTargetMesh = null;

        // Camera Transition State
        this.isFlying = false;
        this.flyState = null;

        // Sidebar & Filter State
        this.searchQuery = '';
        this.minLoc = 0;
        this.activeLanguages = new Set();
        this.activeDistricts = new Set();
        this.availableLanguages = [];
        this.availableDistricts = [];
        this.collapsedDistricts = new Set();

        // Navigation & WASD / Street View State
        this.keysDown = {};
        this.isMouseDown = false;
        this.isStreetView = false;
        this.overviewCamState = null;

        // Toggle Settings
        this.trafficEnabled = true;
        this.flowMode = 'data_flow';
        this.decoEnabled = true;
        this.labelsEnabled = true;
        const isLightInit = (typeof document !== 'undefined' && document.documentElement.classList.contains('light')) ||
                            (typeof appSettings !== 'undefined' && appSettings && appSettings.themeMode === 'light') ||
                            (typeof localStorage !== 'undefined' && (localStorage.getItem('codebase_theme') === 'light' || localStorage.getItem('codebase_theme_mode') === 'light'));
        this.theme = isLightInit ? 'light' : 'cyberpunk';

        // Theme Style Configurations (High-Visibility Atmospheric & Sun Lighting)
        this.themeStyles = {
          cyberpunk: {
            bgDark: 0x070913,
            fogColor: 0x070913,
            fogDensity: 0.00035, // Clear long-range metropolis visibility
            ambientColor: 0x1e293b,
            ambientIntensity: 2.2,
            hemiSkyColor: 0x38bdf8,
            hemiGroundColor: 0x0f172a,
            hemiIntensity: 1.4,
            sunColor: 0xffffff,
            sunIntensity: 2.5,
            secondarySunColor: 0x38bdf8,
            secondarySunIntensity: 1.2,
            rimCyanColor: 0x00f0ff,
            rimCyanIntensity: 2.2,
            rimMagentaColor: 0xff0077,
            rimMagentaIntensity: 1.8,
            rimOrangeColor: 0xff8000,
            rimOrangeIntensity: 1.8,
            plateColor: 0x0f172a,
            plateBorderColor: 0x38bdf8,
            plotColor: 0x0b1120,
            plotBorderColor: 0x63B22F,
            walkwayColor: 0x1e293b,
            gridNeon: 0x38bdf8,
            gridDark: 0x0f172a,
            gridFloorVisible: false,
            buildingEmissiveIntensity: 0.32,
            highwayColor: 0x38bdf8,
            highwayOpacity: 0.85,
            packetColor: 0xD9FF3D,
            neonAccent: 0xD9FF3D,
            pinkAccent: 0xFF8EAB,
            orangeAccent: 0xFF8000,
            cyanAccent: 0x38bdf8,
            boulevardColor: 0x070d1a,
            boulevardDivider: 0x63B22F,
            boulevardGuardrail: 0x00f0ff
          },
          matrix: {
            bgDark: 0x030d06,
            fogColor: 0x030d06,
            fogDensity: 0.00035,
            ambientColor: 0x062e12,
            ambientIntensity: 2.2,
            hemiSkyColor: 0x22c55e,
            hemiGroundColor: 0x031807,
            hemiIntensity: 1.4,
            sunColor: 0x63B22F,
            sunIntensity: 2.5,
            secondarySunColor: 0x22c55e,
            secondarySunIntensity: 1.2,
            rimCyanColor: 0x22c55e,
            rimCyanIntensity: 2.2,
            rimMagentaColor: 0x15803d,
            rimMagentaIntensity: 1.5,
            rimOrangeColor: 0xD9FF3D,
            rimOrangeIntensity: 1.8,
            plateColor: 0x071e0c,
            plateBorderColor: 0x63B22F,
            plotColor: 0x031206,
            plotBorderColor: 0x16a34a,
            walkwayColor: 0x0b2c14,
            gridNeon: 0x63B22F,
            gridDark: 0x041908,
            gridFloorVisible: false,
            buildingEmissiveIntensity: 0.35,
            highwayColor: 0x63B22F,
            highwayOpacity: 0.85,
            packetColor: 0xD9FF3D,
            neonAccent: 0xD9FF3D,
            pinkAccent: 0xFF8EAB,
            orangeAccent: 0x84cc16,
            cyanAccent: 0x22c55e,
            boulevardColor: 0x031508,
            boulevardDivider: 0xD9FF3D,
            boulevardGuardrail: 0x63B22F
          },
          studio: {
            bgDark: 0x18181b,
            fogColor: 0x18181b,
            fogDensity: 0.0003,
            ambientColor: 0x52525b,
            ambientIntensity: 2.4,
            hemiSkyColor: 0xffffff,
            hemiGroundColor: 0x27272a,
            hemiIntensity: 1.5,
            sunColor: 0xffffff,
            sunIntensity: 2.8,
            secondarySunColor: 0xa1a1aa,
            secondarySunIntensity: 1.4,
            rimCyanColor: 0xa1a1aa,
            rimCyanIntensity: 0.8,
            rimMagentaColor: 0x71717a,
            rimMagentaIntensity: 0.6,
            rimOrangeColor: 0xa1a1aa,
            rimOrangeIntensity: 0.8,
            plateColor: 0x27272a,
            plateBorderColor: 0x52525b,
            plotColor: 0x1f1f23,
            plotBorderColor: 0x3f3f46,
            walkwayColor: 0x27272a,
            gridNeon: 0x52525b,
            gridDark: 0x27272a,
            gridFloorVisible: false,
            buildingEmissiveIntensity: 0.12,
            highwayColor: 0x38bdf8,
            highwayOpacity: 0.6,
            packetColor: 0x60a5fa,
            neonAccent: 0x63B22F,
            pinkAccent: 0xf43f5e,
            orangeAccent: 0xf97316,
            cyanAccent: 0x38bdf8,
            boulevardColor: 0x18181b,
            boulevardDivider: 0x63B22F,
            boulevardGuardrail: 0x71717a
          },
          light: {
            bgDark: 0xF1F5F9,
            fogColor: 0xF1F5F9,
            fogDensity: 0.00025,
            ambientColor: 0xFFFFFF,
            ambientIntensity: 2.5,
            hemiSkyColor: 0xFFFFFF,
            hemiGroundColor: 0xCBD5E1,
            hemiIntensity: 1.8,
            sunColor: 0xFFFBEB,
            sunIntensity: 3.0,
            secondarySunColor: 0xE0F2FE,
            secondarySunIntensity: 1.5,
            rimCyanColor: 0x0284C7,
            rimCyanIntensity: 0.9,
            rimMagentaColor: 0x63B22F,
            rimMagentaIntensity: 0.7,
            rimOrangeColor: 0xFF8000,
            rimOrangeIntensity: 0.8,
            plateColor: 0xFFFFFF,
            plateBorderColor: 0xCBD5E1,
            plotColor: 0xF8FAFC,
            plotBorderColor: 0x94A3B8,
            walkwayColor: 0xF1F5F9,
            gridNeon: 0xCBD5E1,
            gridDark: 0xE2E8F0,
            gridFloorVisible: true,
            buildingEmissiveIntensity: 0.06,
            highwayColor: 0x0284C7,
            highwayOpacity: 0.65,
            packetColor: 0xFF8000,
            neonAccent: 0x63B22F,
            pinkAccent: 0xFF8EAB,
            orangeAccent: 0xFF8000,
            cyanAccent: 0x0284C7,
            boulevardColor: 0xE2E8F0,
            boulevardDivider: 0xFF8000,
            boulevardGuardrail: 0x94A3B8
          },
          'arch-light': {
            bgDark: 0xF1F5F9,
            fogColor: 0xF1F5F9,
            fogDensity: 0.00025,
            ambientColor: 0xFFFFFF,
            ambientIntensity: 2.5,
            hemiSkyColor: 0xFFFFFF,
            hemiGroundColor: 0xCBD5E1,
            hemiIntensity: 1.8,
            sunColor: 0xFFFBEB,
            sunIntensity: 3.0,
            secondarySunColor: 0xE0F2FE,
            secondarySunIntensity: 1.5,
            rimCyanColor: 0x0284C7,
            rimCyanIntensity: 0.9,
            rimMagentaColor: 0x63B22F,
            rimMagentaIntensity: 0.7,
            rimOrangeColor: 0xFF8000,
            rimOrangeIntensity: 0.8,
            plateColor: 0xFFFFFF,
            plateBorderColor: 0xCBD5E1,
            plotColor: 0xF8FAFC,
            plotBorderColor: 0x94A3B8,
            walkwayColor: 0xF1F5F9,
            gridNeon: 0xCBD5E1,
            gridDark: 0xE2E8F0,
            gridFloorVisible: true,
            buildingEmissiveIntensity: 0.06,
            highwayColor: 0x0284C7,
            highwayOpacity: 0.65,
            packetColor: 0xFF8000,
            neonAccent: 0x63B22F,
            pinkAccent: 0xFF8EAB,
            orangeAccent: 0xFF8000,
            cyanAccent: 0x0284C7,
            boulevardColor: 0xE2E8F0,
            boulevardDivider: 0xFF8000,
            boulevardGuardrail: 0x94A3B8
          }
        };

        // Standard Styleguide Colors
        this.styleColors = {
          green: 0x63B22F,
          darkGray: 0x414141,
          neon: 0xD9FF3D,
          pink: 0xFF8EAB,
          orange: 0xFF8000,
          bgDark: 0x05050f
        };

        // Vibrant High-Tech Language Color Palette (Exact 1:1 match with Legend & Linguist / VSCode)
        this.langColors = {
          // Rust
          'Rust': 0xFF8000,              // #FF8000 (Vibrant Rust Orange)

          // C & C++ (Fixed: Distinct C++ from CSS!)
          'C++': 0x00599C,               // #00599C (C++ Deep Blue)
          'C': 0x555555,                 // #555555 (C Classic Slate Dark)

          // C# & JVM
          'C#': 0x178600,                // #178600 (C# Forest Green)
          'Java': 0xB07219,              // #B07219 (Java Caramel Brown)
          'Kotlin': 0xA97BFF,            // #A97BFF (Kotlin Violet)
          'Scala': 0xDC322F,             // #DC322F (Scala Crimson)

          // Apple / Swift
          'Swift': 0xF05138,             // #F05138 (Swift Vibrant Orange-Red)

          // Go
          'Go': 0x00ADD8,                // #00ADD8 (Go Cyan)

          // Python
          'Python': 0x3572A5,            // #3572A5 (Python Classic Blue)
          'Jupyter Notebook': 0xDA5B0B,  // #DA5B0B (Jupyter Orange)

          // TypeScript & JavaScript
          'TypeScript': 0x3178C6,        // #3178C6 (TypeScript Standard Blue)
          'TypeScript React': 0x38BDF8,  // #38BDF8 (TSX Sky Blue)
          'JavaScript': 0xF59E0B,        // #F59E0B (JS Amber / Gold)
          'React JS': 0x61DAFB,          // #61DAFB (React Cyan)

          // Web Frameworks
          'Vue': 0x41B883,               // #41B883 (Vue Emerald)
          'Svelte': 0xFF3E00,            // #FF3E00 (Svelte Orange-Red)
          'Astro': 0xFF5D01,             // #FF5D01 (Astro Bright Orange)

          // Markup & Styling (Distinct from C++)
          'HTML': 0xE34F26,              // #E34F26 (HTML Orange-Red)
          'CSS': 0x563D7C,               // #563D7C (CSS Classic Purple)
          'SCSS': 0xEC4899,              // #EC4899 (SCSS Hot Pink)
          'Sass': 0xA259FF,              // #A259FF (Sass Lilac)
          'Less': 0x1D365D,              // #1D365D (Less Navy)

          // Backend Web / Scripting
          'PHP': 0x4F5D95,               // #4F5D95 (PHP Indigo)
          'Ruby': 0xCC342D,              // #CC342D (Ruby Ruby Red)
          'Lua': 0x000080,               // #000080 (Lua Navy)
          'Dart': 0x00B4AB,              // #00B4AB (Dart Teal)
          'Elixir': 0x6E4A7E,            // #6E4A7E (Elixir Purple)
          'Erlang': 0xB83998,            // #B83998 (Erlang Magenta)
          'Haskell': 0x5E5086,           // #5E5086 (Haskell Purple)
          'Zig': 0xF7A41D,               // #F7A41D (Zig Gold)
          'Solidity': 0xAA6746,          // #AA6746 (Solidity Bronze)

          // Shell & PowerShell
          'Shell': 0x89E051,             // #89E051 (Bash Bright Green)
          'Bash': 0x89E051,              // #89E051 (Bash Bright Green)
          'PowerShell': 0x012456,        // #012456 (PowerShell Navy)
          'Batch': 0xC1F12E,             // #C1F12E (Batch Lime)

          // Databases
          'SQL': 0xE38C00,               // #E38C00 (SQL Ochre)
          'Prisma': 0x2D3748,            // #2D3748 (Prisma Charcoal)
          'GraphQL': 0xE10098,           // #E10098 (GraphQL Pink)

          // Data & Config
          'JSON': 0xCBCB41,              // #CBCB41 (JSON Olive/Yellow)
          'TOML': 0x9C4221,              // #9C4221 (TOML Brown-Orange)
          'YAML': 0xCB171E,              // #CB171E (YAML Red)
          'XML': 0x0060AC,               // #0060AC (XML Blue)
          'Config': 0x6E7681,            // #6E7681 (Config Muted Slate)
          'Markdown': 0x94A3B8,          // #94A3B8 (Markdown Slate)
          'Dockerfile': 0x2496ED,        // #2496ED (Docker Blue)
          'Terraform': 0x7B42BC,         // #7B42BC (Terraform Purple)

          // Default
          'Default': 0x818CF8,           // #818CF8 (Modern Indigo tech default)
          'Other': 0x94A3B8              // #94A3B8 (Other Slate)
        };

        // Textures & Shared Materials Cache
        this.windowTextures = {};
        this.sharedBuildingMaterials = {};
        this.sharedEdgeMaterials = {};
        this.circuitTexture = null;
        this.hexPlateTexture = null;
        this.gridFloor = null;
        this.floorMesh = null;
        this.ambientLight = null;
        this.hemiLight = null;
        this.dirLight1 = null;
        this.dirLight2 = null;
        this.rimLightCyan = null;
        this.rimLightMagenta = null;
        this.rimLightOrange = null;

        this.init();
      }

      init() {
        if (!this.container) return;
        const width = this.container.clientWidth || window.innerWidth - 64;
        const height = this.container.clientHeight || window.innerHeight - 56;

        // 1. Three.js Scene with Cyberpunk Fog
        this.scene = new THREE.Scene();
        const themeCfg = this.themeStyles[this.theme];
        this.scene.background = new THREE.Color(themeCfg.bgDark);
        this.scene.fog = new THREE.FogExp2(themeCfg.fogColor, themeCfg.fogDensity);

        // 2. Camera (Isometric Perspective)
        this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 6000);
        this.camera.position.set(220, 240, 280);

        // 3. Renderer with Performance Defaults (Capped Pixel Ratio to max 1.5 to prevent 4K Fillrate Bottlenecks)
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Clear existing canvas
        while (this.container.firstChild) {
          this.container.removeChild(this.container.firstChild);
        }
        this.container.appendChild(this.renderer.domElement);

        // 4. OrbitControls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
        this.controls.minDistance = 25;
        this.controls.maxDistance = 2500;
        this.controls.target.set(0, 0, 0);

        // 5. Sci-Fi Lighting Setup
        this.setupLights();

        // 6. Pre-generate Textures & Sci-Fi Elements
        this.createHexPlateTexture();
        this.setupFloor();
        this.setupCyberParticles();
        this.setupRadarScan();

        // 7. Event Listeners with Throttling & WASD Navigation
        window.addEventListener('resize', this.onResize.bind(this));
        this.container.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.container.addEventListener('mousedown', (e) => { this.isMouseDown = true; });
        window.addEventListener('mouseup', (e) => { this.isMouseDown = false; });
        this.container.addEventListener('click', this.onClick.bind(this));
        this.container.addEventListener('mouseleave', this.onMouseLeave.bind(this));
        window.addEventListener('keydown', this.onKeyDown.bind(this));
        window.addEventListener('keyup', this.onKeyUp.bind(this));

        // 8. Start Animation Loop
        this.animate = this.animate.bind(this);
        this.animate();

        // 9. Synchronize initial theme
        this.setTheme(this.theme);
      }

      setupLights() {
        const themeCfg = this.themeStyles[this.theme];

        // 1. Soft Ambient Light
        this.ambientLight = new THREE.AmbientLight(themeCfg.ambientColor, themeCfg.ambientIntensity);
        this.scene.add(this.ambientLight);

        // 2. Hemisphere Light for Sky/Ground Natural Fill
        this.hemiLight = new THREE.HemisphereLight(
          themeCfg.hemiSkyColor || 0x38bdf8,
          themeCfg.hemiGroundColor || 0x0f172a,
          themeCfg.hemiIntensity || 1.4
        );
        this.scene.add(this.hemiLight);

        // 3. Primary Directional Global Sun
        this.dirLight1 = new THREE.DirectionalLight(themeCfg.sunColor, themeCfg.sunIntensity);
        this.dirLight1.position.set(300, 600, 250);
        this.dirLight1.castShadow = true;
        this.dirLight1.shadow.mapSize.width = 2048;
        this.dirLight1.shadow.mapSize.height = 2048;
        this.dirLight1.shadow.camera.near = 10;
        this.dirLight1.shadow.camera.far = 2500;
        const d = 800; // Expanded shadow box coverage so large metropolis is fully covered
        this.dirLight1.shadow.camera.left = -d;
        this.dirLight1.shadow.camera.right = d;
        this.dirLight1.shadow.camera.top = d;
        this.dirLight1.shadow.camera.bottom = -d;
        this.dirLight1.shadow.bias = -0.0005;
        this.scene.add(this.dirLight1);

        // 4. Secondary Fill Directional Sun (Opposite quadrant)
        this.dirLight2 = new THREE.DirectionalLight(themeCfg.secondarySunColor || 0x38bdf8, themeCfg.secondarySunIntensity || 1.2);
        this.dirLight2.position.set(-300, 450, -250);
        this.scene.add(this.dirLight2);

        // 5. Rim Light Cyan (West)
        this.rimLightCyan = new THREE.DirectionalLight(themeCfg.rimCyanColor, themeCfg.rimCyanIntensity);
        this.rimLightCyan.position.set(-400, 180, -250);
        this.scene.add(this.rimLightCyan);

        // 6. Rim Light Magenta (South-East)
        this.rimLightMagenta = new THREE.DirectionalLight(themeCfg.rimMagentaColor, themeCfg.rimMagentaIntensity);
        this.rimLightMagenta.position.set(350, 200, -400);
        this.scene.add(this.rimLightMagenta);

        // 7. Rim Light Neon / Orange (Under-Glow Ground Bounce)
        this.rimLightOrange = new THREE.DirectionalLight(themeCfg.rimOrangeColor, themeCfg.rimOrangeIntensity);
        this.rimLightOrange.position.set(0, -80, 250);
        this.scene.add(this.rimLightOrange);
      }

      // Procedural Circuit-Board / Cyber Ground Canvas Texture (512x512)
      createProceduralCircuitGroundTexture() {
        if (this.circuitTexture) return this.circuitTexture;
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#040711';
        ctx.fillRect(0, 0, 512, 512);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 512; i += 64) {
          ctx.beginPath();
          ctx.moveTo(i, 0); ctx.lineTo(i, 512);
          ctx.moveTo(0, i); ctx.lineTo(512, i);
          ctx.stroke();
        }

        const traceColors = [
          { core: '#FF8000', glow: 'rgba(255, 128, 0, 0.25)' },
          { core: '#38bdf8', glow: 'rgba(56, 189, 248, 0.25)' },
          { core: '#D9FF3D', glow: 'rgba(217, 255, 61, 0.25)' }
        ];

        const drawBusTracks = (x1, y1, len, horizontal, col, count) => {
          for (let c = 0; c < count; c++) {
            const offset = (c - count / 2) * 6;
            ctx.save();
            ctx.strokeStyle = col.glow;
            ctx.lineWidth = 4.0;
            ctx.beginPath();
            if (horizontal) {
              ctx.moveTo(x1, y1 + offset);
              ctx.lineTo(x1 + len * 0.6, y1 + offset);
              ctx.lineTo(x1 + len * 0.7, y1 + offset + 20);
              ctx.lineTo(x1 + len, y1 + offset + 20);
            } else {
              ctx.moveTo(x1 + offset, y1);
              ctx.lineTo(x1 + offset, y1 + len * 0.6);
              ctx.lineTo(x1 + offset + 20, y1 + len * 0.7);
              ctx.lineTo(x1 + offset + 20, y1 + len);
            }
            ctx.stroke();

            ctx.strokeStyle = col.core;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();
          }
        };

        drawBusTracks(16, 80, 240, true, traceColors[0], 3);
        drawBusTracks(270, 160, 225, true, traceColors[1], 3);
        drawBusTracks(32, 340, 260, true, traceColors[0], 4);
        drawBusTracks(256, 420, 240, true, traceColors[1], 3);

        drawBusTracks(110, 20, 230, false, traceColors[1], 3);
        drawBusTracks(380, 40, 250, false, traceColors[0], 3);
        drawBusTracks(190, 260, 230, false, traceColors[2], 4);

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(6, 6);
        this.circuitTexture = texture;
        return texture;
      }

      createHexPlateTexture() {
        if (this.hexPlateTexture) return this.hexPlateTexture;
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#080d1a';
        ctx.fillRect(0, 0, 256, 256);

        const hexRadius = 12;
        const hexHeight = hexRadius * Math.sqrt(3);
        const horizDist = hexRadius * 1.5;
        const vertDist = hexHeight;

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
        ctx.lineWidth = 1;

        for (let col = -1; col < 256 / horizDist + 1; col++) {
          for (let row = -1; row < 256 / vertDist + 1; row++) {
            const x = col * horizDist;
            const y = row * vertDist + (col % 2 !== 0 ? hexHeight / 2 : 0);

            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
              const angle = (Math.PI / 3) * i;
              const hx = x + hexRadius * Math.cos(angle);
              const hy = y + hexRadius * Math.sin(angle);
              if (i === 0) ctx.moveTo(hx, hy);
              else ctx.lineTo(hx, hy);
            }
            ctx.closePath();
            ctx.stroke();
          }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(3, 3);
        this.hexPlateTexture = texture;
        return texture;
      }

      setupFloor() {
        const themeCfg = this.themeStyles[this.theme];
        const isLight = this.theme === 'light' || this.theme === 'arch-light';

        const floorGeo = new THREE.PlaneGeometry(3000, 3000);
        const floorMat = new THREE.MeshStandardMaterial({
          color: isLight ? 0xEDF2F7 : 0x050811,
          map: this.createProceduralCircuitGroundTexture(),
          roughness: 0.7,
          metalness: 0.35,
          emissive: isLight ? 0xCBD5E1 : 0x040814,
          emissiveMap: this.circuitTexture,
          emissiveIntensity: isLight ? 0.08 : 0.4
        });
        this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
        this.floorMesh.rotation.x = -Math.PI / 2;
        this.floorMesh.position.y = -1.1;
        this.floorMesh.receiveShadow = true;
        this.floorMesh.matrixAutoUpdate = false;
        this.floorMesh.updateMatrix();
        this.scene.add(this.floorMesh);

        this.gridFloor = new THREE.GridHelper(2400, 180, themeCfg.gridNeon, themeCfg.gridDark);
        this.gridFloor.position.y = -1.05;
        this.gridFloor.material.opacity = 0.35;
        this.gridFloor.material.transparent = true;
        this.gridFloor.visible = themeCfg.gridFloorVisible !== false;
        this.gridFloor.matrixAutoUpdate = false;
        this.gridFloor.updateMatrix();
        this.scene.add(this.gridFloor);
      }

      setupCyberParticles() {
        const pCount = 350;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(pCount * 3);
        const colors = new Float32Array(pCount * 3);

        const colorPool = [
          new THREE.Color(this.styleColors.green),
          new THREE.Color(this.styleColors.neon),
          new THREE.Color(this.styleColors.orange),
          new THREE.Color(0x38bdf8),
          new THREE.Color(this.styleColors.pink)
        ];

        for (let i = 0; i < pCount; i++) {
          positions[i * 3] = (Math.random() - 0.5) * 1600;
          positions[i * 3 + 1] = 5 + Math.random() * 220;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 1600;

          const col = colorPool[Math.floor(Math.random() * colorPool.length)];
          colors[i * 3] = col.r;
          colors[i * 3 + 1] = col.g;
          colors[i * 3 + 2] = col.b;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const pMaterial = new THREE.PointsMaterial({
          size: 2.2,
          vertexColors: true,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });

        this.cyberParticles = new THREE.Points(geometry, pMaterial);
        this.cyberParticles.frustumCulled = true;
        if (this.theme === 'light' || this.theme === 'arch-light') {
          this.cyberParticles.visible = false;
        }
        this.scene.add(this.cyberParticles);
      }

      setupRadarScan() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        const cx = 128;
        const cy = 128;
        const rMax = 120;

        ctx.clearRect(0, 0, 256, 256);

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = 1.5;
        [30, 60, 90, 120].forEach(r => {
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
        });

        const sweepAngle = Math.PI / 3.2;
        const grad = ctx.createRadialGradient(cx, cy, 5, cx, cy, rMax);
        grad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
        grad.addColorStop(0.7, 'rgba(0, 240, 255, 0.2)');
        grad.addColorStop(1, 'rgba(0, 240, 255, 0.0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, rMax, -sweepAngle, 0);
        ctx.closePath();
        ctx.fill();

        const radarTexture = new THREE.CanvasTexture(canvas);
        const radarMat = new THREE.MeshBasicMaterial({
          map: radarTexture,
          transparent: true,
          opacity: 0.35,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide
        });

        const radarGeo = new THREE.PlaneGeometry(1600, 1600);
        this.radarMesh = new THREE.Mesh(radarGeo, radarMat);
        this.radarMesh.rotation.x = -Math.PI / 2;
        this.radarMesh.position.y = -0.98;
        this.radarMaterial = radarMat;
        if (this.theme === 'light' || this.theme === 'arch-light') {
          this.radarMesh.visible = false;
        }
        this.scene.add(this.radarMesh);
      }

      applyCustomTexture(dataUrl) {
        if (!dataUrl) {
          if (this.floorMesh) {
            const tex = this.createProceduralCircuitGroundTexture();
            this.floorMesh.material.map = tex;
            this.floorMesh.material.emissiveMap = tex;
            this.floorMesh.material.needsUpdate = true;
          }
          return;
        }

        const img = new Image();
        img.onload = () => {
          const texture = new THREE.Texture(img);
          texture.needsUpdate = true;
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.repeat.set(4, 4);

          if (this.floorMesh) {
            this.floorMesh.material.map = texture;
            this.floorMesh.material.emissiveMap = texture;
            this.floorMesh.material.emissiveIntensity = 0.25;
            this.floorMesh.material.needsUpdate = true;
          }
        };
        img.src = dataUrl;
      }

      normalizeLanguageName(rawLang, path = '') {
        const cleanPath = (path || '').split('?')[0].split('#')[0];
        let ext = '';
        if (cleanPath.includes('.')) {
          ext = cleanPath.substring(cleanPath.lastIndexOf('.')).toLowerCase();
        }

        // Direct extension mapping takes precedence for accuracy (Fix: C++ vs CSS)
        if (ext) {
          const detected = detectLanguage(ext);
          if (detected && detected !== 'Other') {
            return detected;
          }
        }

        const str = (rawLang || '').toString().trim().toLowerCase();
        if (str === 'rs' || str === 'rust') return 'Rust';
        if (str === 'cpp' || str === 'c++' || str === 'cc' || str === 'cxx' || str === 'hpp' || str === 'hxx') return 'C++';
        if (str === 'c' || str === 'h') return 'C';
        if (str === 'cs' || str === 'c#' || str === 'csharp') return 'C#';
        if (str === 'java') return 'Java';
        if (str === 'kt' || str === 'kotlin') return 'Kotlin';
        if (str === 'scala') return 'Scala';
        if (str === 'swift') return 'Swift';
        if (str === 'go' || str === 'golang') return 'Go';
        if (str === 'py' || str === 'python') return 'Python';
        if (str === 'ts' || str === 'typescript') return 'TypeScript';
        if (str === 'tsx' || str === 'typescript react') return 'TypeScript React';
        if (str === 'js' || str === 'javascript') return 'JavaScript';
        if (str === 'jsx' || str === 'react js' || str === 'react') return 'React JS';
        if (str === 'vue') return 'Vue';
        if (str === 'svelte') return 'Svelte';
        if (str === 'astro') return 'Astro';
        if (str === 'html' || str === 'htm' || str === 'markup') return 'HTML';
        if (str === 'css') return 'CSS';
        if (str === 'scss') return 'SCSS';
        if (str === 'sass') return 'Sass';
        if (str === 'less') return 'Less';
        if (str === 'php') return 'PHP';
        if (str === 'rb' || str === 'ruby') return 'Ruby';
        if (str === 'sh' || str === 'bash' || str === 'shell') return 'Shell';
        if (str === 'zsh') return 'Zsh';
        if (str === 'ps1' || str === 'powershell') return 'PowerShell';
        if (str === 'bat' || str === 'batch' || str === 'cmd') return 'Batch';
        if (str === 'sql') return 'SQL';
        if (str === 'prisma') return 'Prisma';
        if (str === 'graphql' || str === 'gql') return 'GraphQL';
        if (str === 'json') return 'JSON';
        if (str === 'toml') return 'TOML';
        if (str === 'yaml' || str === 'yml') return 'YAML';
        if (str === 'xml' || str === 'svg') return 'XML';
        if (str === 'md' || str === 'markdown') return 'Markdown';
        if (str === 'dockerfile') return 'Dockerfile';
        if (str === 'terraform' || str === 'tf') return 'Terraform';
        if (str === 'zig') return 'Zig';
        if (str === 'lua') return 'Lua';
        if (str === 'solidity' || str === 'sol') return 'Solidity';
        if (str === 'elixir' || str === 'ex') return 'Elixir';

        if (rawLang && rawLang !== 'Default' && rawLang !== 'Code' && rawLang !== 'text') {
          return rawLang.charAt(0).toUpperCase() + rawLang.slice(1);
        }
        return 'Other';
      }

      getLanguageColor(lang, path = '') {
        const norm = this.normalizeLanguageName(lang, path);
        if (this.langColors[norm] !== undefined) {
          return this.langColors[norm];
        }
        const lowerNorm = norm.toLowerCase();
        for (const [k, v] of Object.entries(this.langColors)) {
          if (k.toLowerCase() === lowerNorm) return v;
        }
        return this.langColors['Default'] || 0x818CF8;
      }

      createWindowTexture(hexColor) {
        const isLight = this.theme === 'light' || this.theme === 'arch-light';
        const isCyber = this.theme === 'cyberpunk';
        const cacheKey = hexColor + '_' + (isLight ? 'light' : (isCyber ? 'cyber' : 'dark'));

        if (this.windowTextures[cacheKey]) {
          return this.windowTextures[cacheKey];
        }

        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        if (isLight) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, 64, 128);
          ctx.strokeStyle = '#E2E8F0';
          ctx.lineWidth = 1;
          ctx.strokeRect(0, 0, 64, 128);
        } else {
          ctx.fillStyle = isCyber ? '#090d19' : '#1e1e24';
          ctx.fillRect(0, 0, 64, 128);
        }

        const c = new THREE.Color(hexColor);
        let colorRgba, dimRgba;
        if (isLight) {
          colorRgba = 'rgba(' + Math.round(c.r * 255) + ', ' + Math.round(c.g * 255) + ', ' + Math.round(c.b * 255) + ', 0.85)';
          dimRgba = 'rgba(226, 232, 240, 0.7)';
        } else {
          colorRgba = 'rgba(' + Math.round(c.r * 255) + ', ' + Math.round(c.g * 255) + ', ' + Math.round(c.b * 255) + ', ' + (isCyber ? '0.88' : '0.65') + ')';
          dimRgba = 'rgba(' + Math.round(c.r * 255) + ', ' + Math.round(c.g * 255) + ', ' + Math.round(c.b * 255) + ', ' + (isCyber ? '0.22' : '0.12') + ')';
        }

        const cols = 4;
        const rows = 12;
        const padX = 2;
        const padY = 2;
        const winW = (64 - (cols + 1) * padX) / cols;
        const winH = (128 - (rows + 1) * padY) / rows;

        for (let r = 0; r < rows; r++) {
          for (let cl = 0; cl < cols; cl++) {
            const wx = padX + cl * (winW + padX);
            const wy = padY + r * (winH + padY);

            const rand = Math.random();
            if (rand > 0.42) {
              ctx.fillStyle = colorRgba;
              ctx.fillRect(wx, wy, winW, winH);
              if (isLight) {
                ctx.strokeStyle = 'rgba(' + Math.round(c.r * 180) + ', ' + Math.round(c.g * 180) + ', ' + Math.round(c.b * 180) + ', 0.4)';
                ctx.strokeRect(wx, wy, winW, winH);
              }
            } else if (rand > 0.15) {
              ctx.fillStyle = dimRgba;
              ctx.fillRect(wx, wy, winW, winH);
            }
          }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        this.windowTextures[cacheKey] = texture;
        return texture;
      }

      getSharedBuildingMaterial(langColorHex) {
        const key = langColorHex + '_' + this.theme;
        if (this.sharedBuildingMaterials[key]) {
          return this.sharedBuildingMaterials[key];
        }

        const themeCfg = this.themeStyles[this.theme];
        const isLight = this.theme === 'light' || this.theme === 'arch-light';
        const tex = this.createWindowTexture(langColorHex);
        const mat = new THREE.MeshStandardMaterial({
          color: isLight ? 0xF8FAFC : 0x121829,
          map: tex,
          roughness: isLight ? 0.5 : 0.35,
          metalness: isLight ? 0.2 : 0.75,
          emissive: new THREE.Color(langColorHex),
          emissiveMap: tex,
          emissiveIntensity: themeCfg.buildingEmissiveIntensity
        });
        this.sharedBuildingMaterials[key] = mat;
        return mat;
      }

      getSharedEdgeMaterial(langColorHex) {
        const key = langColorHex + '_' + this.theme;
        if (this.sharedEdgeMaterials[key]) {
          return this.sharedEdgeMaterials[key];
        }

        const isLight = this.theme === 'light' || this.theme === 'arch-light';
        const isCyber = this.theme === 'cyberpunk';
        const mat = new THREE.LineBasicMaterial({
          color: isLight ? 0x64748B : langColorHex,
          linewidth: isLight ? 2.0 : 1.8,
          transparent: true,
          opacity: isCyber ? 0.75 : (isLight ? 0.7 : 0.45)
        });
        this.sharedEdgeMaterials[key] = mat;
        return mat;
      }

      createCanvasTextSprite(text, subText, accentHex, isDistrict = false) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 70;
        const ctx = canvas.getContext('2d');

        const isLight = this.theme === 'light' || this.theme === 'arch-light';
        const isCyber = this.theme === 'cyberpunk';
        const c = new THREE.Color(accentHex || 0x38bdf8);

        ctx.fillStyle = isLight 
          ? (isDistrict ? 'rgba(255, 255, 255, 0.96)' : 'rgba(248, 250, 252, 0.94)')
          : (isDistrict ? 'rgba(5, 10, 24, 0.92)' : 'rgba(8, 12, 22, 0.88)');
        ctx.strokeStyle = isLight ? (isDistrict ? '#' + c.getHexString() : 'rgba(203, 213, 225, 0.9)') : '#' + c.getHexString();
        ctx.lineWidth = isDistrict ? 2.5 : 1.5;

        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath();
          ctx.roundRect(4, 4, 248, 62, 10);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillRect(4, 4, 248, 62);
          ctx.strokeRect(4, 4, 248, 62);
        }

        if (isCyber) {
          ctx.shadowColor = 'rgba(' + Math.round(c.r * 255) + ', ' + Math.round(c.g * 255) + ', ' + Math.round(c.b * 255) + ', 0.6)';
          ctx.shadowBlur = 6;
        }

        ctx.fillStyle = isLight ? '#0F172A' : '#ffffff';
        ctx.font = isDistrict ? 'bold 18px "JetBrains Mono", monospace' : 'bold 14px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 128, subText ? 26 : 35);

        if (subText) {
          ctx.fillStyle = '#' + c.getHexString();
          ctx.font = 'bold 11px "JetBrains Mono", monospace';
          ctx.fillText(subText, 128, 48);
        }

        const texture = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          opacity: 0.95,
          blending: isCyber ? THREE.AdditiveBlending : THREE.NormalBlending,
          depthWrite: false
        });

        const sprite = new THREE.Sprite(mat);
        const w = isDistrict ? 30 : 18;
        const h = isDistrict ? 8.2 : 5.0;
        sprite.scale.set(w, h, 1);
        sprite.frustumCulled = true;
        sprite.userData = { isDistrictLabel: isDistrict };
        return sprite;
      }

      // =======================================================================
      // DENDRITIC ORGANIC CITY GROWTH ENGINE (HIGH PERFORMANCE BUILDER)
      // =======================================================================
      buildCity(data) {
        if (!data) return;
        this.data = data;

        const isLight = (typeof document !== 'undefined' && document.documentElement.classList.contains('light')) ||
                        (typeof appSettings !== 'undefined' && appSettings && appSettings.themeMode === 'light') ||
                        (typeof localStorage !== 'undefined' && (localStorage.getItem('codebase_theme') === 'light' || localStorage.getItem('codebase_theme_mode') === 'light'));
        const targetTheme = isLight ? 'light' : (this.theme === 'light' ? 'cyberpunk' : this.theme);
        if (this.theme !== targetTheme) {
          this.setTheme(targetTheme);
        }

        // 1. Clean previous scene objects & dispose memory
        this.clearCity();

        // 2. Extract normalized files list
        const fileList = this.extractNormalizedFiles(data);
        if (fileList.length === 0) return;

        // Capped Pixel Ratio: 1.25 for massive scenes (> 500 buildings or > 50 districts), 1.5 for regular
        const isMassive = fileList.length > 500;
        if (this.renderer) {
          this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMassive ? 1.25 : 1.5));
          if (isMassive) {
            this.renderer.shadowMap.enabled = false;
          }
        }

        // 3. Build Dendritic Hierarchy Tree
        const { root, allDistricts } = this.buildDendriticHierarchy(fileList);
        this.districtTreeRoot = root;
        this.districts = allDistricts;
        this.districtMap.clear();
        allDistricts.forEach(d => this.districtMap.set(d.path, d));

        // 4. Calculate dynamic platform sizes based on File Count & LOC
        this.calculateDistrictPlatformSizes(allDistricts);

        // 5. Position districts using Radial Dendritic Branching Spacing
        this.arrangeDendriticDistricts(root, allDistricts);

        // Track Geometries & Transforms for Single Draw Call Merging & Instancing
        const treeCrownTransforms = [];
        const bollardTransforms = [];
        const parcelTransforms = [];
        const groundLineVertices = [];
        const groundLineColors = [];

        // 6. Construct District Foundations, Manhattan Parcels, Local Streets & Buildings
        allDistricts.forEach(district => {
          this.createDistrictUrbanGrid(district, treeCrownTransforms, bollardTransforms, parcelTransforms, groundLineVertices, groundLineColors);
          this.createDistrictBuildings(district);
        });

        // 7. Construct Downtown Root Core Monument
        this.createDowntownCoreMonument(root);

        // 8. Construct Gateways via InstancedMesh
        this.createDistrictGatewaysInstanced(allDistricts);

        // 9. Construct Dendritic Manhattan Motherboard Connections (Parent to Child)
        this.createDendriticArterialHighwaysMerged(allDistricts, groundLineVertices, groundLineColors);

        // 10. Construct Single Draw Call Merged Ground Lines
        this.createMergedGroundLines(groundLineVertices, groundLineColors);

        // 11. Construct Low-Poly Instanced Trees, Bollards & Parcels (Single Draw Calls)
        this.createInstancedDeco(treeCrownTransforms, bollardTransforms, parcelTransforms);

        // 12. Construct Cross-District Highways & Single-Buffer Particle Traffic
        this.createCyberHighwaysMerged(fileList);

        // 13. Update Filter Sidebar & Raycast Targets
        this.setupFilterSidebar(allDistricts, fileList);
        this.updateRaycastTargets();

        // 14. Auto-Fit Camera smoothly
        this.autoFitMetropolis(false);
      }

      extractNormalizedFiles(data) {
        const list = [];
        const seen = new Set();

        if (data.files && typeof data.files === 'object') {
          for (const [path, fileObj] of Object.entries(data.files)) {
            const normPath = path.replace(/\\/g, '/');
            if (!seen.has(normPath)) {
              seen.add(normPath);
              const rawLang = fileObj.language || (typeof getLanguageFromPath === 'function' ? getLanguageFromPath(normPath) : 'Default');
              const normLang = this.normalizeLanguageName(rawLang, normPath);
              list.push({
                path: normPath,
                language: normLang,
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

        if (list.length === 0 && data.file_contents) {
          for (const [path, content] of Object.entries(data.file_contents)) {
            const normPath = path.replace(/\\/g, '/');
            if (!seen.has(normPath)) {
              seen.add(normPath);
              const rawLang = typeof getLanguageFromPath === 'function' ? getLanguageFromPath(normPath) : 'Default';
              const normLang = this.normalizeLanguageName(rawLang, normPath);
              const lines = content ? content.split('\n').length : 30;
              const syms = typeof extractSymbols === 'function' ? extractSymbols(content, normLang.toLowerCase(), normPath) : [];
              list.push({
                path: normPath,
                language: normLang,
                code_lines: lines,
                total_lines: lines,
                complexity: typeof calculateComplexity === 'function' ? calculateComplexity(content) : 1,
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

      buildDendriticHierarchy(fileList) {
        const nodeMap = new Map();

        const getOrCreate = (path) => {
          if (nodeMap.has(path)) return nodeMap.get(path);
          const isRoot = (path === 'root' || !path.includes('/'));
          const parentPath = isRoot ? (path === 'root' ? null : 'root') : path.substring(0, path.lastIndexOf('/'));
          const name = path === 'root' ? 'Downtown Root (/)' : path.split('/').pop();
          const depth = path === 'root' ? 0 : path.split('/').length;

          const node = {
            path,
            dirPath: path,
            name,
            parentPath,
            children: [],
            parent: null,
            depth,
            files: [],
            totalLoc: 0,
            descendantFilesCount: 0,
            descendantLoc: 0,
            x: 0,
            z: 0,
            width: 0,
            depth: 0,
            angle: 0,
            radius: 0,
            sectorSpan: 2 * Math.PI,
            buildingMeshes: [],
            gateways: { N: null, S: null, E: null, W: null }
          };
          nodeMap.set(path, node);
          return node;
        };

        getOrCreate('root');

        fileList.forEach(file => {
          const parts = file.path.split('/');
          const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : 'root';
          if (dir !== 'root') {
            let cur = '';
            parts.slice(0, -1).forEach(p => {
              cur = cur ? cur + '/' + p : p;
              getOrCreate(cur);
            });
          }
          const dNode = getOrCreate(dir);
          dNode.files.push(file);
          dNode.totalLoc += file.code_lines || 30;
        });

        for (const [path, node] of nodeMap.entries()) {
          if (node.parentPath && nodeMap.has(node.parentPath)) {
            const parent = nodeMap.get(node.parentPath);
            node.parent = parent;
            if (!parent.children.includes(node)) {
              parent.children.push(node);
            }
          }
        }

        const rollup = (node) => {
          node.descendantFilesCount = node.files.length;
          node.descendantLoc = node.totalLoc;
          node.children.forEach(child => {
            rollup(child);
            node.descendantFilesCount += child.descendantFilesCount;
            node.descendantLoc += child.descendantLoc;
          });
        };
        const root = nodeMap.get('root');
        rollup(root);

        return { root, allDistricts: Array.from(nodeMap.values()) };
      }

      calculateDistrictPlatformSizes(districts) {
        const plotWidth = 26;
        const plotDepth = 26;
        const streetWidth = 14;
        const cellPitchX = 40;
        const cellPitchZ = 40;
        const districtMargin = 20;

        districts.forEach(d => {
          const count = d.files.length;
          d.plotWidth = plotWidth;
          d.plotDepth = plotDepth;
          d.streetWidth = streetWidth;
          d.cellPitchX = cellPitchX;
          d.cellPitchZ = cellPitchZ;
          d.districtMargin = districtMargin;

          if (d.path === 'root') {
            d.cols = Math.max(2, Math.ceil(Math.sqrt(Math.max(1, count))));
            d.rows = Math.max(2, Math.ceil(Math.max(1, count) / d.cols));
            d.width = Math.max(86, d.cols * cellPitchX + streetWidth + districtMargin * 2);
            d.depth = Math.max(86, d.rows * cellPitchZ + streetWidth + districtMargin * 2);
          } else if (count === 0) {
            d.cols = 1;
            d.rows = 1;
            d.width = 54;
            d.depth = 54;
          } else {
            d.cols = Math.max(1, Math.ceil(Math.sqrt(count)));
            d.rows = Math.max(1, Math.ceil(count / d.cols));
            d.width = d.cols * cellPitchX + streetWidth + districtMargin * 2;
            d.depth = d.rows * cellPitchZ + streetWidth + districtMargin * 2;
          }
        });
      }

      arrangeDendriticDistricts(root, allDistricts) {
        root.x = 0;
        root.z = 0;
        root.angle = 0;
        root.radius = 0;
        root.sectorSpan = 2 * Math.PI;

        const positionSubtree = (node) => {
          if (!node.children || node.children.length === 0) return;
          const numChildren = node.children.length;
          const totalWeight = node.children.reduce((acc, c) => acc + Math.max(1, c.descendantFilesCount || 1), 0);

          if (node.path === 'root') {
            let currentAngle = -Math.PI / 2;
            node.children.forEach((child) => {
              const weightFrac = Math.max(1, child.descendantFilesCount || 1) / totalWeight;
              const sectorSpan = (2 * Math.PI) * (numChildren > 1 ? (0.35 / numChildren + 0.65 * weightFrac) : 1);
              const childAngle = currentAngle + sectorSpan / 2;

              const rRoot = Math.max(node.width, node.depth) / 2;
              const rChild = Math.max(child.width, child.depth) / 2;
              const gap = 65 + Math.min(50, (child.descendantLoc || 0) / 75);
              const branchDist = rRoot + rChild + gap;

              child.x = branchDist * Math.cos(childAngle);
              child.z = branchDist * Math.sin(childAngle);
              child.angle = childAngle;
              child.radius = branchDist;
              child.sectorSpan = sectorSpan;

              currentAngle += sectorSpan;
              positionSubtree(child);
            });
          } else {
            const parentAngle = node.angle;
            const parentR = Math.max(node.width, node.depth) / 2;
            const maxFan = Math.min(Math.PI * 0.75, Math.max(0.45, node.sectorSpan * 0.85));

            node.children.forEach((child, idx) => {
              let childAngle = parentAngle;
              if (numChildren > 1) {
                const t = (idx / (numChildren - 1)) - 0.5;
                childAngle = parentAngle + t * maxFan;
              }
              const rChild = Math.max(child.width, child.depth) / 2;
              const gap = 52 + Math.min(40, (child.descendantLoc || 0) / 100);
              const branchDist = parentR + rChild + gap;

              child.x = node.x + branchDist * Math.cos(childAngle);
              child.z = node.z + branchDist * Math.sin(childAngle);
              child.angle = childAngle;
              child.radius = Math.hypot(child.x, child.z);
              child.sectorSpan = maxFan / numChildren;

              positionSubtree(child);
            });
          }
        };

        positionSubtree(root);

        for (let iter = 0; iter < 24; iter++) {
          for (let i = 0; i < allDistricts.length; i++) {
            for (let j = i + 1; j < allDistricts.length; j++) {
              const d1 = allDistricts[i];
              const d2 = allDistricts[j];
              const minAllowed = (Math.hypot(d1.width, d1.depth) + Math.hypot(d2.width, d2.depth)) / 2 + 25;
              let dx = d2.x - d1.x;
              let dz = d2.z - d1.z;
              let dist = Math.hypot(dx, dz);
              if (dist < minAllowed && dist > 0.001) {
                const overlap = (minAllowed - dist) * 0.5;
                const nx = dx / dist;
                const nz = dz / dist;
                if (d1.path !== 'root') { d1.x -= nx * overlap; d1.z -= nz * overlap; }
                if (d2.path !== 'root') { d2.x += nx * overlap; d2.z += nz * overlap; }
              }
            }
          }
        }
      }

      createDowntownCoreMonument(root) {
        const themeCfg = this.themeStyles[this.theme];
        const isCyber = this.theme === 'cyberpunk';

        const coreGeo = new THREE.CylinderGeometry(4.5, 4.5, 12, 16, 1, true);
        const coreMat = new THREE.MeshBasicMaterial({
          color: themeCfg.neonAccent,
          transparent: true,
          opacity: 0.85,
          wireframe: true,
          blending: isCyber ? THREE.AdditiveBlending : THREE.NormalBlending
        });
        const coreMesh = new THREE.Mesh(coreGeo, coreMat);
        coreMesh.position.set(root.x, 6.5, root.z);
        coreMesh.userData = { isCoreRotator: true, rotSpeed: 0.015 };
        coreMesh.frustumCulled = true;
        coreMesh.matrixAutoUpdate = true; // Monument continuously rotates
        this.scene.add(coreMesh);
        this.coreMonumentObjects.push(coreMesh);

        [7.0, 11.5, 16.0].forEach((r, idx) => {
          const ringGeo = new THREE.RingGeometry(r - 0.35, r, 32);
          const ringMat = new THREE.MeshBasicMaterial({
            color: idx === 1 ? themeCfg.cyanAccent : themeCfg.neonAccent,
            transparent: true,
            opacity: 0.75,
            side: THREE.DoubleSide,
            blending: isCyber ? THREE.AdditiveBlending : THREE.NormalBlending
          });
          const ringMesh = new THREE.Mesh(ringGeo, ringMat);
          ringMesh.rotation.x = -Math.PI / 2;
          ringMesh.position.set(root.x, 1.25 + idx * 0.3, root.z);
          ringMesh.userData = { isCoreRotator: true, rotSpeed: (idx % 2 === 0 ? 0.008 : -0.012) };
          ringMesh.frustumCulled = true;
          ringMesh.matrixAutoUpdate = true;
          this.scene.add(ringMesh);
          this.coreMonumentObjects.push(ringMesh);
        });

        const coreSprite = this.createCanvasTextSprite('⚡ DOWNTOWN CORE', 'Pulsing Root Hub', themeCfg.neonAccent, true);
        coreSprite.position.set(root.x, 18.0, root.z);
        coreSprite.matrixAutoUpdate = false;
        coreSprite.updateMatrix();
        this.scene.add(coreSprite);
        this.coreMonumentObjects.push(coreSprite);
      }

      createDistrictUrbanGrid(district, treeCrownTransforms, bollardTransforms, parcelTransforms, groundLineVertices, groundLineColors) {
        const themeCfg = this.themeStyles[this.theme];
        const halfW = district.width / 2;
        const halfD = district.depth / 2;

        // Base District Foundation Platform with matrixAutoUpdate = false
        const plateGeo = new THREE.BoxGeometry(district.width, 1.8, district.depth);
        const plateMat = new THREE.MeshStandardMaterial({
          color: themeCfg.plateColor,
          map: this.hexPlateTexture,
          roughness: 0.65,
          metalness: 0.45
        });
        const plateMesh = new THREE.Mesh(plateGeo, plateMat);
        plateMesh.position.set(district.x, 0.0, district.z);
        plateMesh.receiveShadow = true;
        plateMesh.frustumCulled = true;
        plateMesh.matrixAutoUpdate = false;
        plateMesh.updateMatrix();
        plateMesh.userData = { type: 'district', districtObj: district };
        this.scene.add(plateMesh);
        district.plateMesh = plateMesh;
        this.districtPlateMeshes.push(plateMesh);

        // Platform Border Lines added to Merged Ground Line Array
        const borderColor = new THREE.Color(themeCfg.plateBorderColor);
        const pY = 0.92;
        const corners = [
          [district.x - halfW, district.z - halfD],
          [district.x + halfW, district.z - halfD],
          [district.x + halfW, district.z + halfD],
          [district.x - halfW, district.z + halfD]
        ];
        for (let i = 0; i < 4; i++) {
          const c1 = corners[i];
          const c2 = corners[(i + 1) % 4];
          groundLineVertices.push(c1[0], pY, c1[1], c2[0], pY, c2[1]);
          groundLineColors.push(borderColor.r, borderColor.g, borderColor.b, borderColor.r, borderColor.g, borderColor.b);
        }

        // Internal Street Grid Lines added to Merged Ground Line Array
        const startX = district.x - halfW + district.districtMargin + district.streetWidth / 2;
        const startZ = district.z - halfD + district.districtMargin + district.streetWidth / 2;
        const gridColor = new THREE.Color(themeCfg.neonAccent);

        // Avenues (North-South)
        for (let c = 0; c <= district.cols; c++) {
          const avenueX = startX + c * district.cellPitchX;
          groundLineVertices.push(
            avenueX, 0.95, district.z - halfD + district.districtMargin / 2,
            avenueX, 0.95, district.z + halfD - district.districtMargin / 2
          );
          groundLineColors.push(gridColor.r * 0.7, gridColor.g * 0.7, gridColor.b * 0.7, gridColor.r * 0.7, gridColor.g * 0.7, gridColor.b * 0.7);

          if (c < district.cols) {
            treeCrownTransforms.push({
              x: avenueX + district.streetWidth / 2 + 3.0,
              z: district.z - halfD + district.districtMargin + 4.0,
              scale: 0.85 + Math.random() * 0.3,
              rotY: Math.random() * Math.PI
            });
            bollardTransforms.push({
              x: avenueX + district.streetWidth / 2 + 1.2,
              y: 1.8,
              z: district.z + halfD - district.districtMargin - 4.0
            });
          }
        }

        // Cross-Streets (East-West)
        for (let r = 0; r <= district.rows; r++) {
          const streetZ = startZ + r * district.cellPitchZ;
          groundLineVertices.push(
            district.x - halfW + district.districtMargin / 2, 0.95, streetZ,
            district.x + halfW - district.districtMargin / 2, 0.95, streetZ
          );
          groundLineColors.push(gridColor.r * 0.7, gridColor.g * 0.7, gridColor.b * 0.7, gridColor.r * 0.7, gridColor.g * 0.7, gridColor.b * 0.7);
        }

        // Register Anchor Ports
        const insetW = halfW * 0.55;
        const insetD = halfD * 0.55;
        const N_ports = [
          { x: district.x, z: district.z - halfD, dir: 'N', name: 'N_C', isEW: false, isPrimary: true },
          { x: district.x - insetW, z: district.z - halfD, dir: 'N', name: 'N_L', isEW: false, isPrimary: false },
          { x: district.x + insetW, z: district.z - halfD, dir: 'N', name: 'N_R', isEW: false, isPrimary: false }
        ];
        const S_ports = [
          { x: district.x, z: district.z + halfD, dir: 'S', name: 'S_C', isEW: false, isPrimary: true },
          { x: district.x - insetW, z: district.z + halfD, dir: 'S', name: 'S_L', isEW: false, isPrimary: false },
          { x: district.x + insetW, z: district.z + halfD, dir: 'S', name: 'S_R', isEW: false, isPrimary: false }
        ];
        const E_ports = [
          { x: district.x + halfW, z: district.z, dir: 'E', name: 'E_C', isEW: true, isPrimary: true },
          { x: district.x + halfW, z: district.z - insetD, dir: 'E', name: 'E_L', isEW: true, isPrimary: false },
          { x: district.x + halfW, z: district.z + insetD, dir: 'E', name: 'E_R', isEW: true, isPrimary: false }
        ];
        const W_ports = [
          { x: district.x - halfW, z: district.z, dir: 'W', name: 'W_C', isEW: true, isPrimary: true },
          { x: district.x - halfW, z: district.z - insetD, dir: 'W', name: 'W_L', isEW: true, isPrimary: false },
          { x: district.x - halfW, z: district.z + insetD, dir: 'W', name: 'W_R', isEW: true, isPrimary: false }
        ];

        district.ports = {
          N: N_ports,
          S: S_ports,
          E: E_ports,
          W: W_ports,
          all: [...N_ports, ...S_ports, ...E_ports, ...W_ports]
        };
        district.gateways = {
          N: N_ports[0],
          S: S_ports[0],
          E: E_ports[0],
          W: W_ports[0]
        };

        // District Billboard Label
        if (district.path !== 'root') {
          const distLabel = this.createCanvasTextSprite('📁 ' + district.name, district.files.length + ' files | ' + district.totalLoc + ' LOC', themeCfg.cyanAccent, true);
          distLabel.position.set(district.x, 14.0, district.z - halfD - 6.0);
          distLabel.matrixAutoUpdate = false;
          distLabel.updateMatrix();
          this.scene.add(distLabel);
          district.districtLabel = distLabel;
          this.labels.push(distLabel);
        }
      }

      createDistrictGatewaysInstanced(districts) {
        const themeCfg = this.themeStyles[this.theme];
        const isCyber = this.theme === 'cyberpunk';

        let totalPorts = 0;
        districts.forEach(d => { if (d.ports && d.ports.all) totalPorts += d.ports.all.length; });
        if (totalPorts === 0) return;

        // Pylons (2 per port)
        const pylonGeo = new THREE.BoxGeometry(1.2, 7.0, 1.2);
        const pylonMat = new THREE.MeshStandardMaterial({ color: 0x101420, roughness: 0.35, metalness: 0.88 });
        const pylonInstanced = new THREE.InstancedMesh(pylonGeo, pylonMat, totalPorts * 2);
        pylonInstanced.matrixAutoUpdate = false;

        // Beams (1 per port)
        const beamGeo = new THREE.BoxGeometry(10, 0.65, 1.4);
        const beamInstanced = new THREE.InstancedMesh(beamGeo, pylonMat, totalPorts);
        beamInstanced.matrixAutoUpdate = false;

        // Launch Pads (1 per port)
        const padGeo = new THREE.PlaneGeometry(8, 2.2);
        const padMat = new THREE.MeshBasicMaterial({ color: themeCfg.neonAccent, transparent: true, opacity: 0.85, blending: isCyber ? THREE.AdditiveBlending : THREE.NormalBlending });
        const padInstanced = new THREE.InstancedMesh(padGeo, padMat, totalPorts);
        padInstanced.matrixAutoUpdate = false;

        const m = new THREE.Matrix4();
        const pos = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        const sc = new THREE.Vector3(1, 1, 1);
        const euler = new THREE.Euler();

        let pylonIdx = 0;
        let gateIdx = 0;

        districts.forEach(district => {
          if (!district.ports || !district.ports.all) return;
          district.ports.all.forEach(port => {
            const gateSpan = port.isPrimary ? 12 : 8;
            const pylonOffset = gateSpan / 2;
            const pylonHeight = port.isPrimary ? 8.5 : 6.0;

            // Two Pylons
            [-pylonOffset, pylonOffset].forEach(offset => {
              const pX = port.isEW ? port.x : port.x + offset;
              const pZ = port.isEW ? port.z + offset : port.z;
              pos.set(pX, pylonHeight / 2 + 0.9, pZ);
              quat.set(0, 0, 0, 1);
              sc.set(1, pylonHeight / 7.0, 1);
              m.compose(pos, quat, sc);
              pylonInstanced.setMatrixAt(pylonIdx++, m);
            });

            // Crossbeam
            pos.set(port.x, pylonHeight + 0.6, port.z);
            euler.set(0, port.isEW ? Math.PI / 2 : 0, 0);
            quat.setFromEuler(euler);
            sc.set((gateSpan + 1.6) / 10, 1, 1);
            m.compose(pos, quat, sc);
            beamInstanced.setMatrixAt(gateIdx, m);

            // Pad
            pos.set(port.x, 0.935, port.z);
            euler.set(-Math.PI / 2, 0, port.isEW ? Math.PI / 2 : 0);
            quat.setFromEuler(euler);
            sc.set((gateSpan - 1.2) / 8, 1, 1);
            m.compose(pos, quat, sc);
            padInstanced.setMatrixAt(gateIdx, m);

            gateIdx++;
          });
        });

        pylonInstanced.instanceMatrix.needsUpdate = true;
        beamInstanced.instanceMatrix.needsUpdate = true;
        padInstanced.instanceMatrix.needsUpdate = true;

        pylonInstanced.updateMatrix();
        beamInstanced.updateMatrix();
        padInstanced.updateMatrix();

        this.scene.add(pylonInstanced);
        this.scene.add(beamInstanced);
        this.scene.add(padInstanced);
        this.instancedMeshes.push(pylonInstanced, beamInstanced, padInstanced);
      }

      createDendriticArterialHighwaysMerged(districts, groundLineVertices, groundLineColors) {
        const themeCfg = this.themeStyles[this.theme];
        const groundY = 0.05;
        const colorCyan = new THREE.Color(themeCfg.cyanAccent);
        const colorNeon = new THREE.Color(themeCfg.neonAccent);

        districts.forEach(child => {
          if (!child.parent) return;
          const parent = child.parent;

          const pGates = [parent.gateways.N, parent.gateways.S, parent.gateways.E, parent.gateways.W].filter(Boolean);
          const cGates = [child.gateways.N, child.gateways.S, child.gateways.E, child.gateways.W].filter(Boolean);

          let bestDist = Infinity;
          let bestPGate = pGates[0];
          let bestCGate = cGates[0];

          pGates.forEach(pg => {
            cGates.forEach(cg => {
              const d = Math.hypot(pg.x - cg.x, pg.z - cg.z);
              if (d < bestDist) {
                bestDist = d;
                bestPGate = pg;
                bestCGate = cg;
              }
            });
          });

          if (!bestPGate || !bestCGate) return;

          const pts = [];
          pts.push(new THREE.Vector3(bestPGate.x, groundY, bestPGate.z));

          const dx = bestCGate.x - bestPGate.x;
          const dz = bestCGate.z - bestPGate.z;

          if (Math.abs(dx) > 1 && Math.abs(dz) > 1) {
            if (bestPGate.dir === 'E' || bestPGate.dir === 'W') {
              const cornerX = bestPGate.x + dx * 0.5;
              pts.push(new THREE.Vector3(cornerX, groundY, bestPGate.z));
              pts.push(new THREE.Vector3(cornerX, groundY, bestCGate.z));
            } else if (bestPGate.dir === 'N' || bestPGate.dir === 'S') {
              const cornerZ = bestPGate.z + dz * 0.5;
              pts.push(new THREE.Vector3(bestPGate.x, groundY, cornerZ));
              pts.push(new THREE.Vector3(bestCGate.x, groundY, cornerZ));
            } else {
              pts.push(new THREE.Vector3(bestCGate.x, groundY, bestPGate.z));
            }
          }
          pts.push(new THREE.Vector3(bestCGate.x, groundY, bestCGate.z));

          // Append Manhattan lines directly to unified ground lines buffer
          for (let i = 0; i < pts.length - 1; i++) {
            const pA = pts[i];
            const pB = pts[i + 1];
            groundLineVertices.push(pA.x, pA.y + 0.02, pA.z, pB.x, pB.y + 0.02, pB.z);
            groundLineColors.push(colorCyan.r, colorCyan.g, colorCyan.b, colorCyan.r, colorCyan.g, colorCyan.b);

            // Parallel Neon Rails
            const isH = Math.abs(pB.x - pA.x) >= Math.abs(pB.z - pA.z);
            const off = 1.2;
            const ox = isH ? 0 : off;
            const oz = isH ? off : 0;
            groundLineVertices.push(pA.x + ox, pA.y + 0.01, pA.z + oz, pB.x + ox, pB.y + 0.01, pB.z + oz);
            groundLineColors.push(colorNeon.r * 0.6, colorNeon.g * 0.6, colorNeon.b * 0.6, colorNeon.r * 0.6, colorNeon.g * 0.6, colorNeon.b * 0.6);
            groundLineVertices.push(pA.x - ox, pA.y + 0.01, pA.z - oz, pB.x - ox, pB.y + 0.01, pB.z - oz);
            groundLineColors.push(colorNeon.r * 0.6, colorNeon.g * 0.6, colorNeon.b * 0.6, colorNeon.r * 0.6, colorNeon.g * 0.6, colorNeon.b * 0.6);
          }

          const polyCurve = new THREE.CurvePath();
          for (let i = 0; i < pts.length - 1; i++) {
            polyCurve.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
          }

          const connObj = {
            type: 'district_connection',
            sourceDistrict: parent.path,
            targetDistrict: child.path,
            pts,
            polyCurve
          };
          this.districtConnections.push(connObj);

          // Add to unified particle descriptor pool
          this.trafficParticleList.push({
            curve: polyCurve,
            t: Math.random(),
            speed: 0.0028 + Math.random() * 0.0014,
            baseColor: colorNeon,
            currentColor: colorNeon.clone(),
            sourceDistrict: parent.path,
            targetDistrict: child.path,
            sourcePath: null,
            targetPath: null,
            visible: true
          });
        });
      }

      createMergedGroundLines(vertices, colors) {
        if (vertices.length === 0) return;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        const mat = new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.75,
          blending: this.theme === 'cyberpunk' ? THREE.AdditiveBlending : THREE.NormalBlending,
          depthWrite: false
        });

        this.groundLineSegments = new THREE.LineSegments(geo, mat);
        this.groundLineSegments.frustumCulled = true;
        this.groundLineSegments.matrixAutoUpdate = false;
        this.groundLineSegments.updateMatrix();
        this.scene.add(this.groundLineSegments);
      }

      createDistrictBuildings(district) {
        const themeCfg = this.themeStyles[this.theme];
        const halfW = district.width / 2;
        const halfD = district.depth / 2;
        const startX = district.x - halfW + district.districtMargin + district.streetWidth / 2;
        const startZ = district.z - halfD + district.districtMargin + district.streetWidth / 2;

        district.buildingMeshes = [];

        district.files.forEach((file, index) => {
          const col = index % district.cols;
          const row = Math.floor(index / district.cols);

          const plotCenterX = startX + col * district.cellPitchX + district.plotWidth / 2 + district.streetWidth / 2;
          const plotCenterZ = startZ + row * district.cellPitchZ + district.plotDepth / 2 + district.streetWidth / 2;
          const localStreetZ = startZ + (row + 1) * district.cellPitchZ;
          const districtAvenueX = startX + col * district.cellPitchX;

          const loc = file.code_lines || file.total_lines || 30;
          const complexity = file.complexity || 1;
          const risk = file.risk_score || (complexity > 18 ? 35 : 0);
          const langColorHex = this.getLanguageColor(file.language, file.path);

          const height = Math.min(220, Math.max(8.0, Math.sqrt(loc) * 3.8));
          const baseSize = Math.max(10, Math.min(20, 12 + Math.log10(Math.max(1, complexity)) * 4.5));

          // Skyscraper Geometry with static matrixAutoUpdate = false
          const buildingGeo = new THREE.BoxGeometry(baseSize, height, baseSize);
          const buildingMat = this.getSharedBuildingMaterial(langColorHex);
          const buildingMesh = new THREE.Mesh(buildingGeo, buildingMat);
          buildingMesh.position.set(plotCenterX, 1.0 + height / 2, plotCenterZ);
          buildingMesh.castShadow = true;
          buildingMesh.receiveShadow = true;
          buildingMesh.frustumCulled = true;
          buildingMesh.matrixAutoUpdate = false;
          buildingMesh.updateMatrix();
          this.scene.add(buildingMesh);
          district.buildingMeshes.push(buildingMesh);

          // Edge Wireframe
          const edgesGeo = new THREE.EdgesGeometry(buildingGeo);
          const edgesMat = this.getSharedEdgeMaterial(langColorHex);
          const edgesMesh = new THREE.LineSegments(edgesGeo, edgesMat);
          edgesMesh.frustumCulled = true;
          edgesMesh.matrixAutoUpdate = false;
          edgesMesh.updateMatrix();
          buildingMesh.add(edgesMesh);

          // Antenna / Spire for Megatowers (LOC > 250)
          let spireMesh = null;
          if (loc > 250) {
            const spireHeight = Math.min(30, 6 + (loc / 80));
            const spireGeo = new THREE.CylinderGeometry(0.15, 0.45, spireHeight, 6);
            const spireMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.2 });
            spireMesh = new THREE.Mesh(spireGeo, spireMat);
            spireMesh.position.set(0, height / 2 + spireHeight / 2, 0);
            spireMesh.frustumCulled = true;
            spireMesh.matrixAutoUpdate = false;
            spireMesh.updateMatrix();
            buildingMesh.add(spireMesh);

            const tipGeo = new THREE.SphereGeometry(0.5, 6, 6);
            const tipMat = new THREE.MeshBasicMaterial({ color: themeCfg.neonAccent });
            const tipMesh = new THREE.Mesh(tipGeo, tipMat);
            tipMesh.position.set(0, spireHeight / 2 + 0.3, 0);
            tipMesh.frustumCulled = true;
            tipMesh.matrixAutoUpdate = false;
            tipMesh.updateMatrix();
            spireMesh.add(tipMesh);
          }

          // Pulsing Risk Beacon
          let beaconMesh = null;
          if (complexity > 18 || risk > 25) {
            const beaconGeo = new THREE.SphereGeometry(0.9, 8, 8);
            const beaconMat = new THREE.MeshBasicMaterial({ color: themeCfg.pinkAccent, transparent: true, opacity: 0.95 });
            beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
            beaconMesh.position.set(0, height / 2 + (spireMesh ? 8.0 : 1.2), 0);
            beaconMesh.frustumCulled = true;
            buildingMesh.add(beaconMesh);
          }

          // Floating Billboard Label
          const fileName = file.path.split('/').pop();
          const labelSprite = this.createCanvasTextSprite(fileName, loc + ' LOC', langColorHex, false);
          labelSprite.position.set(plotCenterX, height + 1.0 + (spireMesh ? 10.0 : 4.5), plotCenterZ);
          labelSprite.matrixAutoUpdate = false;
          labelSprite.updateMatrix();
          this.scene.add(labelSprite);
          this.labels.push(labelSprite);

          const buildingObj = {
            mesh: buildingMesh,
            edgesMesh,
            beaconMesh,
            spireMesh,
            labelSprite,
            fileData: file,
            district: district.path,
            districtObj: district,
            langColor: langColorHex,
            height,
            baseSize,
            width: baseSize,
            x: plotCenterX,
            z: plotCenterZ,
            loc,
            complexity,
            risk,
            doorstep: { x: plotCenterX, y: 1.35, z: plotCenterZ + baseSize / 2 },
            localStreet: { x: plotCenterX, y: 1.35, z: localStreetZ },
            avenueX: districtAvenueX
          };

          buildingMesh.userData = { type: 'building', buildingObj };
          this.buildings.push(buildingObj);
          this.buildingMap.set(file.path, buildingObj);
        });
      }

      createInstancedDeco(treeTransforms, bollardTransforms, parcelTransforms) {
        if (!this.decoEnabled) return;
        const themeCfg = this.themeStyles[this.theme];

        if (treeTransforms && treeTransforms.length > 0) {
          const count = treeTransforms.length;
          const crownGeo = new THREE.ConeGeometry(1.6, 3.4, 5);
          const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 1.4, 5);

          const crownMat = new THREE.MeshStandardMaterial({
            color: this.theme === 'cyberpunk' ? 0x184828 : 0x2e3830,
            roughness: 0.8,
            metalness: 0.1,
            emissive: new THREE.Color(this.styleColors.green),
            emissiveIntensity: this.theme === 'cyberpunk' ? 0.22 : 0.05
          });

          const trunkMat = new THREE.MeshStandardMaterial({ color: 0x1c1612, roughness: 0.9, metalness: 0.1 });

          const crownInstanced = new THREE.InstancedMesh(crownGeo, crownMat, count);
          const trunkInstanced = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
          crownInstanced.frustumCulled = true;
          trunkInstanced.frustumCulled = true;
          crownInstanced.matrixAutoUpdate = false;
          trunkInstanced.matrixAutoUpdate = false;

          const matrix = new THREE.Matrix4();
          const position = new THREE.Vector3();
          const quaternion = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          const rotation = new THREE.Euler();

          treeTransforms.forEach((t, i) => {
            position.set(t.x, 1.2 + 0.7 * t.scale, t.z);
            rotation.set(0, t.rotY, 0);
            quaternion.setFromEuler(rotation);
            scale.set(t.scale, t.scale, t.scale);
            matrix.compose(position, quaternion, scale);
            trunkInstanced.setMatrixAt(i, matrix);

            position.set(t.x, 1.2 + 2.0 * t.scale, t.z);
            matrix.compose(position, quaternion, scale);
            crownInstanced.setMatrixAt(i, matrix);
          });

          crownInstanced.instanceMatrix.needsUpdate = true;
          trunkInstanced.instanceMatrix.needsUpdate = true;
          crownInstanced.updateMatrix();
          trunkInstanced.updateMatrix();

          this.scene.add(crownInstanced);
          this.scene.add(trunkInstanced);
          this.instancedMeshes.push(crownInstanced, trunkInstanced);
        }

        if (bollardTransforms && bollardTransforms.length > 0) {
          const count = bollardTransforms.length;
          const bollardGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.6, 5);
          const bollardMat = new THREE.MeshStandardMaterial({
            color: 0x22242c,
            roughness: 0.4,
            metalness: 0.8,
            emissive: new THREE.Color(themeCfg.neonAccent),
            emissiveIntensity: this.theme === 'cyberpunk' ? 0.6 : 0.15
          });
          const bollardInstanced = new THREE.InstancedMesh(bollardGeo, bollardMat, count);
          bollardInstanced.frustumCulled = true;
          bollardInstanced.matrixAutoUpdate = false;

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
          bollardInstanced.updateMatrix();
          this.scene.add(bollardInstanced);
          this.instancedMeshes.push(bollardInstanced);
        }
      }

      findClosestAnchorPort(district, targetPos) {
        if (!district || !district.ports || !district.ports.all || district.ports.all.length === 0) {
          if (district && district.gateways) {
            return district.gateways.N || { x: district.x, z: district.z, dir: 'N' };
          }
          return { x: 0, z: 0, dir: 'N' };
        }

        let bestPort = district.ports.all[0];
        let bestDist = Infinity;

        district.ports.all.forEach(port => {
          const d = Math.hypot(port.x - targetPos.x, port.z - targetPos.z);
          if (d < bestDist) {
            bestDist = d;
            bestPort = port;
          }
        });

        return bestPort;
      }

      createCyberHighwaysMerged(fileList) {
        const themeCfg = this.themeStyles[this.theme];
        const isCyber = this.theme === 'cyberpunk';
        const highwayPairs = [];
        const seenPairs = new Set();
        const expresswayPairs = new Set();

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

                const srcD = this.districtMap.get(sourceFile.path.split('/').slice(0, -1).join('/') || 'root');
                const tgtD = this.districtMap.get(targetBuilding.fileData.path.split('/').slice(0, -1).join('/') || 'root');
                if (srcD && tgtD && srcD !== tgtD && srcD.parent !== tgtD && tgtD.parent !== srcD) {
                  const dPairKey = [srcD.path, tgtD.path].sort().join('<->');
                  if (!expresswayPairs.has(dPairKey)) {
                    expresswayPairs.add(dPairKey);
                  }
                }
              }
            }
          });
        });

        const groundY = 1.32;
        const flatGroundY = 0.05;
        const lineVertices = [];
        const lineColors = [];
        this.highwayDataList = [];

        const defaultSkyColor = isCyber ? new THREE.Color(0x00F0FF) : new THREE.Color(0x00B4D8);
        const defaultGroundColor = new THREE.Color(themeCfg.highwayColor);

        highwayPairs.forEach(pair => {
          if (!pair.source || !pair.target) return;

          const src = pair.source;
          const tgt = pair.target;
          const srcD = src.districtObj;
          const tgtD = tgt.districtObj;

          const directDistance = Math.hypot(tgt.x - src.x, tgt.z - src.z);
          const isSameDistrict = src.district === tgt.district;
          const isDirectHierarchy = srcD && tgtD && (srcD.parent === tgtD || tgtD.parent === srcD);
          const isSkyHighway = (!isSameDistrict && !isDirectHierarchy) || directDistance > 150;

          const srcInternalPoints = [
            new THREE.Vector3(src.doorstep.x, groundY, src.doorstep.z),
            new THREE.Vector3(src.localStreet.x, groundY, src.localStreet.z),
            new THREE.Vector3(src.avenueX, groundY, src.localStreet.z)
          ];

          const tgtInternalPoints = [
            new THREE.Vector3(tgt.avenueX, groundY, tgt.localStreet.z),
            new THREE.Vector3(tgt.localStreet.x, groundY, tgt.localStreet.z),
            new THREE.Vector3(tgt.doorstep.x, groundY, tgt.doorstep.z)
          ];

          const waypoints = [];

          if (isSameDistrict || !srcD || !tgtD) {
            waypoints.push(...srcInternalPoints);
            waypoints.push(new THREE.Vector3(src.avenueX, groundY, tgt.localStreet.z));
            waypoints.push(...tgtInternalPoints);
          } else if (!isSkyHighway) {
            const exitPort = this.findClosestAnchorPort(srcD, { x: tgt.x, z: tgt.z });
            const entryPort = this.findClosestAnchorPort(tgtD, { x: src.x, z: src.z });

            waypoints.push(...srcInternalPoints);
            waypoints.push(new THREE.Vector3(exitPort.x, groundY, exitPort.z));

            const dx = entryPort.x - exitPort.x;
            const dz = entryPort.z - exitPort.z;
            if (Math.abs(dx) > 2 && Math.abs(dz) > 2) {
              if (exitPort.dir === 'E' || exitPort.dir === 'W') {
                const cornerX = exitPort.x + dx * 0.5;
                waypoints.push(new THREE.Vector3(cornerX, flatGroundY + 0.1, exitPort.z));
                waypoints.push(new THREE.Vector3(cornerX, flatGroundY + 0.1, entryPort.z));
              } else {
                const cornerZ = exitPort.z + dz * 0.5;
                waypoints.push(new THREE.Vector3(exitPort.x, flatGroundY + 0.1, cornerZ));
                waypoints.push(new THREE.Vector3(entryPort.x, flatGroundY + 0.1, cornerZ));
              }
            } else {
              waypoints.push(new THREE.Vector3((exitPort.x + entryPort.x) / 2, flatGroundY + 0.1, (exitPort.z + entryPort.z) / 2));
            }

            waypoints.push(new THREE.Vector3(entryPort.x, groundY, entryPort.z));
            waypoints.push(...tgtInternalPoints);
          } else {
            const exitPort = this.findClosestAnchorPort(srcD, { x: tgt.x, z: tgt.z });
            const entryPort = this.findClosestAnchorPort(tgtD, { x: src.x, z: src.z });

            waypoints.push(...srcInternalPoints);
            waypoints.push(new THREE.Vector3(exitPort.x, groundY, exitPort.z));

            const pylonTipY = exitPort.isPrimary ? 9.5 : 7.2;
            waypoints.push(new THREE.Vector3(exitPort.x, pylonTipY, exitPort.z));

            const midX = (exitPort.x + entryPort.x) / 2;
            const midZ = (exitPort.z + entryPort.z) / 2;
            const archApexY = Math.min(180, Math.max(28, pylonTipY + directDistance * 0.38));

            const q1X = exitPort.x * 0.65 + midX * 0.35;
            const q1Z = exitPort.z * 0.65 + midZ * 0.35;
            const q2X = entryPort.x * 0.65 + midX * 0.35;
            const q2Z = entryPort.z * 0.65 + midZ * 0.35;

            waypoints.push(new THREE.Vector3(q1X, archApexY * 0.75, q1Z));
            waypoints.push(new THREE.Vector3(midX, archApexY, midZ));
            waypoints.push(new THREE.Vector3(q2X, archApexY * 0.75, q2Z));

            const tgtPylonTipY = entryPort.isPrimary ? 9.5 : 7.2;
            waypoints.push(new THREE.Vector3(entryPort.x, tgtPylonTipY, entryPort.z));
            waypoints.push(new THREE.Vector3(entryPort.x, groundY, entryPort.z));
            waypoints.push(...tgtInternalPoints);
          }

          const filteredPoints = [];
          for (let i = 0; i < waypoints.length; i++) {
            if (i === 0 || waypoints[i].distanceTo(waypoints[i - 1]) > 1.2) {
              filteredPoints.push(waypoints[i]);
            }
          }
          if (filteredPoints.length < 2) return;

          const curve = new THREE.CatmullRomCurve3(filteredPoints, false, 'catmullrom', isSkyHighway ? 0.45 : 0.2);
          const col = isSkyHighway ? defaultSkyColor : defaultGroundColor;

          // Sample curve segments for Single Draw Call LineSegments
          const numSamples = isSkyHighway ? 18 : 12;
          const startIndex = lineVertices.length / 3;
          let prevPt = curve.getPointAt(0);

          for (let s = 1; s <= numSamples; s++) {
            const nextPt = curve.getPointAt(s / numSamples);
            lineVertices.push(prevPt.x, prevPt.y, prevPt.z, nextPt.x, nextPt.y, nextPt.z);
            lineColors.push(col.r, col.g, col.b, col.r, col.g, col.b);
            prevPt = nextPt;
          }
          const endIndex = lineVertices.length / 3;

          const hwRecord = {
            curve,
            isSkyHighway,
            sourcePath: src.fileData.path,
            targetPath: tgt.fileData.path,
            importName: pair.importName,
            startIndex,
            endIndex,
            baseColor: col.clone(),
            currentColor: col.clone()
          };
          this.highwayDataList.push(hwRecord);

          // Add to unified particle descriptor pool
          const packetColor = isSkyHighway ? (isCyber ? new THREE.Color(0xD9FF3D) : new THREE.Color(0x38BDF8)) : new THREE.Color(themeCfg.packetColor);
          this.trafficParticleList.push({
            curve: curve,
            t: Math.random(),
            speed: (isSkyHighway ? 0.0038 : 0.0030) + Math.random() * 0.0016,
            baseColor: packetColor,
            currentColor: packetColor.clone(),
            sourceDistrict: src.district,
            targetDistrict: tgt.district,
            sourcePath: src.fileData.path,
            targetPath: tgt.fileData.path,
            visible: true
          });
        });

        // 1. Single Draw Call Unified Highway LineSegments
        if (lineVertices.length > 0) {
          const hwGeo = new THREE.BufferGeometry();
          hwGeo.setAttribute('position', new THREE.Float32BufferAttribute(lineVertices, 3));
          hwGeo.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));

          const hwMat = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.85,
            blending: isCyber ? THREE.AdditiveBlending : THREE.NormalBlending,
            depthWrite: false
          });

          this.highwayLineSegments = new THREE.LineSegments(hwGeo, hwMat);
          this.highwayLineSegments.frustumCulled = true;
          this.highwayLineSegments.matrixAutoUpdate = false;
          this.highwayLineSegments.updateMatrix();
          this.scene.add(this.highwayLineSegments);
        }

        // 2. Single Draw Call Batched Traffic Points Buffer
        this.setupBatchedTrafficParticles();
      }

      setupBatchedTrafficParticles() {
        const pCount = this.trafficParticleList.length;
        if (pCount === 0) return;

        const pGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(pCount * 3);
        const colors = new Float32Array(pCount * 3);

        for (let i = 0; i < pCount; i++) {
          const p = this.trafficParticleList[i];
          const pos = p.curve.getPointAt(p.t);
          positions[i * 3] = pos.x;
          positions[i * 3 + 1] = pos.y + 0.15;
          positions[i * 3 + 2] = pos.z;

          colors[i * 3] = p.baseColor.r;
          colors[i * 3 + 1] = p.baseColor.g;
          colors[i * 3 + 2] = p.baseColor.b;
        }

        pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        pGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const pMat = new THREE.PointsMaterial({
          size: 3.2,
          vertexColors: true,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });

        this.trafficParticlesMesh = new THREE.Points(pGeo, pMat);
        this.trafficParticlesMesh.frustumCulled = true;
        this.scene.add(this.trafficParticlesMesh);
      }

      extractFileImports(file) {
        const results = [];
        if (file.symbols && Array.isArray(file.symbols.imports)) {
          file.symbols.imports.forEach(imp => results.push(imp));
        }

        if (file.content) {
          const content = file.content;
          const jsMatches = content.matchAll(/(?:import|from)\s+['"]([^'"]+)['"]/g);
          for (const m of jsMatches) results.push(m[1]);

          const rsMatches = content.matchAll(/use\s+([a-zA-Z0-9_:]+);/g);
          for (const m of rsMatches) results.push(m[1]);

          const pyMatches = content.matchAll(/(?:from\s+([a-zA-Z0-9_.]+)\s+import|import\s+([a-zA-Z0-9_.]+))/g);
          for (const m of pyMatches) results.push(m[1] || m[2]);
        }

        return Array.from(new Set(results));
      }

      resolveImportTarget(importStr, sourcePath) {
        if (!importStr) return null;
        const cleanImp = importStr.replace(/^crate::/, '').replace(/^super::/, '').replace(/^[./]+/, '');
        const impBase = cleanImp.split('/').pop().split('::').pop().replace(/\.[a-zA-Z0-9]+$/, '');

        for (const [path, building] of this.buildingMap.entries()) {
          if (path.includes(cleanImp) || path.toLowerCase().endsWith(cleanImp.toLowerCase())) {
            return building;
          }
          const base = path.split('/').pop().replace(/\.[a-zA-Z0-9]+$/, '');
          if (base === impBase && cleanImp.length > 2) {
            return building;
          }
        }
        return null;
      }

      setupFilterSidebar(districts, files) {
        const langCounts = {};
        files.forEach(f => {
          const lang = f.language || 'Default';
          langCounts[lang] = (langCounts[lang] || 0) + 1;
        });

        this.availableLanguages = Object.keys(langCounts).sort();
        this.availableDistricts = districts.map(d => d.path);
        this.activeLanguages = new Set(this.availableLanguages);
        this.activeDistricts = new Set(this.availableDistricts);

        const langListEl = document.getElementById('cityLangFilterList');
        const langCountEl = document.getElementById('cityLangFilterCount');
        if (langCountEl) langCountEl.innerText = this.availableLanguages.length;

        if (langListEl) {
          langListEl.innerHTML = this.availableLanguages.map(lang => {
            const count = langCounts[lang];
            const hex = '#' + this.getLanguageColor(lang).toString(16).padStart(6, '0');
            return `
              <label class="flex items-center justify-between p-1.5 rounded hover:bg-brand-card text-xs cursor-pointer select-none transition group">
                <div class="flex items-center space-x-2 truncate">
                  <input type="checkbox" data-lang="${escapeHtml(lang)}" checked onchange="window.codeCityApp && window.codeCityApp.onLanguageCheckboxChange(this)" class="rounded border-zinc-700 bg-zinc-900 text-brand-orange focus:ring-brand-orange focus:ring-offset-0 cursor-pointer">
                  <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color: ${hex};"></span>
                  <span class="text-zinc-200 truncate font-semibold">${escapeHtml(lang)}</span>
                </div>
                <span class="text-zinc-500 font-mono text-[10px] ml-1">(${count})</span>
              </label>
            `;
          }).join('');
        }

        const distListEl = document.getElementById('cityDistrictFilterList');
        const distCountEl = document.getElementById('cityDistrictFilterCount');
        if (distCountEl) distCountEl.innerText = districts.length;

        if (distListEl && this.districtTreeRoot) {
          const renderDistrictTreeIterative = (root) => {
            if (!root) return '';
            const visited = new Set();
            const stack = [{
              node: root,
              chunks: []
            }];

            while (stack.length > 0) {
              const current = stack[stack.length - 1];

              if (!current.initialized) {
                current.initialized = true;
                if (visited.has(current.node)) {
                  stack.pop();
                  continue;
                }
                visited.add(current.node);

                const node = current.node;
                const isRoot = node.path === 'root';
                const shortName = isRoot ? 'Downtown Root (/)' : node.name;
                const fileCount = node.files ? node.files.length : 0;
                const hasChildren = node.children && node.children.length > 0;
                const isCollapsed = this.collapsedDistricts.has(node.path);

                let headerHtml = `
                  <div class="district-tree-node space-y-0.5 ${node.depth > 0 ? 'ml-3 pl-1.5 border-l border-brand-border/40' : ''}" data-district-path="${escapeHtml(node.path)}">
                    <div class="district-item-row flex items-center justify-between p-1 rounded hover:bg-brand-card text-xs group transition cursor-pointer select-none"
                         data-district-row="${escapeHtml(node.path)}"
                         onclick="window.codeCityApp && window.codeCityApp.onDistrictRowClick(event, '${escapeJsString(node.path)}')">
                      <div class="flex items-center space-x-1.5 truncate flex-1 min-w-0">
                        ${(hasChildren || (node.files && node.files.length > 0)) ? `
                          <button onclick="event.stopPropagation(); window.codeCityApp && window.codeCityApp.toggleDistrictCollapse('${escapeJsString(node.path)}')" class="p-0.5 text-zinc-500 hover:text-white rounded hover:bg-brand-dark transition">
                            <i data-lucide="${isCollapsed ? 'chevron-right' : 'chevron-down'}" class="w-3 h-3"></i>
                          </button>
                        ` : '<span class="w-4"></span>'}
                        <input type="checkbox" data-district="${escapeHtml(node.path)}" ${this.activeDistricts.has(node.path) ? 'checked' : ''} onclick="event.stopPropagation()" onchange="window.codeCityApp && window.codeCityApp.onDistrictCheckboxChange(this)" class="rounded border-zinc-700 bg-zinc-900 text-brand-orange focus:ring-brand-orange focus:ring-offset-0 cursor-pointer">
                        <i data-lucide="${isRoot ? 'cpu' : (hasChildren ? 'folder-tree' : 'folder')}" class="w-3 h-3 ${isRoot ? 'text-[#D9FF3D]' : 'text-brand-orange'} flex-shrink-0"></i>
                        <span class="text-zinc-200 truncate ${isRoot ? 'font-bold text-[#D9FF3D]' : ''}" title="${escapeHtml(node.path)}">${escapeHtml(shortName)}</span>
                      </div>
                      <div class="flex items-center space-x-1 flex-shrink-0 ml-1">
                        <span class="text-zinc-500 font-mono text-[10px]">(${fileCount})</span>
                        <button onclick="event.stopPropagation(); window.codeCityApp && window.codeCityApp.focusDistrict('${escapeJsString(node.path)}')" title="Bezirk fokussieren" class="p-1 text-zinc-500 hover:text-white rounded hover:bg-brand-dark transition opacity-0 group-hover:opacity-100">
                          <i data-lucide="crosshair" class="w-3 h-3"></i>
                        </button>
                      </div>
                    </div>
                `;

                current.chunks.push(headerHtml);

                if (!isCollapsed) {
                  current.chunks.push(`<div class="space-y-0.5">`);
                  current.childrenToProcess = hasChildren ? [...node.children] : [];
                  current.childIdx = 0;
                  current.hasSubgroup = true;
                } else {
                  current.childrenToProcess = [];
                  current.childIdx = 0;
                  current.hasSubgroup = false;
                }
              }

              if (current.childIdx < current.childrenToProcess.length) {
                const childNode = current.childrenToProcess[current.childIdx++];
                stack.push({
                  node: childNode,
                  chunks: [],
                  parentFrame: current
                });
              } else {
                const node = current.node;
                const isCollapsed = this.collapsedDistricts.has(node.path);
                if (!isCollapsed && node.files && node.files.length > 0) {
                  node.files.forEach(f => {
                    const fLang = f.language || 'Default';
                    const fHex = '#' + this.getLanguageColor(fLang, f.path).toString(16).padStart(6, '0');
                    const fName = f.path.split('/').pop();
                    current.chunks.push(`
                      <div class="district-file-item flex items-center justify-between p-1 pl-5 rounded hover:bg-brand-card text-[11px] group transition cursor-pointer text-zinc-300 hover:text-white select-none"
                           data-file-path="${escapeHtml(f.path)}"
                           data-parent-district="${escapeHtml(node.path)}"
                           onclick="event.stopPropagation(); window.codeCityApp && window.codeCityApp.selectBuildingByPath('${escapeJsString(f.path)}')">
                        <div class="flex items-center space-x-1.5 truncate flex-1 min-w-0">
                          <span class="w-2 h-2 rounded-full flex-shrink-0 shadow-sm" style="background-color: ${fHex};"></span>
                          <span class="truncate font-mono text-zinc-300 group-hover:text-white" title="${escapeHtml(f.path)}">${escapeHtml(fName)}</span>
                        </div>
                        <span class="text-zinc-500 font-mono text-[9px] flex-shrink-0 ml-1">${f.code_lines || f.total_lines || 0} LOC</span>
                      </div>
                    `);
                  });
                }
                if (current.hasSubgroup) {
                  current.chunks.push(`</div>`);
                }
                current.chunks.push(`</div>`);

                const finishedFrame = stack.pop();
                const finishedHtml = finishedFrame.chunks.join('');
                if (finishedFrame.parentFrame) {
                  finishedFrame.parentFrame.chunks.push(finishedHtml);
                } else {
                  return finishedHtml;
                }
              }
            }
            return '';
          };

          distListEl.innerHTML = renderDistrictTreeIterative(this.districtTreeRoot);
        }

        if (window.lucide && typeof lucide.createIcons === 'function') {
          lucide.createIcons();
        }

        this.updateHUDStats();
        this.updateLegend(files);
      }

      updateLegend(files) {
        const legendItemsEl = document.getElementById('cityLegendDynamicItems');
        const countBadgeEl = document.getElementById('cityLegendCountBadge');
        if (!legendItemsEl) return;

        const langCounts = {};
        (files || []).forEach(f => {
          const lang = f.language || 'Default';
          langCounts[lang] = (langCounts[lang] || 0) + 1;
        });

        const sortedLangs = Object.keys(langCounts).sort((a, b) => langCounts[b] - langCounts[a]);

        if (countBadgeEl) {
          countBadgeEl.innerText = `${sortedLangs.length} Typen`;
        }

        if (sortedLangs.length > 0) {
          legendItemsEl.innerHTML = sortedLangs.map(lang => {
            const hex = '#' + this.getLanguageColor(lang).toString(16).padStart(6, '0');
            const count = langCounts[lang];
            return `
              <span class="flex items-center gap-1.5 hover:opacity-80 transition cursor-default" title="${escapeHtml(lang)} (${count} Dateien)">
                <span class="w-2.5 h-2.5 rounded-sm flex-shrink-0 shadow-sm" style="background-color: ${hex};"></span>
                <span class="text-zinc-200 font-medium">${escapeHtml(lang)}</span>
                <span class="text-zinc-500 font-mono text-[9px]">(${count})</span>
              </span>
            `;
          }).join('');
        } else {
          legendItemsEl.innerHTML = `
            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-[#FF8000]"></span> <span class="text-zinc-300">Rust</span></span>
            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-[#00599C]"></span> <span class="text-zinc-300">C++</span></span>
            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-[#3178C6]"></span> <span class="text-zinc-300">TypeScript</span></span>
            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-[#F59E0B]"></span> <span class="text-zinc-300">JavaScript</span></span>
            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-[#3572A5]"></span> <span class="text-zinc-300">Python</span></span>
            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-[#563D7C]"></span> <span class="text-zinc-300">CSS</span></span>
            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-[#E34F26]"></span> <span class="text-zinc-300">HTML</span></span>
            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-[#CBCB41]"></span> <span class="text-zinc-300">JSON</span></span>
          `;
        }
      }

      toggleLegend() {
        const body = document.getElementById('cityLegendBody');
        const icon = document.getElementById('cityLegendToggleIcon');
        const text = document.getElementById('cityLegendToggleText');
        if (!body) return;

        const isCollapsed = body.classList.contains('hidden');
        if (isCollapsed) {
          body.classList.remove('hidden');
          if (icon) icon.classList.remove('-rotate-90');
          if (text) text.innerText = 'Einklappen';
        } else {
          body.classList.add('hidden');
          if (icon) icon.classList.add('-rotate-90');
          if (text) text.innerText = 'Ausklappen';
        }
      }

      toggleDistrictCollapse(districtPath) {
        if (this.collapsedDistricts.has(districtPath)) {
          this.collapsedDistricts.delete(districtPath);
        } else {
          this.collapsedDistricts.add(districtPath);
        }
        if (this.districts && this.data) {
          const fileList = this.extractNormalizedFiles(this.data);
          this.setupFilterSidebar(this.districts, fileList);
        }
      }

      toggleSidebar(forceState = null) {
        const sidebar = document.getElementById('cityFilterSidebar');
        const pullTab = document.getElementById('btnCitySidebarPullTab');
        if (!sidebar) return;

        const isCurrentlyHidden = sidebar.classList.contains('hidden') || sidebar.classList.contains('-translate-x-full');
        const shouldOpen = forceState !== null ? forceState : isCurrentlyHidden;

        if (shouldOpen) {
          sidebar.classList.remove('hidden');
          sidebar.classList.remove('-translate-x-full');
          if (pullTab) pullTab.classList.add('hidden');
        } else {
          sidebar.classList.add('hidden');
          sidebar.classList.add('-translate-x-full');
          if (pullTab) pullTab.classList.remove('hidden');
        }

        if (window.lucide && typeof lucide.createIcons === 'function') {
          lucide.createIcons();
        }
      }

      onDistrictRowClick(event, districtPath) {
        if (!districtPath) return;
        this.focusDistrict(districtPath);
      }

      syncSidebarToBuilding(buildingObj) {
        if (!buildingObj) return;
        const districtPath = buildingObj.district || 'root';
        const filePath = buildingObj.fileData ? buildingObj.fileData.path : null;

        // 1. Ensure sidebar is open/visible
        this.toggleSidebar(true);

        // 2. Expand all ancestor districts along the path
        let changed = false;
        if (this.collapsedDistricts.has('root')) {
          this.collapsedDistricts.delete('root');
          changed = true;
        }
        if (districtPath && districtPath !== 'root') {
          const parts = districtPath.split('/');
          let cur = '';
          parts.forEach(p => {
            cur = cur ? cur + '/' + p : p;
            if (this.collapsedDistricts.has(cur)) {
              this.collapsedDistricts.delete(cur);
              changed = true;
            }
          });
          if (this.collapsedDistricts.has(districtPath)) {
            this.collapsedDistricts.delete(districtPath);
            changed = true;
          }
        }

        if (changed && this.districts && this.data) {
          const fileList = this.extractNormalizedFiles(this.data);
          this.setupFilterSidebar(this.districts, fileList);
        }

        // 3. Highlight and scroll into view with slight delay to ensure DOM is ready
        setTimeout(() => {
          this.highlightSidebarItem(filePath, districtPath);
        }, changed ? 60 : 10);
      }

      highlightSidebarItem(filePath, districtPath) {
        const listEl = document.getElementById('cityDistrictFilterList');
        if (!listEl) return;

        // Remove previous highlight classes
        listEl.querySelectorAll('.district-sidebar-highlight').forEach(el => {
          el.classList.remove('district-sidebar-highlight');
        });

        let targetEl = null;
        if (filePath) {
          const escapedFile = (window.CSS && CSS.escape) ? CSS.escape(filePath) : filePath.replace(/([ #;?%&,.+*~\':"!^$[\]()=>|\/@])/g, '\\$1');
          targetEl = listEl.querySelector(`[data-file-path="${escapedFile}"]`);
        }
        if (!targetEl && districtPath) {
          const escapedDist = (window.CSS && CSS.escape) ? CSS.escape(districtPath) : districtPath.replace(/([ #;?%&,.+*~\':"!^$[\]()=>|\/@])/g, '\\$1');
          targetEl = listEl.querySelector(`[data-district-row="${escapedDist}"]`) || listEl.querySelector(`[data-district-path="${escapedDist}"]`);
        }

        if (targetEl) {
          targetEl.classList.add('district-sidebar-highlight');
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }

      onSearchInput(query) {
        this.searchQuery = (query || '').toLowerCase().trim();
        const clearBtn = document.getElementById('citySearchClearBtn');
        if (clearBtn) {
          if (this.searchQuery.length > 0) {
            clearBtn.classList.remove('hidden');
          } else {
            clearBtn.classList.add('hidden');
          }
        }
        this.applyFilters();
      }

      clearSearch() {
        const input = document.getElementById('citySidebarSearchInput') || document.getElementById('citySearchInput');
        if (input) input.value = '';
        this.onSearchInput('');
      }

      onMinLocChange(val) {
        this.minLoc = parseInt(val, 10) || 0;
        const valEl = document.getElementById('cityMinLocDisplay') || document.getElementById('cityMinLocValue');
        if (valEl) valEl.innerText = '≥ ' + this.minLoc + ' LOC';
        const slider = document.getElementById('cityMinLocSlider');
        if (slider) slider.value = this.minLoc;
        this.applyFilters();
      }

      onLanguageCheckboxChange(cb) {
        const lang = cb.getAttribute('data-lang');
        if (cb.checked) {
          this.activeLanguages.add(lang);
        } else {
          this.activeLanguages.delete(lang);
        }
        this.applyFilters();
      }

      onDistrictCheckboxChange(cb) {
        const districtPath = cb.getAttribute('data-district');
        const isChecked = cb.checked;

        const toggleSubtree = (node, state) => {
          if (state) {
            this.activeDistricts.add(node.path);
          } else {
            this.activeDistricts.delete(node.path);
          }
          if (node.children) {
            node.children.forEach(c => toggleSubtree(c, state));
          }
        };

        const targetNode = this.districtMap.get(districtPath);
        if (targetNode) {
          toggleSubtree(targetNode, isChecked);
        } else {
          if (isChecked) this.activeDistricts.add(districtPath);
          else this.activeDistricts.delete(districtPath);
        }

        document.querySelectorAll('#cityDistrictFilterList input[type="checkbox"]').forEach(input => {
          const d = input.getAttribute('data-district');
          if (d) {
            input.checked = this.activeDistricts.has(d);
          }
        });

        this.applyFilters();
      }

      selectAllFilters(visible) {
        if (visible) {
          this.activeLanguages = new Set(this.availableLanguages);
          this.activeDistricts = new Set(this.availableDistricts);
        } else {
          this.activeLanguages.clear();
          this.activeDistricts.clear();
        }

        document.querySelectorAll('#cityLangFilterList input[type="checkbox"]').forEach(cb => {
          cb.checked = visible;
        });
        document.querySelectorAll('#cityDistrictFilterList input[type="checkbox"]').forEach(cb => {
          cb.checked = visible;
        });

        this.applyFilters();
      }

      resetAllFilters() {
        this.clearSearch();
        this.onMinLocChange(0);
        this.selectAllFilters(true);
      }

      toggleAllLanguages() {
        const anyUnchecked = Array.from(document.querySelectorAll('#cityLangFilterList input[type="checkbox"]')).some(cb => !cb.checked);
        const targetState = anyUnchecked;
        if (targetState) {
          this.activeLanguages = new Set(this.availableLanguages);
        } else {
          this.activeLanguages.clear();
        }
        document.querySelectorAll('#cityLangFilterList input[type="checkbox"]').forEach(cb => {
          cb.checked = targetState;
        });
        this.applyFilters();
      }

      toggleAllDistricts() {
        const anyUnchecked = Array.from(document.querySelectorAll('#cityDistrictFilterList input[type="checkbox"]')).some(cb => !cb.checked);
        const targetState = anyUnchecked;
        if (targetState) {
          this.activeDistricts = new Set(this.availableDistricts);
        } else {
          this.activeDistricts.clear();
        }
        document.querySelectorAll('#cityDistrictFilterList input[type="checkbox"]').forEach(cb => {
          cb.checked = targetState;
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
            b.mesh.visible = false;
            b.edgesMesh.visible = false;
            if (b.labelSprite) b.labelSprite.visible = false;
            if (b.beaconMesh) b.beaconMesh.visible = false;
            if (b.spireMesh) b.spireMesh.visible = false;
          }
        });

        const isFiltered = (this.searchQuery !== '') || (this.minLoc > 0) ||
          (this.activeLanguages.size < this.availableLanguages.length) ||
          (this.activeDistricts.size < this.availableDistricts.length);

        const badge = document.getElementById('cityActiveFilterBadge');
        const pullTabBadge = document.getElementById('cityPullTabFilterBadge');
        if (badge) {
          if (isFiltered) badge.classList.remove('hidden');
          else badge.classList.add('hidden');
        }
        if (pullTabBadge) {
          if (isFiltered) pullTabBadge.classList.remove('hidden');
          else pullTabBadge.classList.add('hidden');
        }

        const total = this.buildings.length;
        const statusText = document.getElementById('cityFilterStatusText');
        const statusPercent = document.getElementById('cityFilterStatusPercent');
        if (statusText) statusText.innerText = 'Sichtbar: ' + visibleCount + ' / ' + total + ' Gebäude';
        if (statusPercent) {
          const pct = total > 0 ? Math.round((visibleCount / total) * 100) : 0;
          statusPercent.innerText = pct + '%';
        }

        this.updateRaycastTargets();
        this.updateDistrictHighwayHighlighting();
      }

      updateRaycastTargets() {
        // District Plate Meshes are updated on build
      }

      updateHUDStats() {
        const buildingCountBadge = document.getElementById('cityBuildingCountBadge');
        if (buildingCountBadge) {
          buildingCountBadge.innerText = this.buildings.length + ' Towers';
        }

        const summaryStats = document.getElementById('citySummaryStats');
        if (summaryStats) {
          const totalLoc = this.buildings.reduce((acc, b) => acc + (b.loc || 0), 0);
          summaryStats.innerText = 'Metropolis: ' + this.districts.length + ' Districts | ' + totalLoc.toLocaleString() + ' LOC | ' + this.highwayDataList.length + ' Cyber Highways';
        }
      }

      // =======================================================================
      // Animation Loop & Performance (Batched Particles, LOD & Throttled Raycasting)
      // =======================================================================
      animate() {
        this.animFrameId = requestAnimationFrame(this.animate);

        const now = Date.now();
        const time = now * 0.001;

        if (this.controls) {
          this.controls.update();
        }

        // WASD Smooth Navigation (Forward, Back, Strafe Left, Strafe Right)
        if (!this.isFlying && (this.keysDown['KeyW'] || this.keysDown['KeyS'] || this.keysDown['KeyA'] || this.keysDown['KeyD'] ||
            this.keysDown['ArrowUp'] || this.keysDown['ArrowDown'] || this.keysDown['ArrowLeft'] || this.keysDown['ArrowRight'])) {
          const forward = new THREE.Vector3();
          this.camera.getWorldDirection(forward);
          forward.y = 0;
          forward.normalize();

          const right = new THREE.Vector3();
          right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

          const isShift = this.keysDown['ShiftLeft'] || this.keysDown['ShiftRight'];
          const moveSpeed = (this.isStreetView ? 2.2 : 4.5) * (isShift ? 2.5 : 1.0);
          const moveDelta = new THREE.Vector3();

          if (this.keysDown['KeyW'] || this.keysDown['ArrowUp']) moveDelta.addScaledVector(forward, moveSpeed);
          if (this.keysDown['KeyS'] || this.keysDown['ArrowDown']) moveDelta.addScaledVector(forward, -moveSpeed);
          if (this.keysDown['KeyA'] || this.keysDown['ArrowLeft']) moveDelta.addScaledVector(right, -moveSpeed);
          if (this.keysDown['KeyD'] || this.keysDown['ArrowRight']) moveDelta.addScaledVector(right, moveSpeed);

          this.camera.position.add(moveDelta);
          this.controls.target.add(moveDelta);

          if (this.isStreetView) {
            this.camera.position.y = 4.0;
            this.controls.target.y = 4.0;
          }
        }

        // Smooth Camera Flight (Lerp)
        if (this.isFlying && this.flyState) {
          const elapsed = now - this.flyState.startTime;
          const progress = Math.min(1.0, elapsed / this.flyState.duration);
          const t = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

          this.camera.position.lerpVectors(this.flyState.startCam, this.flyState.targetCam, t);
          this.controls.target.lerpVectors(this.flyState.startTarget, this.flyState.targetLook, t);

          if (progress >= 1.0) {
            this.isFlying = false;
            this.flyState = null;
          }
        }

        // Throttled Spatial Raycasting Execution (~15 fps, zero per-frame mousemove overhead)
        if (this.mouseDirty && (now - this.lastRaycastTime >= this.raycastThrottleInterval)) {
          this.performSpatialRaycast(false);
          this.mouseDirty = false;
          this.lastRaycastTime = now;
        }

        // Rotate Cyber Atmosphere & Ground Radar Scan
        if (this.radarMesh && this.radarMesh.visible) {
          this.radarMesh.rotation.z += 0.008;
        }

        // Rotate Downtown Core Monument Elements
        if (this.coreMonumentObjects.length > 0) {
          this.coreMonumentObjects.forEach(obj => {
            if (obj.userData && obj.userData.isCoreRotator) {
              obj.rotation.y += obj.userData.rotSpeed || 0.01;
            }
          });
        }

        // Single Draw Call Batched Traffic Particles Buffer Update
        if (this.trafficEnabled && this.trafficParticlesMesh && this.trafficParticlesMesh.visible && this.trafficParticleList.length > 0) {
          const posAttr = this.trafficParticlesMesh.geometry.attributes.position;
          const colAttr = this.trafficParticlesMesh.geometry.attributes.color;
          const posArr = posAttr.array;
          const colArr = colAttr.array;
          const pCount = this.trafficParticleList.length;
          const isReverse = this.flowMode === 'data_flow';

          for (let i = 0; i < pCount; i++) {
            const p = this.trafficParticleList[i];
            if (!p.visible) {
              posArr[i * 3 + 1] = -9999;
              continue;
            }

            if (isReverse) {
              p.t -= p.speed;
              if (p.t < 0) p.t = 1.0;
            } else {
              p.t += p.speed;
              if (p.t > 1.0) p.t = 0.0;
            }

            p.curve.getPointAt(p.t, this.tempVec3);
            posArr[i * 3] = this.tempVec3.x;
            posArr[i * 3 + 1] = this.tempVec3.y + 0.15;
            posArr[i * 3 + 2] = this.tempVec3.z;

            colArr[i * 3] = p.currentColor.r;
            colArr[i * 3 + 1] = p.currentColor.g;
            colArr[i * 3 + 2] = p.currentColor.b;
          }

          posAttr.needsUpdate = true;
          colAttr.needsUpdate = true;
        }

        // LOD / Distance Damping for Billboard Labels
        if (this.camera && this.labels.length > 0) {
          const camDist = this.camera.position.length();
          const showDetailLabels = this.labelsEnabled && camDist < 580;
          this.labels.forEach(l => {
            if (l.userData && l.userData.isDistrictLabel) {
              l.visible = this.labelsEnabled;
            } else {
              l.visible = showDetailLabels;
            }
          });
        }

        // Pulse Hazard Beacons (Only visible megatowers)
        if (this.buildings.length < 500) {
          this.buildings.forEach(b => {
            if (b.beaconMesh && b.beaconMesh.visible) {
              const scale = 1.0 + Math.sin(time * 5.0) * 0.25;
              b.beaconMesh.scale.set(scale, scale, scale);
            }
          });
        }

        if (this.renderer && this.scene && this.camera) {
          this.renderer.render(this.scene, this.camera);
        }
      }

      // =======================================================================
      // 2-Tier Spatial Throttled Raycasting Engine (O(Districts) + O(District.Buildings))
      // =======================================================================
      onMouseMove(event) {
        if (!this.container || !this.camera) return;
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this.mouseRaw.x = event.clientX;
        this.mouseRaw.y = event.clientY;
        this.mouseDirty = true;

        const tooltip = document.getElementById('cityHoverTooltip');
        if (tooltip && !tooltip.classList.contains('hidden')) {
          tooltip.style.left = (event.clientX + 16) + 'px';
          tooltip.style.top = (event.clientY + 16) + 'px';
        }
      }

      performSpatialRaycast(isClick = false) {
        if (!this.container || !this.camera) return;
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Tier 1: Raycast against District Foundations (240 plates vs 10,000 buildings)
        const plateIntersects = this.raycaster.intersectObjects(this.districtPlateMeshes, false);

        let hitBuilding = null;
        let hitDistrict = null;

        if (plateIntersects.length > 0) {
          hitDistrict = plateIntersects[0].object.userData.districtObj;

          // Tier 2: Raycast ONLY against buildings belonging to the intersected district!
          if (hitDistrict && hitDistrict.buildingMeshes && hitDistrict.buildingMeshes.length > 0) {
            const buildingIntersects = this.raycaster.intersectObjects(hitDistrict.buildingMeshes, false);
            if (buildingIntersects.length > 0) {
              hitBuilding = buildingIntersects[0].object.userData.buildingObj;
            }
          }
        }

        if (isClick) {
          if (hitBuilding) {
            this.selectBuilding(hitBuilding);
          } else if (hitDistrict) {
            this.activeDistrict = hitDistrict.path;
            this.closeInspector();
            this.updateDistrictHighwayHighlighting();
          } else {
            this.activeDistrict = null;
            this.closeInspector();
            this.updateDistrictHighwayHighlighting();
          }
          return;
        }

        const tooltip = document.getElementById('cityHoverTooltip');
        const tooltipContent = document.getElementById('cityHoverContent');

        if (hitBuilding) {
          if (this.hoveredBuilding !== hitBuilding) {
            if (this.hoveredBuilding && this.hoveredBuilding !== this.selectedBuilding) {
              this.hoveredBuilding.mesh.material = this.getSharedBuildingMaterial(this.hoveredBuilding.langColor);
            }
            this.hoveredBuilding = hitBuilding;
            if (hitBuilding !== this.selectedBuilding) {
              const hoverMat = this.getSharedBuildingMaterial(hitBuilding.langColor).clone();
              hoverMat.emissiveIntensity = 0.65;
              hitBuilding.mesh.material = hoverMat;
            }
            this.updateDistrictHighwayHighlighting();
          }

          if (tooltip && tooltipContent) {
            tooltip.style.left = (this.mouseRaw.x + 16) + 'px';
            tooltip.style.top = (this.mouseRaw.y + 16) + 'px';
            tooltip.classList.remove('hidden');

            const langHex = '#' + this.getLanguageColor(hitBuilding.fileData.language, hitBuilding.fileData.path).toString(16).padStart(6, '0');
            const loc = hitBuilding.loc || 0;
            const fileName = hitBuilding.fileData.path.split('/').pop();

            tooltipContent.innerHTML = `
              <div class="flex items-center space-x-2 mb-1.5 pb-1 border-b border-zinc-700">
                <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${langHex};"></span>
                <span class="font-bold text-white truncate text-xs">${escapeHtml(fileName)}</span>
              </div>
              <div class="text-[11px] text-zinc-400 space-y-0.5">
                <div class="flex justify-between"><span class="text-zinc-500">Bezirk:</span> <span class="text-zinc-300 font-mono">${escapeHtml(hitBuilding.district)}</span></div>
                <div class="flex justify-between"><span class="text-zinc-500">Lines:</span> <span class="text-[#D9FF3D] font-bold">${loc} LOC</span></div>
                <div class="flex justify-between"><span class="text-zinc-500">Sprache:</span> <span class="text-zinc-300">${escapeHtml(hitBuilding.fileData.language || 'Code')}</span></div>
                <div class="flex justify-between"><span class="text-zinc-500">Komplexität:</span> <span class="text-zinc-300">${hitBuilding.complexity || 1}</span></div>
              </div>
            `;
          }
        } else if (hitDistrict) {
          if (this.hoveredBuilding && this.hoveredBuilding !== this.selectedBuilding) {
            this.hoveredBuilding.mesh.material = this.getSharedBuildingMaterial(this.hoveredBuilding.langColor);
          }
          this.hoveredBuilding = null;

          if (this.hoveredDistrict !== hitDistrict.path) {
            this.hoveredDistrict = hitDistrict.path;
            this.updateDistrictHighwayHighlighting();
          }

          if (tooltip && tooltipContent) {
            tooltip.style.left = (this.mouseRaw.x + 16) + 'px';
            tooltip.style.top = (this.mouseRaw.y + 16) + 'px';
            tooltip.classList.remove('hidden');

            tooltipContent.innerHTML = `
              <div class="flex items-center space-x-2 mb-1 pb-1 border-b border-zinc-700">
                <span class="text-brand-orange font-bold text-xs truncate">📁 ${escapeHtml(hitDistrict.path === 'root' ? 'Downtown Root (/)' : hitDistrict.name)}</span>
              </div>
              <div class="text-[11px] text-zinc-400 space-y-0.5">
                <div class="flex justify-between"><span class="text-zinc-500">Dateien:</span> <span class="text-white font-mono">${hitDistrict.files.length}</span></div>
                <div class="flex justify-between"><span class="text-zinc-500">Gesamt LOC:</span> <span class="text-[#D9FF3D] font-bold font-mono">${hitDistrict.totalLoc}</span></div>
              </div>
            `;
          }
        } else {
          if (this.hoveredBuilding && this.hoveredBuilding !== this.selectedBuilding) {
            this.hoveredBuilding.mesh.material = this.getSharedBuildingMaterial(this.hoveredBuilding.langColor);
          }
          const hadHover = (this.hoveredBuilding !== null || this.hoveredDistrict !== null);
          this.hoveredBuilding = null;
          this.hoveredDistrict = null;
          if (hadHover) {
            this.updateDistrictHighwayHighlighting();
          }
          if (tooltip) tooltip.classList.add('hidden');
        }
      }

      onMouseLeave() {
        if (this.hoveredBuilding && this.hoveredBuilding !== this.selectedBuilding) {
          this.hoveredBuilding.mesh.material = this.getSharedBuildingMaterial(this.hoveredBuilding.langColor);
        }
        this.hoveredBuilding = null;
        this.hoveredDistrict = null;
        this.updateDistrictHighwayHighlighting();
        const tooltip = document.getElementById('cityHoverTooltip');
        if (tooltip) tooltip.classList.add('hidden');
      }

      onClick(event) {
        this.onMouseMove(event);
        this.performSpatialRaycast(true);
      }

      selectBuilding(buildingObj) {
        if (!buildingObj) return;

        if (this.selectedBuilding && this.selectedBuilding !== buildingObj) {
          this.selectedBuilding.mesh.material = this.getSharedBuildingMaterial(this.selectedBuilding.langColor);
        }

        this.selectedBuilding = buildingObj;
        this.activeDistrict = buildingObj.district;

        const selMat = this.getSharedBuildingMaterial(buildingObj.langColor).clone();
        selMat.emissiveIntensity = 0.98;
        buildingObj.mesh.material = selMat;

        this.updateSelectionBox(buildingObj);
        this.openInspector(buildingObj);
        this.updateDistrictHighwayHighlighting();
        this.syncSidebarToBuilding(buildingObj);
      }

      updateSelectionBox(buildingObj) {
        if (!this.selectionTargetMesh) {
          const boxGeo = new THREE.BoxGeometry(1, 1, 1);
          const edgesGeo = new THREE.EdgesGeometry(boxGeo);
          const boxMat = new THREE.LineBasicMaterial({
            color: 0xFF8000,
            linewidth: 2.5,
            transparent: true,
            opacity: 0.95
          });
          this.selectionTargetMesh = new THREE.LineSegments(edgesGeo, boxMat);
          this.selectionTargetMesh.renderOrder = 999;
          this.scene.add(this.selectionTargetMesh);
        }

        if (buildingObj) {
          const padW = buildingObj.baseSize * 1.08;
          const padH = buildingObj.height * 1.02;
          this.selectionTargetMesh.scale.set(padW, padH, padW);
          this.selectionTargetMesh.position.set(buildingObj.x, 1.0 + buildingObj.height / 2, buildingObj.z);
          this.selectionTargetMesh.visible = true;
        } else if (this.selectionTargetMesh) {
          this.selectionTargetMesh.visible = false;
        }
      }

      openInspector(buildingObj) {
        const inspector = document.getElementById('cityInspectorDrawer');
        if (!inspector) return;

        inspector.classList.remove('hidden');

        const file = buildingObj.fileData;
        const filePath = file.path || '';
        const fileName = filePath.split('/').pop() || 'file';
        const lang = file.language || getLanguageFromPath(filePath) || 'Code';
        const loc = buildingObj.loc || file.code_lines || file.total_lines || 0;
        const comp = buildingObj.complexity || file.complexity || 1;
        const risk = buildingObj.risk || file.risk_score || 0;
        const langHex = '#' + this.getLanguageColor(lang, filePath).toString(16).padStart(6, '0');

        const langBadge = document.getElementById('cityDrawerLangBadge');
        if (langBadge) {
          langBadge.innerText = lang.toUpperCase();
          langBadge.style.backgroundColor = langHex;
          langBadge.style.color = '#000000';
        }

        const locBadge = document.getElementById('cityDrawerLOCBadge');
        if (locBadge) locBadge.innerText = loc + ' LOC';

        const riskBadge = document.getElementById('cityDrawerRiskBadge');
        if (riskBadge) {
          if (risk > 25 || comp > 20) {
            riskBadge.innerText = '⚠️ HIGH RISK (' + risk + ')';
            riskBadge.className = 'text-[10px] px-2 py-0.5 rounded font-mono font-semibold bg-rose-500/20 text-[#FF8EAB] border border-rose-500/40';
          } else if (risk > 10 || comp > 12) {
            riskBadge.innerText = '⚡ MEDIUM RISK (' + risk + ')';
            riskBadge.className = 'text-[10px] px-2 py-0.5 rounded font-mono font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30';
          } else {
            riskBadge.innerText = '✓ LOW RISK (' + risk + ')';
            riskBadge.className = 'text-[10px] px-2 py-0.5 rounded font-mono font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
          }
        }

        const titleEl = document.getElementById('cityDrawerFileName');
        if (titleEl) titleEl.innerText = fileName;

        const pathEl = document.getElementById('cityDrawerFilePath');
        if (pathEl) {
          pathEl.innerText = filePath;
          pathEl.setAttribute('title', filePath);
        }

        const copyFb = document.getElementById('cityDrawerCopyFeedback');
        if (copyFb) copyFb.innerText = 'Kopieren';

        const locEl = document.getElementById('cityDrawerLOC');
        if (locEl) locEl.innerText = loc;

        const compEl = document.getElementById('cityDrawerComplexity');
        if (compEl) compEl.innerText = comp;

        const riskScoreEl = document.getElementById('cityDrawerRiskScore');
        if (riskScoreEl) {
          riskScoreEl.innerText = risk;
          riskScoreEl.className = (risk > 25) ? 'text-[#FF8EAB] font-bold text-sm' : (risk > 10 ? 'text-amber-400 font-bold text-sm' : 'text-emerald-400 font-bold text-sm');
        }

        const imports = this.extractFileImports(file);
        const impCountEl = document.getElementById('cityDrawerImportsCount');
        if (impCountEl) impCountEl.innerText = imports.length;

        const impListEl = document.getElementById('cityDrawerImportsList');
        if (impListEl) {
          if (imports.length === 0) {
            impListEl.innerHTML = '<div class="text-zinc-500 italic text-[10px] py-1">Keine Imports deklariert</div>';
          } else {
            impListEl.innerHTML = imports.map(imp => {
              const targetB = this.resolveImportTarget(imp, filePath);
              const exists = !!targetB;
              return `
                <div class="flex items-center justify-between py-1 px-1.5 rounded hover:bg-brand-dark/80 border border-transparent hover:border-brand-border/40 transition">
                  <span class="text-zinc-300 truncate max-w-[200px]" title="${escapeHtml(imp)}">${escapeHtml(imp)}</span>
                  ${exists ? `
                    <button onclick="window.codeCityApp && window.codeCityApp.selectBuildingByPath('${escapeHtml(targetB.fileData.path)}')" class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-[#63B22F] border border-emerald-500/40 hover:bg-[#63B22F] hover:text-black transition flex items-center gap-1 font-bold">
                      ⚡ Linked
                    </button>
                  ` : `
                    <span class="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700">
                      External
                    </span>
                  `}
                </div>
              `;
            }).join('');
          }
        }

        const exportsList = this.extractFileExports(file);
        const expCountEl = document.getElementById('cityDrawerExportsCount');
        if (expCountEl) expCountEl.innerText = exportsList.length;

        const expListEl = document.getElementById('cityDrawerExportsList');
        if (expListEl) {
          if (exportsList.length === 0) {
            expListEl.innerHTML = '<div class="text-zinc-500 italic text-[10px] py-1">Keine expliziten Exports gefunden</div>';
          } else {
            expListEl.innerHTML = exportsList.map(exp => {
              return `
                <div onclick="window.codeCityApp && window.codeCityApp.openCurrentFileInCodeViewer(${exp.line || 1})" class="flex items-center justify-between py-1 px-1.5 rounded hover:bg-brand-dark/80 border border-transparent hover:border-brand-border/40 cursor-pointer transition group" title="Z. ${exp.line}: ${escapeHtml(exp.signature || exp.name)}">
                  <div class="flex items-center space-x-1.5 min-w-0 flex-1">
                    <span class="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-[#D9FF3D] border border-amber-500/30 uppercase font-bold">${escapeHtml(exp.type || 'export')}</span>
                    <span class="text-zinc-200 group-hover:text-brand-orange truncate font-medium">${escapeHtml(exp.name)}</span>
                  </div>
                  <span class="text-[10px] text-zinc-500 group-hover:text-zinc-300 ml-2 flex-shrink-0">Z. ${exp.line || 1}</span>
                </div>
              `;
            }).join('');
          }
        }

        const functionsList = this.extractFileFunctionsWithDetails(file);
        const fnCountEl = document.getElementById('cityDrawerFunctionsCount');
        if (fnCountEl) fnCountEl.innerText = functionsList.length;

        const fnListEl = document.getElementById('cityDrawerFunctionsList');
        if (fnListEl) {
          if (functionsList.length === 0) {
            fnListEl.innerHTML = '<div class="text-zinc-500 italic text-[10px] py-1">Keine Funktionsdeklarationen gefunden</div>';
          } else {
            fnListEl.innerHTML = functionsList.map(fn => {
              const cat = fn.category || (typeof categorizeFunction === 'function' ? categorizeFunction(fn.name) : { shortName: 'Core', icon: '⚙️', color: '#63B22F', bgClass: 'bg-[#63B22F]/10', textClass: 'text-[#63B22F]', borderClass: 'border-[#63B22F]/40' });
              return `
                <div onclick="window.codeCityApp && window.codeCityApp.openCurrentFileInCodeViewer(${fn.line})" class="p-1.5 rounded-lg bg-brand-dark/60 hover:bg-brand-dark border border-brand-border/40 hover:border-brand-orange/60 cursor-pointer transition group" title="Z. ${fn.line}: ${escapeHtml(fn.rawSignature || fn.name)}">
                  <div class="flex items-center justify-between mb-0.5">
                    <div class="flex items-center space-x-1 min-w-0 flex-1">
                      <span class="text-brand-orange font-bold truncate group-hover:underline">${escapeHtml(fn.name)}</span>
                      <span class="text-zinc-400 text-[10px] truncate max-w-[120px]">${escapeHtml(fn.params || '()')}</span>
                    </div>
                    <span class="text-[9px] font-mono text-zinc-400 group-hover:text-white bg-brand-card px-1.5 py-0.2 rounded border border-brand-border ml-1 flex-shrink-0">
                      Z. ${fn.line}
                    </span>
                  </div>
                  <div class="flex items-center justify-between text-[9px] mt-1">
                    <span class="px-1.5 py-0.2 rounded border flex items-center space-x-1 ${cat.bgClass || 'bg-zinc-800'} ${cat.textClass || 'text-zinc-300'} ${cat.borderClass || 'border-zinc-700'}">
                      <span>${cat.icon || '⚙️'}</span>
                      <span>${cat.shortName || cat.name || 'Function'}</span>
                    </span>
                    ${fn.isAsync ? '<span class="text-amber-400 font-bold">async</span>' : ''}
                  </div>
                </div>
              `;
            }).join('');
          }
        }

        if (window.lucide && typeof lucide.createIcons === 'function') {
          lucide.createIcons();
        }
      }

      closeInspector() {
        const inspector = document.getElementById('cityInspectorDrawer');
        if (inspector) {
          inspector.classList.add('hidden');
        }
        if (this.selectedBuilding) {
          this.selectedBuilding.mesh.material = this.getSharedBuildingMaterial(this.selectedBuilding.langColor);
          this.selectedBuilding = null;
        }
        this.updateSelectionBox(null);
        this.updateDistrictHighwayHighlighting();
      }

      selectBuildingByPath(filePath) {
        if (!filePath) return;
        const building = this.buildingMap.get(filePath);
        if (building) {
          this.selectBuilding(building);
          this.flyToBuilding(building);
        }
      }

      copyCurrentFilePath() {
        if (!this.selectedBuilding || !this.selectedBuilding.fileData) return;
        const path = this.selectedBuilding.fileData.path;
        if (!path) return;

        navigator.clipboard.writeText(path).then(() => {
          const fb = document.getElementById('cityDrawerCopyFeedback');
          if (fb) {
            fb.innerText = '✓ Kopiert!';
            setTimeout(() => { fb.innerText = 'Kopieren'; }, 2000);
          }
        }).catch(err => {
          console.warn('Clipboard write error:', err);
        });
      }

      copySingleMetric(metricType) {
        if (!this.selectedBuilding || !this.selectedBuilding.fileData) return;
        const file = this.selectedBuilding.fileData;
        const loc = this.selectedBuilding.loc || file.code_lines || file.total_lines || 0;
        const comp = this.selectedBuilding.complexity || file.complexity || 1;
        const risk = this.selectedBuilding.risk || file.risk_score || 0;

        let textToCopy = '';
        let toastId = '';

        if (metricType === 'loc') {
          textToCopy = `Zeilen (LOC): ${loc}`;
          toastId = 'cityDrawerLOCCopyToast';
        } else if (metricType === 'complexity') {
          textToCopy = `Komplexität: ${comp}`;
          toastId = 'cityDrawerCompCopyToast';
        } else if (metricType === 'risk') {
          textToCopy = `Risk-Score: ${risk}`;
          toastId = 'cityDrawerRiskCopyToast';
        }

        if (!textToCopy) return;

        const triggerToast = () => {
          if (toastId) {
            const toast = document.getElementById(toastId);
            if (toast) {
              toast.classList.remove('opacity-0', 'pointer-events-none');
              toast.classList.add('opacity-100');
              setTimeout(() => {
                toast.classList.remove('opacity-100');
                toast.classList.add('opacity-0', 'pointer-events-none');
              }, 1200);
            }
          }
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(textToCopy).then(triggerToast).catch(err => {
            console.warn('Clipboard write failed, fallback used:', err);
            if (typeof fallbackCopyText === 'function') fallbackCopyText(textToCopy);
            triggerToast();
          });
        } else {
          if (typeof fallbackCopyText === 'function') fallbackCopyText(textToCopy);
          triggerToast();
        }
      }

      copyAllMetrics() {
        if (!this.selectedBuilding || !this.selectedBuilding.fileData) return;
        const file = this.selectedBuilding.fileData;
        const filePath = file.path || '';
        const loc = this.selectedBuilding.loc || file.code_lines || file.total_lines || 0;
        const comp = this.selectedBuilding.complexity || file.complexity || 1;
        const risk = this.selectedBuilding.risk || file.risk_score || 0;

        const formattedText = `Datei: ${filePath}\nZeilen (LOC): ${loc}\nKomplexität: ${comp}\nRisk-Score: ${risk}`;

        const triggerFeedback = () => {
          const fb = document.getElementById('cityDrawerCopyAllMetricsFeedback');
          if (fb) {
            const orig = fb.innerText;
            fb.innerText = '✓ Kopiert!';
            fb.classList.add('text-[#D9FF3D]');
            setTimeout(() => {
              fb.innerText = orig;
              fb.classList.remove('text-[#D9FF3D]');
            }, 2000);
          }
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(formattedText).then(triggerFeedback).catch(err => {
            console.warn('Clipboard write failed, fallback used:', err);
            if (typeof fallbackCopyText === 'function') fallbackCopyText(formattedText);
            triggerFeedback();
          });
        } else {
          if (typeof fallbackCopyText === 'function') fallbackCopyText(formattedText);
          triggerFeedback();
        }
      }

      openCurrentFileInCodeViewer(targetLine = null) {
        if (this.selectedBuilding && this.selectedBuilding.fileData) {
          const path = this.selectedBuilding.fileData.path;
          if (typeof openFileInViewer === 'function') {
            openFileInViewer(path, null, targetLine);
          } else if (typeof selectFile === 'function') {
            selectFile(path);
          }
        }
      }

      markCurrentFileInExplorer() {
        if (!this.selectedBuilding || !this.selectedBuilding.fileData) return;
        const path = this.selectedBuilding.fileData.path;
        if (!path) return;

        if (typeof switchView === 'function') {
          switchView('code');
        }

        document.querySelectorAll('.file-tree-node').forEach(el => {
          const itemPath = el.getAttribute('data-filepath');
          if (itemPath === path) {
            el.setAttribute('class', 'file-tree-node flex items-center space-x-1.5 py-1 px-2 rounded cursor-pointer transition select-none bg-white/15 text-brand-orange font-bold border-l-2 border-brand-orange shadow-md');
            
            let parentFolder = el.closest('.folder-children');
            while (parentFolder) {
              parentFolder.classList.remove('hidden');
              const parentGroup = parentFolder.closest('.folder-group');
              if (parentGroup) {
                const row = parentGroup.querySelector('.folder-row');
                if (row) {
                  const folderId = row.getAttribute('data-folder-id');
                  if (folderId && typeof folderExpandedState !== 'undefined') folderExpandedState.set(folderId, true);
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
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
            el.setAttribute('class', 'file-tree-node flex items-center space-x-1.5 py-1 px-2 rounded cursor-pointer transition select-none text-zinc-400 hover:text-white hover:bg-white/5 border-l-2 border-transparent');
          }
        });
      }

      extractFileExports(file) {
        const exportsList = [];
        if (!file) return exportsList;
        const content = file.content || (currentData?.file_contents?.[file.path]) || '';
        const lang = (file.language || getLanguageFromPath(file.path) || '').toLowerCase();
        if (!content) return exportsList;

        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          const trimmed = line.trim();
          const lineNum = idx + 1;
          if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || (trimmed.startsWith('#') && !trimmed.startsWith('#['))) return;

          if (lang.includes('rust') || lang === 'rs') {
            const pubMatch = trimmed.match(/^pub(?:([^)]+))?\s+(?:async\s+)?(fn|struct|enum|trait|type|const|static)\s+([a-zA-Z0-9_]+)/);
            if (pubMatch) {
              exportsList.push({ type: pubMatch[1], name: pubMatch[2], signature: trimmed.replace(/\{.*$/, '').trim(), line: lineNum });
            }
          } else if (lang.includes('typescript') || lang.includes('javascript') || lang === 'ts' || lang === 'js') {
            const expMatch = trimmed.match(/^export\s+(?:default\s+)?(?:async\s+)?(function|class|interface|type|const|let|var)\s+([a-zA-Z0-9_]+)/);
            if (expMatch) {
              exportsList.push({ type: expMatch[1], name: expMatch[2], signature: trimmed.replace(/\{.*$/, '').trim(), line: lineNum });
            }
          } else if (lang.includes('python') || lang === 'py') {
            const pyMatch = trimmed.match(/^(?:def|class)\s+([a-zA-Z0-9_]+)/);
            if (pyMatch && !pyMatch[1].startsWith('_')) {
              exportsList.push({ type: trimmed.startsWith('class') ? 'class' : 'def', name: pyMatch[1], signature: trimmed.replace(/:.*$/, '').trim(), line: lineNum });
            }
          } else if (lang.includes('go')) {
            const goMatch = trimmed.match(/^(?:func|type)\s+([A-Z][a-zA-Z0-9_]*)/);
            if (goMatch) {
              exportsList.push({ type: trimmed.startsWith('type') ? 'type' : 'func', name: goMatch[1], signature: trimmed.replace(/\{.*$/, '').trim(), line: lineNum });
            }
          }
        });

        return exportsList.slice(0, 25);
      }

      extractFileFunctionsWithDetails(file) {
        const fns = [];
        if (!file) return fns;
        const content = file.content || (currentData?.file_contents?.[file.path]) || '';
        const lang = (file.language || getLanguageFromPath(file.path) || '').toLowerCase();
        if (!content) return fns;

        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          const trimmed = line.trim();
          const lineNum = idx + 1;
          if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || (trimmed.startsWith('#') && !trimmed.startsWith('#['))) return;

          let fnName = null;
          let params = '';
          let isAsync = trimmed.includes('async ');

          if (lang.includes('rust') || lang === 'rs') {
            const m = trimmed.match(/(?:pub(?:\([^\)]+\))?\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)\s*(?:<[^>]+>)?\s*\(([^)]*)\)/);
            if (m) {
              fnName = m[1];
              params = m[2] ? '(' + m[2].trim() + ')' : '()';
            }
          } else if (lang.includes('typescript') || lang.includes('javascript') || lang === 'ts' || lang === 'js') {
            const m = trimmed.match(/(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/) ||
                      trimmed.match(/(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/) ||
                      trimmed.match(/(?:public\s+|private\s+|protected\s+|static\s+)?(?:async\s+)?([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*[:{]/);
            if (m && !['if', 'for', 'while', 'switch', 'catch'].includes(m[1])) {
              fnName = m[1];
              params = m[2] ? '(' + m[2].trim() + ')' : '()';
            }
          } else if (lang.includes('python') || lang === 'py') {
            const m = trimmed.match(/^(?:async\s+)?def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/);
            if (m) {
              fnName = m[1];
              params = m[2] ? '(' + m[2].trim() + ')' : '()';
            }
          } else if (lang.includes('go')) {
            const m = trimmed.match(/^func\s+(?:\([^)]+\)\s+)?([a-zA-Z0-9_]+)\s*\(([^)]*)\)/);
            if (m) {
              fnName = m[1];
              params = m[2] ? '(' + m[2].trim() + ')' : '()';
            }
          } else if (lang.includes('c') || lang.includes('cpp')) {
            const m = trimmed.match(/(?:[a-zA-Z0-9_:<>]+\s+)+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*\{/);
            if (m && !['if', 'for', 'while', 'switch', 'catch'].includes(m[1])) {
              fnName = m[1];
              params = m[2] ? '(' + m[2].trim() + ')' : '()';
            }
          }

          if (fnName) {
            const cat = typeof categorizeFunction === 'function' ? categorizeFunction(fnName) : null;
            fns.push({
              name: fnName,
              params: params,
              line: lineNum,
              isAsync: isAsync,
              category: cat,
              rawSignature: `${fnName}${params}`
            });
          }
        });

        return fns.slice(0, 35);
      }

      updateDistrictHighwayHighlighting(activeDistrictKey = null) {
        if (!this.highwayLineSegments || !this.highwayDataList) return;

        const targetDistrict = activeDistrictKey || this.activeDistrict || this.hoveredDistrict || (this.selectedBuilding ? this.selectedBuilding.district : null);
        const targetBuildingPath = this.isolatedBuilding || (this.selectedBuilding ? this.selectedBuilding.fileData?.path : (this.hoveredBuilding ? this.hoveredBuilding.fileData?.path : null));

        const colAttr = this.highwayLineSegments.geometry.attributes.color;
        const colArr = colAttr.array;

        this.highwayDataList.forEach(hw => {
          const srcB = this.buildingMap.get(hw.sourcePath);
          const tgtB = this.buildingMap.get(hw.targetPath);
          const isVisibleBuilding = (!srcB || srcB.mesh.visible) && (!tgtB || tgtB.mesh.visible);

          if (!this.trafficEnabled || !this.highwaysEnabled || !isVisibleBuilding) {
            for (let idx = hw.startIndex; idx < hw.endIndex; idx++) {
              colArr[idx * 3] = 0;
              colArr[idx * 3 + 1] = 0;
              colArr[idx * 3 + 2] = 0;
            }
            return;
          }

          const isDirectBuildingMatch = targetBuildingPath ? (hw.sourcePath === targetBuildingPath || hw.targetPath === targetBuildingPath) : false;
          let isDistrictMatch = false;
          if (targetDistrict) {
            if ((srcB && srcB.district === targetDistrict) || (tgtB && tgtB.district === targetDistrict)) {
              isDistrictMatch = true;
            }
          }

          let brightness = 0.75;
          if (this.isolatedBuilding) {
            brightness = (hw.sourcePath === this.isolatedBuilding || hw.targetPath === this.isolatedBuilding) ? 1.0 : 0.0;
          } else if (targetBuildingPath) {
            brightness = isDirectBuildingMatch ? 1.0 : 0.12;
          } else if (targetDistrict) {
            brightness = isDistrictMatch ? 0.95 : 0.18;
          }

          for (let idx = hw.startIndex; idx < hw.endIndex; idx++) {
            colArr[idx * 3] = hw.baseColor.r * brightness;
            colArr[idx * 3 + 1] = hw.baseColor.g * brightness;
            colArr[idx * 3 + 2] = hw.baseColor.b * brightness;
          }
        });

        colAttr.needsUpdate = true;

        // Update Traffic Particle brightness and visibility
        if (this.trafficParticleList) {
          this.trafficParticleList.forEach(p => {
            const isMatch = targetBuildingPath ? (p.sourcePath === targetBuildingPath || p.targetPath === targetBuildingPath) :
                            (targetDistrict ? (p.sourceDistrict === targetDistrict || p.targetDistrict === targetDistrict) : true);
            p.visible = this.trafficEnabled && isMatch;
            const mult = (targetBuildingPath || targetDistrict) ? (isMatch ? 1.2 : 0.2) : 1.0;
            p.currentColor.r = Math.min(1.0, p.baseColor.r * mult);
            p.currentColor.g = Math.min(1.0, p.baseColor.g * mult);
            p.currentColor.b = Math.min(1.0, p.baseColor.b * mult);
          });
        }
      }

      isolateBuildingHighways() {
        if (!this.selectedBuilding) return;
        const path = this.selectedBuilding.fileData.path;
        this.isolatedBuilding = (this.isolatedBuilding === path) ? null : path;
        this.updateDistrictHighwayHighlighting();
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

        this.activeDistrict = districtPath;
        this.updateDistrictHighwayHighlighting();

        const targetLook = new THREE.Vector3(district.x, 2, district.z);
        const targetCam = new THREE.Vector3(district.x + district.width * 0.8, Math.max(25, district.width * 0.9), district.z + district.depth * 0.9);

        this.smoothCameraFlight(targetCam, targetLook, 750);

        // Sidebar synchronization: ensure sidebar is open, ancestors uncollapsed, and item highlighted
        this.toggleSidebar(true);
        let changed = false;
        if (this.collapsedDistricts.has('root')) {
          this.collapsedDistricts.delete('root');
          changed = true;
        }
        if (districtPath !== 'root') {
          const parts = districtPath.split('/');
          let cur = '';
          parts.forEach(p => {
            cur = cur ? cur + '/' + p : p;
            if (this.collapsedDistricts.has(cur)) {
              this.collapsedDistricts.delete(cur);
              changed = true;
            }
          });
          if (this.collapsedDistricts.has(districtPath)) {
            this.collapsedDistricts.delete(districtPath);
            changed = true;
          }
        }
        if (changed && this.districts && this.data) {
          const fileList = this.extractNormalizedFiles(this.data);
          this.setupFilterSidebar(this.districts, fileList);
        }
        setTimeout(() => {
          this.highlightSidebarItem(null, districtPath);
        }, changed ? 60 : 10);
      }

      autoFitMetropolis(smooth = true) {
        if (!this.camera || !this.controls) return;

        let maxRadius = 160;
        let sumX = 0;
        let sumZ = 0;
        const total = Math.max(1, this.districts.length);

        this.districts.forEach(d => {
          sumX += d.x;
          sumZ += d.z;
          const r = Math.hypot(d.x, d.z) + Math.max(d.width, d.depth) / 2;
          if (r > maxRadius) maxRadius = r;
        });

        const centerX = sumX / total;
        const centerZ = sumZ / total;

        const camDist = Math.max(220, maxRadius * 1.75);
        const targetCam = new THREE.Vector3(centerX + camDist * 0.72, camDist * 0.85, centerZ + camDist * 0.78);
        const targetLook = new THREE.Vector3(centerX, 4, centerZ);

        if (smooth) {
          this.smoothCameraFlight(targetCam, targetLook, 700);
        } else {
          this.camera.position.copy(targetCam);
          this.controls.target.copy(targetLook);
        }
        this.isolatedBuilding = null;
        this.activeDistrict = null;
        this.updateDistrictHighwayHighlighting();
      }

      resetCamera(smooth = true) {
        this.autoFitMetropolis(smooth);
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

      toggleFlowMode() {
        this.flowMode = this.flowMode === 'data_flow' ? 'call_flow' : 'data_flow';
        this.updateFlowUI();
      }

      updateFlowUI() {
        const btn = document.getElementById('btnCityFlowToggle');
        const badge = document.getElementById('cityFlowBadge');
        if (btn) {
          if (badge) {
            badge.innerText = this.flowMode === 'data_flow' ? '📦 Daten' : '⚡ Aufruf';
          }
          if (window.lucide && typeof lucide.createIcons === 'function') {
            lucide.createIcons();
          }
        }
      }

      toggleTraffic() {
        this.trafficEnabled = !this.trafficEnabled;
        if (this.trafficParticlesMesh) {
          this.trafficParticlesMesh.visible = this.trafficEnabled;
        }
        this.updateDistrictHighwayHighlighting();

        const badge = document.getElementById('cityTrafficBadge');
        if (badge) {
          badge.innerText = this.trafficEnabled ? 'ON' : 'OFF';
          badge.className = this.trafficEnabled ? 'text-[10px] ml-0.5 font-bold text-[#D9FF3D]' : 'text-[10px] ml-0.5 font-bold text-zinc-500';
        }
      }

      toggleHighways() {
        this.highwaysEnabled = !this.highwaysEnabled;
        if (this.highwayLineSegments) {
          this.highwayLineSegments.visible = this.highwaysEnabled;
        }
        this.updateDistrictHighwayHighlighting();

        const badge = document.getElementById('cityHighwaysBadge');
        if (badge) {
          badge.innerText = this.highwaysEnabled ? 'ON' : 'OFF';
          badge.className = this.highwaysEnabled ? 'text-[10px] ml-0.5 font-bold text-sky-400' : 'text-[10px] ml-0.5 font-bold text-zinc-500';
        }
      }

      toggleDeco() {
        this.decoEnabled = !this.decoEnabled;
        this.instancedMeshes.forEach(m => {
          m.visible = this.decoEnabled;
        });

        const badge = document.getElementById('cityDecoBadge');
        if (badge) {
          badge.innerText = this.decoEnabled ? 'ON' : 'OFF';
          badge.className = this.decoEnabled ? 'text-[10px] ml-0.5 font-bold text-[#63B22F]' : 'text-[10px] ml-0.5 font-bold text-zinc-500';
        }
      }

      toggleLabels() {
        this.labelsEnabled = !this.labelsEnabled;
        this.labels.forEach(l => {
          l.visible = this.labelsEnabled;
        });

        const badge = document.getElementById('cityLabelsBadge');
        if (badge) {
          badge.innerText = this.labelsEnabled ? 'ON' : 'OFF';
          badge.className = this.labelsEnabled ? 'text-[10px] ml-0.5 font-bold text-cyan-400' : 'text-[10px] ml-0.5 font-bold text-zinc-500';
        }
      }

      toggleTheme() {
        const order = ['cyberpunk', 'matrix', 'studio', 'light'];
        const nextIdx = (order.indexOf(this.theme) + 1) % order.length;
        this.setTheme(order[nextIdx]);
      }

      onKeyDown(e) {
        // Prevent default scrolling for WASD / Arrow keys if target is canvas or body (not input)
        const tag = e.target ? e.target.tagName : '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
          this.keysDown[e.code] = true;
          if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
            e.preventDefault();
          }
        }
      }

      onKeyUp(e) {
        if (this.keysDown[e.code]) {
          delete this.keysDown[e.code];
        }
      }

      toggleStreetView() {
        this.isStreetView = !this.isStreetView;
        const btn = document.getElementById('btnCityStreetViewToggle');
        const badge = document.getElementById('cityStreetViewBadge');
        const icon = document.getElementById('cityStreetViewIcon');

        if (this.isStreetView) {
          // Save previous overview camera state
          this.overviewCamState = {
            pos: this.camera.position.clone(),
            target: this.controls.target.clone()
          };

          // Center at Downtown Core or current active district
          let streetX = 0, streetZ = 0;
          if (this.selectedBuilding) {
            streetX = this.selectedBuilding.x;
            streetZ = this.selectedBuilding.z + 20;
          } else if (this.districtTreeRoot) {
            streetX = this.districtTreeRoot.x || 0;
            streetZ = (this.districtTreeRoot.z || 0) + 15;
          }

          const targetCam = new THREE.Vector3(streetX, 4.0, streetZ);
          const targetLook = new THREE.Vector3(streetX, 4.0, streetZ - 40);

          this.controls.minPolarAngle = 0.05;
          this.controls.maxPolarAngle = Math.PI / 2 - 0.01;
          this.controls.minDistance = 0.5;
          this.controls.maxDistance = 1800;

          this.smoothCameraFlight(targetCam, targetLook, 750);

          if (badge) {
            badge.innerText = 'ON 🚶';
            badge.className = 'text-[10px] ml-0.5 font-bold text-[#D9FF3D]';
          }
          if (btn) btn.title = "Street View beenden (Zurück zur Vogelperspektive 🦅)";
        } else {
          if (this.overviewCamState) {
            this.smoothCameraFlight(this.overviewCamState.pos, this.overviewCamState.target, 750);
          } else {
            this.autoFitMetropolis(true);
          }
          this.controls.minDistance = 25;
          this.controls.maxDistance = 2500;
          if (badge) {
            badge.innerText = 'OFF';
            badge.className = 'text-[10px] ml-0.5 font-bold text-zinc-400';
          }
          if (btn) btn.title = "🚶 Street View Modus (Erkundung auf Straßenniveau mit WASD)";
        }
      }

      exportStandaloneCityHtml() {
        const activeData = this.data || (typeof currentData !== 'undefined' ? currentData : null);
        if (!activeData || !activeData.files) {
          alert("Keine Codebase-Daten für den Standalone HTML-Export geladen.");
          return;
        }

        const projName = (activeData.project_name || 'CodeCity_Metropolis').replace(/[^a-zA-Z0-9_-]/g, '_');
        const jsonStr = (typeof window.safeJsonStringify === 'function')
          ? window.safeJsonStringify(activeData, 0)
          : JSON.stringify(activeData);
        
        let pageHtml = document.documentElement.outerHTML;
        const autoInjectScript = `\n<script>\nwindow.addEventListener('DOMContentLoaded', () => {\n  const standaloneData = ${jsonStr};\n  if (typeof loadAnalysisResultsData === 'function') {\n    loadAnalysisResultsData(standaloneData);\n  } else if (window.codeCityApp && typeof window.codeCityApp.buildCity === 'function') {\n    window.codeCityApp.buildCity(standaloneData);\n  }\n});\n<\/script>\n`;

        if (pageHtml.includes('</head>')) {
          pageHtml = pageHtml.replace('</head>', autoInjectScript + '</head>');
        } else {
          pageHtml = pageHtml + autoInjectScript;
        }

        const blob = new Blob([pageHtml], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projName}_3D_CodeCity_Standalone.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      setTheme(themeName) {
        if (!this.themeStyles[themeName]) return;
        this.theme = themeName;
        const themeCfg = this.themeStyles[this.theme];
        const isLight = this.theme === 'light' || this.theme === 'arch-light';

        if (this.scene) {
          this.scene.background = new THREE.Color(themeCfg.bgDark);
          this.scene.fog = new THREE.FogExp2(themeCfg.fogColor, themeCfg.fogDensity);
        }

        if (this.ambientLight) {
          this.ambientLight.color.setHex(themeCfg.ambientColor);
          this.ambientLight.intensity = themeCfg.ambientIntensity;
        }
        if (this.hemiLight) {
          this.hemiLight.color.setHex(themeCfg.hemiSkyColor || 0x38bdf8);
          this.hemiLight.groundColor.setHex(themeCfg.hemiGroundColor || 0x0f172a);
          this.hemiLight.intensity = themeCfg.hemiIntensity || 1.4;
        }
        if (this.dirLight1) {
          this.dirLight1.color.setHex(themeCfg.sunColor);
          this.dirLight1.intensity = themeCfg.sunIntensity;
        }
        if (this.dirLight2) {
          this.dirLight2.color.setHex(themeCfg.secondarySunColor || 0x38bdf8);
          this.dirLight2.intensity = themeCfg.secondarySunIntensity || 1.2;
        }
        if (this.rimLightCyan) {
          this.rimLightCyan.color.setHex(themeCfg.rimCyanColor);
          this.rimLightCyan.intensity = themeCfg.rimCyanIntensity;
        }
        if (this.rimLightMagenta) {
          this.rimLightMagenta.color.setHex(themeCfg.rimMagentaColor);
          this.rimLightMagenta.intensity = themeCfg.rimMagentaIntensity;
        }
        if (this.rimLightOrange) {
          this.rimLightOrange.color.setHex(themeCfg.rimOrangeColor);
          this.rimLightOrange.intensity = themeCfg.rimOrangeIntensity;
        }

        if (this.gridFloor) {
          this.gridFloor.visible = themeCfg.gridFloorVisible !== false;
        }
        if (this.floorMesh && this.floorMesh.material) {
          this.floorMesh.material.color.setHex(isLight ? 0xEDF2F7 : 0x050811);
          this.floorMesh.material.emissive.setHex(isLight ? 0xCBD5E1 : 0x040814);
          this.floorMesh.material.emissiveIntensity = isLight ? 0.08 : 0.4;
        }
        if (this.radarMesh) {
          this.radarMesh.visible = !isLight;
        }
        if (this.cyberParticles) {
          this.cyberParticles.visible = !isLight;
        }

        if (this.districts) {
          this.districts.forEach(d => {
            if (d.plateMesh && d.plateMesh.material) {
              d.plateMesh.material.color.setHex(themeCfg.plateColor);
            }
          });
        }

        this.windowTextures = {};
        this.sharedBuildingMaterials = {};
        this.sharedEdgeMaterials = {};

        this.buildings.forEach(b => {
          if (b.mesh && b.mesh.visible) {
            b.mesh.material = this.getSharedBuildingMaterial(b.langColor);
            if (b.edgesMesh) {
              b.edgesMesh.material = this.getSharedEdgeMaterial(b.langColor);
            }
          }
        });

        this.updateDistrictHighwayHighlighting();

        const btn = document.getElementById('btnCityThemeToggle');
        const themeText = document.getElementById('cityThemeText');
        const themeIcon = document.getElementById('cityThemeIcon');
        if (themeText) {
          themeText.innerText = themeName === 'light' ? 'Arch-Light' : themeName.charAt(0).toUpperCase() + themeName.slice(1);
        }
        if (themeIcon) {
          themeIcon.setAttribute('data-lucide', themeName === 'light' ? 'sun' : (themeName === 'cyberpunk' ? 'moon' : 'palette'));
          if (window.lucide && typeof lucide.createIcons === 'function') {
            lucide.createIcons();
          }
        }
      }

      clearCity() {
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

        this.coreMonumentObjects.forEach(obj => {
          this.scene.remove(obj);
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (obj.material.map) obj.material.map.dispose();
            obj.material.dispose();
          }
        });
        this.coreMonumentObjects = [];

        this.instancedMeshes.forEach(mesh => {
          this.scene.remove(mesh);
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) mesh.material.dispose();
        });
        this.instancedMeshes = [];

        if (this.highwayLineSegments) {
          this.scene.remove(this.highwayLineSegments);
          if (this.highwayLineSegments.geometry) this.highwayLineSegments.geometry.dispose();
          if (this.highwayLineSegments.material) this.highwayLineSegments.material.dispose();
          this.highwayLineSegments = null;
        }

        if (this.groundLineSegments) {
          this.scene.remove(this.groundLineSegments);
          if (this.groundLineSegments.geometry) this.groundLineSegments.geometry.dispose();
          if (this.groundLineSegments.material) this.groundLineSegments.material.dispose();
          this.groundLineSegments = null;
        }

        if (this.trafficParticlesMesh) {
          this.scene.remove(this.trafficParticlesMesh);
          if (this.trafficParticlesMesh.geometry) this.trafficParticlesMesh.geometry.dispose();
          if (this.trafficParticlesMesh.material) this.trafficParticlesMesh.material.dispose();
          this.trafficParticlesMesh = null;
        }

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
        this.districtMap.clear();
        this.districtPlateMeshes = [];
        this.districtTreeRoot = null;
        this.highwayDataList = [];
        this.trafficParticleList = [];
        this.districtConnections = [];
        this.labels = [];

        this.hoveredBuilding = null;
        this.selectedBuilding = null;
        this.hoveredDistrict = null;
        this.activeDistrict = null;
        this.isolatedBuilding = null;
        this.closeInspector();
      }

      disposeScene() {
        if (this.animFrameId) {
          cancelAnimationFrame(this.animFrameId);
          this.animFrameId = null;
        }
        this.clearCity();

        if (this.cyberParticles) {
          this.scene.remove(this.cyberParticles);
          if (this.cyberParticles.geometry) this.cyberParticles.geometry.dispose();
          if (this.cyberParticles.material) this.cyberParticles.material.dispose();
        }

        if (this.radarMesh) {
          this.scene.remove(this.radarMesh);
          if (this.radarMesh.geometry) this.radarMesh.geometry.dispose();
          if (this.radarMesh.material) this.radarMesh.material.dispose();
        }

        if (this.renderer) {
          this.renderer.dispose();
          if (this.renderer.domElement && this.renderer.domElement.parentNode) {
            this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
          }
        }
        if (this.controls) {
          this.controls.dispose();
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
        const isLight = (typeof document !== 'undefined' && document.documentElement.classList.contains('light')) ||
                        (typeof appSettings !== 'undefined' && appSettings && appSettings.themeMode === 'light') ||
                        (typeof localStorage !== 'undefined' && (localStorage.getItem('codebase_theme') === 'light' || localStorage.getItem('codebase_theme_mode') === 'light'));
        const currentIsLight = this.theme === 'light' || this.theme === 'arch-light';
        if (isLight && !currentIsLight) {
          this.setTheme('light');
        } else if (!isLight && currentIsLight) {
          this.setTheme('cyberpunk');
        }
        if (!this.data && typeof currentData !== 'undefined' && currentData) {
          this.buildCity(currentData);
        }
      }
    }

    // Global Instance
    function initCodeCity() {
      const isLight = (typeof document !== 'undefined' && document.documentElement.classList.contains('light')) ||
                      (typeof appSettings !== 'undefined' && appSettings && appSettings.themeMode === 'light') ||
                      (typeof localStorage !== 'undefined' && (localStorage.getItem('codebase_theme') === 'light' || localStorage.getItem('codebase_theme_mode') === 'light'));
      if (!window.codeCityApp) {
        window.codeCityApp = new CodeCityMetropolis('cityCanvasContainer');
        if (isLight && window.codeCityApp.theme !== 'light' && window.codeCityApp.theme !== 'arch-light') {
          window.codeCityApp.setTheme('light');
        }
        if (typeof currentData !== 'undefined' && currentData) {
          window.codeCityApp.buildCity(currentData);
        }
      } else {
        if (isLight && window.codeCityApp.theme !== 'light' && window.codeCityApp.theme !== 'arch-light') {
          window.codeCityApp.setTheme('light');
        } else if (!isLight && (window.codeCityApp.theme === 'light' || window.codeCityApp.theme === 'arch-light')) {
          window.codeCityApp.setTheme('cyberpunk');
        }
        window.codeCityApp.onViewActivated();
      }
    }



// Attach to window
window.CodeCityMetropolis = CodeCityMetropolis;
window.initCodeCity = initCodeCity;
