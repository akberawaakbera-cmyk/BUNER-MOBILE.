(() => {
  'use strict';

  const THREE = window.THREE;

  if (!THREE) {
    console.error('BUNER MOBILE: Three.js is missing.');
    return;
  }

  class BunerAssetLoader {
    constructor() {
      this.loader = null;
      this.cache = new Map();
      this.ready = this.initialize();
    }

    async initialize() {
      try {
        const module = await import(
          'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js'
        );

        this.loader = new module.GLTFLoader();
        return true;
      } catch (error) {
        console.error('GLTFLoader initialization failed:', error);
        return false;
      }
    }

    async load(path) {
      await this.ready;

      if (!this.loader) {
        throw new Error('GLTFLoader is unavailable.');
      }

      if (this.cache.has(path)) {
        return this.cloneModel(this.cache.get(path));
      }

      const gltf = await this.loader.loadAsync(path);

      this.cache.set(path, gltf.scene);

      console.info('BUNER MOBILE: Loaded:', path);

      return this.cloneModel(gltf.scene);
    }

    cloneModel(original) {
      const model = original.clone(true);

      model.traverse((object) => {
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });

      return model;
    }
  }

  window.BunerAssetLoader = BunerAssetLoader;

  console.info('BUNER MOBILE: Asset loader registered.');
})();