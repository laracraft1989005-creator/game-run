import * as THREE from 'three';

export class CollisionDetector {
    constructor() {
        this.playerBox = new THREE.Box3();
        this.obstacleBox = new THREE.Box3();
    }

    check(playerPos, isSliding, obstacles) {
        const halfH = isSliding ? 0.5 : 1.0;
        const center = new THREE.Vector3(playerPos.x, playerPos.y + halfH, playerPos.z);
        const size = new THREE.Vector3(0.8, halfH * 2, 0.8);
        this.playerBox.setFromCenterAndSize(center, size);

        for (const obs of obstacles) {
            if (!obs.active) continue;
            this.obstacleBox.copy(obs.box);
            if (this.playerBox.intersectsBox(this.obstacleBox)) {
                return obs;
            }
        }
        return null;
    }
}
