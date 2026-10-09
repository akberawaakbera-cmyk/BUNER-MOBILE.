const $ = (id) => document.getElementById(id);

const lobby = $("lobby");
const gameScreen = $("gameScreen");
const canvasHost = $("gameCanvas");
const modal = $("modal");
const modalTitle = $("modalTitle");
const modalContent = $("modalContent");

let scene;
let camera;
let renderer;
let player;
let playerBody;
let playerHead;
let clock;
let animationFrame = 0;

let running = false;
let jumping = false;
let verticalVelocity = 0;
let health = 100;

let yaw = 0;
let pitch = 0.25;
let moveX = 0;
let moveZ = 0;
let isRunning = false;

let lastPointerX = 0;
let lastPointerY = 0;
let dragging = false;

const keys = Object.create(null);
const solids = [];
const trees = [];
const buildings = [];

const WORLD_SIZE = 240;
const PLAYER_SPEED = 5;
const RUN_SPEED = 8;

const joystick = $("joystick");
const joystickKnob = $("joystickKnob");

function showMessage(message) {
    const el = $("gameMessage");
    if (el) el.textContent = message;
}

function openModal(title, html) {
    modalTitle.textContent = title;
    modalContent.innerHTML = html;
    modal.classList.remove("hidden");
}

function closeModal() {
    modal.classList.add("hidden");
}

$("closeModal").addEventListener("click", closeModal);

modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
});

$("editProfile").addEventListener("click", () => {
    openModal("PLAYER PROFILE", `
        <p>Choose your in-game name.</p>
        <input id="nameInput" maxlength="18" placeholder="Enter player name">
        <button id="saveName">SAVE NAME</button>
    `);

    $("nameInput").value = $("playerName").textContent;

    $("saveName").addEventListener("click", () => {
        const name = $("nameInput").value.trim();
        if (!name) return;

        $("playerName").textContent = name.toUpperCase();
        closeModal();
    });
});

$("characterButton").addEventListener("click", () => {
    openModal("CHARACTER", `
        <p>Choose your survivor.</p>
        <button data-character="SURVIVOR">STANDARD SURVIVOR</button>
        <button data-character="SCOUT">SCOUT</button>
        <button data-character="RANGER">RANGER</button>
        <p id="characterStatus">Selected: SURVIVOR</p>
    `);

    modalContent.querySelectorAll("[data-character]").forEach((button) => {
        button.addEventListener("click", () => {
            modalContent.querySelector("#characterStatus").textContent =
                "Selected: " + button.dataset.character;
        });
    });
});

$("loadoutButton").addEventListener("click", () => {
    openModal("LOADOUT", `
        <p>Training equipment</p>
        <button data-weapon="ASSAULT RIFLE">ASSAULT RIFLE</button>
        <button data-weapon="SMG">SMG</button>
        <button data-weapon="SHOTGUN">SHOTGUN</button>
        <p id="weaponStatus">Selected: ASSAULT RIFLE</p>
    `);

    modalContent.querySelectorAll("[data-weapon]").forEach((button) => {
        button.addEventListener("click", () => {
            modalContent.querySelector("#weaponStatus").textContent =
                "Selected: " + button.dataset.weapon;
        });
    });
});

$("settingsButton").addEventListener("click", () => {
    openModal("SETTINGS", `
        <label for="qualitySelect">Graphics quality</label>
        <select id="qualitySelect">
            <option value="low">Low — better performance</option>
            <option value="medium" selected>Medium</option>
            <option value="high">High</option>
        </select>
        <p>High graphics may reduce performance on some phones.</p>
        <button id="saveSettings">SAVE SETTINGS</button>
    `);

    $("saveSettings").addEventListener("click", () => {
        const quality = $("qualitySelect").value;
        localStorage.setItem("bunerGraphics", quality);
        closeModal();
    });

    const saved = localStorage.getItem("bunerGraphics");
    if (saved) $("qualitySelect").value = saved;
});

function makeMaterial(color, roughness = 1) {
    return new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness: 0
    });
}

function addBox(x, y, z, width, height, depth, material, solid = true) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(x, y + height / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    scene.add(mesh);

    if (solid) {
        solids.push({
            x,
            z,
            width,
            depth
        });
    }

    return mesh;
}

function addTree(x, z, scale = 1) {
    const trunkMaterial = makeMaterial(0x55402a);
    const leafMaterial = makeMaterial(0x315b2c);

    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2 * scale, 0.28 * scale, 2.2 * scale, 7),
        trunkMaterial
    );

    trunk.position.set(x, 1.1 * scale, z);
    trunk.castShadow = true;
    scene.add(trunk);

    const crown = new THREE.Mesh(
        new THREE.ConeGeometry(1.25 * scale, 3.1 * scale, 7),
        leafMaterial
    );

    crown.position.set(x, 3.1 * scale, z);
    crown.castShadow = true;
    crown.receiveShadow = true;
    scene.add(crown);

    trees.push({ x, z, radius: 0.55 * scale });
}

function addHouse(x, z, width, depth, height) {
    const wallMaterial = makeMaterial(0xaaa58c);
    const roofMaterial = makeMaterial(0x494b40);
    const doorMaterial = makeMaterial(0x493a29);
    const windowMaterial = new THREE.MeshStandardMaterial({
        color: 0x7da6ad,
        roughness: 0.35,
        metalness: 0.15
    });

    addBox(
        x, 0.1, z,
        width, height, depth,
        wallMaterial
    );

    const roof = new THREE.Mesh(
        new THREE.ConeGeometry(
            Math.max(width, depth) * 0.78,
            1.7,
            4
        ),
        roofMaterial
    );

    roof.position.set(x, height + 0.95, z);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    scene.add(roof);

    const door = new THREE.Mesh(
        new THREE.BoxGeometry(1.05, 1.9, 0.12),
        doorMaterial
    );

    door.position.set(x, 1.05, z + depth / 2 + 0.07);
    scene.add(door);

    const windowLeft = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 0.75, 0.12),
        windowMaterial
    );

    windowLeft.position.set(
        x - width * 0.28,
        height * 0.62,
        z + depth / 2 + 0.08
    );

    scene.add(windowLeft);

    const windowRight = windowLeft.clone();
    windowRight.position.x = x + width * 0.28;
    scene.add(windowRight);

    buildings.push({
        x,
        z,
        width,
        depth
    });
}

function createPlayer() {
    player = new THREE.Group();

    const uniform = makeMaterial(0x394a35);
    const boots = makeMaterial(0x282a25);
    const skin = makeMaterial(0xc49b79);
    const rifleMaterial = makeMaterial(0x242824);

    playerBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 1.15, 0.5),
        uniform
    );

    playerBody.position.y = 1.35;
    playerBody.castShadow = true;
    player.add(playerBody);

    playerHead = new THREE.Mesh(
        new THREE.SphereGeometry(0.31, 12, 10),
        skin
    );

    playerHead.position.y = 2.2;
    playerHead.castShadow = true;
    player.add(playerHead);

    const legGeometry = new THREE.BoxGeometry(0.3, 0.85, 0.35);

    const leftLeg = new THREE.Mesh(legGeometry, boots);
    leftLeg.position.set(-0.23, 0.43, 0);
    leftLeg.castShadow = true;
    player.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeometry, boots);
    rightLeg.position.set(0.23, 0.43, 0);
    rightLeg.castShadow = true;
    player.add(rightLeg);

    const rifle = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.15, 1.05),
        rifleMaterial
    );

    rifle.position.set(0.45, 1.55, -0.5);
    rifle.rotation.x = -0.05;
    rifle.castShadow = true;
    player.add(rifle);

    player.position.set(0, 0, 8);
    scene.add(player);
}

function createWorld() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9bb4a0);
    scene.fog = new THREE.Fog(0x9bb4a0, 65, 210);

    camera = new THREE.PerspectiveCamera(
        68,
        window.innerWidth / window.innerHeight,
        0.1,
        350
    );

    const quality = localStorage.getItem("bunerGraphics") || "medium";

    renderer = new THREE.WebGLRenderer({
        antialias: quality !== "low",
        powerPreference: "high-performance"
    });

    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, quality === "high" ? 1.7 : 1.25)
    );

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = quality !== "low";
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    canvasHost.innerHTML = "";
    canvasHost.appendChild(renderer.domElement);

    clock = new THREE.Clock();

    const hemi = new THREE.HemisphereLight(0xdcebdc, 0x394331, 2.0);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffedca, 2.5);
    sun.position.set(-45, 75, 35);
    sun.castShadow = quality !== "low";

    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -65;
    sun.shadow.camera.right = 65;
    sun.shadow.camera.top = 65;
    sun.shadow.camera.bottom = -65;

    scene.add(sun);

    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 32, 32),
        makeMaterial(0x657b4c)
    );

    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    createRoads();
    createHills();
    createBuildings();
    createTrees();
    createPlayer();

    camera.position.set(0, 5, 14);
    camera.lookAt(player.position);
}

function createRoads() {
    const roadMaterial = makeMaterial(0x484d46);

    const road1 = new THREE.Mesh(
        new THREE.PlaneGeometry(12, WORLD_SIZE),
        roadMaterial
    );

    road1.rotation.x = -Math.PI / 2;
    road1.position.y = 0.025;
    road1.receiveShadow = true;
    scene.add(road1);

    const road2 = new THREE.Mesh(
        new THREE.PlaneGeometry(WORLD_SIZE, 10),
        roadMaterial
    );

    road2.rotation.x = -Math.PI / 2;
    road2.position.set(0, 0.03, -25);
    road2.receiveShadow = true;
    scene.add(road2);

    const lineMaterial = makeMaterial(0xd6d2a6);

    for (let z = -110; z < 110; z += 12) {
        addBox(0, 0.05, z, 0.22, 0.02, 5, lineMaterial, false);
    }
}

function createHills() {
    const hillMaterial = makeMaterial(0x526b42);

    const positions = [
        [-65, -50, 19],
        [60, -65, 25],
        [-80, 20, 22],
        [75, 45, 18],
        [25, -100, 28],
        [-30, 95, 24]
    ];

    positions.forEach(([x, z, radius]) => {
        const hill = new THREE.Mesh(
            new THREE.SphereGeometry(radius, 12, 8),
            hillMaterial
        );

        hill.position.set(x, -radius * 0.48, z);
        hill.scale.y = 0.72;
        hill.receiveShadow = true;
        scene.add(hill);
    });
}

function createBuildings() {
    addHouse(-22, -18, 10, 9, 4.4);
    addHouse(24, -37, 12, 10, 4.7);
    addHouse(-28, -55, 9, 8, 4);
    addHouse(32, 15, 11, 9, 4.5);
    addHouse(-42, 35, 12, 10, 4.5);
    addHouse(46, -5, 9, 8, 4);
    addHouse(20, 54, 13, 10, 4.8);
    addHouse(-18, 60, 10, 9, 4.2);
}

function createTrees() {
    for (let i = 0; i < 100; i++) {
        const x = (Math.random() - 0.5) * 205;
        const z = (Math.random() - 0.5) * 205;

        if (Math.abs(x) < 10 || Math.abs(z + 25) < 8) {
            continue;
        }

        const nearBuilding = buildings.some((b) =>
            Math.abs(x - b.x) < b.width * 0.7 + 3 &&
            Math.abs(z - b.z) < b.depth * 0.7 + 3
        );

        if (!nearBuilding) {
            addTree(x, z, 0.75 + Math.random() * 0.65);
        }
    }
}

function canMoveTo(x, z) {
    const margin = 1.0;

    if (
        Math.abs(x) > WORLD_SIZE / 2 - margin ||
        Math.abs(z) > WORLD_SIZE / 2 - margin
    ) {
        return false;
    }

    for (const b of buildings) {
        const insideX = Math.abs(x - b.x) < b.width / 2 + margin;
        const insideZ = Math.abs(z - b.z) < b.depth / 2 + margin;

        if (insideX && insideZ) return false;
    }

    for (const t of trees) {
        const dx = x - t.x;
        const dz = z - t.z;

        if (dx * dx + dz * dz < (t.radius + margin) ** 2) {
            return false;
        }
    }

    return true;
}

function updateCamera(delta) {
    if (!player || !camera) return;

    const distance = 7.5;
    const height = 3.2 + pitch * 2.5;

    const targetX = player.position.x + Math.sin(yaw) * distance;
    const targetZ = player.position.z + Math.cos(yaw) * distance;

    const desired = new THREE.Vector3(
        targetX,
        player.position.y + height,
        targetZ
    );

    const smooth = 1 - Math.exp(-7 * delta);

    camera.position.lerp(desired, smooth);

    const lookTarget = new THREE.Vector3(
        player.position.x,
        player.position.y + 1.5,
        player.position.z
    );

    camera.lookAt(lookTarget);
}

function updatePlayer(delta) {
    if (!player) return;

    let x = moveX;
    let z = moveZ;

    if (keys.KeyW || keys.ArrowUp) z -= 1;
    if (keys.KeyS || keys.ArrowDown) z += 1;
    if (keys.KeyA || keys.ArrowLeft) x -= 1;
    if (keys.KeyD || keys.ArrowRight) x += 1;

    const magnitude = Math.hypot(x, z);

    if (magnitude > 1) {
        x /= magnitude;
        z /= magnitude;
    }

    if (magnitude > 0.05) {
        const speed = isRunning || keys.ShiftLeft ? RUN_SPEED : PLAYER_SPEED;

        const sin = Math.sin(yaw);
        const cos = Math.cos(yaw);

        const worldX = (x * cos + z * sin) * speed * delta;
        const worldZ = (z * cos - x * sin) * speed * delta;

        const nextX = player.position.x + worldX;
        const nextZ = player.position.z + worldZ;

        if (canMoveTo(nextX, player.position.z)) {
            player.position.x = nextX;
        }

        if (canMoveTo(player.position.x, nextZ)) {
            player.position.z = nextZ;
        }

        player.rotation.y = Math.atan2(worldX, worldZ);
    }

    if (jumping) {
        verticalVelocity -= 18 * delta;
        player.position.y += verticalVelocity * delta;

        if (player.position.y <= 0) {
            player.position.y = 0;
            verticalVelocity = 0;
            jumping = false;
        }
    }

    updateCamera(delta);
}

function animate() {
    if (!running) return;

    animationFrame = requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.04);

    updatePlayer(delta);
    renderer.render(scene, camera);
}

function startGame() {
    if (!window.THREE) {
        alert("3D engine could not load. Please check your internet connection and reload the page.");
        return;
    }

    if (running) return;

    lobby.classList.add("hidden");
    gameScreen.classList.remove("hidden");

    try {
        createWorld();
        running = true;
        clock.start();
        showMessage("WELCOME TO BUNER");
        animate();
    } catch (error) {
        console.error(error);
        running = false;
        gameScreen.classList.add("hidden");
        lobby.classList.remove("hidden");
        alert("The game could not start. Please reload the page and try again.");
    }
}

function exitGame() {
    running = false;

    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
    }

    if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
        renderer = null;
    }

    scene = null;
    camera = null;
    player = null;

    solids.length = 0;
    trees.length = 0;
    buildings.length = 0;

    gameScreen.classList.add("hidden");
    lobby.classList.remove("hidden");
}

$("startButton").addEventListener("click", startGame);
$("exitButton").addEventListener("click", exitGame);

$("jumpButton").addEventListener("click", () => {
    if (!jumping && player) {
        jumping = true;
        verticalVelocity = 7.5;
    }
});

$("runButton").addEventListener("touchstart", (event) => {
    event.preventDefault();
    isRunning = true;
}, { passive: false });

$("runButton").addEventListener("touchend", () => {
    isRunning = false;
});

$("runButton").addEventListener("pointerdown", () => {
    isRunning = true;
});

window.addEventListener("pointerup", () => {
    isRunning = false;
});

joystick.addEventListener("pointerdown", (event) => {
    joystick.setPointerCapture(event.pointerId);
    updateJoystick(event);
});

joystick.addEventListener("pointermove", (event) => {
    if (event.buttons || event.pressure > 0) {
        updateJoystick(event);
    }
});

function updateJoystick(event) {
    const rect = joystick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = event.clientX - centerX;
    let dy = event.clientY - centerY;

    const max = 33;
    const length = Math.hypot(dx, dy);

    if (length > max) {
        dx = dx / length * max;
        dy = dy / length * max;
    }

    joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;

    moveX = dx / max;
    moveZ = dy / max;
}

function resetJoystick() {
    moveX = 0;
    moveZ = 0;
    joystickKnob.style.transform = "translate(0, 0)";
}

joystick.addEventListener("pointerup", resetJoystick);
joystick.addEventListener("pointercancel", resetJoystick);
joystick.addEventListener("lostpointercapture", resetJoystick);

canvasHost.addEventListener("pointerdown", (event) => {
    dragging = true;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;

    if (canvasHost.setPointerCapture) {
        try {
            canvasHost.setPointerCapture(event.pointerId);
        } catch (_) {}
    }
});

canvasHost.addEventListener("pointermove", (event) => {
    if (!dragging || !running) return;

    const dx = event.clientX - lastPointerX;
    const dy = event.clientY - lastPointerY;

    lastPointerX = event.clientX;
    lastPointerY = event.clientY;

    yaw -= dx * 0.005;
    pitch = Math.max(-0.25, Math.min(0.7, pitch - dy * 0.002));
});

canvasHost.addEventListener("pointerup", () => {
    dragging = false;
});

canvasHost.addEventListener("pointercancel", () => {
    dragging = false;
});

window.addEventListener("keydown", (event) => {
    keys[event.code] = true;

    if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]
            .includes(event.code)
    ) {
        event.preventDefault();
    }

    if (event.code === "Space" && player && !jumping) {
        jumping = true;
        verticalVelocity = 7.5;
    }
});

window.addEventListener("keyup", (event) => {
    keys[event.code] = false;
});

window.addEventListener("resize", () => {
    if (!renderer || !camera) return;

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener("visibilitychange", () => {
    if (document.hidden && running) {
        resetJoystick();
        isRunning = false;
    }
});