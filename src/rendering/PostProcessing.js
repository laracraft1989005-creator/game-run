import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export class PostProcessing {
    constructor(renderer, scene, camera) {
        this.enabled = true;

        this.composer = new EffectComposer(renderer);

        // Pass 1: 渲染场景
        this.composer.addPass(new RenderPass(scene, camera));

        // Pass 2: Bloom 泛光
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.4,   // strength (微妙泛光)
            0.6,   // radius
            0.85   // threshold (只有高亮表面泛光)
        );
        this.composer.addPass(this.bloomPass);

        // Pass 3: 输出 (色调映射 + 色彩空间)
        this.composer.addPass(new OutputPass());
    }

    render() {
        this.composer.render();
    }

    setSize(width, height) {
        this.composer.setSize(width, height);
    }

    dispose() {
        this.composer.dispose();
    }
}
