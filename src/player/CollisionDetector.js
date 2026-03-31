import * as THREE from 'three';

export class CollisionDetector {
    constructor() {
        this.playerBox = new THREE.Box3();
    }

    _updatePlayerBox(playerPos, isSliding) {
        const halfH = isSliding ? 0.5 : 1.0;
        const center = new THREE.Vector3(playerPos.x, playerPos.y + halfH, playerPos.z);
        const size = new THREE.Vector3(0.8, halfH * 2, 0.8);
        this.playerBox.setFromCenterAndSize(center, size);
    }

    check(playerPos, isSliding, obstacles) {
        this._updatePlayerBox(playerPos, isSliding);
        for (const obs of obstacles) {
            if (!obs.active) continue;
            if (this.playerBox.intersectsBox(obs.box)) {
                return obs;
            }
        }
        return null;
    }

    /** 检测拾取物（金币/道具），返回所有碰到的 */
    checkPickups(playerPos, isSliding, items) {
        this._updatePlayerBox(playerPos, isSliding);
        const collected = [];
        for (const item of items) {
            if (item.collected) continue;
            if (this.playerBox.intersectsBox(item.box)) {
                collected.push(item);
            }
        }
        return collected;
    }
}
