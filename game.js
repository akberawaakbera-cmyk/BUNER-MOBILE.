(() => {
  "use strict";

  // =====================================================
  // BUNER MOBILE — GLB EDITION
  // Three.js 0.160.0 | Mobile-friendly prototype
  // =====================================================

  if (window.__BUNER_MOBILE_GLB_READY__) return;
window.__BUNER_MOBILE_GLB_READY__ = true;

  const $ = (id) => document.getElementById(id);
  const THREE = window.THREE;

  const MODEL_PATH =
    "./assets/characters/model_E06A91C3-7469-4FE0-918B-26317C457A5A.glb";

  const state = {
    map: "buner",
    weapon: "rifle",
    character: "soldier",
    playerName: "SURVIVOR",
    graphics: "high",
    health: 100,
    ammo: 30,
    maxAmmo: 30,
    gameActive: false,
    aiming: false,
    running: false,
    crouching: false,
    firing: false,
    jumping: false,
    reloading: false,
    yaw: 0,
    pitch: -0.12,
    moveX: 0,
    moveY: 0,
    lastShot: 0,
    lastTime: 0,
    previewToken: 0,
    battleToken: 0,
    emote: "idle"
  };

  const WEAPONS = {
    rifle:   { name: "ASSAULT RIFLE", damage: 20, rate: 160, ammo: 30, spread: 0.025, range: 90 },
    sniper:  { name: "SNIPER",        damage: 90, rate: 900, ammo: 5,  spread: 0.004, range: 180 },
    shotgun: { name: "SHOTGUN",       damage: 12, rate: 650, ammo: 8,  spread: 0.15, range: 24 },
    smg:     { name: "SMG",           damage: 12, rate: 85,  ammo: 35, spread: 0.045, range: 60 },
    pistol:  { name: "PISTOL",        damage: 25, rate: 300, ammo: 12, spread: 0.02, range: 45 }
  };

  const MAPS = {
    buner: {
      name: "BUNER VALLEY",
      ground: 0x68734a,
      sky: 0x9abbd0,
      road: 0x6c675c,
      tree: 0x345b35,
      building: 0xb6a48a
    },
    forest: {
      name: "FOREST ZONE",
      ground: 0x405b3b,
      sky: 0x829d9b,
      road: 0x514e46,
      tree: 0x23472b,
      building: 0x777e68
    },
    desert: {
      name: "DESERT OUTPOST",
      ground: 0xc7a66b,
      sky: 0xe0c59b,
      road: 0x988365,
      tree: 0x78804c,
      building: 0xb9a07d
    }
  };

  const ui = {
    lobby: $("lobby"),
    game: $("gameScreen"),
    canvas: $("gameCanvas"),
    preview: $("characterPreviewCanvas"),
    modal: $("modal"),
    modalTitle: $("modalTitle"),
    modalContent: $("modalContent"),
    message: $("gameMessage"),
    healthBar: $("healthBar"),
    healthText: $("healthText"),
    weaponText: $("weaponText"),
    ammoText: $("ammoText"),
    countdown: $("startCountdown"),
    countdownNumber: $("countdownNumber"),
    joystick: $("joystick"),
    joystickKnob: $("joystickKnob"),
    crosshair: $("crosshair")
  };

  let previewRenderer = null;
  let previewScene = null;
  let previewCamera = null;
  let previewModel = null;
  let previewMixer = null;
  let previewClock = new THREE.Clock();

  let renderer = null;
  let scene = null;
  let camera = null;
  let clock = new THREE.Clock();
  let playerRoot = null;
  let playerModel = null;
  let playerMixer = null;
  let playerBody = null;
  let gunRoot = null;
  let muzzleFlash = null;
  let terrain = null;
  let raf = 0;
  let countdownTimer = null;
  let lookPointer = null;
  let joystickPointer = null;
  let joystickRect = null;
  let jumpVelocity = 0;
  let verticalPosition = 0;
  let grounded = true;
  let fireTimer = null;
  let collisionObjects = [];
  let targets = [];
  let worldToken = 0;
  const keys = Object.create(null);

  // ----------------- GENERAL HELPERS -----------------

  function message(text, duration = 1800) {
    if (!ui.message) return;
    ui.message.textContent = text;
    ui.message.classList.remove("hidden");
    clearTimeout(message.timer);
    message.timer = setTimeout(() => {
      if (!state.gameActive) return;
      ui.message.classList.add("hidden");
    }, duration);
  }

  function disposeObject(root) {
    if (!root) return;
    root.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const materials = Array.isArray(obj.material)
          ? obj.material
          : [obj.material];
        materials.forEach((mat) => {
          for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap"]) {
            if (mat[key] && mat[key].dispose) mat[key].dispose();
          }
          mat.dispose();
        });
      }
    });
  }

  function setModal(title, html) {
    if (!ui.modal || !ui.modalTitle || !ui.modalContent) return;
    ui.modalTitle.textContent = title;
    ui.modalContent.innerHTML = html;
    ui.modal.classList.remove("hidden");
  }

  function closeModal() {
    if (ui.modal) ui.modal.classList.add("hidden");
  }

  function updateHUD() {
    if (ui.healthBar) ui.healthBar.style.width = state.health + "%";
    if (ui.healthText) ui.healthText.textContent = Math.ceil(state.health);
    if (ui.weaponText) {
      ui.weaponText.textContent = WEAPONS[state.weapon].name;
    }
    if (ui.ammoText) {
      ui.ammoText.textContent = state.ammo + " / " + state.maxAmmo;
    }
    const mapName = $("selectedMapName");
    if (mapName) mapName.textContent = MAPS[state.map].name;
    const name = $("playerName");
    if (name) name.textContent = state.playerName;
  }

  function disposeScene(sceneObject) {
    if (!sceneObject) return;
    sceneObject.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((mat) => {
          if (mat.map) mat.map.dispose();
          mat.dispose();
        });
      }
    });
  }

  // ----------------- GLB LOADER -----------------

  let GLTFLoaderClass = null;
  let gltfLoaderPromise = null;

  async function getGLTFLoader() {
    if (GLTFLoaderClass) return GLTFLoaderClass;
    if (!gltfLoaderPromise) {
      gltfLoaderPromise = import(
        "https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js"
      ).then((module) => {
        GLTFLoaderClass = module.GLTFLoader;
        return GLTFLoaderClass;
      });
    }
    return gltfLoaderPromise;
  }

  async function loadGLB() {
    const Loader = await getGLTFLoader();
    const loader = new Loader();
    const gltf = await loader.loadAsync(MODEL_PATH);
    return gltf;
  }

  function normalizeModel(model, desiredHeight = 1.8) {
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    if (size.y > 0.001) {
      const scale = desiredHeight / size.y;
      model.scale.multiplyScalar(scale);
    }

    model.updateMatrixWorld(true);
    const newBox = new THREE.Box3().setFromObject(model);
    const newCenter = newBox.getCenter(new THREE.Vector3());

    model.position.x -= newCenter.x;
    model.position.z -= newCenter.z;
    model.position.y -= newBox.min.y;

    model.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        if (obj.material) {
          const mats = Array.isArray(obj.material)
            ? obj.material
            : [obj.material];
          mats.forEach((mat) => {
            if ("roughness" in mat) mat.roughness = Math.max(mat.roughness, 0.45);
          });
        }
      }
    });
    return model;
  }

  function createFallbackCharacter() {
    const root = new THREE.Group();

    const skin = new THREE.MeshStandardMaterial({ color: 0xb78a6a, roughness: 0.85 });
    const uniform = new THREE.MeshStandardMaterial({ color: 0x344b38, roughness: 0.9 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x30372f, roughness: 0.95 });
    const boots = new THREE.MeshStandardMaterial({ color: 0x252722, roughness: 0.9 });
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x48543a, roughness: 0.8 });

    function part(geometry, material, x, y, z) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
      return mesh;
    }

    part(new THREE.CylinderGeometry(0.23, 0.28, 0.62, 10), uniform, 0, 1.03, 0);
    part(new THREE.SphereGeometry(0.17, 12, 10), skin, 0, 1.47, 0);
    part(new THREE.SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), helmetMat, 0, 1.56, 0);

    const leftArm = part(new THREE.CylinderGeometry(0.065, 0.075, 0.48, 8), uniform, -0.3, 1.05, 0);
    const rightArm = part(new THREE.CylinderGeometry(0.065, 0.075, 0.48, 8), uniform, 0.3, 1.05, 0);
    leftArm.rotation.z = -0.22;
    rightArm.rotation.z = 0.22;

    const leftLeg = part(new THREE.CylinderGeometry(0.09, 0.105, 0.55, 8), pants, -0.12, 0.43, 0);
    const rightLeg = part(new THREE.CylinderGeometry(0.09, 0.105, 0.55, 8), pants, 0.12, 0.43, 0);
    part(new THREE.BoxGeometry(0.16, 0.1, 0.25), boots, -0.12, 0.12, 0.04);
    part(new THREE.BoxGeometry(0.16, 0.1, 0.25), boots, 0.12, 0.12, 0.04);

    root.userData = { leftArm, rightArm, leftLeg, rightLeg };
    return root;
  }

  function makeAnimatedClone(gltf) {
    const model = gltf.scene.clone(true);
    normalizeModel(model);
    let mixer = null;

    if (gltf.animations && gltf.animations.length) {
      mixer = new THREE.AnimationMixer(model);
      const idle = gltf.animations.find((clip) =>
        /idle|stand|breath/i.test(clip.name)
      ) || gltf.animations[0];
      mixer.clipAction(idle).play();
    }
    return { model, mixer, animations: gltf.animations || [] };
  }

  // ----------------- LOBBY PREVIEW -----------------

  function initPreview() {
    if (!ui.preview || !THREE) return;

    if (previewRenderer) {
      previewRenderer.dispose();
      previewRenderer = null;
    }

    previewScene = new THREE.Scene();
    previewScene.background = new THREE.Color(0x26372c);
    previewScene.fog = new THREE.Fog(0x26372c, 5, 18);

    previewCamera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    previewCamera.position.set(0, 1.35, 5.5);
    previewCamera.lookAt(0, 0.95, 0);

    previewRenderer = new THREE.WebGLRenderer({
      antialias: state.graphics === "high",
      alpha: false,
      powerPreference: "high-performance"
    });
    previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    previewRenderer.shadowMap.enabled = state.graphics === "high";
    previewRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    previewRenderer.outputColorSpace = THREE.SRGBColorSpace;
    ui.preview.replaceChildren(previewRenderer.domElement);
    resizePreview();

    previewScene.add(new THREE.HemisphereLight(0xddeeff, 0x38452d, 2));
    const light = new THREE.DirectionalLight(0xffffff, 2.5);
    light.position.set(3, 6, 4);
    light.castShadow = true;
    previewScene.add(light);

    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 0.12, 32),
      new THREE.MeshStandardMaterial({ color: 0x3e4938, roughness: 0.85 })
    );
    floor.position.y = -0.07;
    floor.receiveShadow = true;
    previewScene.add(floor);

    previewModel = createFallbackCharacter();
    previewModel.position.y = 0;
    previewScene.add(previewModel);

    loadPreviewGLB();
    previewLoop();
  }

  async function loadPreviewGLB() {
    const token = ++state.previewToken;
    try {
      const gltf = await loadGLB();
      const built = makeAnimatedClone(gltf);

      if (token !== state.previewToken || !previewScene) {
        disposeObject(built.model);
        return;
      }

      if (previewModel) {
        previewScene.remove(previewModel);
        disposeObject(previewModel);
      }

      previewModel = built.model;
      previewMixer = built.mixer;
      previewModel.position.y = 0;
      previewScene.add(previewModel);
      message("3D CHARACTER LOADED", 2500);
    } catch (error) {
      console.warn("BUNER MOBILE: GLB preview failed; using fallback.", error);
      message("3D MODEL UNAVAILABLE — USING FALLBACK", 3000);
    }
  }

  function resizePreview() {
    if (!previewRenderer || !previewCamera || !ui.preview) return;
    const width = Math.max(1, ui.preview.clientWidth);
    const height = Math.max(1, ui.preview.clientHeight);
    previewRenderer.setSize(width, height, false);
    previewCamera.aspect = width / height;
    previewCamera.updateProjectionMatrix();
  }

  function previewLoop() {
    if (!previewRenderer || !previewScene) return;
    requestAnimationFrame(previewLoop);

    const delta = Math.min(previewClock.getDelta(), 0.05);
    if (previewModel) previewModel.rotation.y += 0.003;
    if (previewMixer) previewMixer.update(delta);

    previewRenderer.render(previewScene, previewCamera);
  }

  // ----------------- WORLD BUILDING -----------------

  function addBox(x, y, z, sx, sy, sz, color, solid = true) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(sx, sy, sz),
      new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    if (solid) {
      collisionObjects.push({
        x,
        z,
        rx: sx / 2 + 0.35,
        rz: sz / 2 + 0.35
      });
    }
    return mesh;
  }

  function addTree(x, z, size = 1) {
    const palette = MAPS[state.map];
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12 * size, 0.18 * size, 1.5 * size, 7),
      new THREE.MeshStandardMaterial({ color: 0x57402a })
    );
    trunk.position.set(x, 0.75 * size, z);
    trunk.castShadow = true;
    scene.add(trunk);

    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(0.8 * size, 2.1 * size, 8),
      new THREE.MeshStandardMaterial({ color: palette.tree, roughness: 0.95 })
    );
    crown.position.set(x, 2 * size, z);
    crown.castShadow = true;
    scene.add(crown);

    collisionObjects.push({ x, z, rx: 0.45 * size, rz: 0.45 * size });
  }

  function addHouse(x, z, color) {
    addBox(x, 1.25, z, 5, 2.5, 5, color, true);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(4, 1.8, 4),
      new THREE.MeshStandardMaterial({ color: 0x54483c })
    );
    roof.position.set(x, 3.3, z);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    scene.add(roof);

    // Visual door and windows.
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.7, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x3c2b20 })
    );
    door.position.set(x, 0.85, z + 2.54);
    scene.add(door);

    for (const side of [-1, 1]) {
      const windowMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.65, 0.09),
        new THREE.MeshStandardMaterial({
          color: 0x5e8e9c,
          metalness: 0.15,
          roughness: 0.2
        })
      );
      windowMesh.position.set(x + side * 1.35, 1.55, z + 2.55);
      scene.add(windowMesh);
    }
  }

  function createTerrain() {
    const palette = MAPS[state.map];
    const geometry = new THREE.PlaneGeometry(220, 220, 70, 70);
    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      let h = Math.sin(x * 0.045) * Math.cos(z * 0.035) * 1.7;
      h += Math.sin(z * 0.09 + x * 0.02) * 0.45;
      if (state.map === "desert") h *= 0.55;
      positions.setY(i, h);
    }
    geometry.computeVertexNormals();

    terrain = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: palette.ground,
        roughness: 1
      })
    );
    terrain.receiveShadow = true;
    scene.add(terrain);

    // Main road.
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 170),
      new THREE.MeshStandardMaterial({ color: palette.road, roughness: 1 })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.06, -30);
    road.receiveShadow = true;
    scene.add(road);
  }

  function createWorld() {
    cleanupWorld();
    worldToken++;
    const token = worldToken;
    state.health = 100;
    state.ammo = WEAPONS[state.weapon].ammo;
    state.maxAmmo = state.ammo;
    state.yaw = 0;
    state.pitch = -0.12;
    state.moveX = 0;
    state.moveY = 0;
    verticalPosition = 0;
    jumpVelocity = 0;
    grounded = true;
    collisionObjects = [];
    targets = [];

    scene = new THREE.Scene();
    const palette = MAPS[state.map];
    scene.background = new THREE.Color(palette.sky);
    scene.fog = new THREE.Fog(palette.sky, 55, 190);

    camera = new THREE.PerspectiveCamera(
      70,
      ui.canvas.clientWidth / Math.max(1, ui.canvas.clientHeight),
      0.1,
      250
    );

    renderer = new THREE.WebGLRenderer({
      antialias: state.graphics === "high",
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, state.graphics === "high" ? 1.5 : 1));
    renderer.shadowMap.enabled = state.graphics === "high";
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setSize(ui.canvas.clientWidth, ui.canvas.clientHeight);
    ui.canvas.replaceChildren(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xe6f0ff, 0x3c4933, 1.9));

    const sun = new THREE.DirectionalLight(0xffedce, 2.3);
    sun.position.set(35, 60, 20);
    sun.castShadow = state.graphics === "high";
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);

    createTerrain();

    // Village buildings.
    [
      [-18, -20], [19, -25], [-24, -36], [24, -43],
      [-14, -52], [17, -61], [-32, -12], [33, -17]
    ].forEach(([x, z], i) => {
      addHouse(x, z, i % 2 ? 0xa99a7b : palette.building);
    });

    // Forest / valley vegetation.
    const treeCount = state.graphics === "high" ? 95 : 48;
    for (let i = 0; i < treeCount; i++) {
      const x = (Math.random() - 0.5) * 180;
      const z = (Math.random() - 0.5) * 180;
      if (Math.abs(x) < 8 && z < 20 && z > -90) continue;
      addTree(x, z, 0.65 + Math.random() * 0.8);
    }

    // Hills / rocks.
    for (let i = 0; i < 22; i++) {
      const x = (Math.random() - 0.5) * 190;
      const z = -35 - Math.random() * 95;
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(2 + Math.random() * 5, 1),
        new THREE.MeshStandardMaterial({
          color: state.map === "desert" ? 0x998366 : 0x586452,
          roughness: 1
        })
      );
      rock.position.set(x, 0.5, z);
      rock.scale.y = 0.7;
      rock.castShadow = true;
      scene.add(rock);
      collisionObjects.push({ x, z, rx: 2.2, rz: 2.2 });
    }

    // Target dummies to give the shooting loop something to hit.
    for (let i = 0; i < 8; i++) {
      const target = createTarget(-35 + i * 10, -38 - (i % 3) * 8);
      targets.push(target);
    }

    playerRoot = new THREE.Group();
    playerRoot.position.set(0, 0, 5);
    scene.add(playerRoot);

    playerBody = createFallbackCharacter();
    playerRoot.add(playerBody);

    gunRoot = createGun();
    gunRoot.position.set(0.34, 1.15, -0.55);
    playerRoot.add(gunRoot);

    loadBattleGLB(token);

    updateHUD();
    resizeGame();
    clock = new THREE.Clock();
    state.lastTime = performance.now();
    raf = requestAnimationFrame(gameLoop);
  }

  function createTarget(x, z) {
    const target = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.34, 1.1, 8),
      new THREE.MeshStandardMaterial({ color: 0x873e34 })
    );
    body.position.y = 0.8;
    target.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xd6b293 })
    );
    head.position.y = 1.55;
    target.add(head);

    target.position.set(x, 0, z);
    target.userData = { health: 100, alive: true };
    scene.add(target);
    return target;
  }

  async function loadBattleGLB(token) {
    const rootAtRequest = playerRoot;

    try {
      const gltf = await loadGLB();
      const built = makeAnimatedClone(gltf);

      if (token !== worldToken || rootAtRequest !== playerRoot) {
        disposeObject(built.model);
        return;
      }

      if (playerBody) {
        playerRoot.remove(playerBody);
        disposeObject(playerBody);
      }

      playerModel = built.model;
      playerMixer = built.mixer;
      playerBody = playerModel;
      playerRoot.add(playerModel);

      // Keep the existing weapon in the player's hand area.
      if (gunRoot) {
        gunRoot.position.set(0.3, 1.05, -0.45);
        playerRoot.add(gunRoot);
      }

      message("YOUR 3D CHARACTER IS READY", 2200);
    } catch (error) {
      console.warn("BUNER MOBILE: Battle GLB failed; fallback character active.", error);
      message("USING BACKUP CHARACTER", 2000);
    }
  }

  // ----------------- WEAPON MODELS -----------------

  function createGun() {
    const group = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({
      color: 0x242927,
      metalness: 0.45,
      roughness: 0.5
    });
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x4c4639 });

    const type = state.weapon;
    const barrelLength = type === "sniper" ? 1.2 : type === "shotgun" ? 0.55 : 0.75;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(type === "pistol" ? 0.14 : 0.2, 0.17, barrelLength),
      dark
    );
    group.add(body);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, barrelLength, 8),
      dark
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -barrelLength / 2);
    group.add(barrel);

    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.25, 0.13),
      gripMat
    );
    grip.position.set(0, -0.16, 0.08);
    grip.rotation.x = -0.25;
    group.add(grip);

    const magazine = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.28, 0.13),
      dark
    );
    magazine.position.set(0, -0.18, -0.08);
    group.add(magazine);

    muzzleFlash = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffbb46 })
    );
    muzzleFlash.position.set(0, 0.02, -barrelLength - 0.05);
    muzzleFlash.visible = false;
    group.add(muzzleFlash);

    group.userData.barrelLength = barrelLength;
    return group;
  }

  function changeWeapon(type) {
    if (!WEAPONS[type]) return;
    state.weapon = type;
    state.ammo = WEAPONS[type].ammo;
    state.maxAmmo = state.ammo;

    document.querySelectorAll(".weapon-card[data-weapon]").forEach((card) => {
      card.classList.toggle("selected", card.dataset.weapon === type);
    });

    if (gunRoot && playerRoot) {
      playerRoot.remove(gunRoot);
      disposeObject(gunRoot);
      gunRoot = createGun();
      gunRoot.position.set(0.34, 1.15, -0.55);
      playerRoot.add(gunRoot);
    }
    updateHUD();
    message(WEAPONS[type].name + " EQUIPPED");
  }

  // ----------------- SHOOTING -----------------

  function shoot() {
    if (!state.gameActive || state.reloading) return;

    const weapon = WEAPONS[state.weapon];
    const now = performance.now();

    if (now - state.lastShot < weapon.rate) return;
    if (state.ammo <= 0) {
      message("OUT OF AMMO — RELOAD");
      return;
    }

    state.lastShot = now;
    state.ammo--;
    updateHUD();

    if (muzzleFlash) {
      muzzleFlash.visible = true;
      clearTimeout(shoot.flashTimer);
      shoot.flashTimer = setTimeout(() => {
        if (muzzleFlash) muzzleFlash.visible = false;
      }, 65);
    }

    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.x += (Math.random() - 0.5) * weapon.spread;
    direction.y += (Math.random() - 0.5) * weapon.spread;
    direction.z += (Math.random() - 0.5) * weapon.spread;
    direction.normalize();

    const origin = camera.position.clone();
    const raycaster = new THREE.Raycaster(origin, direction, 0, weapon.range);
    const meshes = [];

    targets.forEach((target) => {
      if (target.userData.alive) {
        target.traverse((obj) => {
          if (obj.isMesh) meshes.push(obj);
        });
      }
    });

    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length) {
      let hitObject = hits[0].object;
      let target = hitObject;
      while (target && !target.userData?.alive) target = target.parent;

      if (target && target.userData.alive) {
        target.userData.health -= weapon.damage;
        if (target.userData.health <= 0) {
          target.userData.alive = false;
          target.visible = false;
          message("TARGET ELIMINATED!");
        } else {
          message("HIT!");
        }
      }
    }
  }

  function reload() {
    if (state.reloading || state.ammo === state.maxAmmo) return;
    state.reloading = true;
    message("RELOADING...");
    setTimeout(() => {
      state.ammo = state.maxAmmo;
      state.reloading = false;
      updateHUD();
      message("RELOAD COMPLETE");
    }, state.weapon === "sniper" ? 1800 : 1300);
  }

  function startFiring() {
    if (state.firing) return;
    state.firing = true;
    shoot();
    fireTimer = setInterval(() => {
      if (state.gameActive && state.firing) shoot();
    }, 40);
  }

  function stopFiring() {
    state.firing = false;
    if (fireTimer) clearInterval(fireTimer);
    fireTimer = null;
  }

  // ----------------- CAMERA / MOVEMENT -----------------

  function isBlocked(x, z) {
    for (const obj of collisionObjects) {
      if (Math.abs(x - obj.x) < obj.rx && Math.abs(z - obj.z) < obj.rz) {
        return true;
      }
    }
    return false;
  }

  function updateMovement(delta) {
    if (!playerRoot) return;

    let x = state.moveX;
    let y = state.moveY;

    if (keys.KeyW || keys.ArrowUp) y -= 1;
    if (keys.KeyS || keys.ArrowDown) y += 1;
    if (keys.KeyA || keys.ArrowLeft) x -= 1;
    if (keys.KeyD || keys.ArrowRight) x += 1;

    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }

    const speed = state.crouching ? 2 : state.running ? 8 : 4.4;
    const forward = new THREE.Vector3(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
    const right = new THREE.Vector3(Math.cos(state.yaw), 0, -Math.sin(state.yaw));

    const dx = (right.x * x + forward.x * -y) * speed * delta;
    const dz = (right.z * x + forward.z * -y) * speed * delta;

    const nextX = playerRoot.position.x + dx;
    const nextZ = playerRoot.position.z + dz;

    if (!isBlocked(nextX, playerRoot.position.z)) {
      playerRoot.position.x = THREE.MathUtils.clamp(nextX, -103, 103);
    }
    if (!isBlocked(playerRoot.position.x, nextZ)) {
      playerRoot.position.z = THREE.MathUtils.clamp(nextZ, -103, 103);
    }

    if (grounded && (Math.abs(x) + Math.abs(y) > 0.1)) {
      if (playerBody && playerBody.userData && playerBody.userData.leftLeg) {
        const swing = Math.sin(performance.now() * 0.012) * 0.5;
        playerBody.userData.leftLeg.rotation.x = swing;
        playerBody.userData.rightLeg.rotation.x = -swing;
        playerBody.userData.leftArm.rotation.x = -swing * 0.45;
        playerBody.userData.rightArm.rotation.x = swing * 0.45;
      }
    } else if (playerBody && playerBody.userData && playerBody.userData.leftLeg) {
      playerBody.userData.leftLeg.rotation.x *= 0.85;
      playerBody.userData.rightLeg.rotation.x *= 0.85;
    }

    if (!grounded) {
      jumpVelocity -= 15 * delta;
      verticalPosition += jumpVelocity * delta;
      if (verticalPosition <= 0) {
        verticalPosition = 0;
        jumpVelocity = 0;
        grounded = true;
      }
    }

    playerRoot.position.y = verticalPosition;
    playerRoot.rotation.y = state.yaw;
  }

  function updateCamera() {
    if (!playerRoot || !camera) return;

    const target = playerRoot.position.clone();
    target.y += state.crouching ? 1.15 : 1.55;

    const distance = state.aiming ? 2.4 : 5.2;
    const horizontal = Math.cos(state.pitch) * distance;

    camera.position.set(
      target.x + Math.sin(state.yaw) * horizontal,
      target.y + 0.6 + Math.sin(state.pitch) * distance,
      target.z + Math.cos(state.yaw) * horizontal
    );

    const lookTarget = target.clone();
    lookTarget.x -= Math.sin(state.yaw) * 10;
    lookTarget.z -= Math.cos(state.yaw) * 10;
    lookTarget.y += Math.sin(state.pitch) * 10;
    camera.lookAt(lookTarget);
  }

  function jump() {
    if (!state.gameActive || !grounded) return;
    grounded = false;
    jumpVelocity = 6.4;
    state.jumping = true;
    setTimeout(() => { state.jumping = false; }, 450);
  }

  // ----------------- GAME LOOP -----------------

  function gameLoop(time) {
    if (!state.gameActive || !renderer || !scene || !camera) return;

    const delta = Math.min(clock.getDelta(), 0.05);
    updateMovement(delta);
    updateCamera();

    if (playerMixer) playerMixer.update(delta);

    if (playerBody && playerBody.userData && playerBody.userData.leftLeg) {
      // Procedural fallback animation is handled by updateMovement().
    }

    renderer.render(scene, camera);
    raf = requestAnimationFrame(gameLoop);
  }

  function resizeGame() {
    if (!renderer || !camera || !ui.canvas) return;
    const width = Math.max(1, ui.canvas.clientWidth);
    const height = Math.max(1, ui.canvas.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function cleanupWorld() {
    state.gameActive = false;
    stopFiring();

    if (raf) cancelAnimationFrame(raf);
    raf = 0;

    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer = null;
    }

    if (scene) {
      disposeScene(scene);
      scene.clear();
      scene = null;
    }

    camera = null;
    playerRoot = null;
    playerModel = null;
    playerMixer = null;
    playerBody = null;
    gunRoot = null;
    muzzleFlash = null;
    terrain = null;
    collisionObjects = [];
    targets = [];

    if (ui.canvas) ui.canvas.replaceChildren();
  }

  // ----------------- BATTLE START / EXIT -----------------

  function startBattle() {
    if (countdownTimer) clearInterval(countdownTimer);
    closeModal();

    ui.lobby?.classList.add("hidden");
    ui.game?.classList.remove("hidden");
    state.gameActive = false;

    if (ui.countdown) ui.countdown.classList.remove("hidden");

    createWorld();

    let count = 3;
    if (ui.countdownNumber) ui.countdownNumber.textContent = count;

    countdownTimer = setInterval(() => {
      count--;
      if (ui.countdownNumber) ui.countdownNumber.textContent = count;

      if (count <= 0) {
        clearInterval(countdownTimer);
        countdownTimer = null;
        if (ui.countdown) ui.countdown.classList.add("hidden");
        state.gameActive = true;
        clock = new THREE.Clock();
        raf = requestAnimationFrame(gameLoop);
        message("BATTLE STARTED!");
      }
    }, 800);
  }

  function exitBattle() {
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = null;
    state.gameActive = false;
    if (ui.countdown) ui.countdown.classList.add("hidden");
    cleanupWorld();
    ui.game?.classList.add("hidden");
    ui.lobby?.classList.remove("hidden");
    stopFiring();
    updateHUD();
  }

  // ----------------- LOBBY MENUS -----------------

  function openCharacterMenu() {
    setModal("SELECT CHARACTER", `
      <div class="modal-options">
        <button type="button" data-char="soldier">🪖 SOLDIER</button>
        <button type="button" data-char="scout">🏃 SCOUT</button>
        <button type="button" data-char="ranger">🎯 RANGER</button>
        <p>Your custom GLB model is used when it loads successfully.</p>
      </div>
    `);
  }

  function openEmoteMenu() {
    setModal("EMOTES", `
      <div class="modal-options">
        <button type="button" data-emote="idle">🧍 IDLE</button>
        <button type="button" data-emote="dance">🕺 DANCE</button>
        <button type="button" data-emote="victory">🏆 VICTORY</button>
      </div>
      <p>Emotes use available GLB animations. If the model has no matching clips, its default animation remains active.</p>
    `);
  }

  function openSettings() {
    setModal("SETTINGS", `
      <div class="modal-options">
        <button type="button" data-graphics="high">HIGH GRAPHICS</button>
        <button type="button" data-graphics="low">LOW GRAPHICS — BETTER FPS</button>
        <button type="button" data-sound="on">SOUND ON</button>
        <button type="button" data-sound="off">SOUND OFF</button>
      </div>
      <p>Graphics changes apply to the next battle and preview refresh.</p>
    `);
  }

  function openInventory() {
    setModal("INVENTORY", `
      <div class="modal-options">
        <button type="button">🔫 ${WEAPONS[state.weapon].name}</button>
        <button type="button">🩹 MEDICAL KIT — PROTOTYPE</button>
        <button type="button">🧱 GLOO WALL — PLANNED</button>
      </div>
    `);
  }

  function openLoadout() {
    setModal("WEAPON LOADOUT", `
      <div class="modal-options">
        ${Object.entries(WEAPONS).map(([id, weapon]) =>
          `<button type="button" data-loadout="${id}">${weapon.name}</button>`
        ).join("")}
      </div>
    `);
  }

  function editProfile() {
    setModal("EDIT PROFILE", `
      <label for="profileName">PLAYER NAME</label>
      <input id="profileName" maxlength="16" value="${escapeHTML(state.playerName)}" />
      <button id="saveProfileButton" type="button">SAVE PROFILE</button>
    `);
  }

  function escapeHTML(text) {
    return String(text).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  // ----------------- INPUT BINDINGS -----------------

  function bindButton(id, callback) {
    const element = $(id);
    if (element) element.addEventListener("click", callback);
  }

  function bindInputs() {
    bindButton("startButton", startBattle);
    bindButton("exitButton", exitBattle);
    bindButton("closeModal", closeModal);
    bindButton("characterButton", openCharacterMenu);
    bindButton("emoteButton", openEmoteMenu);
    bindButton("settingsButton", openSettings);
    bindButton("inventoryButton", openInventory);
    bindButton("loadoutButton", openLoadout);
    bindButton("editProfile", editProfile);

    document.querySelectorAll(".weapon-card[data-weapon]").forEach((button) => {
      button.addEventListener("click", () => changeWeapon(button.dataset.weapon));
    });

    document.querySelectorAll(".map-card[data-map]").forEach((button) => {
      button.addEventListener("click", () => {
        state.map = button.dataset.map;
        document.querySelectorAll(".map-card[data-map]").forEach((card) => {
          card.classList.toggle("selected", card === button);
        });
        updateHUD();
      });
    });

    bindButton("jumpButton", jump);

    bindButton("runButton", () => {
      state.running = !state.running;
      $("runButton")?.classList.toggle("selected", state.running);
    });

    bindButton("crouchButton", () => {
      state.crouching = !state.crouching;
      $("crouchButton")?.classList.toggle("selected", state.crouching);
    });

    bindButton("aimButton", () => {
      state.aiming = !state.aiming;
      $("aimButton")?.classList.toggle("selected", state.aiming);
    });

    bindButton("reloadButton", reload);

    const fireButton = $("fireButton");
    if (fireButton) {
      fireButton.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        startFiring();
      });
      ["pointerup", "pointercancel", "pointerleave"].forEach((type) => {
        fireButton.addEventListener(type, stopFiring);
      });
    }

    // Desktop / keyboard movement.
    window.addEventListener("keydown", (event) => {
      keys[event.code] = true;
      if (event.code === "Space") {
        event.preventDefault();
        jump();
      }
      if (event.code === "KeyR") reload();
      if (event.code === "KeyF") startFiring();
      if (event.code === "ShiftLeft" || event.code === "ShiftRight") state.running = true;
    });

    window.addEventListener("keyup", (event) => {
      keys[event.code] = false;
      if (event.code === "KeyF") stopFiring();
      if (event.code === "ShiftLeft" || event.code === "ShiftRight") state.running = false;
    });

    // Joystick.
    if (ui.joystick && ui.joystickKnob) {
      ui.joystick.addEventListener("pointerdown", (event) => {
        joystickPointer = event.pointerId;
        ui.joystick.setPointerCapture?.(event.pointerId);
        joystickRect = ui.joystick.getBoundingClientRect();
        updateJoystick(event);
      });

      ui.joystick.addEventListener("pointermove", (event) => {
        if (event.pointerId === joystickPointer) updateJoystick(event);
      });

      const resetJoystick = (event) => {
        if (event.pointerId !== joystickPointer) return;
        joystickPointer = null;
        state.moveX = 0;
        state.moveY = 0;
        ui.joystickKnob.style.transform = "translate(0, 0)";
      };
      ui.joystick.addEventListener("pointerup", resetJoystick);
      ui.joystick.addEventListener("pointercancel", resetJoystick);
    }

    // Right-side drag camera control.
    if (ui.game) {
      ui.game.addEventListener("pointerdown", (event) => {
        if (!state.gameActive) return;
        if (event.target.closest("button, .joystick, .action-buttons")) return;
        const rect = ui.game.getBoundingClientRect();
        if (event.clientX < rect.left + rect.width * 0.45) return;
        lookPointer = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY
        };
        ui.game.setPointerCapture?.(event.pointerId);
      });

      ui.game.addEventListener("pointermove", (event) => {
        if (!lookPointer || event.pointerId !== lookPointer.id) return;
        const dx = event.clientX - lookPointer.x;
        const dy = event.clientY - lookPointer.y;
        state.yaw -= dx * 0.006;
        state.pitch = THREE.MathUtils.clamp(state.pitch - dy * 0.004, -0.9, 0.65);
        lookPointer.x = event.clientX;
        lookPointer.y = event.clientY;
      });

      const endLook = (event) => {
        if (lookPointer && event.pointerId === lookPointer.id) lookPointer = null;
      };
      ui.game.addEventListener("pointerup", endLook);
      ui.game.addEventListener("pointercancel", endLook);
    }

    // Modal actions use delegation so freshly-created buttons work.
    if (ui.modalContent) {
      ui.modalContent.addEventListener("click", (event) => {
        const button = event.target.closest("button");
        if (!button) return;

        if (button.dataset.char) {
          state.character = button.dataset.char;
          closeModal();
          message(state.character.toUpperCase() + " SELECTED");
        }

        if (button.dataset.emote) {
          state.emote = button.dataset.emote;
          const clips = previewModel?.userData?.animations;
          if (previewMixer && clips?.length) {
            const clip = clips.find((item) =>
              item.name.toLowerCase().includes(state.emote)
            );
            if (clip) {
              previewMixer.stopAllAction();
              previewMixer.clipAction(clip).reset().play();
            }
          }
          closeModal();
          message(state.emote.toUpperCase() + " EMOTE");
        }

        if (button.dataset.graphics) {
          state.graphics = button.dataset.graphics;
          closeModal();
          initPreview();
          message(state.graphics.toUpperCase() + " GRAPHICS SELECTED");
        }

        if (button.dataset.loadout) {
          changeWeapon(button.dataset.loadout);
          closeModal();
        }

        if (button.dataset.sound) {
          state.sound = button.dataset.sound === "on";
          closeModal();
          message("SOUND " + button.dataset.sound.toUpperCase());
        }
      });

      ui.modalContent.addEventListener("click", (event) => {
        if (event.target.id === "saveProfileButton") {
          const input = $("profileName");
          const value = input?.value.trim();
          if (value) state.playerName = value.slice(0, 16);
          updateHUD();
          closeModal();
        }
      });
    }

    // Drag preview rotation.
    let previewDrag = null;
    if (ui.preview) {
      ui.preview.addEventListener("pointerdown", (event) => {
        previewDrag = { id: event.pointerId, x: event.clientX };
        ui.preview.setPointerCapture?.(event.pointerId);
      });
      ui.preview.addEventListener("pointermove", (event) => {
        if (!previewDrag || event.pointerId !== previewDrag.id || !previewModel) return;
        previewModel.rotation.y += (event.clientX - previewDrag.x) * 0.01;
        previewDrag.x = event.clientX;
      });
      ui.preview.addEventListener("pointerup", () => { previewDrag = null; });
      ui.preview.addEventListener("pointercancel", () => { previewDrag = null; });
    }

    window.addEventListener("resize", () => {
      resizePreview();
      resizeGame();
    });
  }

  function updateJoystick(event) {
    if (!joystickRect || !ui.joystickKnob) return;
    const cx = joystickRect.left + joystickRect.width / 2;
    const cy = joystickRect.top + joystickRect.height / 2;
    const max = joystickRect.width * 0.32;
    let dx = event.clientX - cx;
    let dy = event.clientY - cy;
    const length = Math.hypot(dx, dy);
    if (length > max) {
      dx = (dx / length) * max;
      dy = (dy / length) * max;
    }
    state.moveX = dx / max;
    state.moveY = dy / max;
    ui.joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  // ----------------- STARTUP -----------------

  function init() {
    if (!THREE) {
      console.error("BUNER MOBILE: Three.js is missing.");
      message("3D ENGINE FAILED TO LOAD");
      return;
    }

    bindInputs();
    initPreview();
    updateHUD();

    console.log("BUNER MOBILE GLB EDITION READY");
  }

  init();

})();