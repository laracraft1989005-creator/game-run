/**
 * RideSystem — 车顶骑乘奖励阶段
 * 弹射板触发 → 公交车驶入 → 玩家在车顶跑 → 车辆驶离 → 降落
 */
import * as THREE from 'three';
import { LANES } from '../world/LaneConfig.js?v=202604011500';

const RIDE_HEIGHT = 2.8;
const RIDE_DURATION = 4.0;
const RISE_DURATION = 0.5;
const DESCEND_DURATION = 0.8;
const RIDE_CHANCE = 0.6;
const VEHICLE_LENGTH = 20;
const COIN_Y_OFFSET = 0.8;

export class RideSystem {
    constructor(scene) {
        this.scene = scene;
        this.state = 'idle';
        this.timer = 0;
        this._groundY = 0;
        this._vehicleMesh = null;
        this._vehicleTargetX = 0;
        this._rideCoins = [];

        // 共享金币几何/材质（与 CoinSystem 一致）
        this._coinGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.08, 12);
        this._coinMat = new THREE.MeshStandardMaterial({
            color: 0xFFD700,
            emissive: 0xAA8800,
            emissiveIntensity: 0.3,
            metalness: 0.8,
            roughness: 0.3,
        });
    }

    // ─── 状态查询 ───

    isActive() {
        return this.state !== 'idle';
    }

    isRiding() {
        return this.state === 'riding';
    }

    getGroundY() {
        return this._groundY;
    }

    getRideCoins() {
        return this._rideCoins;
    }

    // ─── 生命周期 ───

    tryTrigger() {
        if (this.state !== 'idle') return false;
        if (Math.random() > RIDE_CHANCE) return false;

        this.state = 'rising';
        this.timer = 0;
        this._createVehicle();
        return true;
    }

    update(dt, playerPos, speed) {
        if (this.state === 'idle') return;

        this.timer += dt;

        if (this.state === 'rising') {
            const t = Math.min(1, this.timer / RISE_DURATION);
            const ease = t * t * (3 - 2 * t); // smoothstep
            this._groundY = RIDE_HEIGHT * ease;

            // 车辆从右侧滑入
            if (this._vehicleMesh) {
                const enterT = Math.min(1, this.timer / RISE_DURATION);
                this._vehicleMesh.position.x = THREE.MathUtils.lerp(18, 0, enterT * enterT);
                this._vehicleMesh.position.z = playerPos.z;
            }

            if (this.timer >= RISE_DURATION) {
                this.state = 'riding';
                this.timer = 0;
                this._groundY = RIDE_HEIGHT;
                this._spawnRideCoins(playerPos);
            }
        }

        else if (this.state === 'riding') {
            this._groundY = RIDE_HEIGHT;

            // 车辆跟随玩家 Z，固定 X=0
            if (this._vehicleMesh) {
                this._vehicleMesh.position.x = 0;
                this._vehicleMesh.position.z = playerPos.z;
            }

            // 更新金币碰撞盒（金币跟随车辆世界位置）
            this._updateCoinBoxes();

            // 金币旋转动画
            for (const coin of this._rideCoins) {
                if (!coin.collected) {
                    coin.mesh.rotation.z += 3.0 * dt;
                }
            }

            if (this.timer >= RIDE_DURATION) {
                this.state = 'descending';
                this.timer = 0;
            }
        }

        else if (this.state === 'descending') {
            const t = Math.min(1, this.timer / DESCEND_DURATION);
            const ease = t * t; // ease-in
            this._groundY = RIDE_HEIGHT * (1 - ease);

            // 车辆向左驶离
            if (this._vehicleMesh) {
                this._vehicleMesh.position.x = THREE.MathUtils.lerp(0, -20, ease);
                this._vehicleMesh.position.z = playerPos.z;
            }

            if (this.timer >= DESCEND_DURATION) {
                this._finish();
            }
        }
    }

    reset() {
        this._finish();
    }

    _finish() {
        this.state = 'idle';
        this.timer = 0;
        this._groundY = 0;
        this._removeVehicle();
        this._clearRideCoins();
    }

    // ─── 车辆视觉 ───

    _createVehicle() {
        this._removeVehicle();

        const group = new THREE.Group();
        const bodyH = 2.5;
        const roofY = RIDE_HEIGHT; // 车顶面 = 骑乘高度

        // 车身
        const bodyGeo = new THREE.BoxGeometry(8, bodyH, VEHICLE_LENGTH);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x2288AA,
            emissive: 0x114455,
            emissiveIntensity: 0.3,
            roughness: 0.4,
            metalness: 0.2,
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = roofY - bodyH / 2;
        body.castShadow = true;
        group.add(body);

        // 车顶平面
        const roofGeo = new THREE.BoxGeometry(8.2, 0.1, VEHICLE_LENGTH + 0.2);
        const roofMat = new THREE.MeshStandardMaterial({
            color: 0x999999,
            roughness: 0.8,
        });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.y = roofY;
        roof.receiveShadow = true;
        group.add(roof);

        // 窗户 (两侧)
        const winGeo = new THREE.BoxGeometry(0.1, 0.8, VEHICLE_LENGTH - 2);
        const winMat = new THREE.MeshStandardMaterial({
            color: 0x88DDFF,
            emissive: 0x44AACC,
            emissiveIntensity: 0.4,
            transparent: true,
            opacity: 0.6,
        });
        for (const side of [-1, 1]) {
            const win = new THREE.Mesh(winGeo, winMat);
            win.position.set(side * 4.05, roofY - bodyH / 2 + 0.5, 0);
            group.add(win);
        }

        // 车轮 (4个)
        const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 8);
        wheelGeo.rotateZ(Math.PI / 2);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
        const wheelPositions = [
            [-3.5, 0.5, -7], [3.5, 0.5, -7],
            [-3.5, 0.5, 7], [3.5, 0.5, 7],
        ];
        for (const [wx, wy, wz] of wheelPositions) {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.position.set(wx, wy, wz);
            group.add(wheel);
        }

        // 初始位置（场景右侧外）
        group.position.set(18, 0, 0);

        this._vehicleMesh = group;
        this.scene.add(group);
    }

    _removeVehicle() {
        if (this._vehicleMesh) {
            this.scene.remove(this._vehicleMesh);
            this._vehicleMesh.traverse(c => {
                if (c.isMesh) c.geometry.dispose();
            });
            this._vehicleMesh = null;
        }
    }

    // ─── 车顶金币 ───

    _spawnRideCoins(playerPos) {
        this._clearRideCoins();

        const coinY = RIDE_HEIGHT + COIN_Y_OFFSET;
        const rows = 8;
        const spacing = 2.0;
        const startZ = playerPos.z - rows * spacing / 2;

        for (let row = 0; row < rows; row++) {
            for (let laneIdx = 0; laneIdx < 3; laneIdx++) {
                const mesh = new THREE.Mesh(this._coinGeo, this._coinMat);
                mesh.rotation.x = Math.PI / 2;
                const z = startZ - row * spacing;
                mesh.position.set(LANES[laneIdx], coinY, z);
                this.scene.add(mesh);

                this._rideCoins.push({
                    mesh,
                    box: new THREE.Box3(),
                    collected: false,
                    baseY: coinY,
                });
            }
        }

        this._updateCoinBoxes();
    }

    _updateCoinBoxes() {
        const size = new THREE.Vector3(0.8, 1.0, 0.8);
        for (const coin of this._rideCoins) {
            if (coin.collected) continue;
            coin.box.setFromCenterAndSize(coin.mesh.position, size);
        }
    }

    _clearRideCoins() {
        for (const coin of this._rideCoins) {
            this.scene.remove(coin.mesh);
        }
        this._rideCoins = [];
    }
}
