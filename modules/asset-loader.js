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
      this.loading = new Map();
      this.ready = this.initialize();
    }
    async initialize() {
      try {
        const module = await import(
          'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js'
        );
        this.loader = new module.GLTFLoader();
        console.info('BUNER MOBILE: GLTFLoader ready.');
        return true;
      } catch (error) {
        console.error(
          'BUNER MOBILE: GLTFLoader initialization failed.',
          error
        );
        return false;
      }
    }
    async load(path) {
      await this.ready;
      if (!this.loader) {
        throw new Error('GLTFLoader is unavailable.');
      }
      if (this.cache.has(path)) {
        return this.cloneModel(this.cache.get(path).scene);
      }
      if (this.loading.has(path)) {
        const gltf = await this.loading.get(path);
        return this.cloneModel(gltf.scene);
      }
      const request = this.loader.loadAsync(path);
      this.loading.set(path, request);
      try {
        const gltf = await request;
        this.cache.set(path, gltf);
        console.info('BUNER MOBILE: GLB loaded:', path);
        return this.cloneModel(gltf.scene);
      } catch (error) {
        console.error(
          'BUNER MOBILE: Could not load GLB:',
          path,
          error
        );
        throw error;
      } finally {
        this.loading.delete(path);
      }
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
    async getAnimations(path) {
      await this.ready;
      if (!this.loader) {
        throw new Error('GLTFLoader is unavailable.');
      }
      if (this.cache.has(path)) {
        return this.cache.get(path).animations || [];
      }
      const gltf = await this.loader.loadAsync(path);
      this.cache.set(path, gltf);
      return gltf.animations || [];
    }
  }
  window.BunerAssetLoader = BunerAssetLoader;
  console.info('BUNER MOBILE: Asset loader registered.');
})();