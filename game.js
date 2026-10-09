(() => {
    "use strict";

    // ==========================================
    // BUNER MOBILE V2
    // Mobile 3D Battle Royale Prototype
    // ==========================================

    const $ = (id) => document.getElementById(id);

    const lobby = $("lobby");
    const gameScreen = $("gameScreen");
    const canvasContainer = $("gameCanvas");
    const modal = $("modal");
    const modalTitle = $("modalTitle");
    const modalContent = $("modalContent");

    let scene = null;
    let camera = null;
    let renderer = null;
    let clock = null;

    let player = null;
    let playerBody = null;
    let playerGun = null;
    let muzzleFlash = null;

    let terrain = null;
    let sunLight = null;

    let animationFrame = 0;
    let gameRunning = false;
    let gameStarted = false;
    let countdownRunning = false;

    let selectedWeapon = "rifle";
    let selectedMap = "buner";
    let selectedCharacter = "soldier";

    let cameraYaw = 0;
    let cameraPitch = -0.12;
    let cameraDistance = 5.5;

    let playerVelocityY = 0;
    let isGrounded = true;
    let isRunning = false;
    let isCrouching = false;
    let isAiming = false;
    let isFiring = false;

    let health = 100;
    let ammo = 30;
    let maxAmmo = 30;

    let joystickX = 0;
    let joystickY = 0;

    let lastFireTime = 0;
    let fireCooldown = 180;

    const keys = {};
    const raycaster = new THREE.Raycaster();
    const clockDeltaLimit = 0.05;

    const worldObjects = [];
    const enemies = [];
    const temporaryObjects = [];

    const state = {
        emote: "none",
        playerName: "SURVIVOR",
        graphics: "high",
        sound: true
    };

    // ==========================================
    // HELPERS
    // ==========================================

    function setMessage(message) {
        const element = $("gameMessage");

        if (element) {
            element.textContent = message;
        }
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function random(min, max) {
        return min + Math.random() * (max - min);
    }

    function createMaterial(color, roughness = 0.9) {
        return new THREE.MeshStandardMaterial({
            color,
            roughness
        });
    }

    function createBox(
        width,
        height,
        depth,
        color,
        x,
        y,
        z,
        parent = scene
    ) {
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(width, height, depth),
            createMaterial(color)
        );

        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        parent.add(mesh);
        worldObjects.push(mesh);

        return mesh;
    }

    function makeLabel(text) {
        setMessage(text);
    }

    // ==========================================
    // TERRAIN HEIGHT
    // ==========================================

    function terrainHeight(x, z) {
        let height =
            Math.sin(x * 0.075) * 1.1 +
            Math.cos(z * 0.09) * 0.8 +
            Math.sin((x + z) * 0.045) * 1.4;

        if (selectedMap === "forest") {
            height += Math.sin(x * 0.13) * 0.6;
        }

        if (selectedMap === "desert") {
            height *= 0.55;
        }

        return height;
    }

    // ==========================================
    // WORLD
    // ==========================================

    function createWorld() {
        scene = new THREE.Scene();

        const skyColors = {
            buner: 0x9bc9ed,
            forest: 0x91b8a0,
            desert: 0xe5bd86
        };

        scene.background = new THREE.Color(
            skyColors[selectedMap] || skyColors.buner
        );

        scene.fog = new THREE.Fog(
            skyColors[selectedMap] || skyColors.buner,
            55,
            180
        );

        camera = new THREE.PerspectiveCamera(
            72,
            window.innerWidth / window.innerHeight,
            0.1,
            350
        );

        renderer = new THREE.WebGLRenderer({
            antialias: state.graphics !== "low",
            alpha: false,
            powerPreference: "high-performance"
        });

        renderer.setPixelRatio(
            Math.min(window.devicePixelRatio || 1, 1.5)
        );

        renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );

        renderer.shadowMap.enabled = state.graphics === "high";
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;

        canvasContainer.replaceChildren(renderer.domElement);

        clock = new THREE.Clock();

        const hemiLight = new THREE.HemisphereLight(
            0xe5f1ff,
            0x43553a,
            2.0
        );

        scene.add(hemiLight);

        sunLight = new THREE.DirectionalLight(
            0xfff1d2,
            2.4
        );

        sunLight.position.set(-35, 65, 25);
        sunLight.castShadow = state.graphics === "high";

        sunLight.shadow.mapSize.set(1024, 1024);

        sunLight.shadow.camera.left = -50;
        sunLight.shadow.camera.right = 50;
        sunLight.shadow.camera.top = 50;
        sunLight.shadow.camera.bottom = -50;

        scene.add(sunLight);

        createTerrain();
        createMountains();
        createRoads();
        createBuildings();
        createTrees();
        createPlayer();

        updateCamera(0);

        window.addEventListener("resize", resizeRenderer);
    }

    // ==========================================
    // TERRAIN
    // ==========================================

    function createTerrain() {
        const size = 220;
        const segments = 110;

        const geometry = new THREE.PlaneGeometry(
            size,
            size,
            segments,
            segments
        );

        geometry.rotateX(-Math.PI / 2);

        const positions = geometry.attributes.position;

        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const z = positions.getZ(i);

            positions.setY(
                i,
                terrainHeight(x, z)
            );
        }

        geometry.computeVertexNormals();

        const terrainColors = {
            buner: 0x567c45,
            forest: 0x315e3b,
            desert: 0xb89a67
        };

        terrain = new THREE.Mesh(
            geometry,
            new THREE.MeshStandardMaterial({
                color: terrainColors[selectedMap],
                roughness: 1
            })
        );

        terrain.receiveShadow = true;
        scene.add(terrain);
    }

    // ==========================================
    // MOUNTAINS
    // ==========================================

    function createMountains() {
        const mountainColors = {
            buner: [0x687d70, 0x788b7d, 0x52695b],
            forest: [0x46664d, 0x59745b, 0x304d38],
            desert: [0xb59a77, 0xc5a982, 0x927655]
        };

        const colors = mountainColors[selectedMap];

        for (let i = 0; i < 18; i++) {
            const angle = (i / 18) * Math.PI * 2;
            const radius = random(85, 110);

            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            const height = random(13, 30);
            const width = random(12, 25);

            const mountain = new THREE.Mesh(
                new THREE.ConeGeometry(
                    width,
                    height,
                    5 + Math.floor(Math.random() * 3)
                ),
                createMaterial(
                    colors[Math.floor(Math.random() * colors.length)]
                )
            );

            mountain.position.set(
                x,
                terrainHeight(x, z) + height / 2 - 2,
                z
            );

            mountain.rotation.y = random(0, Math.PI);
            mountain.castShadow = true;
            mountain.receiveShadow = true;

            scene.add(mountain);
        }
    }

    // ==========================================
    // ROADS
    // ==========================================

    function createRoads() {
        const roadMaterial = createMaterial(
            selectedMap === "desert" ? 0x887b65 : 0x66695d
        );

        const road = new THREE.Mesh(
            new THREE.PlaneGeometry(12, 150),
            roadMaterial
        );

        road.rotation.x = -Math.PI / 2;
        road.position.set(0, 0.04, -20);

        road.receiveShadow = true;
        scene.add(road);

        // Road markings

        for (let z = -85; z < 55; z += 9) {
            createBox(
                0.22,
                0.025,
                3.5,
                0xd6d2b4,
                0,
                0.09,
                z
            );
        }
    }

    // ==========================================
    // BUILDINGS
    // ==========================================

    function createHouse(x, z, scale = 1) {
        const house = new THREE.Group();

        const wallColor =
            selectedMap === "desert"
                ? 0xbda47e
                : 0xb6b39a;

        const walls = new THREE.Mesh(
            new THREE.BoxGeometry(
                7 * scale,
                4 * scale,
                6 * scale
            ),
            createMaterial(wallColor)
        );

        walls.position.y = 2 * scale;
        walls.castShadow = true;
        walls.receiveShadow = true;

        house.add(walls);

        const roof = new THREE.Mesh(
            new THREE.ConeGeometry(
                5.7 * scale,
                2.2 * scale,
                4
            ),
            createMaterial(
                selectedMap === "desert"
                    ? 0x775640
                    : 0x544d42
            )
        );

        roof.position.y = 5 * scale;
        roof.rotation.y = Math.PI / 4;

        roof.castShadow = true;
        house.add(roof);

        const door = new THREE.Mesh(
            new THREE.BoxGeometry(
                1.1 * scale,
                2.2 * scale,
                0.12 * scale
            ),
            createMaterial(0x49372a)
        );

        door.position.set(
            0,
            1.1 * scale,
            3.05 * scale
        );

        house.add(door);

        house.position.set(
            x,
            terrainHeight(x, z),
            z
        );

        scene.add(house);
        worldObjects.push(house);
    }

    function createBuildings() {
        const positions = [
            [-18, -20],
            [19, -25],
            [-24, -36],
            [24, -43],
            [-14, -52],
            [17, -61],
            [-32, -12],
            [33, -17]
        ];

        positions.forEach(([x, z], index) => {
            createHouse(
                x,
                z,
                index % 3 === 0 ? 1.15 : 0.9
            );
        });

        // Small roadside structures

        for (let i = 0; i < 5; i++) {
            const x = i % 2 === 0 ? -8 : 8;
            const z = -12 - i * 13;

            createBox(
                1.2,
                1.4,
                1.2,
                0x777b66,
                x,
                terrainHeight(x, z) + 0.7,
                z
            );
        }
    }

    // ==========================================
    // TREES
    // ==========================================

    function createTree(x, z, scale = 1) {
        const tree = new THREE.Group();

        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(
                0.25 * scale,
                0.4 * scale,
                2.5 * scale,
                6
            ),
            createMaterial(0x65442b)
        );

        trunk.position.y = 1.25 * scale;
        trunk.castShadow = true;

        tree.add(trunk);

        const leafColors =
            selectedMap === "forest"
                ? [0x254e30, 0x31643a, 0x3d7541]
                : [0x37673a, 0x467d42, 0x5b8b49];

        for (let i = 0; i < 3; i++) {
            const leaves = new THREE.Mesh(
                new THREE.ConeGeometry(
                    (1.6 - i * 0.2) * scale,
                    2.8 * scale,
                    7
                ),
                createMaterial(leafColors[i])
            );

            leaves.position.y =
                (2.6 + i * 1.2) * scale;

            leaves.castShadow = true;
            tree.add(leaves);
        }

        tree.position.set(
            x,
            terrainHeight(x, z),
            z
        );

        scene.add(tree);
        worldObjects.push(tree);
    }

    function createTrees() {
        for (let i = 0; i < 85; i++) {
            let x = random(-95, 95);
            let z = random(-95, 70);

            // Keep the starting area relatively clear.

            if (Math.abs(x) < 12 && z > -18 && z < 12) {
                x += x < 0 ? -17 : 17;
            }

            // Leave the road open.

            if (Math.abs(x) < 8) {
                x += x < 0 ? -9 : 9;
            }

            createTree(x, z, random(0.75, 1.4));
        }
    }

    // ==========================================
    // PLAYER MODEL
    // ==========================================

    function createPlayer() {
        player = new THREE.Group();

        player.position.set(
            0,
            terrainHeight(0, 0),
            4
        );

        playerBody = new THREE.Group();

        const outfitColors = {
            soldier: 0x354d35,
            scout: 0x777c80,
            desert: 0x9b7a50
        };

        const outfit = outfitColors[selectedCharacter];

        const body = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 1.15, 0.42),
            createMaterial(outfit)
        );

        body.position.y = 1.35;
        body.castShadow = true;

        playerBody.add(body);

        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.29, 12, 12),
            createMaterial(0xc99a75)
        );

        head.position.y = 2.18;
        head.castShadow = true;

        playerBody.add(head);

        const helmet = new THREE.Mesh(
            new THREE.SphereGeometry(
                0.32,
                12,
                8,
                0,
                Math.PI * 2,
                0,
                Math.PI / 2
            ),
            createMaterial(0x303b2d)
        );

        helmet.position.y = 2.28;
        playerBody.add(helmet);

        // Arms

        const armMaterial = createMaterial(outfit);

        const leftArm = new THREE.Mesh(
            new THREE.BoxGeometry(0.22, 0.83, 0.25),
            armMaterial
        );

        leftArm.position.set(-0.52, 1.4, -0.02);
        leftArm.rotation.z = -0.12;

        playerBody.add(leftArm);

        const rightArm = new THREE.Mesh(
            new THREE.BoxGeometry(0.22, 0.83, 0.25),
            armMaterial
        );

        rightArm.position.set(0.52, 1.4, -0.02);
        rightArm.rotation.z = 0.12;

        playerBody.add(rightArm);

        // Legs

        const legMaterial = createMaterial(0x30362c);

        const leftLeg = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.8, 0.34),
            legMaterial
        );

        leftLeg.position.set(-0.22, 0.4, 0);

        playerBody.add(leftLeg);

        const rightLeg = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.8, 0.34),
            legMaterial
        );

        rightLeg.position.set(0.22, 0.4, 0);

        playerBody.add(rightLeg);

        player.add(playerBody);

        // Simple placeholder weapon

        playerGun = new THREE.Group();

        const gunBody = new THREE.Mesh(
            new THREE.BoxGeometry(0.16, 0.17, 0.9),
            createMaterial(0x242a25)
        );

        gunBody.position.z = -0.25;

        playerGun.add(gunBody);

        const barrel = new THREE.Mesh(
            new THREE.CylinderGeometry(
                0.045,
                0.045,
                0.5,
                8
            ),
            createMaterial(0x171b18)
        );

        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0, -0.85);

        playerGun.add(barrel);

        playerGun.position.set(
            0.4,
            1.45,
            -0.35
        );

        playerBody.add(playerGun);

        muzzleFlash = new THREE.Mesh(
            new THREE.SphereGeometry(0.12, 8, 8),
            new THREE.MeshBasicMaterial({
                color: 0xffcc55
            })
        );

        muzzleFlash.position.set(0, 0, -1.15);
        muzzleFlash.visible = false;

        playerGun.add(muzzleFlash);

        scene.add(player);

        updateWeaponAppearance();
    }

    // ==========================================
    // WEAPON APPEARANCE
    // ==========================================

    function updateWeaponAppearance() {
        if (!playerGun) return;

        const dimensions = {
            rifle: [0.16, 0.17, 0.9],
            sniper: [0.13, 0.13, 1.25],
            shotgun: [0.2, 0.18, 0.8],
            smg: [0.17, 0.18, 0.65],
            pistol: [0.14, 0.18, 0.35]
        };

        const length = dimensions[selectedWeapon] || dimensions.rifle;

        const gunBody = playerGun.children[0];

        if (gunBody) {
            gunBody.geometry.dispose();

            gunBody.geometry = new THREE.BoxGeometry(
                length[0],
                length[1],
                length[2]
            );
        }

        const barrel = playerGun.children[1];

        if (barrel) {
            barrel.position.z = -(length[2] / 2 + 0.3);
        }

        if (muzzleFlash) {
            muzzleFlash.position.z = -(length[2] / 2 + 0.55);
        }
    }

    // ==========================================
    // CAMERA
    // ==========================================

    function updateCamera(delta) {
        if (!player || !camera) return;

        const horizontalDistance =
            cameraDistance * Math.cos(cameraPitch);

        const verticalDistance =
            cameraDistance * Math.sin(-cameraPitch);

        const target = new THREE.Vector3(
            player.position.x,
            player.position.y + (isCrouching ? 1.2 : 1.8),
            player.position.z
        );

        const offset = new THREE.Vector3(
            Math.sin(cameraYaw) * horizontalDistance,
            1.5 + verticalDistance,
            Math.cos(cameraYaw) * horizontalDistance
        );

        const desiredPosition = target.clone().add(offset);

        camera.position.lerp(
            desiredPosition,
            Math.min(1, delta * 10)
        );

        camera.lookAt(target);
    }

    // ==========================================
    // RESIZE
    // ==========================================

    function resizeRenderer() {
        if (!camera || !renderer) return;

        camera.aspect =
            window.innerWidth / window.innerHeight;

        camera.updateProjectionMatrix();

        renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );
    }

    // ==========================================
    // START GAME
    // ==========================================

    async function requestGameDisplay() {
        try {
            if (
                document.documentElement.requestFullscreen &&
                !document.fullscreenElement
            ) {
                await document.documentElement.requestFullscreen();
            }
        } catch (error) {
            // Safari may not support fullscreen on ordinary web pages.
        }

        try {
            if (
                screen.orientation &&
                screen.orientation.lock
            ) {
                await screen.orientation.lock("landscape");
            }
        } catch (error) {
            // Orientation locking is not supported in every browser.
        }
    }

    async function startGame() {
        if (countdownRunning) return;

        if (typeof THREE === "undefined") {
            alert(
                "3D engine could not load. Check your internet connection and refresh the page."
            );
            return;
        }

        countdownRunning = true;

        const startButton = $("startButton");

        if (startButton) {
            startButton.disabled = true;
            startButton.textContent = "LOADING...";
        }

        lobby.classList.add("hidden");
        gameScreen.classList.remove("hidden");

        await requestGameDisplay();

        try {
            createWorld();
        } catch (error) {
            console.error("World creation failed:", error);

            gameScreen.classList.add("hidden");
            lobby.classList.remove("hidden");

            countdownRunning = false;

            if (startButton) {
                startButton.disabled = false;
                startButton.innerHTML = "<span>▶</span> START BATTLE";
            }

            alert(
                "The 3D world could not start. Please refresh the page and try again."
            );

            return;
        }

        health = 100;
        ammo = maxAmmo;

        updateHealth();

        const countdown = $("startCountdown");
        const number = $("countdownNumber");

        countdown.classList.remove("hidden");

        let count = 3;

        number.textContent = count;

        const timer = setInterval(() => {
            count--;

            if (count > 0) {
                number.textContent = count;
            } else {
                clearInterval(timer);

                countdown.classList.add("hidden");

                countdownRunning = false;
                gameStarted = true;
                gameRunning = true;

                if (startButton) {
                    startButton.disabled = false;
                    startButton.innerHTML = "<span>▶</span> START BATTLE";
                }

                setMessage("SURVIVE THE BATTLE");

                clock.start();

                animate();
            }
        }, 1000);
    }

    // ==========================================
    // GAME LOOP
    // ==========================================

    function animate() {
        if (!gameRunning || !renderer || !scene || !camera) {
            return;
        }

        animationFrame = requestAnimationFrame(animate);

        const delta = Math.min(
            clock.getDelta(),
            clockDeltaLimit
        );

        updatePlayer(delta);
        updateCamera(delta);
        updateTemporaryObjects(delta);

        renderer.render(scene, camera);
    }

    // ==========================================
    // PLAYER MOVEMENT
    // ==========================================

    function updatePlayer(delta) {
        if (!player) return;

        let forward = -joystickY;
        let sideways = joystickX;

        if (keys.KeyW || keys.ArrowUp) forward = 1;
        if (keys.KeyS || keys.ArrowDown) forward = -1;
        if (keys.KeyA || keys.ArrowLeft) sideways = -1;
        if (keys.KeyD || keys.ArrowRight) sideways = 1;

        const inputLength = Math.hypot(forward, sideways);

        if (inputLength > 1) {
            forward /= inputLength;
            sideways /= inputLength;
        }

        const speed = isCrouching
            ? 2.0
            : isRunning
                ? 8.0
                : 4.5;

        const moveForward = new THREE.Vector3(
            -Math.sin(cameraYaw),
            0,
            -Math.cos(cameraYaw)
        );

        const moveRight = new THREE.Vector3(
            Math.cos(cameraYaw),
            0,
            -Math.sin(cameraYaw)
        );

        const movement = new THREE.Vector3();

        movement.addScaledVector(moveForward, forward);
        movement.addScaledVector(moveRight, sideways);

        if (movement.lengthSq() > 0) {
            movement.normalize();

            player.position.x += movement.x * speed * delta;
            player.position.z += movement.z * speed * delta;

            player.rotation.y = Math.atan2(
                movement.x,
                movement.z
            ) + Math.PI;
        }

        player.position.x = clamp(player.position.x, -100, 100);
        player.position.z = clamp(player.position.z, -100, 100);

        const ground = terrainHeight(
            player.position.x,
            player.position.z
        );

        playerVelocityY -= 17 * delta;

        player.position.y += playerVelocityY * delta;

        if (player.position.y <= ground) {
            player.position.y = ground;
            playerVelocityY = 0;
            isGrounded = true;
        }

        // Simple crouch pose

        if (playerBody) {
            const targetScale = isCrouching ? 0.72 : 1;

            playerBody.scale.y +=
                (targetScale - playerBody.scale.y) *
                Math.min(1, delta * 12);
        }

        // Slight movement animation

        if (playerBody && movement.lengthSq() > 0) {
            const bob = Math.sin(performance.now() * 0.012) * 0.025;

            playerBody.position.y = bob;
        } else if (playerBody) {
            playerBody.position.y = 0;
        }
    }

    // ==========================================
    // JUMP
    // ==========================================

    function jump() {
        if (!gameRunning || !isGrounded) return;

        playerVelocityY = 7.5;
        isGrounded = false;

        setMessage("JUMP");
    }

    // ==========================================
    // FIRE
    // ==========================================

    function fireWeapon() {
        if (!gameRunning || !gameStarted) return;

        const now = performance.now();

        if (now - lastFireTime < fireCooldown) return;

        if (ammo <= 0) {
            setMessage("RELOAD YOUR WEAPON");
            return;
        }

        lastFireTime = now;
        ammo--;

        if (muzzleFlash) {
            muzzleFlash.visible = true;

            setTimeout(() => {
                if (muzzleFlash) {
                    muzzleFlash.visible = false;
                }
            }, 65);
        }

        setMessage(
            selectedWeapon.toUpperCase() +
            " · AMMO " + ammo
        );

        // This is a visual prototype.
        // Real projectile physics and enemy damage
        // will be implemented in a later stage.
    }

    // ==========================================
    // RELOAD
    // ==========================================

    function reloadWeapon() {
        if (!gameRunning) return;

        setMessage("RELOADING...");

        setTimeout(() => {
            if (!gameRunning) return;

            ammo = maxAmmo;

            setMessage(
                "RELOADED · " + ammo
            );
        }, 1000);
    }

    // ==========================================
    // HEALTH HUD
    // ==========================================

    function updateHealth() {
        const bar = $("healthBar");
        const text = $("healthText");

        if (bar) {
            bar.style.width = health + "%";
        }

        if (text) {
            text.textContent = health;
        }
    }

    // ==========================================
    // TEMPORARY OBJECTS
    // ==========================================

    function updateTemporaryObjects(delta) {
        for (let i = temporaryObjects.length - 1; i >= 0; i--) {
            const item = temporaryObjects[i];

            item.life -= delta;

            if (item.life <= 0) {
                scene.remove(item.object);

                if (item.object.geometry) {
                    item.object.geometry.dispose();
                }

                temporaryObjects.splice(i, 1);
            }
        }
    }

    // ==========================================
    // MAP SELECTION
    // ==========================================

    document.querySelectorAll("[data-map]").forEach((button) => {
        button.addEventListener("click", () => {
            selectedMap = button.dataset.map;

            document.querySelectorAll("[data-map]").forEach((item) => {
                item.classList.toggle(
                    "selected",
                    item.dataset.map === selectedMap
                );
            });

            const names = {
                buner: "BUNER VALLEY",
                forest: "FOREST ZONE",
                desert: "DESERT OUTPOST"
            };

            $("selectedMapName").textContent =
                names[selectedMap] || names.buner;
        });
    });

    // ==========================================
    // WEAPON SELECTION
    // ==========================================

    document.querySelectorAll("[data-weapon]").forEach((button) => {
        button.addEventListener("click", () => {
            selectedWeapon = button.dataset.weapon;

            document.querySelectorAll("[data-weapon]").forEach((item) => {
                item.classList.toggle(
                    "selected",
                    item.dataset.weapon === selectedWeapon
                );
            });

            const stats = {
                rifle: { ammo: 30, cooldown: 180 },
                sniper: { ammo: 5, cooldown: 900 },
                shotgun: { ammo: 8, cooldown: 650 },
                smg: { ammo: 40, cooldown: 100 },
                pistol: { ammo: 12, cooldown: 300 }
            };

            const selected = stats[selectedWeapon] || stats.rifle;

            maxAmmo = selected.ammo;
            ammo = maxAmmo;
            fireCooldown = selected.cooldown;

            if (playerGun) {
                updateWeaponAppearance();
            }
        });
    });

    // ==========================================
    // MODAL SYSTEM
    // ==========================================

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
        if (event.target === modal) {
            closeModal();
        }
    });

    // ==========================================
    // PROFILE
    // ==========================================

    $("editProfile").addEventListener("click", () => {
        openModal(
            "PLAYER PROFILE",
            `
                <p>Choose your player name.</p>
                <input
                    id="profileNameInput"
                    maxlength="16"
                    placeholder="Enter player name"
                    value="${escapeHTML(state.playerName)}"
                >
                <button id="saveProfileButton">SAVE PROFILE</button>
            `
        );

        $("saveProfileButton").addEventListener("click", () => {
            const input = $("profileNameInput");
            const value = input.value.trim();

            if (!value) {
                input.focus();
                return;
            }

            state.playerName = value;

            $("playerName").textContent = value;

            closeModal();
        });
    });

    function escapeHTML(value) {
        return String(value).replace(/[&<>"']/g, (character) => {
            const entities = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            };

            return entities[character];
        });
    }

    // ==========================================
    // CHARACTER SELECTION
    // ==========================================

    $("characterButton").addEventListener("click", () => {
        openModal(
            "SELECT CHARACTER",
            `
                <p>Choose your fighter.</p>

                <button data-character-choice="soldier">
                    🪖 SOLDIER
                </button>

                <button data-character-choice="scout">
                    🥷 SCOUT
                </button>

                <button data-character-choice="desert">
                    🏜️ DESERT FIGHTER
                </button>

                <p>
                    Character changes currently affect the
                    prototype character's outfit color.
                </p>
            `
        );

        modalContent.querySelectorAll("[data-character-choice]").forEach((button) => {
            button.addEventListener("click", () => {
                selectedCharacter = button.dataset.characterChoice;

                const statusNames = {
                    soldier: "Soldier",
                    scout: "Scout",
                    desert: "Desert Fighter"
                };

                $("playerStatus").textContent =
                    statusNames[selectedCharacter];

                closeModal();

                // Rebuild the character model if the 3D world is active.

                if (player && scene) {
                    scene.remove(player);

                    player = null;
                    playerBody = null;
                    playerGun = null;
                    muzzleFlash = null;

                    createPlayer();
                }
            });
        });
    });

    // ==========================================
    // EMOTES
    // ==========================================

    $("emoteButton").addEventListener("click", () => {
        openModal(
            "EMOTES",
            `
                <p>Select an emote.</p>

                <button data-emote-choice="wave">
                    👋 WAVE
                </button>

                <button data-emote-choice="dance">
                    🕺 DANCE
                </button>

                <button data-emote-choice="celebrate">
                    🎉 CELEBRATE
                </button>

                <button data-emote-choice="none">
                    ⏹ STOP EMOTE
                </button>

                <p>
                    Full character emote animations will be
                    added with the animation system.
                </p>
            `
        );

        modalContent.querySelectorAll("[data-emote-choice]").forEach((button) => {
            button.addEventListener("click", () => {
                state.emote = button.dataset.emoteChoice;

                closeModal();

                if (playerBody) {
                    playerBody.rotation.y =
                        state.emote === "wave" ? 0.2 : 0;
                }

                setMessage(
                    state.emote === "none"
                        ? "EMOTE STOPPED"
                        : state.emote.toUpperCase() + " SELECTED"
                );
            });
        });
    });

    // ==========================================
    // LOADOUT
    // ==========================================

    $("loadoutButton").addEventListener("click", () => {
        openModal(
            "WEAPON LOADOUT",
            `
                <p>Current primary weapon:</p>
                <h3>${escapeHTML(selectedWeapon.toUpperCase())}</h3>
                <p>Magazine: ${maxAmmo}</p>
                <p>Select another weapon from the Lobby.</p>
                <button id="closeLoadout">OK</button>
            `
        );

        $("closeLoadout").addEventListener("click", closeModal);
    });

    // ==========================================
    // INVENTORY
    // ==========================================

    $("inventoryButton").addEventListener("click", () => {
        openModal(
            "INVENTORY",
            `
                <p>Available equipment</p>
                <ul>
                    <li>Primary weapon: ${escapeHTML(selectedWeapon)}</li>
                    <li>Health: 100</li>
                    <li>Magazine: ${maxAmmo} rounds</li>
                </ul>
                <p>
                    Backpack, ammunition pickups and healing
                    items will be implemented later.
                </p>
            `
        );
    });

    // ==========================================
    // SETTINGS
    // ==========================================

    $("settingsButton").addEventListener("click", () => {
        openModal(
            "GAME SETTINGS",
            `
                <label for="graphicsSelect">
                    GRAPHICS QUALITY
                </label>

                <select id="graphicsSelect">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                </select>

                <p>
                    Graphics changes apply the next time
                    the 3D world is created.
                </p>

                <button id="saveSettingsButton">
                    SAVE SETTINGS
                </button>
            `
        );

        $("graphicsSelect").value = state.graphics;

        $("saveSettingsButton").addEventListener("click", () => {
            state.graphics = $("graphicsSelect").value;

            closeModal();
        });
    });

    // ==========================================
    // JOYSTICK
    // ==========================================

    const joystick = $("joystick");
    const joystickKnob = $("joystickKnob");

    let joystickPointer = null;

    function updateJoystick(event) {
        const rect = joystick.getBoundingClientRect();

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const maxRadius = rect.width * 0.32;

        let dx = event.clientX - centerX;
        let dy = event.clientY - centerY;

        const length = Math.hypot(dx, dy);

        if (length > maxRadius) {
            dx = (dx / length) * maxRadius;
            dy = (dy / length) * maxRadius;
        }

        joystickX = dx / maxRadius;
        joystickY = dy / maxRadius;

        joystickKnob.style.left =
            `calc(50% + ${dx}px)`;

        joystickKnob.style.top =
            `calc(50% + ${dy}px)`;

        joystickKnob.style.transform = "translate(-50%, -50%)";
    }

    function resetJoystick() {
        joystickPointer = null;
        joystickX = 0;
        joystickY = 0;

        joystickKnob.style.left = "50%";
        joystickKnob.style.top = "50%";
    }

    joystick.addEventListener("pointerdown", (event) => {
        event.preventDefault();

        joystickPointer = event.pointerId;

        try {
            joystick.setPointerCapture(event.pointerId);
        } catch (error) {}

        updateJoystick(event);
    });

    joystick.addEventListener("pointermove", (event) => {
        if (event.pointerId !== joystickPointer) return;

        updateJoystick(event);
    });

    joystick.addEventListener("pointerup", (event) => {
        if (event.pointerId === joystickPointer) {
            resetJoystick();
        }
    });

    joystick.addEventListener("pointercancel", resetJoystick);

    // ==========================================
    // CAMERA LOOK
    // ==========================================

    let lookPointer = null;
    let lastLookX = 0;
    let lastLookY = 0;

    canvasContainer.addEventListener("pointerdown", (event) => {
        if (!gameRunning || lookPointer !== null) return;

        // The right half of the screen controls the camera.

        if (event.clientX < window.innerWidth * 0.38) {
            return;
        }

        lookPointer = event.pointerId;

        lastLookX = event.clientX;
        lastLookY = event.clientY;

        try {
            canvasContainer.setPointerCapture(event.pointerId);
        } catch (error) {}
    });

    canvasContainer.addEventListener("pointermove", (event) => {
        if (event.pointerId !== lookPointer) return;

        const dx = event.clientX - lastLookX;
        const dy = event.clientY - lastLookY;

        lastLookX = event.clientX;
        lastLookY = event.clientY;

        cameraYaw -= dx * 0.006;
        cameraPitch -= dy * 0.004;

        cameraPitch = clamp(cameraPitch, -1.0, 1.05);
    });

    function resetLook(event) {
        if (!event || event.pointerId === lookPointer) {
            lookPointer = null;
        }
    }

    canvasContainer.addEventListener("pointerup", resetLook);
    canvasContainer.addEventListener("pointercancel", resetLook);

    // ==========================================
    // ACTION BUTTONS
    // ==========================================

    $("jumpButton").addEventListener("click", jump);

    $("runButton").addEventListener("pointerdown", () => {
        isRunning = true;
    });

    $("runButton").addEventListener("pointerup", () => {
        isRunning = false;
    });

    $("runButton").addEventListener("pointercancel", () => {
        isRunning = false;
    });

    $("runButton").addEventListener("pointerleave", () => {
        isRunning = false;
    });

    $("crouchButton").addEventListener("click", () => {
        isCrouching = !isCrouching;

        $("crouchButton").classList.toggle(
            "active",
            isCrouching
        );
    });

    $("aimButton").addEventListener("click", () => {
        isAiming = !isAiming;

        cameraDistance = isAiming ? 3.5 : 5.5;

        $("aimButton").classList.toggle(
            "active",
            isAiming
        );
    });

    $("reloadButton").addEventListener("click", reloadWeapon);

    $("fireButton").addEventListener("pointerdown", (event) => {
        event.preventDefault();

        isFiring = true;
        fireWeapon();
    });

    $("fireButton").addEventListener("pointerup", () => {
        isFiring = false;
    });

    $("fireButton").addEventListener("pointercancel", () => {
        isFiring = false;
    });

    $("fireButton").addEventListener("pointerleave", () => {
        isFiring = false;
    });

    // ==========================================
    // KEYBOARD SUPPORT
    // ==========================================

    window.addEventListener("keydown", (event) => {
        keys[event.code] = true;

        if (
            ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]
                .includes(event.code)
        ) {
            event.preventDefault();
        }

        if (event.code === "Space") jump();

        if (event.code === "ShiftLeft") isRunning = true;

        if (event.code === "KeyF") fireWeapon();

        if (event.code === "KeyR") reloadWeapon();
    });

    window.addEventListener("keyup", (event) => {
        keys[event.code] = false;

        if (event.code === "ShiftLeft") {
            isRunning = false;
        }
    });

    window.addEventListener("blur", () => {
        isRunning = false;
        isFiring = false;

        resetJoystick();
        resetLook();
    });

    // ==========================================
    // EXIT GAME
    // ==========================================

    $("exitButton").addEventListener("click", async () => {
        gameRunning = false;
        gameStarted = false;
        countdownRunning = false;

        cancelAnimationFrame(animationFrame);

        if (renderer) {
            renderer.dispose();
            renderer.domElement.remove();
        }

        renderer = null;
        camera = null;
        scene = null;
        player = null;
        playerBody = null;
        playerGun = null;
        muzzleFlash = null;

        worldObjects.length = 0;
        temporaryObjects.length = 0;
        enemies.length = 0;

        gameScreen.classList.add("hidden");
        lobby.classList.remove("hidden");

        resetJoystick();

        isRunning = false;
        isCrouching = false;
        isAiming = false;

        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            }
        } catch (error) {}

        try {
            if (
                screen.orientation &&
                screen.orientation.unlock
            ) {
                screen.orientation.unlock();
            }
        } catch (error) {}

        window.removeEventListener("resize", resizeRenderer);

        window.addEventListener("resize", resizeRenderer);
    });

    // ==========================================
    // INITIALIZATION
    // ==========================================

    function initializeLobby() {
    $("playerName").textContent = state.playerName;
    $("selectedMapName").textContent = "BUNER VALLEY";
    setMessage("READY FOR BATTLE");
}
// Connect the START BATTLE button.
$("startButton").addEventListener("click", startGame);
initializeLobby();
})();