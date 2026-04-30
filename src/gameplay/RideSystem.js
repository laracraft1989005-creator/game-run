/**
 * RideSystem — 车顶骑乘奖励阶段
 * 弹射板触发 → 载具进入 → 玩家在车顶/平台跑 → 载具离开 → 降落
 * v1.4: 支持多种载具（公交车、卡车、直升机）
 */
import * as THREE from 'three';
import { LANES } from '../world/LaneConfig.js?v=202604011500';
import { VEHICLE_TYPES, pickVehicleType, createVehicleMesh } from './Vehicles.js?v=202604011500';

const RIDE_CHANCE = 0.6;

export class RideSystem {
    constructor(scene) {
        this.scene = scene;
        this.state = 'idle';
        this.timer = 0;
        this._groundY = 0;
        this._vehicleMesh = null;
        this._vehicleType = null;
        this._config = null;
        this._rideCoins = [];
        this._rotorTime = 0;

        // 共享金币几何/材质
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

    isActive() { return this.state !== 'idle'; }
    isRiding() { return this.state === 'riding'; }
    getGroundY() { return this._groundY; }
    getRideCoins() { return this._rideCoins; }
    getVehicleType() { return this._vehicleType; }
    getVehicleName() { return this._config ? this._config.name : 'BUS RIDE!'; }

    // ─── 生命周期 ───

    tryTrigger() {
        if (this.state !== 'idle') return false;
        if (Math.random() > RIDE_CHANCE) return false;

        this._vehicleType = pickVehicleType();
        this._config = VEHICLE_TYPES[this._vehicleType];
        this.state = 'rising';
        this.timer = 0;
        this._createVehicle();
        return true;
    }

    update(dt, playerPos, speed) {
        if (this.state === 'idle') return;

        this.timer += dt;
        this._rotorTime += dt;

        // 直升机旋翼始终旋转
        if (this._vehicleMesh && this._vehicleType === 'helicopter') {
            this._vehicleMesh.traverse(c => {
                if (c.name === 'mainRotor') c.rotation.y = this._rotorTime * 25;
                if (c.name === 'tailRotor') c.rotation.x = this._rotorTime * 35;
            });
        }

        const cfg = this._config;

        if (this.state === 'rising') {
            const t = Math.min(1, this.timer / cfg.riseDuration);
            const ease = t * t * (3 - 2 * t); // smoothstep
            this._groundY = cfg.rideHeight * ease;

            if (this._vehicleMesh) {
                if (cfg.entryDirection === 'air') {
                    // 直升机从空中降落
                    this._vehicleMesh.position.x = THREE.MathUtils.lerp(8, 0, ease);
                    this._vehicleMesh.position.y = THREE.MathUtils.lerp(8, 0, ease);
                } else {
                    // 普通车辆从右侧滑入
                    const enterT = ease;
                    this._vehicleMesh.position.x = THREE.MathUtils.lerp(18, 0, enterT);
                    this._vehicleMesh.position.y = 0;
                }
                this._vehicleMesh.position.z = playerPos.z;
            }

            if (this.timer >= cfg.riseDuration) {
                this.state = 'riding';
                this.timer = 0;
                this._groundY = cfg.rideHeight;
                this._spawnRideCoins(playerPos);
            }
        }

        else if (this.state === 'riding') {
            this._groundY = cfg.rideHeight;

            if (this._vehicleMesh) {
                this._vehicleMesh.position.x = 0;
                this._vehicleMesh.position.y = this._vehicleType === 'helicopter'
                    ? Math.sin(this._rotorTime * 2) * 0.08  // 直升机轻微悬停
                    : 0;
                this._vehicleMesh.position.z = playerPos.z;
            }

            this._updateCoinBoxes();

            for (const coin of this._rideCoins) {
                if (!coin.collected) {
                    coin.mesh.rotation.z += 3.0 * dt;
                }
            }

            if (this.timer >= cfg.rideDuration) {
                this.state = 'descending';
                this.timer = 0;
            }
        }

        else if (this.state === 'descending') {
            const t = Math.min(1, this.timer / cfg.descendDuration);
            const ease = t * t; // ease-in
            this._groundY = cfg.rideHeight * (1 - ease);

            if (this._vehicleMesh) {
                if (cfg.entryDirection === 'air') {
                    // 直升机向上飞走
                    this._vehicleMesh.position.x = THREE.MathUtils.lerp(0, -6, ease);
                    this._vehicleMesh.position.y = THREE.MathUtils.lerp(0, 10, ease);
                } else {
                    this._vehicleMesh.position.x = THREE.MathUtils.lerp(0, -20, ease);
                    this._vehicleMesh.position.y = 0;
                }
                this._vehicleMesh.position.z = playerPos.z;
            }

            if (this.timer >= cfg.descendDuration) {
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
        this._vehicleType = null;
        this._config = null;
        this._removeVehicle();
        this._clearRideCoins();
    }

    // ─── 车辆视觉 ───

    _createVehicle() {
        this._removeVehicle();
        const group = createVehicleMesh(this._vehicleType);
        const cfg = this._config;
        // 根据进入方向设置起始位置
        if (cfg.entryDirection === 'air') {
            group.position.set(8, 8, 0);
        } else {
            group.position.set(18, 0, 0);
        }
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

        const cfg = this._config;
        const coinY = cfg.rideHeight + cfg.coinYOffset;
        const rows = cfg.coinRows;
        const spacing = 2.0;
        const startZ = playerPos.z - rows * spacing / 2;

        for (let row = 0; row < rows; row++) {
            for (let laneIdx = 0; laneIdx < cfg.coinLanes; laneIdx++) {
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
