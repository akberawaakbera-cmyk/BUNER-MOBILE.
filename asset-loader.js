// BUNER MOBILE - 3D Asset Loader
// File: modules/asset-loader.js

(() => {
    "use strict";

    const THREE = window.THREE;

    if (!THREE) {
        console.error("BUNER MOBILE: Three.js is not loaded.");
        return;
    }

    class BunerAssetLoader {
        constructor() {
            this.loader = null;
            this.cache = new Map();
            this.loadingManager = new THREE.LoadingManager();

            this.ready = this.initialize();
        }

        async initialize() {
            try {
                const module = await import(
                    "https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js"
                );

                this.loader = new module.GLTFLoader();

                console.log(
                    "BUNER MOBILE: GLTFLoader ready."
                );

                return true;
            } catch (error) {
                console.error(
                    "BUNER MOBILE: Could not initialize GLTFLoader.",
                    error
                );

                return false;
            }
        }

        async loadModel(path) {
            await this.ready;

            if (!this.loader) {
                throw new Error("GLTFLoader is unavailable.");
            }

            if (this.cache.has(path)) {
                const cached = this.cache.get(path);
                return cached.scene.clone(true);
            }

            const gltf = await this.loader.loadAsync(path);

            this.cache.set(path, gltf);

            const model = gltf.scene.clone(true);

            model.traverse((object) => {
                if (object.isMesh) {
                    object.castShadow = true;
                    object.receiveShadow = true;
                }
            });

            console.log(
                "BUNER MOBILE: Model loaded:",
                path
            );

            return model;
        }

        async loadCharacter(path, scene, options = {}) {
            const model = await this.loadModel(path);

            model.position.set(
                options.x ?? 0,
                options.y ?? 0,
                options.z ?? 0
            );

            const scale = options.scale ?? 1;

            model.scale.setScalar(scale);

            scene.add(model);

            return model;
        }

        async loadMap(path, scene, options = {}) {
            const model = await this.loadModel(path);

            model.position.set(
                options.x ?? 0,
                options.y ?? 0,
                options.z ?? 0
            );

            model.scale.setScalar(options.scale ?? 1);

            scene.add(model);

            return model;
        }
    }

    window.BunerAssetLoader = BunerAssetLoader;

    console.log(
        "BUNER MOBILE: Asset loader module registered."
    );
})();