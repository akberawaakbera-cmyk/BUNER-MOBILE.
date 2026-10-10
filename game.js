(() => {
    "use strict";

    // ==========================================
    // BUNER MOBILE V3
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

    let previewScene = null;
    let previewCamera = null;
    let previewRenderer = null;
    let previewCharacter = null;
    let previewAnimationFrame = 0;
    let previewPointer = null;
    let previewLastX = 0;

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
    const clockDeltaLimit = 0.05;

    const temporaryObjects = [];
    const collisionObjects = [];

    const state = {
        emote: "none",
        playerName: "SURVIVOR",
        graphics: "high",
        sound: true
    };

    const CHARACTER_COLORS = {
        soldier: {
            outfit: 0x435b3c,
            pants: 0x303a2e,
            helmet: 0x263528,
            skin: 0xc99470,
            accent: 0x8a9a64
        },
        scout: {
            outfit: 0x68747b,
            pants: 0x353d47,
            helmet: 0x343c45,
            skin: 0xc99470,
            accent: 0xb5c0c4
        },
        desert: {
            outfit: 0xa98a5e,
            pants: 0x66543b,
            helmet: 0x8d744d,
            skin: 0xc99470,
            accent: 0xd0b789
        }
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

    function createMaterial(color, roughness = 0.9, metalness = 0) {
        return new THREE.MeshStandardMaterial({
            color,
            roughness,
            metalness
        });
    }

    function addMesh(parent, geometry, material, x, y, z) {
        const mesh = new THREE.Mesh(geometry, material);

        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        parent.add(mesh);

        return mesh;
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
        const mesh = addMesh(
            parent,
            new THREE.BoxGeometry(width, height, depth),
            createMaterial(color),
            x,
            y,
            z
        );

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
    // COLLISION SYSTEM
    // ==========================================

    function addCollisionCircle(x, z, radius) {
        collisionObjects.push({
            type: "circle",
            x,
            z,
            radius
        });
    }

    function addCollisionBox(x, z, halfWidth, halfDepth) {
        collisionObjects.push({
            type: "box",
            x,
            z,
            halfWidth,
            halfDepth
        });
    }

    function isPositionBlocked(x, z, radius = 0.48) {
        for (const obstacle of collisionObjects) {
            if (obstacle.type === "circle") {
                const dx = x - obstacle.x;
                const dz = z - obstacle.z;

                const combinedRadius = radius + obstacle.radius;

                if (
                    dx * dx + dz * dz <
                    combinedRadius * combinedRadius
                ) {
                    return true;
                }
            }

            if (obstacle.type === "box") {
                const closestX = clamp(
                    x,
                    obstacle.x - obstacle.halfWidth,
                    obstacle.x + obstacle.halfWidth
                );

                const closestZ = clamp(
                    z,
                    obstacle.z - obstacle.halfDepth,
                    obstacle.z + obstacle.halfDepth
                );

                const dx = x - closestX;
                const dz = z - closestZ;

                if (dx * dx + dz * dz < radius * radius) {
                    return true;
                }
            }
        }

        return false;
    }

    function movePlayerWithCollision(dx, dz) {
        if (!player) return;

        const radius = isCrouching ? 0.4 : 0.48;

        const nextX = clamp(
            player.position.x + dx,
            -103,
            103
        );

        const nextZ = clamp(
            player.position.z + dz,
            -103,
            103
        );

        // Check X and Z independently so the player can
        // slide along walls instead of getting stuck.

        if (!isPositionBlocked(nextX, player.position.z, radius)) {
            player.position.x = nextX;
        }

        if (!isPositionBlocked(player.position.x, nextZ, radius)) {
            player.position.z = nextZ;
        }
    }

    // ==========================================
    // WORLD CREATION
    // ==========================================

    function createWorld() {
        disposeWorld();

        scene = new THREE.Scene();

        const skyColors = {
            buner: 0x9bc9ed,
            forest: 0x91b8a0,
            desert: 0xe5bd86
        };

        const skyColor = skyColors[selectedMap] || skyColors.buner;

        scene.background = new THREE.Color(skyColor);
        scene.fog = new THREE.Fog(skyColor, 55, 180);

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
            2
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

        collisionObjects.length = 0;

        createTerrain();
        createMountains();
        createRoads();
        createBuildings();
        createTrees();
        createPlayer();

        updateCamera(1);

        window.removeEventListener("resize", resizeRenderer);
        window.addEventListener("resize", resizeRenderer);
    }

    function disposeWorld() {
        gameRunning = false;

        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = 0;
        }

        if (renderer) {
            renderer.dispose();
            renderer.domElement.remove();
        }

        if (scene) {
            scene.traverse((object) => {
                if (object.geometry) {
                    object.geometry.dispose();
                }

                if (object.material) {
                    const materials = Array.isArray(object.material)
                        ? object.material
                        : [object.material];

                    materials.forEach((material) => {
                        material.dispose();
                    });
                }
            });
        }

        renderer = null;
        camera = null;
        scene = null;
        player = null;
        playerBody = null;
        playerGun = null;
        muzzleFlash = null;
        terrain = null;

        collisionObjects.length = 0;
        temporaryObjects.length = 0;
    }

    // ==========================================
    // TERRAIN
    // ==========================================

    function createTerrain() {
        const size = 220;
        const segments = state.graphics === "low" ? 55 : 110;

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

            positions.setY(i, terrainHeight(x, z));
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
                color: terrainColors[selectedMap] || terrainColors.buner,
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

        const colors = mountainColors[selectedMap] || mountainColors.buner;

        for (let i = 0; i < 18; i++) {
            const angle = (i / 18) * Math.PI * 2;
            const radius = random(85, 110);

            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            const height = random(13, 30);
            const width = random(12, 25);

            const mountain = addMesh(
                scene,
                new THREE.ConeGeometry(
                    width,
                    height,
                    5 + Math.floor(Math.random() * 3)
                ),
                createMaterial(
                    colors[Math.floor(Math.random() * colors.length)]
                ),
                x,
                terrainHeight(x, z) + height / 2 - 2,
                z
            );

            mountain.rotation.y = random(0, Math.PI);
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
            selectedMap === "desert" ? 0xbda47e : 0xb6b39a;

        const walls = addMesh(
            house,
            new THREE.BoxGeometry(
                7 * scale,
                4 * scale,
                6 * scale
            ),
            createMaterial(wallColor),
            0,
            2 * scale,
            0
        );

        walls.receiveShadow = true;

        const roof = addMesh(
            house,
            new THREE.ConeGeometry(5.7 * scale, 2.2 * scale, 4),
            createMaterial(
                selectedMap === "desert" ? 0x775640 : 0x544d42
            ),
            0,
            5 * scale,
            0
        );

        roof.rotation.y = Math.PI / 4;

        const door = addMesh(
            house,
            new THREE.BoxGeometry(
                1.1 * scale,
                2.2 * scale,
                0.12 * scale
            ),
            createMaterial(0x49372a),
            0,
            1.1 * scale,
            3.05 * scale
        );

        house.position.set(
            x,
            terrainHeight(x, z),
            z
        );

        scene.add(house);

        // Approximate collision area for the entire house.
        // The decorative door is not a walk-through doorway.

        addCollisionBox(
            x,
            z,
            3.8 * scale,
            3.3 * scale
        );
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

            addCollisionBox(x, z, 0.85, 0.85);
        }
    }

    // ==========================================
    // TREES
    // ==========================================

    function createTree(x, z, scale = 1) {
        const tree = new THREE.Group();

        addMesh(
            tree,
            new THREE.CylinderGeometry(
                0.25 * scale,
                0.4 * scale,
                2.5 * scale,
                6
            ),
            createMaterial(0x65442b),
            0,
            1.25 * scale,
            0
        );

        const leafColors =
            selectedMap === "forest"
                ? [0x254e30, 0x31643a, 0x3d7541]
                : [0x37673a, 0x467d42, 0x5b8b49];

        for (let i = 0; i < 3; i++) {
            addMesh(
                tree,
                new THREE.ConeGeometry(
                    (1.6 - i * 0.2) * scale,
                    2.8 * scale,
                    7
                ),
                createMaterial(leafColors[i]),
                0,
                (2.6 + i * 1.2) * scale,
                0
            );
        }

        tree.position.set(x, terrainHeight(x, z), z);
        scene.add(tree);

        addCollisionCircle(x, z, 0.65 * scale);
    }

    function createTrees() {
        const count = state.graphics === "low" ? 45 : 85;

        for (let i = 0; i < count; i++) {
            let x = random(-95, 95);
            let z = random(-95, 70);

            if (Math.abs(x) < 12 && z > -18 && z < 12) {
                x += x < 0 ? -17 : 17;
            }

            if (Math.abs(x) < 8) {
                x += x < 0 ? -9 : 9;
            }

            // Keep the player spawn area clear.
            if (Math.abs(x) < 5 && z > -2 && z < 12) {
                x += 12;
            }

            createTree(x, z, random(0.75, 1.4));
        }
    }

    // ==========================================
    // CHARACTER MODEL
    // ==========================================

    function buildCharacterModel(parent, options = {}) {
        const colors = CHARACTER_COLORS[selectedCharacter] ||
            CHARACTER_COLORS.soldier;

        const root = new THREE.Group();
        parent.add(root);

        const bodyPivot = new THREE.Group();
        root.add(bodyPivot);

        // Torso
        addMesh(
            bodyPivot,
            new THREE.BoxGeometry(0.82, 0.95, 0.43),
            createMaterial(colors.outfit),
            0,
            1.38,
            0
        );

        // Chest armor
        addMesh(
            bodyPivot,
            new THREE.BoxGeometry(0.65, 0.45, 0.12),
            createMaterial(colors.accent, 0.65, 0.1),
            0,
            1.52,
            -0.24
        );

        // Belt
        addMesh(
            bodyPivot,
            new THREE.BoxGeometry(0.76, 0.12, 0.46),
            createMaterial(0x302c25),
            0,
            0.91,
            0
        );

        // Neck
        addMesh(
            bodyPivot,
            new THREE.CylinderGeometry(0.12, 0.14, 0.2, 10),
            createMaterial(colors.skin),
            0,
            1.93,
            0
        );

        // Head
        addMesh(
            bodyPivot,
            new THREE.SphereGeometry(0.285, 16, 12),
            createMaterial(colors.skin),
            0,
            2.17,
            0
        );

        // Helmet
        const helmet = addMesh(
            bodyPivot,
            new THREE.SphereGeometry(
                0.32,
                16,
                10,
                0,
                Math.PI * 2,
                0,
                Math.PI / 2
            ),
            createMaterial(colors.helmet),
            0,
            2.29,
            0
        );

        // Helmet rim
        addMesh(
            bodyPivot,
            new THREE.CylinderGeometry(0.32, 0.32, 0.055, 16),
            createMaterial(colors.helmet),
            0,
            2.25,
            0
        );

        // Eyes
        const eyeMaterial = new THREE.MeshStandardMaterial({
            color: 0x171a18,
            roughness: 0.5
        });

        addMesh(
            bodyPivot,
            new THREE.SphereGeometry(0.025, 8, 8),
            eyeMaterial,
            -0.095,
            2.19,
            -0.263
        );

        addMesh(
            bodyPivot,
            new THREE.SphereGeometry(0.025, 8, 8),
            eyeMaterial,
            0.095,
            2.19,
            -0.263
        );

        // Arms
        const leftArmPivot = new THREE.Group();
        leftArmPivot.position.set(-0.49, 1.72, 0);
        bodyPivot.add(leftArmPivot);

        addMesh(
            leftArmPivot,
            new THREE.BoxGeometry(0.24, 0.68, 0.27),
            createMaterial(colors.outfit),
            0,
            -0.34,
            0
        );

        addMesh(
            leftArmPivot,
            new THREE.BoxGeometry(0.21, 0.23, 0.23),
            createMaterial(colors.skin),
            0,
            -0.72,
            -0.015
        );

        const rightArmPivot = new THREE.Group();
        rightArmPivot.position.set(0.49, 1.72, 0);
        bodyPivot.add(rightArmPivot);

        addMesh(
            rightArmPivot,
            new THREE.BoxGeometry(0.24, 0.68, 0.27),
            createMaterial(colors.outfit),
            0,
            -0.34,
            0
        );

        addMesh(
            rightArmPivot,
            new THREE.BoxGeometry(0.21, 0.23, 0.23),
            createMaterial(colors.skin),
            0,
            -0.72,
            -0.015
        );

        // Legs
        const leftLegPivot = new THREE.Group();
        leftLegPivot.position.set(-0.22, 0.82, 0);
        bodyPivot.add(leftLegPivot);

        addMesh(
            leftLegPivot,
            new THREE.BoxGeometry(0.31, 0.72, 0.34),
            createMaterial(colors.pants),
            0,
            -0.36,
            0
        );

        addMesh(
            leftLegPivot,
            new THREE.BoxGeometry(0.34, 0.2, 0.48),
            createMaterial(0x252822),
            0,
            -0.76,
            -0.04
        );

        const rightLegPivot = new THREE.Group();
        rightLegPivot.position.set(0.22, 0.82, 0);
        bodyPivot.add(rightLegPivot);

        addMesh(
            rightLegPivot,
            new THREE.BoxGeometry(0.31, 0.72, 0.34),
            createMaterial(colors.pants),
            0,
            -0.36,
            0
        );

        addMesh(
            rightLegPivot,
            new THREE.BoxGeometry(0.34, 0.2, 0.48),
            createMaterial(0x252822),
            0,
            -0.76,
            -0.04
        );

        // Backpack
        addMesh(
            bodyPivot,
            new THREE.BoxGeometry(0.48, 0.57, 0.22),
            createMaterial(0x373d2d),
            0,
            1.38,
            0.31
        );

        // Weapon
        const gun = new THREE.Group();

        addMesh(
            gun,
            new THREE.BoxGeometry(0.16, 0.17, 0.9),
            createMaterial(0x242a25, 0.5, 0.25),
            0,
            0,
            0
        );

        addMesh(
            gun,
            new THREE.BoxGeometry(0.13, 0.3, 0.2),
            createMaterial(0x343a33),
            0,
            -0.2,
            0.14
        );

        addMesh(
            gun,
            new THREE.CylinderGeometry(0.045, 0.045, 0.5, 8),
            createMaterial(0x171b18, 0.45, 0.35),
            0,
            0,
            -0.65
        ).rotation.x = Math.PI / 2;

        gun.position.set(0.36, 1.42, -0.36);
        bodyPivot.add(gun);

        const flash = new THREE.Mesh(
            new THREE.SphereGeometry(0.12, 8, 8),
            new THREE.MeshBasicMaterial({
                color: 0xffcc55
            })
        );

        flash.position.set(0, 0, -0.95);
        flash.visible = false;
        gun.add(flash);

        return {
            root,
            bodyPivot,
            leftArmPivot,
            rightArmPivot,
            leftLegPivot,
            rightLegPivot,
            gun,
            flash
        };
    }

    function createPlayer() {
    player = new THREE.Group();

    player.position.set(
        0,
        terrainHeight(0, 4),
        4
    );

    // Keep the original character as a fallback.
    const fallback = buildCharacterModel(player);

    playerBody = fallback.bodyPivot;
    playerGun = fallback.gun;
    muzzleFlash = fallback.flash;
    player.userData.model = fallback;

    scene.add(player);
    updateWeaponAppearance();

    // Load the custom 3D character.
    if (typeof window.GLTFLoader !== "function") {
        console.error("GLTFLoader is not available.");
        setMessage("3D MODEL LOADER ERROR");
        return;
    }

    const loader = new window.GLTFLoader();

    loader.load(
    "https://model_E06A91C3-7469-4FE0-918B-26317C457A5A.glb",
    

        function (gltf) {
            if (!player || !scene) return;

            const character = gltf.scene;

            // Measure the imported model.
            const box = new THREE.Box3().setFromObject(character);
            const size = box.getSize(new THREE.Vector3());

            if (size.y <= 0) {
                console.error("The GLB model has invalid dimensions.");
                return;
            }

            // Resize the model to approximately 2.2 units tall.
            const scale = 2.2 / size.y;
            character.scale.setScalar(scale);

            // Center the model and place its feet at ground level.
            const scaledBox = new THREE.Box3().setFromObject(character);
            const center = scaledBox.getCenter(new THREE.Vector3());

            character.position.x -= center.x;
            character.position.z -= center.z;
            character.position.y -= scaledBox.min.y;

            // Preserve the weapon while replacing the old character.
            const weapon = fallback.gun;
            const flash = fallback.flash;

            if (weapon.parent) {
                weapon.parent.remove(weapon);
            }

            player.remove(fallback.root);

            const characterRoot = new THREE.Group();
            characterRoot.add(character);
            player.add(characterRoot);

            player.add(weapon);

            weapon.position.set(0.36, 1.42, -0.36);

            playerBody = characterRoot;
            playerGun = weapon;
            muzzleFlash = flash;

            // The imported model does not use the old procedural limbs.
            player.userData.model = null;

            updateWeaponAppearance();

            console.log("BUNER MOBILE: Custom GLB character loaded.");
            setMessage("CUSTOM CHARACTER LOADED");
        },

        undefined,

        function (error) {
            console.error("Could not load player.glb:", error);
            setMessage("3D MODEL FAILED TO LOAD");
        }
    );
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

        const barrel = playerGun.children.find(
            (child) => child.geometry &&
                child.geometry.type === "CylinderGeometry"
        );

        if (barrel) {
            barrel.position.z = -(length[2] / 2 + 0.2);
        }

        if (muzzleFlash) {
            muzzleFlash.position.z = -(length[2] / 2 + 0.4);
        }
    }

    // ==========================================
    // LOBBY CHARACTER PREVIEW
    // ==========================================

    function disposePreview() {
        if (previewAnimationFrame) {
            cancelAnimationFrame(previewAnimationFrame);
            previewAnimationFrame = 0;
        }

        if (previewRenderer) {
            previewRenderer.dispose();
            previewRenderer.domElement.remove();
        }

        if (previewScene) {
            previewScene.traverse((object) => {
                if (object.geometry) {
                    object.geometry.dispose();
                }

                if (object.material) {
                    const materials = Array.isArray(object.material)
                        ? object.material
                        : [object.material];

                    materials.forEach((material) => {
                        material.dispose();
                    });
                }
            });
        }

        previewRenderer = null;
        previewScene = null;
        previewCamera = null;
        previewCharacter = null;
    }

    function createCharacterPreview() {
        const container = $("characterPreviewCanvas");

        if (!container || typeof THREE === "undefined") return;

        disposePreview();

        try {
            previewScene = new THREE.Scene();
            previewScene.background = new THREE.Color(0x24322b);

            previewCamera = new THREE.PerspectiveCamera(
                35,
                1,
                0.1,
                50
            );

            previewCamera.position.set(0, 2.0, 7.2);
            previewCamera.lookAt(0, 1.25, 0);

            previewRenderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: false,
                powerPreference: "low-power"
            });

            previewRenderer.setPixelRatio(
                Math.min(window.devicePixelRatio || 1, 1.5)
            );

            previewRenderer.setSize(
                Math.max(container.clientWidth, 150),
                Math.max(container.clientHeight, 150)
            );

            previewRenderer.outputColorSpace = THREE.SRGBColorSpace;
            previewRenderer.toneMapping = THREE.ACESFilmicToneMapping;
            previewRenderer.toneMappingExposure = 1.15;

            container.replaceChildren(previewRenderer.domElement);

            previewScene.add(
                new THREE.HemisphereLight(0xe5f1ff, 0x263324, 2.3)
            );

            const light = new THREE.DirectionalLight(0xffe6bf, 2.8);
            light.position.set(-3, 7, 5);
            previewScene.add(light);

            const fill = new THREE.DirectionalLight(0x89baff, 1.2);
            fill.position.set(4, 3, -4);
            previewScene.add(fill);

            const floor = new THREE.Mesh(
                new THREE.CircleGeometry(2.4, 32),
                createMaterial(0x35463b)
            );

            floor.rotation.x = -Math.PI / 2;
            floor.position.y = -0.025;
            previewScene.add(floor);

            previewCharacter = buildCharacterModel(previewScene);

            previewCharacter.root.position.y = 0;
            previewCharacter.root.rotation.y = Math.PI;

            updateWeaponAppearancePreview();

            resizePreview();
            animatePreview();
        } catch (error) {
            console.error("Character preview error:", error);
            disposePreview();
        }
    }

    function updateWeaponAppearancePreview() {
        if (!previewCharacter) return;

        const gun = previewCharacter.gun;

        const dimensions = {
            rifle: [0.16, 0.17, 0.9],
            sniper: [0.13, 0.13, 1.25],
            shotgun: [0.2, 0.18, 0.8],
            smg: [0.17, 0.18, 0.65],
            pistol: [0.14, 0.18, 0.35]
        };

        const length = dimensions[selectedWeapon] || dimensions.rifle;
        const gunBody = gun.children[0];

        if (gunBody) {
            gunBody.geometry.dispose();
            gunBody.geometry = new THREE.BoxGeometry(
                length[0],
                length[1],
                length[2]
            );
        }

        const barrel = gun.children.find(
            (child) => child.geometry &&
                child.geometry.type === "CylinderGeometry"
        );

        if (barrel) {
            barrel.position.z = -(length[2] / 2 + 0.2);
        }

        if (previewCharacter.flash) {
            previewCharacter.flash.position.z = -(length[2] / 2 + 0.4);
        }
    }

    function resizePreview() {
        if (!previewRenderer || !previewCamera) return;

        const container = $("characterPreviewCanvas");

        if (!container) return;

        const width = Math.max(container.clientWidth, 150);
        const height = Math.max(container.clientHeight, 150);

        previewCamera.aspect = width / height;
        previewCamera.updateProjectionMatrix();

        previewRenderer.setSize(width, height);
    }

    function animatePreview() {
        if (!previewRenderer || !previewScene || !previewCamera) return;

        previewAnimationFrame = requestAnimationFrame(animatePreview);

        if (previewCharacter) {
            if (previewPointer === null) {
                previewCharacter.root.rotation.y += 0.004;
            }

            const time = performance.now() * 0.001;

            previewCharacter.bodyPivot.position.y =
                Math.sin(time * 1.5) * 0.015;

            if (state.emote === "dance") {
                previewCharacter.bodyPivot.rotation.z =
                    Math.sin(time * 5) * 0.12;
            } else if (state.emote === "wave") {
                previewCharacter.bodyPivot.rotation.z =
                    Math.sin(time * 2) * 0.035;
            } else if (state.emote === "celebrate") {
                previewCharacter.bodyPivot.rotation.z =
                    Math.sin(time * 4) * 0.08;
            } else {
                previewCharacter.bodyPivot.rotation.z = 0;
            }
        }

        previewRenderer.render(previewScene, previewCamera);
    }

    function bindPreviewRotation() {
        const container = $("characterPreviewCanvas");

        if (!container) return;

        container.addEventListener("pointerdown", (event) => {
            previewPointer = event.pointerId;
            previewLastX = event.clientX;

            try {
                container.setPointerCapture(event.pointerId);
            } catch (error) {}
        });

        container.addEventListener("pointermove", (event) => {
            if (event.pointerId !== previewPointer || !previewCharacter) {
                return;
            }

            const dx = event.clientX - previewLastX;
            previewLastX = event.clientX;

            previewCharacter.root.rotation.y += dx * 0.012;
        });

        const finish = (event) => {
            if (!event || event.pointerId === previewPointer) {
                previewPointer = null;
            }
        };

        container.addEventListener("pointerup", finish);
        container.addEventListener("pointercancel", finish);
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
        if (camera && renderer) {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();

            renderer.setSize(
                window.innerWidth,
                window.innerHeight
            );
        }

        resizePreview();
    }

    // ==========================================
    // DISPLAY
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
            // Fullscreen may not be available on iOS Safari.
        }

        try {
            if (screen.orientation && screen.orientation.lock) {
                await screen.orientation.lock("landscape");
            }
        } catch (error) {
            // Orientation locking is browser-dependent.
        }
    }

    // ==========================================
    // START GAME
    // ==========================================

    async function startGame() {
        if (countdownRunning || gameRunning) return;

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

            disposeWorld();

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

        if (countdown && number) {
            countdown.classList.remove("hidden");

            let count = 3;
            number.textContent = count;

            const timer = setInterval(() => {
                if (!countdownRunning) {
                    clearInterval(timer);
                    countdown.classList.add("hidden");
                    return;
                }

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
        } else {
            countdownRunning = false;
            gameStarted = true;
            gameRunning = true;

            clock.start();
            animate();
        }
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

        if (isFiring) {
            fireWeapon();
        }

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
            ? 2
            : isRunning
                ? 8
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

        const isMoving = movement.lengthSq() > 0.0001;

        if (isMoving) {
            movement.normalize();

            movePlayerWithCollision(
                movement.x * speed * delta,
                movement.z * speed * delta
            );

            player.rotation.y = Math.atan2(
                movement.x,
                movement.z
            ) + Math.PI;
        }

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

        if (playerBody) {
            const targetScale = isCrouching ? 0.72 : 1;

            playerBody.scale.y +=
                (targetScale - playerBody.scale.y) *
                Math.min(1, delta * 12);

            if (isMoving) {
                const time = performance.now() * 0.012;
                const swing = Math.sin(time) * (isRunning ? 0.45 : 0.25);

                playerBody.position.y =
                    Math.abs(Math.sin(time)) * 0.035;

                const model = player.userData.model;

                if (model) {
                    model.leftLegPivot.rotation.x = swing;
                    model.rightLegPivot.rotation.x = -swing;

                    model.leftArmPivot.rotation.x = -swing * 0.45;
                    model.rightArmPivot.rotation.x = swing * 0.45;
                }
            } else {
                playerBody.position.y = 0;

                const model = player.userData.model;

                if (model) {
                    model.leftLegPivot.rotation.x = 0;
                    model.rightLegPivot.rotation.x = 0;
                    model.leftArmPivot.rotation.x = 0;
                    model.rightArmPivot.rotation.x = 0;
                }
            }
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
            isFiring = false;
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
            selectedWeapon.toUpperCase() + " · AMMO " + ammo
        );

        // Visual prototype only.
        // Real projectile physics and enemy damage are not implemented.
    }

    // ==========================================
    // RELOAD
    // ==========================================

    function reloadWeapon() {
        if (!gameRunning || !gameStarted) return;

        setMessage("RELOADING...");

        setTimeout(() => {
            if (!gameRunning) return;

            ammo = maxAmmo;

            setMessage("RELOADED · " + ammo);
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
                if (scene) {
                    scene.remove(item.object);
                }

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

            const mapName = $("selectedMapName");

            if (mapName) {
                mapName.textContent = names[selectedMap] || names.buner;
            }
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

            updateWeaponAppearance();
            updateWeaponAppearancePreview();
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
    // HTML ESCAPING
    // ==========================================

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

            if ($("playerName")) {
                $("playerName").textContent = value;
            }

            closeModal();
        });
    });

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

                <p>Choose a character to change the outfit.</p>
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

                if ($("playerStatus")) {
                    $("playerStatus").textContent =
                        statusNames[selectedCharacter];
                }

                closeModal();

                createCharacterPreview();

                if (player && scene) {
                    const position = player.position.clone();
                    const rotation = player.rotation.y;

                    scene.remove(player);

                    player = null;
                    playerBody = null;
                    playerGun = null;
                    muzzleFlash = null;

                    createPlayer();

                    player.position.copy(position);
                    player.rotation.y = rotation;
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

                <button data-emote-choice="wave">👋 WAVE</button>
                <button data-emote-choice="dance">🕺 DANCE</button>
                <button data-emote-choice="celebrate">🎉 CELEBRATE</button>
                <button data-emote-choice="none">⏹ STOP EMOTE</button>
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
                    <li>Health: ${health}</li>
                    <li>Magazine: ${maxAmmo} rounds</li>
                </ul>
                <p>Pickups and healing items are not implemented yet.</p>
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
                <label for="graphicsSelect">GRAPHICS QUALITY</label>

                <select id="graphicsSelect">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                </select>

                <p>Graphics changes apply the next time the world is created.</p>

                <button id="saveSettingsButton">SAVE SETTINGS</button>
            `
        );

        $("graphicsSelect").value = state.graphics;

        $("saveSettingsButton").addEventListener("click", () => {
            state.graphics = $("graphicsSelect").value;
            closeModal();
            setMessage("SETTINGS SAVED");
        });
    });

    // ==========================================
    // JOYSTICK
    // ==========================================

    const joystick = $("joystick");
    const joystickKnob = $("joystickKnob");

    let joystickPointer = null;

    function updateJoystick(event) {
        if (!joystick || !joystickKnob) return;

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

        joystickKnob.style.left = `calc(50% + ${dx}px)`;
        joystickKnob.style.top = `calc(50% + ${dy}px)`;
        joystickKnob.style.transform = "translate(-50%, -50%)";
    }

    function resetJoystick() {
        joystickPointer = null;
        joystickX = 0;
        joystickY = 0;

        if (joystickKnob) {
            joystickKnob.style.left = "50%";
            joystickKnob.style.top = "50%";
            joystickKnob.style.transform = "translate(-50%, -50%)";
        }
    }

    if (joystick && joystickKnob) {
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
    }

    // ==========================================
    // CAMERA LOOK
    // ==========================================

    let lookPointer = null;
    let lastLookX = 0;
    let lastLookY = 0;

    canvasContainer.addEventListener("pointerdown", (event) => {
        if (!gameRunning || lookPointer !== null) return;

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

        cameraPitch = clamp(cameraPitch, -1, 1.05);
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

    $("runButton").addEventListener("pointerdown", (event) => {
        event.preventDefault();
        isRunning = true;
    });

    ["pointerup", "pointercancel", "pointerleave"].forEach((type) => {
        $("runButton").addEventListener(type, () => {
            isRunning = false;
        });
    });

    $("crouchButton").addEventListener("click", () => {
        isCrouching = !isCrouching;

        $("crouchButton").classList.toggle("active", isCrouching);
    });

    $("aimButton").addEventListener("click", () => {
        isAiming = !isAiming;
        cameraDistance = isAiming ? 3.5 : 5.5;

        $("aimButton").classList.toggle("active", isAiming);
    });

    $("reloadButton").addEventListener("click", reloadWeapon);

    $("fireButton").addEventListener("pointerdown", (event) => {
        event.preventDefault();
        isFiring = true;
        fireWeapon();
    });

    ["pointerup", "pointercancel", "pointerleave"].forEach((type) => {
        $("fireButton").addEventListener(type, () => {
            isFiring = false;
        });
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

        const countdown = $("startCountdown");

        if (countdown) {
            countdown.classList.add("hidden");
        }

        disposeWorld();

        gameScreen.classList.add("hidden");
        lobby.classList.remove("hidden");

        resetJoystick();

        isRunning = false;
        isCrouching = false;
        isAiming = false;
        isFiring = false;

        cameraYaw = 0;
        cameraPitch = -0.12;
        cameraDistance = 5.5;

        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            }
        } catch (error) {}

        try {
            if (screen.orientation && screen.orientation.unlock) {
                screen.orientation.unlock();
            }
        } catch (error) {}

        createCharacterPreview();
    });

    // ==========================================
    // INITIALIZATION
    // ==========================================

    function initializeLobby() {
        if ($("playerName")) {
            $("playerName").textContent = state.playerName;
        }

        if ($("selectedMapName")) {
            $("selectedMapName").textContent = "BUNER VALLEY";
        }

        if ($("playerStatus")) {
            $("playerStatus").textContent = "Soldier";
        }

        setMessage("READY FOR BATTLE");

        bindPreviewRotation();
        createCharacterPreview();

        window.addEventListener("resize", resizePreview);
    }

    $("startButton").addEventListener("click", startGame);

    initializeLobby();

})();