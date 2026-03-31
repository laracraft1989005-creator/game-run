import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class CharacterModel {
    constructor() {
        this.mesh = null;
        this.mixer = null;
        this.animations = {};
        this.ready = false;
    }

    async load(scene) {
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync('assets/characters/base/character.glb');

        this.mesh = gltf.scene;
        this.mesh.scale.setScalar(1.0);
        this.mesh.rotation.y = Math.PI; // 面朝前方 (负Z)

        // 启用阴影
        this.mesh.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        scene.add(this.mesh);

        // 动画混合器
        this.mixer = new THREE.AnimationMixer(this.mesh);

        // 解析所有动画剪辑
        for (const clip of gltf.animations) {
            // 动画名格式: "Human Armature|Run" → 取 "Run"
            const name = clip.name.includes('|')
                ? clip.name.split('|').pop()
                : clip.name;
            this.animations[name] = this.mixer.clipAction(clip);
        }

        console.log('Loaded animations:', Object.keys(this.animations));
        this.ready = true;
    }

    update(dt) {
        if (this.mixer) this.mixer.update(dt);
    }

    setPosition(x, y, z) {
        if (this.mesh) this.mesh.position.set(x, y, z);
    }

    setScaleY(s) {
        if (this.mesh) this.mesh.scale.y = s;
    }
}
