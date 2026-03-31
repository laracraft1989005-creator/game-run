import * as THREE from 'three';

export class LightingRig {
    constructor(scene) {
        // 半球光: 天蓝 + 暖棕地面反射
        this.hemisphere = new THREE.HemisphereLight(0x87CEEB, 0x886633, 0.6);
        scene.add(this.hemisphere);

        // 环境光
        this.ambient = new THREE.AmbientLight(0x404060, 0.3);
        scene.add(this.ambient);

        // 方向光 (太阳)
        const sun = new THREE.DirectionalLight(0xFFFFDD, 1.2);
        sun.position.set(50, 100, 50);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.left = -30;
        sun.shadow.camera.right = 30;
        sun.shadow.camera.top = 30;
        sun.shadow.camera.bottom = -30;
        sun.shadow.camera.near = 10;
        sun.shadow.camera.far = 200;
        sun.shadow.bias = -0.001;
        scene.add(sun);

        this.sun = sun;
    }

    update(playerZ) {
        // 太阳跟随玩家位置
        this.sun.position.z = playerZ - 50;
        this.sun.target.position.z = playerZ;
    }
}
