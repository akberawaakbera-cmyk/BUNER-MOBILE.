(() => {
  "use strict";

  if (window.__BUNER_MOBILE_GLB_READY__) return;
  window.__BUNER_MOBILE_GLB_READY__ = true;

  const $ = (id) => document.getElementById(id);
  const THREE = window.THREE;
  const MODEL_PATH = "./assets/characters/model_E06A91C3-7469-4FE0-918B-26317C457A5A.glb";

  if (!THREE) {
    console.error("BUNER MOBILE: Three.js was not found. Load Three.js before game.js.");
    return;
  }

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
    emote: "idle",
    selectedInventory: "rifle"
  };

  const WEAPONS = {
    rifle: {
      name: "ASSAULT RIFLE",
      damage: 20,
      rate: 160,
      ammo: 30,
      spread: 0.025,
      range: 90,
      color: 0x30363b
    },
    sniper: {
      name: "SNIPER",
      damage: 90,
      rate: 900,
      ammo: 5,
      spread: 0.004,
      range: 180,
      color: 0x353b42
    },
    shotgun: {
      name: "SHOTGUN",
      damage: 12,
      rate: 650,
      ammo: 8,
      spread: 0.15,
      range: 24,
      color: 0x4b3828
    },
    smg: {
      name: "SMG",
      damage: 12,
      rate: 85,
      ammo: 35,
      spread: 0.045,
      range: 60,
      color: 0x33383d
    },
    pistol: {
      name: "PISTOL",
      damage: 25,
      rate: 300,
      ammo: 12,
      spread: 0.02,
      range: 45,
      color: 0x22272b
    }
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

  const CHARACTERS = [
    {
      id: "soldier",
      name: "FIELD SOLDIER",
      role: "ASSAULT",
      model: MODEL_PATH,
      unlocked: true,
      description: "Your custom GLB fighter model."
    },
    {
      id: "scout",
      name: "SHADOW SCOUT",
      role: "RECON",
      model: null,
      unlocked: false,
      description: "Fast reconnaissance character. Character asset not added yet."
    },
    {
      id: "ranger",
      name: "ELITE RANGER",
      role: "SNIPER",
      model: null,
      unlocked: false,
      description: "Precision specialist. Character asset not added yet."
    },
    {
      id: "guardian",
      name: "IRON GUARDIAN",
      role: "DEFENDER",
      model: null,
      unlocked: false,
      description: "Heavy defensive fighter. Character asset not added yet."
    }
  ];

  const ui = {
    lobby: $("lobby"),
    gameScreen: $("gameScreen"),
    canvas: $("gameCanvas"),
    modal: $("modal"),
    modalTitle: $("modalTitle"),
    modalContent: $("modalContent"),
    previewCanvas: $("characterPreviewCanvas"),
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

  let scene, camera, renderer, clock;
  let playerRoot, playerBody, gunRoot, muzzleFlash, terrain;
  let worldToken = 0;

  let previewScene, previewCamera, previewRenderer;
  let previewModel, previewMixer, previewRAF = 0;

  let charScene, charCamera, charRenderer;
  let charModel, charMixer, charRAF = 0, charToken = 0;

  let raf = 0;
  let messageTimer = 0;
  let reloadTimer = 0;
  let fireTimer = 0;

  let keys = Object.create(null);
  let mixers = [];
  let targets = [];
  let collisionObjects = [];
  let worldObjects = [];
  let fallbackParts = null;

  let dragLook = false;
  let lastPointerX = 0;
  let lastPointerY = 0;

  let jumpVelocity = 0;
  let playerOnGround = true;
  let cameraDistance = 5.5;

  const v3 = (x = 0, y = 0, z = 0) =>
    new THREE.Vector3(x, y, z);

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
  }

  function message(text, duration = 1800) {
    if (!ui.message) return;

    ui.message.textContent = text;
    ui.message.classList.remove("hidden");

    clearTimeout(messageTimer);

    messageTimer = setTimeout(() => {
      ui.message.classList.add("hidden");
    }, duration);
  }

  function selectedCharacter() {
    return CHARACTERS.find(c => c.id === state.character) || CHARACTERS[0];
  }

  function setModal(title, html) {
    if (!ui.modal) return;

    if (ui.modalTitle) ui.modalTitle.textContent = title;
    if (ui.modalContent) ui.modalContent.innerHTML = html;

    ui.modal.classList.remove("hidden");
  }

  function closeModal() {
    if (ui.modal) ui.modal.classList.add("hidden");
  }

  function updateHUD() {
    if (ui.healthBar) {
      ui.healthBar.style.width = `${Math.max(0, state.health)}%`;
    }

    if (ui.healthText) {
      ui.healthText.textContent = `${Math.max(0, Math.round(state.health))}`;
    }

    if (ui.weaponText) {
      ui.weaponText.textContent =
        WEAPONS[state.weapon]?.name || "ASSAULT RIFLE";
    }

    if (ui.ammoText) {
      ui.ammoText.textContent = `${state.ammo} / ${state.maxAmmo}`;
    }

    const name = $("playerName");

    if (name && !name.dataset.edited) {
      name.value = state.playerName;
    }

    const mapName = $("selectedMapName");

    if (mapName) {
      mapName.textContent = MAPS[state.map]?.name || MAPS.buner.name;
    }

    document.querySelectorAll(".weapon-card[data-weapon]").forEach(el => {
      el.classList.toggle("selected", el.dataset.weapon === state.weapon);
    });

    document.querySelectorAll(".map-card[data-map]").forEach(el => {
      el.classList.toggle("selected", el.dataset.map === state.map);
    });

    const status = $("playerStatus");

    if (status) {
      status.textContent = selectedCharacter().name;
    }
  }

  // =====================================================
  // GLB CHARACTER LOADER
  // =====================================================

  let loaderPromise;

  async function getGLTFLoader() {
    if (!loaderPromise) {
      loaderPromise = import(
        "https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js"
      ).then(m => new m.GLTFLoader());
    }

    return loaderPromise;
  }

  async function loadGLB(path = MODEL_PATH) {
    if (!path) {
      throw new Error("No model path configured");
    }

    const loader = await getGLTFLoader();

    return new Promise((resolve, reject) => {
      loader.load(path, resolve, undefined, reject);
    });
  }

  function normalizeModel(model, desiredHeight = 1.8) {
    model.updateMatrixWorld(true);

    let box = new THREE.Box3().setFromObject(model);
    let size = box.getSize(v3());

    const h = size.y || 1;

    model.scale.multiplyScalar(desiredHeight / h);
    model.updateMatrixWorld(true);

    box = new THREE.Box3().setFromObject(model);

    const center = box.getCenter(v3());

    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box.min.y;

    model.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;

        if (o.material) {
          o.material = Array.isArray(o.material)
            ? o.material.map(m => m.clone())
            : o.material.clone();
        }
      }
    });

    return model;
  }

  function disposeObject(obj) {
    if (!obj) return;

    obj.traverse?.(o => {
      if (o.geometry) o.geometry.dispose();

      if (o.material) {
        const materials = Array.isArray(o.material)
          ? o.material
          : [o.material];

        materials.forEach(m => {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      }
    });
  }

  // =====================================================
  // FALLBACK SOLDIER
  // =====================================================

  function makeFallbackCharacter() {
    const root = new THREE.Group();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x596b4d,
      roughness: 0.88
    });

    const dark = new THREE.MeshStandardMaterial({
      color: 0x303b31,
      roughness: 0.9
    });

    const skin = new THREE.MeshStandardMaterial({
      color: 0xb78d6a,
      roughness: 0.9
    });

    const helmet = new THREE.MeshStandardMaterial({
      color: 0x34452f,
      roughness: 0.8
    });

    function part(geo, material, pos, parent = root) {
      const m = new THREE.Mesh(geo, material);

      m.position.set(...pos);
      m.castShadow = true;
      m.receiveShadow = true;

      parent.add(m);

      return m;
    }

    part(
      new THREE.BoxGeometry(0.58, 0.68, 0.32),
      mat,
      [0, 1.05, 0]
    );

    part(
      new THREE.SphereGeometry(0.19, 12, 10),
      skin,
      [0, 1.58, 0]
    );

    part(
      new THREE.SphereGeometry(0.205, 12, 8),
      helmet,
      [0, 1.69, 0]
    );

    const leftArm = part(
      new THREE.BoxGeometry(0.18, 0.62, 0.2),
      mat,
      [-0.39, 1.08, 0]
    );

    const rightArm = part(
      new THREE.BoxGeometry(0.18, 0.62, 0.2),
      mat,
      [0.39, 1.08, 0]
    );

    const leftLeg = part(
      new THREE.BoxGeometry(0.22, 0.62, 0.24),
      dark,
      [-0.17, 0.35, 0]
    );

    const rightLeg = part(
      new THREE.BoxGeometry(0.22, 0.62, 0.24),
      dark,
      [0.17, 0.35, 0]
    );

    part(
      new THREE.BoxGeometry(0.26, 0.12, 0.42),
      dark,
      [-0.17, 0.06, -0.04]
    );

    part(
      new THREE.BoxGeometry(0.26, 0.12, 0.42),
      dark,
      [0.17, 0.06, -0.04]
    );

    root.userData.parts = {
      leftArm,
      rightArm,
      leftLeg,
      rightLeg
    };

    return root;
  }

  function cloneCharacterVisual(gltf) {
    const model = normalizeModel(gltf.scene.clone(true));

    const mixer = gltf.animations?.length
      ? new THREE.AnimationMixer(model)
      : null;

    if (mixer && gltf.animations.length) {
      const idle =
        gltf.animations.find(a => /idle|stand/i.test(a.name)) ||
        gltf.animations[0];

      mixer.clipAction(idle).play();
    }

    return {
      model,
      mixer,
      animations: gltf.animations || []
    };
  }

  // =====================================================
  // LIGHTING
  // =====================================================

  function addLighting(s, sky = 0x9abbd0) {
    s.background = new THREE.Color(sky);
    s.fog = new THREE.Fog(sky, 65, 190);

    const hemi = new THREE.HemisphereLight(
      0xe7f2ff,
      0x596344,
      2.0
    );

    s.add(hemi);

    const sun = new THREE.DirectionalLight(0xffedcf, 2.4);

    sun.position.set(-25, 45, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);

    s.add(sun);
  }

  // =====================================================
  // LOBBY CHARACTER PREVIEW
  // =====================================================

  function initPreview() {
    if (!ui.previewCanvas) return;

    try {
      previewScene = new THREE.Scene();

      addLighting(previewScene, 0x182a31);

      previewCamera = new THREE.PerspectiveCamera(
        35,
        1,
        0.1,
        100
      );

      previewCamera.position.set(0, 1.5, 4.5);
      previewCamera.lookAt(0, 1, 0);

      previewRenderer = new THREE.WebGLRenderer({
        canvas: ui.previewCanvas,
        alpha: true,
        antialias: state.graphics === "high"
      });

      previewRenderer.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, 1.6)
      );

      previewRenderer.setSize(
        ui.previewCanvas.clientWidth || 300,
        ui.previewCanvas.clientHeight || 300,
        false
      );

      previewRenderer.shadowMap.enabled = true;

      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(1.25, 32),
        new THREE.MeshStandardMaterial({
          color: 0x53654c,
          roughness: 1
        })
      );

      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.02;

      previewScene.add(floor);

      previewModel = makeFallbackCharacter();
      previewScene.add(previewModel);

      loadGLB(MODEL_PATH)
        .then(gltf => {
          if (!previewScene) return;

          const built = cloneCharacterVisual(gltf);

          if (previewModel) {
            previewScene.remove(previewModel);
            disposeObject(previewModel);
          }

          previewModel = built.model;
          previewMixer = built.mixer;

          previewScene.add(previewModel);
        })
        .catch(() => {
          console.warn("GLB preview unavailable; using fallback soldier.");
        });

      cancelAnimationFrame(previewRAF);

      const loop = () => {
        previewRAF = requestAnimationFrame(loop);

        if (previewModel) {
          previewModel.rotation.y += 0.002;
        }

        if (previewMixer) {
          previewMixer.update(0.016);
        }

        previewRenderer?.render(previewScene, previewCamera);
      };

      loop();
    } catch (e) {
      console.warn("Preview init failed", e);
    }
  }

  // =====================================================
  // CHARACTER SELECTION SCREEN
  // =====================================================

  function injectCharacterCSS() {
    if ($("bunerCharacterCSS")) return;

    const style = document.createElement("style");
    style.id = "bunerCharacterCSS";

    style.textContent = `
      #characterSelectOverlay {
        position:fixed;
        inset:0;
        z-index:9999;
        background:rgba(5,10,12,.97);
        color:#f4f7f2;
        display:none;
        overflow:auto;
        font-family:inherit;
        padding:18px;
        box-sizing:border-box;
      }

      #characterSelectOverlay.open {
        display:block;
      }

      .bcs-head {
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
        max-width:1000px;
        margin:0 auto 14px;
      }

      .bcs-title {
        font-weight:900;
        font-size:clamp(20px,4vw,32px);
        letter-spacing:2px;
      }

      .bcs-close,
      .bcs-btn {
        border:1px solid #8fae54;
        background:#18251b;
        color:#f5ffe9;
        border-radius:10px;
        padding:12px 16px;
        font-weight:800;
        cursor:pointer;
        min-height:44px;
      }

      .bcs-layout {
        display:grid;
        grid-template-columns:minmax(0,1fr) minmax(0,1fr);
        gap:16px;
        max-width:1000px;
        margin:auto;
      }

      .bcs-preview {
        min-height:300px;
        border:1px solid #40523a;
        border-radius:16px;
        background:radial-gradient(ellipse at center,#293b2c,#101819 70%);
        display:flex;
        flex-direction:column;
        overflow:hidden;
      }

      .bcs-preview canvas {
        width:100%;
        height:280px;
        display:block;
      }

      .bcs-info {
        padding:14px;
        border-top:1px solid #40523a;
      }

      .bcs-role {
        color:#b6dc6b;
        font-size:12px;
        letter-spacing:2px;
      }

      .bcs-name {
        font-size:23px;
        font-weight:900;
        margin:4px 0;
      }

      .bcs-desc {
        color:#bdc7bb;
        font-size:14px;
        line-height:1.5;
      }

      .bcs-cards {
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:10px;
        align-content:start;
      }

      .bcs-card {
        background:#131b18;
        border:1px solid #39453b;
        border-radius:13px;
        padding:14px;
        text-align:left;
        color:#e9f0e5;
        min-height:112px;
        cursor:pointer;
      }

      .bcs-card.active {
        border:2px solid #b6dc6b;
        background:#263321;
      }

      .bcs-card.locked {
        opacity:.62;
      }

      .bcs-card strong {
        display:block;
        margin-bottom:7px;
        font-size:15px;
      }

      .bcs-card span {
        display:block;
        color:#aebbad;
        font-size:12px;
      }

      .bcs-bottom {
        grid-column:1/-1;
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        align-items:center;
      }

      .bcs-note {
        color:#b7c1b4;
        font-size:12px;
        flex:1;
        min-width:180px;
      }

      .bcs-btn.primary {
        background:#b6dc6b;
        color:#152014;
        border-color:#b6dc6b;
      }

      .bcs-btn:disabled {
        opacity:.4;
        cursor:not-allowed;
      }

      @media(max-width:650px) {
        #characterSelectOverlay {
          padding:12px;
        }

        .bcs-layout {
          grid-template-columns:1fr;
        }

        .bcs-preview {
          min-height:250px;
        }

        .bcs-preview canvas {
          height:220px;
        }

        .bcs-cards {
          grid-template-columns:repeat(2,minmax(0,1fr));
        }

        .bcs-name {
          font-size:20px;
        }
      }
    `;

    document.head.appendChild(style);

    const overlay = document.createElement("div");

    overlay.id = "characterSelectOverlay";

    overlay.innerHTML = `
      <div class="bcs-head">
        <div>
          <div class="bcs-title">CHARACTER SELECT</div>
          <div style="color:#9eac9d;font-size:12px;margin-top:4px">
            BUNER MOBILE • LOADOUT
          </div>
        </div>

        <button class="bcs-close" id="bcsClose" type="button">
          ✕ CLOSE
        </button>
      </div>

      <div class="bcs-layout">
        <section class="bcs-preview">
          <canvas id="bcsCanvas"></canvas>

          <div class="bcs-info">
            <div class="bcs-role" id="bcsRole">ASSAULT</div>
            <div class="bcs-name" id="bcsName">FIELD SOLDIER</div>
            <div class="bcs-desc" id="bcsDesc"></div>
          </div>
        </section>

        <section class="bcs-cards" id="bcsCards"></section>

        <div class="bcs-bottom">
          <div class="bcs-note" id="bcsNote">
            Select a character to preview it.
          </div>

          <button class="bcs-btn" id="bcsBack" type="button">
            BACK
          </button>

          <button class="bcs-btn primary" id="bcsSelect" type="button">
            USE CHARACTER
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    $("bcsClose").addEventListener(
      "click",
      closeCharacterSelection
    );

    $("bcsBack").addEventListener(
      "click",
      closeCharacterSelection
    );

    $("bcsSelect").addEventListener("click", () => {
      const c = selectedCharacter();

      if (!c.unlocked) {
        message("This character needs its own model asset.");
        return;
      }

      closeCharacterSelection();
      updateHUD();
      message(`${c.name} selected`);
    });

    $("bcsCards").addEventListener("click", e => {
      const card = e.target.closest("[data-char-select]");

      if (!card) return;

      const c = CHARACTERS.find(
        x => x.id === card.dataset.charSelect
      );

      if (!c) return;

      state.character = c.id;

      renderCharacterCards();
      loadCharacterSelectionPreview();
      updateHUD();
    });
  }

  function renderCharacterCards() {
    const cards = $("bcsCards");

    if (!cards) return;

    cards.innerHTML = CHARACTERS.map(c => `
      <button
        type="button"
        class="bcs-card ${state.character === c.id ? "active" : ""} ${c.unlocked ? "" : "locked"}"
        data-char-select="${c.id}"
      >
        <strong>
          ${c.unlocked ? "🪖" : "🔒"}
          ${escapeHTML(c.name)}
        </strong>

        <span>
          ${escapeHTML(c.role)} •
          ${c.unlocked ? "AVAILABLE" : "LOCKED / ASSET NEEDED"}
        </span>
      </button>
    `).join("");

    const c = selectedCharacter();

    $("bcsRole").textContent = c.role;
    $("bcsName").textContent = c.name;
    $("bcsDesc").textContent = c.description;

    $("bcsSelect").disabled = !c.unlocked;

    $("bcsSelect").textContent = c.unlocked
      ? "USE CHARACTER"
      : "MODEL REQUIRED";

    $("bcsNote").textContent = c.unlocked
      ? "This character will be used in the lobby and battle if the GLB file loads successfully."
      : "This character is a preview card only. Add a GLB asset and path to enable it.";
  }

  function openCharacterSelection() {
    injectCharacterCSS();
    closeModal();

    $("characterSelectOverlay").classList.add("open");

    renderCharacterCards();
    loadCharacterSelectionPreview();
  }

  function closeCharacterSelection() {
    const overlay = $("characterSelectOverlay");

    if (overlay) {
      overlay.classList.remove("open");
    }

    cancelAnimationFrame(charRAF);
    charRAF = 0;
    charToken++;

    if (charRenderer) {
      charRenderer.dispose();
      charRenderer = null;
    }

    if (charModel) {
      disposeObject(charModel);
      charModel = null;
    }

    charScene = null;
    charMixer = null;
  }

  async function loadCharacterSelectionPreview() {
    injectCharacterCSS();

    cancelAnimationFrame(charRAF);

    charToken++;

    const token = charToken;

    if (charRenderer) {
      charRenderer.dispose();
      charRenderer = null;
    }

    if (charModel) {
      disposeObject(charModel);
      charModel = null;
    }

    charMixer = null;

    const canvas = $("bcsCanvas");

    if (!canvas) return;

    try {
      charScene = new THREE.Scene();

      addLighting(charScene, 0x17241f);

      charCamera = new THREE.PerspectiveCamera(
        36,
        1,
        0.1,
        50
      );

      charCamera.position.set(0, 1.5, 4.4);
      charCamera.lookAt(0, 1, 0);

      charRenderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: state.graphics === "high"
      });

      charRenderer.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, 1.5)
      );

      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(1.15, 32),
        new THREE.MeshStandardMaterial({
          color: 0x48573c,
          roughness: 1
        })
      );

      floor.rotation.x = -Math.PI / 2;

      charScene.add(floor);

      const size = () => {
        if (!charRenderer) return;

        const w = canvas.clientWidth || 300;
        const h = canvas.clientHeight || 250;

        charRenderer.setSize(w, h, false);

        charCamera.aspect = w / h;
        charCamera.updateProjectionMatrix();
      };

      size();

      charModel = makeFallbackCharacter();
      charScene.add(charModel);

      const c = selectedCharacter();

      if (c.unlocked && c.model) {
        try {
          const gltf = await loadGLB(c.model);

          if (
            token !== charToken ||
            !$("characterSelectOverlay")?.classList.contains("open")
          ) {
            return;
          }

          const built = cloneCharacterVisual(gltf);

          if (charModel) {
            charScene.remove(charModel);
            disposeObject(charModel);
          }

          charModel = built.model;
          charMixer = built.mixer;

          charScene.add(charModel);
        } catch (e) {
          if (token === charToken) {
            $("bcsDesc").textContent =
              c.description +
              " GLB load failed; showing fallback soldier.";
          }
        }
      }

      const loop = () => {
        if (
          token !== charToken ||
          !$("characterSelectOverlay")?.classList.contains("open")
        ) {
          return;
        }

        charRAF = requestAnimationFrame(loop);

        if (charModel) {
          charModel.rotation.y += 0.003;
        }

        if (charMixer) {
          charMixer.update(0.016);
        }

        charRenderer?.render(charScene, charCamera);
      };

      loop();
    } catch (e) {
      console.warn("Character selection preview failed", e);
    }
  }

  // =====================================================
  // WORLD OBJECTS
  // =====================================================

  function addBox(w, h, d, x, y, z, color, collide = true) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.95
      })
    );

    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    scene.add(mesh);
    worldObjects.push(mesh);

    if (collide) {
      collisionObjects.push({
        x,
        z,
        rx: w / 2 + 0.45,
        rz: d / 2 + 0.45,
        minY: y - h / 2,
        maxY: y + h / 2
      });
    }

    return mesh;
  }

  function addTree(x, z, scale = 1) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.18 * scale,
        0.25 * scale,
        1.7 * scale,
        7
      ),
      new THREE.MeshStandardMaterial({
        color: 0x5b4630
      })
    );

    trunk.position.set(x, 0.85 * scale, z);
    trunk.castShadow = true;

    scene.add(trunk);
    worldObjects.push(trunk);

    const foliage = new THREE.Mesh(
      new THREE.ConeGeometry(0.95 * scale, 2.3 * scale, 8),
      new THREE.MeshStandardMaterial({
        color: MAPS[state.map].tree,
        roughness: 1
      })
    );

    foliage.position.set(x, 2.25 * scale, z);
    foliage.castShadow = true;

    scene.add(foliage);
    worldObjects.push(foliage);

    collisionObjects.push({
      x,
      z,
      rx: 0.48 * scale,
      rz: 0.48 * scale,
      minY: 0,
      maxY: 3.5 * scale
    });
  }

  function addHouse(x, z, color) {
    addBox(8, 3.4, 7, x, 1.7, z, color, true);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(5.8, 2.2, 4),
      new THREE.MeshStandardMaterial({
        color: 0x55473a,
        roughness: 1
      })
    );

    roof.position.set(x, 4.3, z);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1, 0.7, 0.9);
    roof.castShadow = true;

    scene.add(roof);
    worldObjects.push(roof);

    addBox(1.1, 2, 0.12, x, 1, z - 3.56, 0x493729, false);

    addBox(1.15, 1, 0.14, x - 2.3, 2, z - 3.58, 0x8db4c2, false);

    addBox(1.15, 1, 0.14, x + 2.3, 2, z - 3.58, 0x8db4c2, false);
  }

  function createTerrain() {
    const cfg = MAPS[state.map];

    const geo = new THREE.PlaneGeometry(
      220,
      220,
      state.graphics === "high" ? 100 : 48,
      state.graphics === "high" ? 100 : 48
    );

    const p = geo.attributes.position;

    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);

      p.setZ(
        i,
        Math.sin(x * 0.055) * 0.55 +
        Math.cos(y * 0.07) * 0.45 +
        Math.sin((x + y) * 0.03) * 0.3
      );
    }

    geo.computeVertexNormals();

    terrain = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: cfg.ground,
        roughness: 1
      })
    );

    terrain.rotation.x = -Math.PI / 2;
    terrain.receiveShadow = true;

    scene.add(terrain);
    worldObjects.push(terrain);

    addBox(9, 0.08, 180, 0, 0.02, -25, cfg.road, false);

    const houseX = [-18, 19, -24, 24, -14, 17, -32, 33];
    const houseZ = [-20, -25, -36, -43, -52, -61, -12, -17];

    for (let i = 0; i < 8; i++) {
      addHouse(
        houseX[i],
        houseZ[i],
        cfg.building
      );
    }

    const treeCount = state.graphics === "high" ? 95 : 48;

    for (let i = 0; i < treeCount; i++) {
      const x = (Math.random() - 0.5) * 175;
      const z = (Math.random() - 0.5) * 175;

      if (Math.abs(x) < 13 && z > -70 && z < 8) {
        continue;
      }

      addTree(
        x,
        z,
        0.7 + Math.random() * 0.65
      );
    }

    for (let i = 0; i < 22; i++) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(
          0.35 + Math.random() * 0.7,
          0
        ),
        new THREE.MeshStandardMaterial({
          color: 0x77786d,
          roughness: 1
        })
      );

      rock.position.set(
        (Math.random() - 0.5) * 170,
        0.25,
        (Math.random() - 0.5) * 170
      );

      rock.rotation.set(
        Math.random(),
        Math.random(),
        Math.random()
      );

      rock.castShadow = true;

      scene.add(rock);
      worldObjects.push(rock);

      collisionObjects.push({
        x: rock.position.x,
        z: rock.position.z,
        rx: 0.65,
        rz: 0.65,
        minY: 0,
        maxY: 1.5
      });
    }
  }

  function createTarget(x, z) {
    const g = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.5, 1.6, 8),
      new THREE.MeshStandardMaterial({
        color: 0x8a493b
      })
    );

    body.position.y = 1.05;
    g.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 10, 8),
      new THREE.MeshStandardMaterial({
        color: 0xd3b18d
      })
    );

    head.position.y = 2.05;
    g.add(head);

    g.position.set(x, 0, z);

    g.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.userData.isTarget = true;
      }
    });

    scene.add(g);
    worldObjects.push(g);
    targets.push(g);
  }

  // =====================================================
  // WEAPONS
  // =====================================================

  function createGun() {
    if (gunRoot) {
      playerRoot?.remove(gunRoot);
      disposeObject(gunRoot);
    }

    gunRoot = new THREE.Group();

    const cfg = WEAPONS[state.weapon];

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(
        state.weapon === "sniper" ? 1.05 : 0.7,
        0.13,
        0.15
      ),
      new THREE.MeshStandardMaterial({
        color: cfg.color,
        metalness: 0.35,
        roughness: 0.55
      })
    );

    body.position.set(0.34, 1.13, -0.42);
    gunRoot.add(body);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.035,
        0.035,
        state.weapon === "sniper" ? 0.8 : 0.42,
        8
      ),
      new THREE.MeshStandardMaterial({
        color: 0x181c1e,
        metalness: 0.5
      })
    );

    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.48, 1.15, -0.86);
    gunRoot.add(barrel);

    muzzleFlash = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({
        color: 0xffc45c
      })
    );

    muzzleFlash.position.set(0.48, 1.15, -1.1);
    muzzleFlash.visible = false;

    gunRoot.add(muzzleFlash);

    gunRoot.traverse(o => {
      if (o.isMesh) o.castShadow = true;
    });

    playerRoot.add(gunRoot);
  }

  async function loadBattleGLB(token) {
    const c = selectedCharacter();

    if (!c.unlocked || !c.model) return;

    try {
      const gltf = await loadGLB(c.model);

      if (
        token !== worldToken ||
        !scene ||
        !playerRoot
      ) {
        return;
      }

      const built = cloneCharacterVisual(gltf);

      if (playerBody) {
        playerRoot.remove(playerBody);
        disposeObject(playerBody);
      }

      playerBody = built.model;
      fallbackParts = null;

      playerRoot.add(playerBody);

      if (built.mixer) {
        mixers.push(built.mixer);
      }

      if (gunRoot) {
        playerRoot.add(gunRoot);
      }
    } catch (e) {
      console.warn(
        "Battle GLB failed; fallback character remains",
        e
      );
    }
  }

  // =====================================================
  // CREATE BATTLE WORLD
  // =====================================================

  function createWorld() {
    cleanupWorld();

    worldToken++;

    const token = worldToken;

    state.health = 100;
    state.maxAmmo = WEAPONS[state.weapon].ammo;
    state.ammo = state.maxAmmo;
    state.aiming = false;
    state.gameActive = false;
    state.firing = false;
    state.reloading = false;
    state.yaw = 0;
    state.pitch = -0.12;
    state.moveX = 0;
    state.moveY = 0;

    jumpVelocity = 0;
    playerOnGround = true;

    scene = new THREE.Scene();

    addLighting(scene, MAPS[state.map].sky);

    const w = ui.canvas?.clientWidth || window.innerWidth;
    const h = ui.canvas?.clientHeight || window.innerHeight;

    camera = new THREE.PerspectiveCamera(
      state.aiming ? 52 : 65,
      w / h,
      0.1,
      250
    );

    renderer = new THREE.WebGLRenderer({
      antialias: state.graphics === "high",
      powerPreference: "high-performance"
    });

    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
        state.graphics === "high" ? 1.7 : 1.1
      )
    );

    renderer.setSize(w, h);

    renderer.shadowMap.enabled = state.graphics === "high";
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    ui.canvas.innerHTML = "";
    ui.canvas.appendChild(renderer.domElement);

    clock = new THREE.Clock();

    collisionObjects = [];
    worldObjects = [];
    targets = [];
    mixers = [];

    createTerrain();

    for (let i = 0; i < 8; i++) {
      createTarget(
        (i % 4) * 6 - 9,
        -18 - Math.floor(i / 4) * 8
      );
    }

    playerRoot = new THREE.Group();
    playerRoot.position.set(0, 0, 5);

    scene.add(playerRoot);

    playerBody = makeFallbackCharacter();
    fallbackParts = playerBody.userData.parts;

    playerRoot.add(playerBody);

    createGun();
    loadBattleGLB(token);
    updateHUD();

    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(gameLoop);
  }

  function cleanupWorld() {
    cancelAnimationFrame(raf);

    stopFiring();

    clearTimeout(reloadTimer);

    state.firing = false;
    state.reloading = false;

    if (renderer) {
      renderer.dispose();
      renderer = null;
    }

    if (scene) {
      disposeScene(scene);
      scene = null;
    }

    camera = null;
    playerRoot = null;
    playerBody = null;
    gunRoot = null;
    muzzleFlash = null;
    terrain = null;

    targets = [];
    collisionObjects = [];
    worldObjects = [];
    mixers = [];
    fallbackParts = null;
  }

  function disposeScene(s) {
    if (!s) return;

    s.traverse(o => {
      if (o.geometry) {
        o.geometry.dispose();
      }

      if (o.material) {
        const materials = Array.isArray(o.material)
          ? o.material
          : [o.material];

        materials.forEach(m => {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      }
    });
  }

  function changeWeapon(type) {
    if (!WEAPONS[type]) return;

    state.weapon = type;
    state.maxAmmo = WEAPONS[type].ammo;
    state.ammo = state.maxAmmo;
    state.selectedInventory = type;

    if (playerRoot) {
      createGun();
    }

    updateHUD();

    message(`${WEAPONS[type].name} equipped`);
  }

  function shoot() {
    if (!state.gameActive || state.reloading) return;

    const cfg = WEAPONS[state.weapon];
    const now = performance.now();

    if (now - state.lastShot < cfg.rate) return;

    state.lastShot = now;

    if (state.ammo <= 0) {
      message("Out of ammo — reload");
      return;
    }

    state.ammo--;

    if (muzzleFlash) {
      muzzleFlash.visible = true;

      setTimeout(() => {
        if (muzzleFlash) {
          muzzleFlash.visible = false;
        }
      }, 55);
    }

    if (camera && scene) {
      const origin = camera.position.clone();
      const dir = new THREE.Vector3();

      camera.getWorldDirection(dir);

      dir.x += (Math.random() - 0.5) * cfg.spread;
      dir.y += (Math.random() - 0.5) * cfg.spread;
      dir.z += (Math.random() - 0.5) * cfg.spread;

      dir.normalize();

      const ray = new THREE.Raycaster(
        origin,
        dir,
        0,
        cfg.range
      );

      const meshes = [];

      targets.forEach(t => {
        t.traverse(o => {
          if (o.isMesh && o.visible) {
            meshes.push(o);
          }
        });
      });

      const hit = ray.intersectObjects(meshes, false)[0];

      if (hit) {
        let obj = hit.object;

        while (obj.parent && !targets.includes(obj)) {
          obj = obj.parent;
        }

        if (targets.includes(obj)) {
          scene.remove(obj);

          targets = targets.filter(t => t !== obj);

          message("TARGET HIT +100");
        }
      }
    }

    updateHUD();
  }

  function startFiring() {
    if (state.firing) return;

    state.firing = true;

    shoot();

    fireTimer = setInterval(shoot, 45);
  }

  function stopFiring() {
    state.firing = false;

    if (fireTimer) {
      clearInterval(fireTimer);
    }

    fireTimer = 0;
  }

  function reload() {
    if (state.reloading || state.ammo === state.maxAmmo) {
      return;
    }

    if (state.ammo < 0) return;

    state.reloading = true;

    message("RELOADING...");

    clearTimeout(reloadTimer);

    reloadTimer = setTimeout(() => {
      state.ammo = state.maxAmmo;
      state.reloading = false;

      updateHUD();
      message("RELOADED");
    }, state.weapon === "sniper" ? 1800 : 1300);
  }

  // =====================================================
  // MOVEMENT AND CAMERA
  // =====================================================

  function isBlocked(x, z) {
    for (const b of collisionObjects) {
      if (
        Math.abs(x - b.x) < b.rx &&
        Math.abs(z - b.z) < b.rz
      ) {
        return true;
      }
    }

    return false;
  }

  function updateMovement(dt) {
    if (!playerRoot) return;

    let forward = 0;
    let side = 0;

    if (keys.KeyW || keys.ArrowUp) forward += 1;
    if (keys.KeyS || keys.ArrowDown) forward -= 1;
    if (keys.KeyA || keys.ArrowLeft) side -= 1;
    if (keys.KeyD || keys.ArrowRight) side += 1;

    forward += state.moveY;
    side += state.moveX;

    const len = Math.hypot(forward, side);

    if (len > 1) {
      forward /= len;
      side /= len;
    }

    const speed = state.crouching
      ? 2.1
      : state.running
        ? 7.4
        : 4.3;

    const dx =
      (
        Math.sin(state.yaw) * forward +
        Math.cos(state.yaw) * side
      ) * speed * dt;

    const dz =
      (
        -Math.cos(state.yaw) * forward +
        Math.sin(state.yaw) * side
      ) * speed * dt;

    const nx = playerRoot.position.x + dx;
    const nz = playerRoot.position.z + dz;

    if (!isBlocked(nx, playerRoot.position.z)) {
      playerRoot.position.x = THREE.MathUtils.clamp(nx, -100, 100);
    }

    if (!isBlocked(playerRoot.position.x, nz)) {
      playerRoot.position.z = THREE.MathUtils.clamp(nz, -100, 100);
    }

    playerRoot.rotation.y = state.yaw;

    if (fallbackParts) {
      const moving = len > 0.08;

      fallbackParts.leftLeg.rotation.x = moving
        ? Math.sin(performance.now() * 0.012) * 0.6
        : 0;

      fallbackParts.rightLeg.rotation.x = moving
        ? -Math.sin(performance.now() * 0.012) * 0.6
        : 0;

      fallbackParts.leftArm.rotation.x = moving
        ? -Math.sin(performance.now() * 0.012) * 0.3
        : 0;

      fallbackParts.rightArm.rotation.x = moving
        ? Math.sin(performance.now() * 0.012) * 0.3
        : 0;
    }

    if (state.jumping && !playerOnGround) {
      jumpVelocity -= 16 * dt;
      playerRoot.position.y += jumpVelocity * dt;

      if (playerRoot.position.y <= 0) {
        playerRoot.position.y = 0;
        jumpVelocity = 0;
        playerOnGround = true;
        state.jumping = false;
      }
    } else if (state.jumping && playerOnGround) {
      jumpVelocity = 6.5;
      playerOnGround = false;
    }
  }

  function updateCamera() {
    if (!camera || !playerRoot) return;

    const dist = state.aiming ? 2.2 : cameraDistance;

    const target = v3(
      playerRoot.position.x,
      playerRoot.position.y + (state.crouching ? 1.1 : 1.55),
      playerRoot.position.z
    );

    const yaw = state.yaw;
    const pitch = state.pitch;

    const desired = v3(
      target.x + Math.sin(yaw) * dist * Math.cos(pitch),
      target.y + Math.sin(pitch) * dist + 0.6,
      target.z + Math.cos(yaw) * dist * Math.cos(pitch)
    );

    camera.position.lerp(desired, 0.18);

    camera.lookAt(
      target.x - Math.sin(yaw) * 5,
      target.y + pitch * 8,
      target.z - Math.cos(yaw) * 5
    );

    if (ui.crosshair) {
      ui.crosshair.style.opacity = state.aiming ? "1" : "0.65";
    }
  }

  function gameLoop() {
    raf = requestAnimationFrame(gameLoop);

    if (!renderer || !scene || !camera) return;

    const dt = Math.min(clock?.getDelta() || 0.016, 0.05);

    if (state.gameActive) {
      updateMovement(dt);
      updateCamera();

      mixers.forEach(m => m.update(dt));
    }

    renderer.render(scene, camera);
  }

  function jump() {
    if (!state.gameActive) return;

    if (playerOnGround) {
      state.jumping = true;
      playerOnGround = false;
      jumpVelocity = 6.5;
    }
  }

  // =====================================================
  // START AND EXIT BATTLE
  // =====================================================

  function startBattle() {
    if (!ui.lobby || !ui.gameScreen) return;

    closeModal();
    closeCharacterSelection();

    state.playerName =
      ($("playerName")?.value || state.playerName)
        .trim()
        .slice(0, 18) || "SURVIVOR";

    ui.lobby.classList.add("hidden");
    ui.gameScreen.classList.remove("hidden");

    createWorld();

    if (ui.countdown) {
      ui.countdown.classList.remove("hidden");

      let n = 3;

      if (ui.countdownNumber) {
        ui.countdownNumber.textContent = n;
      }

      const tick = () => {
        n--;

        if (n > 0) {
          if (ui.countdownNumber) {
            ui.countdownNumber.textContent = n;
          }

          setTimeout(tick, 700);
        } else {
          ui.countdown.classList.add("hidden");
          state.gameActive = true;

          message("BATTLE START!");
        }
      };

      setTimeout(tick, 700);
    } else {
      state.gameActive = true;
    }
  }

  function exitBattle() {
    state.gameActive = false;

    stopFiring();
    cleanupWorld();

    if (ui.gameScreen) {
      ui.gameScreen.classList.add("hidden");
    }

    if (ui.lobby) {
      ui.lobby.classList.remove("hidden");
    }

    updateHUD();
  }

  // =====================================================
  // PROFILE AND MENUS
  // =====================================================

  function editProfile() {
    setModal(
      "EDIT PROFILE",
      `
        <div class="modal-options">
          <label>
            PLAYER NAME
            <input
              id="profileNameInput"
              maxlength="18"
              value="${escapeHTML(state.playerName)}"
              style="display:block;width:100%;margin:8px 0;padding:12px;box-sizing:border-box"
            >
          </label>

          <button type="button" data-action="save-profile">
            SAVE PROFILE
          </button>
        </div>
      `
    );
  }

  function openCharacterMenu() {
    openCharacterSelection();
  }

  function openEmoteMenu() {
    setModal(
      "SELECT EMOTE",
      `
        <div class="modal-options">
          <button type="button" data-emote="idle">🧍 IDLE</button>
          <button type="button" data-emote="wave">👋 WAVE</button>
          <button type="button" data-emote="dance">💃 DANCE</button>
          <button type="button" data-emote="victory">🏆 VICTORY</button>

          <p>
            Emotes change the preview animation when supported by the model.
          </p>
        </div>
      `
    );
  }

  function openSettings() {
    setModal(
      "SETTINGS",
      `
        <div class="modal-options">
          <p>GRAPHICS QUALITY</p>

          <button type="button" data-graphics="high">
            HIGH
          </button>

          <button type="button" data-graphics="low">
            LOW (BETTER PERFORMANCE)
          </button>

          <p>Touch controls and keyboard controls are supported.</p>
        </div>
      `
    );
  }

  function openInventory() {
    setModal(
      "INVENTORY",
      `
        <div class="modal-options">
          <p>WEAPON INVENTORY</p>

          ${
            Object.entries(WEAPONS).map(([id, w]) => `
              <button type="button" data-weapon-pick="${id}">
                ${escapeHTML(w.name)} — ${w.ammo} AMMO
              </button>
            `).join("")
          }

          <p>Character outfit items can be added when their assets are available.</p>
        </div>
      `
    );
  }

  function openLoadout() {
    setModal(
      "LOADOUT",
      `
        <div class="modal-options">
          <p>SELECT YOUR WEAPON</p>

          ${
            Object.entries(WEAPONS).map(([id, w]) => `
              <button type="button" data-weapon-pick="${id}">
                ${escapeHTML(w.name)}
              </button>
            `).join("")
          }

          <button type="button" data-action="character">
            SELECT CHARACTER
          </button>
        </div>
      `
    );
  }

  // =====================================================
  // CONTROLS
  // =====================================================

  function bindInputs() {
    $("startButton")?.addEventListener("click", startBattle);
    $("exitButton")?.addEventListener("click", exitBattle);
    $("editProfile")?.addEventListener("click", editProfile);
    $("characterButton")?.addEventListener("click", openCharacterMenu);
    $("emoteButton")?.addEventListener("click", openEmoteMenu);
    $("loadoutButton")?.addEventListener("click", openLoadout);
    $("settingsButton")?.addEventListener("click", openSettings);
    $("inventoryButton")?.addEventListener("click", openInventory);
    $("closeModal")?.addEventListener("click", closeModal);

    $("playerName")?.addEventListener("input", e => {
      e.target.dataset.edited = "1";
      state.playerName = e.target.value.slice(0, 18);
    });

    document.querySelectorAll(".weapon-card[data-weapon]").forEach(el => {
      el.addEventListener("click", () => {
        changeWeapon(el.dataset.weapon);
      });
    });

    document.querySelectorAll(".map-card[data-map]").forEach(el => {
      el.addEventListener("click", () => {
        if (!MAPS[el.dataset.map]) return;

        state.map = el.dataset.map;

        updateHUD();
        message(`${MAPS[state.map].name} selected`);
      });
    });

    $("jumpButton")?.addEventListener("click", jump);

    $("runButton")?.addEventListener("click", () => {
      state.running = !state.running;

      message(state.running ? "RUNNING" : "WALKING");
    });

    $("crouchButton")?.addEventListener("click", () => {
      state.crouching = !state.crouching;

      message(state.crouching ? "CROUCHING" : "STANDING");
    });

    $("aimButton")?.addEventListener("click", () => {
      state.aiming = !state.aiming;

      if (camera) {
        camera.fov = state.aiming ? 42 : 65;
        camera.updateProjectionMatrix();
      }
    });

    $("reloadButton")?.addEventListener("click", reload);

    const fire = $("fireButton");

    if (fire) {
      fire.addEventListener("pointerdown", e => {
        e.preventDefault();
        startFiring();
      });

      ["pointerup", "pointerleave", "pointercancel"].forEach(ev => {
        fire.addEventListener(ev, stopFiring);
      });
    }

    document.addEventListener("keydown", e => {
      keys[e.code] = true;

      if ([
        "Space",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight"
      ].includes(e.code)) {
        e.preventDefault();
      }

      if (e.code === "Space") jump();
      if (e.code === "KeyR") reload();

      if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        state.running = true;
      }

      if (e.code === "KeyC") {
        state.crouching = true;
      }

      if (e.code === "KeyF") {
        startFiring();
      }
    });

    document.addEventListener("keyup", e => {
      keys[e.code] = false;

      if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        state.running = false;
      }

      if (e.code === "KeyC") {
        state.crouching = false;
      }

      if (e.code === "KeyF") {
        stopFiring();
      }
    });

    // Mobile joystick
    const joy = $("joystick");
    const knob = $("joystickKnob");

    if (joy && knob) {
      let active = false;
      let cx = 0;
      let cy = 0;

      joy.addEventListener("pointerdown", e => {
        active = true;

        joy.setPointerCapture?.(e.pointerId);

        const r = joy.getBoundingClientRect();

        cx = r.left + r.width / 2;
        cy = r.top + r.height / 2;

        move(e);
      });

      function move(e) {
        if (!active) return;

        let dx = e.clientX - cx;
        let dy = e.clientY - cy;

        const max = 42;
        const len = Math.hypot(dx, dy);

        if (len > max) {
          dx = dx / len * max;
          dy = dy / len * max;
        }

        knob.style.transform = `translate(${dx}px, ${dy}px)`;

        state.moveX = dx / max;
        state.moveY = -dy / max;
      }

      joy.addEventListener("pointermove", move);

      function end() {
        active = false;

        state.moveX = 0;
        state.moveY = 0;

        knob.style.transform = "translate(0,0)";
      }

      [
        "pointerup",
        "pointercancel",
        "lostpointercapture"
      ].forEach(ev => {
        joy.addEventListener(ev, end);
      });
    }

    // Touch-drag camera control
    const canvas = ui.canvas;

    if (canvas) {
      canvas.addEventListener("pointerdown", e => {
        if (e.target === renderer?.domElement) {
          dragLook = true;

          lastPointerX = e.clientX;
          lastPointerY = e.clientY;

          canvas.setPointerCapture?.(e.pointerId);
        }
      });

      canvas.addEventListener("pointermove", e => {
        if (!dragLook) return;

        state.yaw -= (e.clientX - lastPointerX) * 0.006;

        state.pitch = THREE.MathUtils.clamp(
          state.pitch + (e.clientY - lastPointerY) * 0.004,
          -0.8,
          0.45
        );

        lastPointerX = e.clientX;
        lastPointerY = e.clientY;
      });

      [
        "pointerup",
        "pointercancel",
        "lostpointercapture"
      ].forEach(ev => {
        canvas.addEventListener(ev, () => {
          dragLook = false;
        });
      });
    }

    // Modal actions
    ui.modal?.addEventListener("click", e => {
      const b = e.target.closest("button");

      if (!b) return;

      if (b.dataset.char) {
        state.character = b.dataset.char;

        closeModal();
        updateHUD();

        return;
      }

      if (b.dataset.emote) {
        state.emote = b.dataset.emote;

        closeModal();

        message(`${b.dataset.emote.toUpperCase()} emote selected`);

        return;
      }

      if (b.dataset.graphics) {
        state.graphics = b.dataset.graphics;

        closeModal();

        message(
          `${state.graphics.toUpperCase()} graphics selected. Applies next battle.`
        );

        return;
      }

      if (b.dataset.weaponPick) {
        changeWeapon(b.dataset.weaponPick);
        closeModal();

        return;
      }

      if (b.dataset.action === "character") {
        openCharacterSelection();

        return;
      }

      if (b.dataset.action === "save-profile") {
        const input = $("profileNameInput");

        state.playerName =
          (input?.value || "SURVIVOR")
            .trim()
            .slice(0, 18) || "SURVIVOR";

        const p = $("playerName");

        if (p) p.value = state.playerName;

        closeModal();
        updateHUD();

        message("Profile saved");
      }
    });

    // Resize game and previews
    window.addEventListener("resize", () => {
      if (renderer && camera && ui.canvas) {
        const w = ui.canvas.clientWidth || window.innerWidth;
        const h = ui.canvas.clientHeight || window.innerHeight;

        renderer.setSize(w, h);

        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }

      if (previewRenderer && previewCamera && ui.previewCanvas) {
        const w = ui.previewCanvas.clientWidth || 300;
        const h = ui.previewCanvas.clientHeight || 300;

        previewRenderer.setSize(w, h, false);

        previewCamera.aspect = w / h;
        previewCamera.updateProjectionMatrix();
      }
    });
  }

  function init() {
    injectCharacterCSS();
    bindInputs();
    initPreview();
    updateHUD();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();