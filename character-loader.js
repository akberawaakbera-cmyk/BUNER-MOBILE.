const MODEL_URL =
    "https://pub-0ecebf61e10c4bf0b37061d077302c45.r2.dev/This%20all%20needs%20generate%20only%20one%203d%20model%20face%20hands%20lags%20and%20remove%20background_Meshy_AI_2026-10-10_b5df4b.glb";

const THREE = window.THREE;
const GLTFLoader = window.GLTFLoader;

let loader = null;

function getLoader() {
    if (!THREE || !GLTFLoader) {
        throw new Error("Three.js or GLTFLoader is not ready.");
    }

    if (!loader) {
        loader = new GLTFLoader();
    }

    return loader;
}

function normalizeModel(root, targetHeight = 2.2) {
    const bounds = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    bounds.getSize(size);
    bounds.getCenter(center);

    if (!Number.isFinite(size.y) || size.y <= 0) {
        throw new Error("The GLB model has invalid dimensions.");
    }

    const scale = targetHeight / size.y;

    root.scale.multiplyScalar(scale);
    root.position.x -= center.x * scale;
    root.position.z -= center.z * scale;
    root.position.y -= bounds.min.y * scale;

    root.traverse((object) => {
        if (!object.isMesh) return;

        object.castShadow = true;
        object.receiveShadow = true;

        if (object.material) {
            const materials = Array.isArray(object.material)
                ? object.material
                : [object.material];

            materials.forEach((material) => {
                material.needsUpdate = true;
            });
        }
    });

    return {
        height: targetHeight,
        scale,
        center
    };
}

function loadCharacter(options = {}) {
    return new Promise((resolve, reject) => {
        const targetHeight = options.height || 2.2;

        getLoader().load(
            options.url || MODEL_URL,
            (gltf) => {
                try {
                    const root = gltf.scene;

                    if (!root) {
                        throw new Error("No 3D scene was found in the GLB file.");
                    }

                    const dimensions = normalizeModel(root, targetHeight);

                    const mixer = gltf.animations.length
                        ? new THREE.AnimationMixer(root)
                        : null;

                    const clips = gltf.animations || [];

                    const actions = {};

                    if (mixer) {
                        clips.forEach((clip) => {
                            const action = mixer.clipAction(clip);
                            const name = clip.name.toLowerCase();

                            if (name.includes("idle")) actions.idle = action;
                            else if (name.includes("run")) actions.run = action;
                            else if (name.includes("walk")) actions.walk = action;
                            else if (name.includes("jump")) actions.jump = action;
                            else if (name.includes("shoot") || name.includes("fire")) {
                                actions.shoot = action;
                            }
                        });

                        if (!actions.idle && clips.length) {
                            actions.idle = mixer.clipAction(clips[0]);
                        }

                        if (actions.idle) {
                            actions.idle.play();
                        }
                    }

                    resolve({
                        root,
                        animations: clips,
                        mixer,
                        actions,
                        dimensions,
                        hasAnimations: clips.length > 0,
                        playAnimation(name, fade = 0.2) {
                            if (!mixer || !actions[name]) return false;

                            Object.values(actions).forEach((action) => {
                                if (action !== actions[name]) {
                                    action.fadeOut(fade);
                                }
                            });

                            actions[name]
                                .reset()
                                .fadeIn(fade)
                                .play();

                            return true;
                        },
                        update(delta) {
                            if (mixer) mixer.update(delta);
                        },
                        dispose() {
                            if (mixer) mixer.stopAllAction();

                            root.traverse((object) => {
                                if (!object.isMesh) return;

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
                    });
                } catch (error) {
                    reject(error);
                }
            },
            undefined,
            (error) => {
                reject(
                    new Error(
                        "Could not load the GLB character. Check the model URL and R2 access."
                    )
                );
            }
        );
    });
}

window.BunerCharacterLoader = {
    loadCharacter,
    MODEL_URL
};