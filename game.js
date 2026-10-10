(() => {
  'use strict';

  // BUNER MOBILE V3 — Full Game JavaScript
  const $ = (id) => document.getElementById(id);
  const hasThree = () => typeof window.THREE !== 'undefined';

  const ui = {
    lobby: $('lobby'),
    game: $('gameScreen'),
    canvas: $('gameCanvas'),
    preview: $('characterPreviewCanvas'),
    modal: $('modal'),
    modalTitle: $('modalTitle'),
    modalContent: $('modalContent'),
    message: $('gameMessage'),
    healthBar: $('healthBar'),
    healthText: $('healthText'),
    countdown: $('startCountdown'),
    countdownNumber: $('countdownNumber'),
    crosshair: $('crosshair'),
    joystick: $('joystick'),
    knob: $('joystickKnob')
  };

  const state = {
    map: 'buner',
    weapon: 'rifle',
    character: 'soldier',
    name: 'SURVIVOR',
    graphics: 'high',
    sound: true,
    health: 100,
    ammo: 30,
    maxAmmo: 30,
    running: false,
    crouching: false,
    aiming: false,
    firing: false,
    grounded: true,
    velocityY: 0,
    yaw: 0,
    pitch: -0.16,
    moveX: 0,
    moveZ: 0,
    keys: Object.create(null),
    lastShot: 0,
    reloading: false,
    emote: 'none'
  };

  const colors = {
    soldier: {
      shirt: 0x435b3c,
      pants: 0x303a2e,
      helmet: 0x263528,
      skin: 0xc99470,
      trim: 0x8a9a64
    },
    scout: {
      shirt: 0x68747b,
      pants: 0x353d47,
      helmet: 0x343c45,
      skin: 0xc99470,
      trim: 0xb5c0c4
    },
    desert: {
      shirt: 0xa98a5e,
      pants: 0x66543b,
      helmet: 0x8d744d,
      skin: 0xc99470,
      trim: 0xd0b789
    }
  };

  let previewScene;
  let previewCamera;
  let previewRenderer;
  let previewRoot;
  let previewRAF = 0;
  let previewYaw = 0;

  let scene;
  let camera;
  let renderer;
  let clock;
  let playerRoot;
  let playerBody;
  let gunRoot;
  let terrain;

  let gameRAF = 0;
  let gameActive = false;
  let countdownTimer = 0;
  let resizeHandler = null;

  let joystickPointer = null;
  let lookPointer = null;
  let lookLastX = 0;
  let lookLastY = 0;

  const obstacles = [];

  function message(text) {
    if (ui.message) ui.message.textContent = text;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function mat(color, roughness = 0.88, metalness = 0) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness
    });
  }

  function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }

  function box(parent, w, h, d, color, x, y, z) {
    return mesh(
      parent,
      new THREE.BoxGeometry(w, h, d),
      mat(color),
      x, y, z
    );
  }

  // ==========================================
  // PLAYER CHARACTER
  // ==========================================

  function buildCharacter(parent, type = state.character) {
    const c = colors[type] || colors.soldier;

    const root = new THREE.Group();
    parent.add(root);

    const torso = new THREE.Group();
    root.add(torso);

    box(torso, 0.78, 0.92, 0.42, c.shirt, 0, 1.38, 0);
    box(torso, 0.62, 0.36, 0.09, c.trim, 0, 1.51, -0.245);
    box(torso, 0.74, 0.12, 0.44, 0x302c25, 0, 0.91, 0);

    mesh(
      torso,
      new THREE.CylinderGeometry(0.12, 0.14, 0.2, 10),
      mat(c.skin),
      0, 1.93, 0
    );

    mesh(
      torso,
      new THREE.SphereGeometry(0.27, 16, 12),
      mat(c.skin),
      0, 2.17, 0
    );

    mesh(
      torso,
      new THREE.SphereGeometry(
        0.31, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2
      ),
      mat(c.helmet),
      0, 2.29, 0
    );

    mesh(
      torso,
      new THREE.CylinderGeometry(0.31, 0.31, 0.05, 16),
      mat(c.helmet),
      0, 2.25, 0
    );

    const eyes = mat(0x171a18, 0.5);

    mesh(
      torso,
      new THREE.SphereGeometry(0.023, 8, 8),
      eyes, -0.09, 2.19, -0.25
    );

    mesh(
      torso,
      new THREE.SphereGeometry(0.023, 8, 8),
      eyes, 0.09, 2.19, -0.25
    );

    const leftArm = new THREE.Group();
    leftArm.position.set(-0.47, 1.72, 0);
    torso.add(leftArm);

    box(leftArm, 0.23, 0.67, 0.25, c.shirt, 0, -0.34, 0);
    box(leftArm, 0.2, 0.22, 0.22, c.skin, 0, -0.71, -0.01);

    const rightArm = new THREE.Group();
    rightArm.position.set(0.47, 1.72, 0);
    torso.add(rightArm);

    box(rightArm, 0.23, 0.67, 0.25, c.shirt, 0, -0.34, 0);
    box(rightArm, 0.2, 0.22, 0.22, c.skin, 0, -0.71, -0.01);

    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.21, 0.82, 0);
    root.add(leftLeg);

    box(leftLeg, 0.3, 0.7, 0.32, c.pants, 0, -0.35, 0);
    box(leftLeg, 0.33, 0.18, 0.45, 0x252822, 0, -0.74, -0.04);

    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.21, 0.82, 0);
    root.add(rightLeg);

    box(rightLeg, 0.3, 0.7, 0.32, c.pants, 0, -0.35, 0);
    box(rightLeg, 0.33, 0.18, 0.45, 0x252822, 0, -0.74, -0.04);

    root.userData = {
      torso,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg
    };

    return root;
  }

  // ==========================================
  // WEAPONS
  // ==========================================

  function buildGun(parent, type = state.weapon) {
    const gun = new THREE.Group();
    parent.add(gun);

    const sizes = {
      rifle: [1.05, 0.11, 0.13],
      sniper: [1.45, 0.09, 0.11],
      shotgun: [0.82, 0.14, 0.16],
      smg: [0.72, 0.1, 0.12],
      pistol: [0.43, 0.1, 0.12]
    };

    const size = sizes[type] || sizes.rifle;

    box(gun, ...size, 0x252a2b, 0, 0, 0);

    box(
      gun,
      size[0] * 0.43,
      0.075,
      size[2] * 1.4,
      0x4c514d,
      0, -0.075, 0.01
    );

    box(gun, 0.16, 0.22, 0.12, 0x242724, -0.08, -0.13, 0.02);

    box(
      gun,
      0.13, 0.13, 0.12,
      0x111514,
      size[0] * 0.48, 0, 0
    );

    const flash = new THREE.Mesh(
      new THREE.ConeGeometry(0.11, 0.34, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd45a })
    );

    flash.rotation.z = -Math.PI / 2;
    flash.position.x = size[0] * 0.65;
    flash.visible = false;
    gun.add(flash);

    gun.userData.flash = flash;

    return gun;
  }

  // ==========================================
  // LOBBY CHARACTER PREVIEW
  // ==========================================

  function createPreview() {
    if (!ui.preview || !hasThree()) return;

    stopPreview();
    ui.preview.replaceChildren();

    previewScene = new THREE.Scene();
    previewScene.background = new THREE.Color(0x17251d);

    previewCamera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    previewCamera.position.set(0, 2.05, 6.4);
    previewCamera.lookAt(0, 1.25, 0);

    previewRenderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'low-power'
    });

    previewRenderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, 1.5)
    );

    previewRenderer.outputColorSpace = THREE.SRGBColorSpace;

    ui.preview.appendChild(previewRenderer.domElement);

    previewScene.add(
      new THREE.HemisphereLight(0xe6f2ff, 0x34442f, 2.1)
    );

    const light = new THREE.DirectionalLight(0xffe3b0, 2.4);
    light.position.set(-3, 7, 5);
    previewScene.add(light);

    const floor = mesh(
      previewScene,
      new THREE.CircleGeometry(2.1, 32),
      mat(0x344638),
      0, -0.03, 0
    );

    floor.rotation.x = -Math.PI / 2;

    previewRoot = buildCharacter(previewScene);
    const previewLoadToken = (createPreview.loadToken || 0) + 1;
createPreview.loadToken = previewLoadToken;
loadBunerCharacter()
  .then((model) => {
    if (
      previewLoadToken !== createPreview.loadToken ||
      !previewScene
    ) {
      return;
    }
    if (previewRoot) {
      previewScene.remove(previewRoot);
    }
    previewRoot = model;
    previewRoot.rotation.y = Math.PI + previewYaw;
    previewScene.add(previewRoot);
  })
  .catch((error) => {
    console.error('Lobby character failed to load:', error);
    // Keep the existing procedural character as a fallback.
  });
  
    previewRoot.rotation.y = Math.PI + previewYaw;

    resizePreview();

    const loop = () => {
      if (!previewRenderer || !previewScene || !previewRoot) return;

      previewRoot.rotation.y = Math.PI + previewYaw;

      previewRenderer.render(previewScene, previewCamera);
      previewRAF = requestAnimationFrame(loop);
    };

    loop();
  }

  function resizePreview() {
    if (!previewRenderer || !ui.preview || !previewCamera) return;

    const width = Math.max(1, ui.preview.clientWidth);
    const height = Math.max(1, ui.preview.clientHeight);

    previewRenderer.setSize(width, height, false);
    previewCamera.aspect = width / height;
    previewCamera.updateProjectionMatrix();
  }

  function stopPreview() {
    if (previewRAF) cancelAnimationFrame(previewRAF);
    previewRAF = 0;

    if (previewRenderer) {
      previewRenderer.dispose();
      previewRenderer.domElement.remove();
    }

    if (previewScene) {
      previewScene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();

        if (object.material) {
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];

          materials.forEach((material) => material.dispose());
        }
      });
    }

    previewRenderer = null;
    previewScene = null;
    previewCamera = null;
    previewRoot = null;
  }

  // ==========================================
  // MAP AND COLLISION SYSTEM
  // ==========================================

  function groundHeight(x, z) {
    let height =
      Math.sin(x * 0.075) * 1.1 +
      Math.cos(z * 0.09) * 0.8 +
      Math.sin((x + z) * 0.045) * 1.4;

    if (state.map === 'forest') {
      height += Math.sin(x * 0.13) * 0.6;
    }

    if (state.map === 'desert') {
      height *= 0.55;
    }

    return height;
  }

  function addObstacle(type, x, z, a, b = 0) {
    obstacles.push({ type, x, z, a, b });
  }

  function blocked(x, z, radius = 0.45) {
    for (const obstacle of obstacles) {
      if (obstacle.type === 'circle') {
        const dx = x - obstacle.x;
        const dz = z - obstacle.z;

        if (dx * dx + dz * dz < (radius + obstacle.a) ** 2) {
          return true;
        }
      } else {
        const cx = clamp(x, obstacle.x - obstacle.a, obstacle.x + obstacle.a);
        const cz = clamp(z, obstacle.z - obstacle.b, obstacle.z + obstacle.b);

        if ((x - cx) ** 2 + (z - cz) ** 2 < radius * radius) {
          return true;
        }
      }
    }

    return false;
  }

  function addHouse(x, z, scale = 1) {
    const house = new THREE.Group();
    scene.add(house);

    house.position.set(x, groundHeight(x, z), z);

    const wallColor = state.map === 'desert' ? 0xbda47e : 0xb6b39a;

    box(house, 7 * scale, 4 * scale, 6 * scale, wallColor, 0, 2 * scale, 0);

    const roof = mesh(
      house,
      new THREE.ConeGeometry(5.6 * scale, 2.1 * scale, 4),
      mat(state.map === 'desert' ? 0x775640 : 0x544d42),
      0, 5 * scale, 0
    );

    roof.rotation.y = Math.PI / 4;

    box(house, 1.1 * scale, 2.2 * scale, 0.13 * scale, 0x49372a,
      0, 1.1 * scale, 3.05 * scale);

    box(house, 1.15 * scale, 0.9 * scale, 0.08 * scale, 0x7aa0b0,
      -2 * scale, 2.4 * scale, 3.06 * scale);

    box(house, 1.15 * scale, 0.9 * scale, 0.08 * scale, 0x7aa0b0,
      2 * scale, 2.4 * scale, 3.06 * scale);

    addObstacle('box', x, z, 3.8 * scale, 3.3 * scale);
  }

  function addTree(x, z, scale = 1) {
    const tree = new THREE.Group();
    scene.add(tree);

    tree.position.set(x, groundHeight(x, z), z);

    mesh(
      tree,
      new THREE.CylinderGeometry(0.22 * scale, 0.34 * scale, 2.4 * scale, 6),
      mat(0x65442b),
      0, 1.2 * scale, 0
    );

    const leafColors = state.map === 'forest'
      ? [0x254e30, 0x31643a, 0x3d7541]
      : [0x37673a, 0x467d42, 0x5b8b49];

    for (let i = 0; i < 3; i++) {
      mesh(
        tree,
        new THREE.ConeGeometry((1.55 - i * 0.22) * scale, 2.5 * scale, 7),
        mat(leafColors[i]),
        0, (2.5 + i * 1.05) * scale, 0
      );
    }

    addObstacle('circle', x, z, 0.62 * scale);
  }

  // ==========================================
  // CREATE WORLD
  // ==========================================

  function createWorld() {
    disposeWorld();

    if (!ui.canvas) {
      throw new Error('Missing #gameCanvas in index.html');
    }

    scene = new THREE.Scene();

    const skies = {
      buner: 0x9bc9ed,
      forest: 0x91b8a0,
      desert: 0xe5bd86
    };

    const skyColor = skies[state.map] || skies.buner;

    scene.background = new THREE.Color(skyColor);
    scene.fog = new THREE.Fog(skyColor, 65, 185);

    camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      350
    );

    renderer = new THREE.WebGLRenderer({
      antialias: state.graphics !== 'low',
      powerPreference: 'high-performance'
    });

    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
        state.graphics === 'low' ? 1 : 1.5
      )
    );

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    renderer.shadowMap.enabled = state.graphics === 'high';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    ui.canvas.replaceChildren(renderer.domElement);

    obstacles.length = 0;
    clock = new THREE.Clock();

    scene.add(
      new THREE.HemisphereLight(0xe5f1ff, 0x43553a, 2)
    );

    const sun = new THREE.DirectionalLight(0xfff1d2, 2.5);
    sun.position.set(-35, 65, 25);
    sun.castShadow = state.graphics === 'high';
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);

    const geometry = new THREE.PlaneGeometry(
      220, 220,
      state.graphics === 'low' ? 55 : 100,
      state.graphics === 'low' ? 55 : 100
    );

    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      positions.setY(
        i,
        groundHeight(positions.getX(i), positions.getZ(i))
      );
    }

    geometry.computeVertexNormals();

    const terrainColors = {
      buner: 0x567c45,
      forest: 0x315e3b,
      desert: 0xb89a67
    };

    terrain = mesh(
      scene,
      geometry,
      mat(terrainColors[state.map] || terrainColors.buner),
      0, 0, 0
    );

    const road = mesh(
      scene,
      new THREE.PlaneGeometry(12, 150),
      mat(state.map === 'desert' ? 0x887b65 : 0x66695d),
      0, 0.04, -20
    );

    road.rotation.x = -Math.PI / 2;

    for (let z = -85; z < 55; z += 9) {
      box(scene, 0.22, 0.025, 3.5, 0xd6d2b4, 0, 0.09, z);
    }

    const housePositions = [
      [-18, -20],
      [19, -25],
      [-24, -36],
      [24, -43],
      [-14, -52],
      [17, -61],
      [-32, -12],
      [33, -17]
    ];

    housePositions.forEach(([x, z], i) => {
      addHouse(x, z, i % 3 === 0 ? 1.15 : 0.9);
    });

    const treeCount = state.graphics === 'low' ? 45 : 85;

    for (let i = 0; i < treeCount; i++) {
      let x = rand(-95, 95);
      const z = rand(-95, 70);

      if (Math.abs(x) < 12 && z > -18 && z < 12) {
        x += x < 0 ? -17 : 17;
      }

      if (Math.abs(x) < 8) {
        x += x < 0 ? -9 : 9;
      }

      addTree(x, z, rand(0.75, 1.4));
    }

    for (let i = 0; i < 18; i++) {
      const angle = i / 18 * Math.PI * 2;
      const radius = rand(85, 108);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const height = rand(13, 28);

      const palette = state.map === 'desert'
        ? [0xb59a77, 0xc5a982, 0x927655]
        : state.map === 'forest'
          ? [0x46664d, 0x59745b, 0x304d38]
          : [0x687d70, 0x788b7d, 0x52695b];

      const mountain = mesh(
        scene,
        new THREE.ConeGeometry(rand(12, 23), height, 6),
        mat(palette[i % 3]),
        x,
        groundHeight(x, z) + height / 2 - 2,
        z
      );

      mountain.rotation.y = rand(0, Math.PI);
    }

    playerRoot = new THREE.Group();
    scene.add(playerRoot);

    playerRoot.position.set(0, groundHeight(0, 4), 4);

    playerBody = buildCharacter(playerRoot);

    gunRoot = buildGun(playerBody);
    gunRoot.position.set(0.48, 1.43, -0.33);
    gunRoot.rotation.y = Math.PI;
    gunRoot.rotation.z = -0.08;

    state.health = 100;

    const ammunition = {
      rifle: 30,
      sniper: 5,
      shotgun: 6,
      smg: 35,
      pistol: 12
    };

    state.ammo = state.maxAmmo = ammunition[state.weapon] || 30;
    state.reloading = false;
    state.velocityY = 0;
    state.grounded = true;

    updateHUD();
    updateCamera(0);

    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
    }

    resizeHandler = () => {
      if (!renderer || !camera) return;

      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();

      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', resizeHandler);
  }

  function disposeWorld() {
    gameActive = false;

    if (gameRAF) {
      cancelAnimationFrame(gameRAF);
    }

    gameRAF = 0;

    if (renderer) {
      renderer.dispose();
      renderer.domElement.remove();
    }

    if (scene) {
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();

        if (object.material) {
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];

          materials.forEach((material) => material.dispose());
        }
      });
    }

    scene = null;
    camera = null;
    renderer = null;
    clock = null;
    playerRoot = null;
    playerBody = null;
    gunRoot = null;
    terrain = null;

    obstacles.length = 0;
  }

  // ==========================================
  // CAMERA AND PLAYER MOVEMENT
  // ==========================================

  function updateCamera() {
    if (!camera || !playerRoot) return;

    const target = new THREE.Vector3(
      playerRoot.position.x,
      playerRoot.position.y + (state.crouching ? 1.2 : 1.65),
      playerRoot.position.z
    );

    const distance = state.aiming ? 3.1 : 5.5;
    const horizontal = Math.cos(state.pitch) * distance;

    camera.position.set(
      target.x + Math.sin(state.yaw) * horizontal,
      target.y + Math.sin(-state.pitch) * distance,
      target.z + Math.cos(state.yaw) * horizontal
    );

    camera.lookAt(target.x, target.y + 0.1, target.z);
  }

  function movePlayer(dx, dz) {
    if (!playerRoot) return;

    const nx = clamp(playerRoot.position.x + dx, -103, 103);
    const nz = clamp(playerRoot.position.z + dz, -103, 103);
    const radius = state.crouching ? 0.4 : 0.46;

    if (!blocked(nx, playerRoot.position.z, radius)) {
      playerRoot.position.x = nx;
    }

    if (!blocked(playerRoot.position.x, nz, radius)) {
      playerRoot.position.z = nz;
    }

    playerRoot.position.y = groundHeight(
      playerRoot.position.x,
      playerRoot.position.z
    );
  }

  function updateHUD() {
    if (ui.healthBar) {
      ui.healthBar.style.width = state.health + '%';
    }

    if (ui.healthText) {
      ui.healthText.textContent = String(state.health);
    }

    const ammoLabel = $('ammoText');

    if (ammoLabel) {
      ammoLabel.textContent = `${state.ammo} / ${state.maxAmmo}`;
    }

    const weaponLabel = $('weaponText');

    if (weaponLabel) {
      weaponLabel.textContent = state.weapon.toUpperCase();
    }

    const playerName = $('playerName');

    if (playerName) {
      playerName.textContent = state.name;
    }
  }

  // ==========================================
  // GAME LOOP
  // ==========================================

  function gameLoop() {
    if (!gameActive || !renderer || !scene || !clock) return;

    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;

    const forward =
      (state.keys.KeyW || state.keys.ArrowUp ? 1 : 0) -
      (state.keys.KeyS || state.keys.ArrowDown ? 1 : 0) -
      state.moveZ;

    const side =
      (state.keys.KeyD || state.keys.ArrowRight ? 1 : 0) -
      (state.keys.KeyA || state.keys.ArrowLeft ? 1 : 0) +
      state.moveX;

    const magnitude = Math.hypot(forward, side);

    if (magnitude > 0.01) {
      const speed =
        (state.running ? 8 : 4.4) *
        (state.crouching ? 0.48 : 1) *
        dt;

      const fx =
        (side * Math.cos(state.yaw) +
          forward * Math.sin(state.yaw)) / magnitude;

      const fz =
        (-forward * Math.cos(state.yaw) +
          side * Math.sin(state.yaw)) / magnitude;

      movePlayer(fx * speed, fz * speed);

      playerRoot.rotation.y = Math.atan2(fx, fz);
    }

    if (!state.grounded) {
      state.velocityY -= 18 * dt;
      playerRoot.position.y += state.velocityY * dt;

      const ground = groundHeight(
        playerRoot.position.x,
        playerRoot.position.z
      );

      if (playerRoot.position.y <= ground) {
        playerRoot.position.y = ground;
        state.velocityY = 0;
        state.grounded = true;
      }
    }

    if (playerBody && playerBody.userData) {
      const movement = magnitude > 0.01
        ? Math.sin(time * 10) * 0.42
        : 0;

      playerBody.userData.leftLeg.rotation.x = movement;
      playerBody.userData.rightLeg.rotation.x = -movement;

      playerBody.userData.leftArm.rotation.x = -movement * 0.6;
      playerBody.userData.rightArm.rotation.x = movement * 0.6;

      playerBody.position.y = state.crouching ? -0.3 : 0;
    }

    if (state.firing) {
      shoot();
    }

    updateCamera();

    renderer.render(scene, camera);

    gameRAF = requestAnimationFrame(gameLoop);
  }

  // ==========================================
  // START AND EXIT BATTLE
  // ==========================================

  function startBattle() {
    if (!hasThree()) {
      alert('Three.js did not load. Check your connection and refresh.');
      return;
    }

    if (gameActive) return;

    clearInterval(countdownTimer);

    if (ui.lobby) ui.lobby.classList.add('hidden');
    if (ui.game) ui.game.classList.remove('hidden');

    try {
      createWorld();
    } catch (error) {
      console.error('BUNER MOBILE error:', error);

      message('Game error: ' + error.message);

      if (ui.lobby) ui.lobby.classList.remove('hidden');
      if (ui.game) ui.game.classList.add('hidden');

      return;
    }

    const begin = () => {
      if (ui.countdown) ui.countdown.classList.add('hidden');

      message('BATTLE STARTED — SURVIVE!');

      gameActive = true;
      clock.start();
      gameLoop();
    };

    if (ui.countdown) {
      ui.countdown.classList.remove('hidden');

      let number = 3;

      if (ui.countdownNumber) {
        ui.countdownNumber.textContent = number;
      }

      countdownTimer = setInterval(() => {
        number--;

        if (number > 0) {
          if (ui.countdownNumber) {
            ui.countdownNumber.textContent = number;
          }
        } else {
          clearInterval(countdownTimer);
          begin();
        }
      }, 700);
    } else {
      begin();
    }
  }

  function exitBattle() {
    clearInterval(countdownTimer);

    state.firing = false;
    state.moveX = 0;
    state.moveZ = 0;

    if (ui.game) ui.game.classList.add('hidden');
    if (ui.lobby) ui.lobby.classList.remove('hidden');

    disposeWorld();
    createPreview();
  }

  // ==========================================
  // FIRING AND RELOADING
  // ==========================================

  function shoot() {
    if (!gameActive || state.reloading) return;

    const now = performance.now();

    const delays = {
      sniper: 850,
      shotgun: 650,
      pistol: 320,
      smg: 90,
      rifle: 170
    };

    const delay = delays[state.weapon] || 170;

    if (now - state.lastShot < delay) return;

    state.lastShot = now;

    if (state.ammo <= 0) {
      message('OUT OF AMMO — RELOAD');
      return;
    }

    state.ammo--;
    updateHUD();

    if (gunRoot && gunRoot.userData.flash) {
      const flash = gunRoot.userData.flash;

      flash.visible = true;

      setTimeout(() => {
        if (gunRoot && gunRoot.userData.flash) {
          gunRoot.userData.flash.visible = false;
        }
      }, 55);
    }

    message('FIRING ' + state.weapon.toUpperCase());
  }

  function reload() {
    if (state.reloading || state.ammo === state.maxAmmo) return;

    state.reloading = true;
    message('RELOADING...');

    setTimeout(() => {
      state.ammo = state.maxAmmo;
      state.reloading = false;

      updateHUD();
      message('RELOADED');
    }, 900);
  }

  // ==========================================
  // MODALS AND UI HELPERS
  // ==========================================

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);
  }

  function openModal(title, html) {
    if (!ui.modal || !ui.modalTitle || !ui.modalContent) return;

    ui.modalTitle.textContent = title;
    ui.modalContent.innerHTML = html;
    ui.modal.classList.remove('hidden');
  }

  function closeModal() {
    if (ui.modal) ui.modal.classList.add('hidden');
  }

  function bind(id, event, callback) {
    const element = $(id);

    if (element) {
      element.addEventListener(event, callback);
    }
  }

  function selectCards(selector, key, callback) {
    document.querySelectorAll(selector).forEach((element) => {
      element.addEventListener('click', () => {
        const value = element.dataset[key];

        if (!value) return;

        callback(value);

        document.querySelectorAll(selector).forEach((card) => {
          card.classList.toggle('selected', card === element);
        });
      });
    });
  }

  // ==========================================
  // BUTTONS
  // ==========================================

  function bindUI() {
    bind('startButton', 'click', startBattle);
    bind('exitButton', 'click', exitBattle);
    bind('closeModal', 'click', closeModal);

    bind('editProfile', 'click', () => {
      openModal(
        'EDIT PROFILE',
        `<label class="modal-label" for="profileNameInput">Player name</label>
         <input id="profileNameInput" maxlength="16"
         value="${escapeHTML(state.name)}" class="modal-input">
         <button id="saveProfileButton" class="start-button modal-action"
         type="button">SAVE NAME</button>`
      );
    });

    bind('characterButton', 'click', () => {
      openModal(
        'SELECT CHARACTER',
        `<div class="modal-options">
          <button class="modal-option" data-char="soldier">SOLDIER</button>
          <button class="modal-option" data-char="scout">SCOUT</button>
          <button class="modal-option" data-char="desert">DESERT</button>
        </div>`
      );
    });

    bind('emoteButton', 'click', () => {
      openModal(
        'EMOTES',
        `<div class="modal-options">
          <button class="modal-option" data-emote="wave">WAVE</button>
          <button class="modal-option" data-emote="dance">DANCE</button>
          <button class="modal-option" data-emote="salute">SALUTE</button>
          <button class="modal-option" data-emote="none">STOP</button>
        </div>`
      );
    });

    bind('loadoutButton', 'click', () => {
      openModal(
        'LOADOUT',
        `<p>Current weapon: <strong>${state.weapon.toUpperCase()}</strong></p>
         <p>Choose a weapon card on the lobby screen to change weapons.</p>`
      );
    });

    bind('settingsButton', 'click', () => {
      openModal(
        'SETTINGS',
        `<div class="modal-options">
          <button class="modal-option" data-graphics="high">HIGH GRAPHICS</button>
          <button class="modal-option" data-graphics="low">LOW GRAPHICS</button>
          <button class="modal-option" data-sound="toggle">
            SOUND: ${state.sound ? 'ON' : 'OFF'}
          </button>
        </div>`
      );
    });

    bind('inventoryButton', 'click', () => {
      openModal(
        'INVENTORY',
        `<p>Equipment: ${state.weapon.toUpperCase()}</p>
         <p>Health: ${state.health}</p>
         <p>Ammo: ${state.ammo} / ${state.maxAmmo}</p>`
      );
    });

    selectCards('.weapon-card[data-weapon]', 'weapon', (value) => {
      state.weapon = value;
      updateHUD();
    });

    selectCards('.map-card[data-map]', 'map', (value) => {
      state.map = value;

      const names = {
        buner: 'BUNER VALLEY',
        forest: 'FOREST ZONE',
        desert: 'DESERT OUTPOST'
      };

      const selectedName = $('selectedMapName');

      if (selectedName) {
        selectedName.textContent = names[value] || value.toUpperCase();
      }
    });

    bind('modalContent', 'click', (event) => {
      const button = event.target.closest('button');

      if (!button) return;

      if (button.dataset.char) {
        state.character = button.dataset.char;
        closeModal();
        createPreview();
      }

      if (button.dataset.emote) {
        state.emote = button.dataset.emote;
        closeModal();
        message('EMOTE: ' + state.emote.toUpperCase());
      }

      if (button.dataset.graphics) {
        state.graphics = button.dataset.graphics;
        closeModal();
      }

      if (button.dataset.sound) {
        state.sound = !state.sound;
        closeModal();
      }

      if (button.id === 'saveProfileButton') {
        const input = $('profileNameInput');

        if (input && input.value.trim()) {
          state.name = input.value.trim().slice(0, 16);
          updateHUD();
          closeModal();
        }
      }
    });

    bind('jumpButton', 'click', () => {
      if (gameActive && state.grounded) {
        state.velocityY = 7.4;
        state.grounded = false;
      }
    });

    bind('runButton', 'click', () => {
      state.running = !state.running;

      const button = $('runButton');

      if (button) button.classList.toggle('selected', state.running);
    });

    bind('crouchButton', 'click', () => {
      state.crouching = !state.crouching;

      const button = $('crouchButton');

      if (button) button.classList.toggle('selected', state.crouching);
    });

    bind('aimButton', 'click', () => {
      state.aiming = !state.aiming;

      const button = $('aimButton');

      if (button) button.classList.toggle('selected', state.aiming);

      if (ui.crosshair) {
        ui.crosshair.style.transform = state.aiming
          ? 'translate(-50%, -50%) scale(.7)'
          : 'translate(-50%, -50%)';
      }
    });

    bind('reloadButton', 'click', reload);

    bind('fireButton', 'pointerdown', (event) => {
      event.preventDefault();
      state.firing = true;
      shoot();
    });

    bind('fireButton', 'pointerup', () => {
      state.firing = false;
    });

    bind('fireButton', 'pointercancel', () => {
      state.firing = false;
    });

    bind('fireButton', 'pointerleave', () => {
      state.firing = false;
    });

    if (ui.joystick) {
      ui.joystick.addEventListener('pointerdown', (event) => {
        if (!gameActive) return;

        joystickPointer = event.pointerId;
        ui.joystick.setPointerCapture(event.pointerId);

        updateJoystick(event);
      });

      ui.joystick.addEventListener('pointermove', (event) => {
        if (event.pointerId === joystickPointer) {
          updateJoystick(event);
        }
      });

      const endJoystick = () => {
        joystickPointer = null;
        state.moveX = 0;
        state.moveZ = 0;

        if (ui.knob) {
          ui.knob.style.transform = 'translate(0, 0)';
        }
      };

      ui.joystick.addEventListener('pointerup', endJoystick);
      ui.joystick.addEventListener('pointercancel', endJoystick);
    }

    if (ui.game) {
      ui.game.addEventListener('pointerdown', (event) => {
        if (!gameActive) return;
        if (event.target.closest('button')) return;
        if (event.target.closest('.joystick')) return;
        if (event.clientX < window.innerWidth * 0.38) return;

        lookPointer = event.pointerId;
        lookLastX = event.clientX;
        lookLastY = event.clientY;
      });

      ui.game.addEventListener('pointermove', (event) => {
        if (event.pointerId !== lookPointer) return;

        const dx = event.clientX - lookLastX;
        const dy = event.clientY - lookLastY;

        lookLastX = event.clientX;
        lookLastY = event.clientY;

        state.yaw -= dx * 0.006;
        state.pitch = clamp(state.pitch + dy * 0.004, -0.8, 0.28);
      });

      const endLook = () => {
        lookPointer = null;
      };

      ui.game.addEventListener('pointerup', endLook);
      ui.game.addEventListener('pointercancel', endLook);
    }

    if (ui.preview) {
      ui.preview.addEventListener('pointerdown', (event) => {
        ui.preview.dataset.dragging = '1';
        ui.preview.dataset.lastX = String(event.clientX);
        ui.preview.setPointerCapture(event.pointerId);
      });

      ui.preview.addEventListener('pointermove', (event) => {
        if (ui.preview.dataset.dragging !== '1') return;

        const last = Number(ui.preview.dataset.lastX || event.clientX);

        previewYaw += (event.clientX - last) * 0.012;
        ui.preview.dataset.lastX = String(event.clientX);
      });

      const endPreviewDrag = () => {
        ui.preview.dataset.dragging = '0';
      };

      ui.preview.addEventListener('pointerup', endPreviewDrag);
      ui.preview.addEventListener('pointercancel', endPreviewDrag);
    }

    window.addEventListener('keydown', (event) => {
      state.keys[event.code] = true;

      if (
        ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
          .includes(event.code)
      ) {
        event.preventDefault();
      }

      if (
        event.code === 'Space' &&
        gameActive &&
        state.grounded
      ) {
        state.velocityY = 7.4;
        state.grounded = false;
      }

      if (event.code === 'KeyR') reload();

      if (
        event.code === 'ShiftLeft' ||
        event.code === 'ShiftRight'
      ) {
        state.running = true;
      }
    });

    window.addEventListener('keyup', (event) => {
      state.keys[event.code] = false;

      if (
        event.code === 'ShiftLeft' ||
        event.code === 'ShiftRight'
      ) {
        state.running = false;
      }
    });

    window.addEventListener('blur', () => {
      state.firing = false;
      state.running = false;
      state.keys = Object.create(null);
    });

    window.addEventListener('resize', resizePreview);

    if (ui.modal) {
      ui.modal.addEventListener('click', (event) => {
        if (event.target === ui.modal) closeModal();
      });
    }
  }

  function updateJoystick(event) {
    if (!ui.joystick) return;

    const rect = ui.joystick.getBoundingClientRect();

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = event.clientX - centerX;
    let dy = event.clientY - centerY;

    const max = rect.width * 0.32;
    const length = Math.hypot(dx, dy);

    if (length > max) {
      dx = dx / length * max;
      dy = dy / length * max;
    }

    state.moveX = dx / max;
    state.moveZ = dy / max;

    if (ui.knob) {
      ui.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    }
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================

  function init() {
    if (window.__BUNER_MOBILE_V3_READY__) return;

    window.__BUNER_MOBILE_V3_READY__ = true;

    bindUI();

    if (!hasThree()) {
      message('Three.js could not load. Check connection and refresh.');
      console.error('BUNER MOBILE: THREE is missing');
      return;
    }

    createPreview();
    updateHUD();

    console.info('BUNER MOBILE initialized successfully.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();