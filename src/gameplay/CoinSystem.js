/**
 * CoinSystem — 金币生成、动画、收集
 * 程序化 CylinderGeometry 金币，三种排列模式
 */
import * as THREE from 'three';
import { LANES } from '../world/LaneConfig.js?v=202604011500';

const COIN_Y = 0.8;          // 路面上方高度
const COIN_RADIUS = 0.4;
const COIN_THICKNESS = 0.08;
const PICKUP_SIZE = new THREE.Vector3(0.8, 1.0, 0.8); // 碰撞盒（宽松）

export class CoinSystem {
    constructor() {
        // 共享几何 & 材质（所有金币复用）
        this._geo = new THREE.CylinderGeometry(COIN_RADIUS, COIN_RADIUS, COIN_THICKNESS, 16);
        this._mat = new THREE.MeshStandardMaterial({
            color: 0xFFD700,
            metalness: 0.8,
            roughness: 0.25,
            emissive: 0x886600,
            emissiveIntensity: 0.3,
        });
        this._elapsed = 0;
    }

    /** 为 chunk 生成金币，返回 coin 数组 */
    createCoinsForChunk(chunkGroup, difficulty) {
        const coins = [];
        // 1-2 组 pattern
        const patternCount = 1 + (Math.random() < 0.4 ? 1 : 0);

        for (let p = 0; p < patternCount; p++) {
            const pattern = this._choosePattern(difficulty);
            // 放在 chunk 前半段（-20 ~ 0 局部坐标），避开障碍物
            const startZ = -18 + p * 10 + Math.random() * 4;
            const entries = pattern(startZ);
            for (const entry of entries) {
                const mesh = new THREE.Mesh(this._geo, this._mat);
                mesh.rotation.x = Math.PI / 2; // 立起来
                mesh.position.set(LANES[entry.lane], COIN_Y, entry.z);
                mesh.castShadow = false;
                chunkGroup.add(mesh);
                coins.push({
                    mesh,
                    box: new THREE.Box3(),
                    collected: false,
                    lane: entry.lane,
                    baseY: COIN_Y,
                });
            }
        }
        return coins;
    }

    /** 更新所有可见金币动画（自旋 + 浮动） */
    update(dt, activeChunks) {
        this._elapsed += dt;
        for (const chunk of activeChunks) {
            for (const coin of chunk.coins) {
                if (coin.collected) continue;
                coin.mesh.rotation.z += 3.0 * dt; // 绕 Z 旋转（因为 X 已旋转 90°）
                coin.mesh.position.y = coin.baseY + Math.sin(this._elapsed * 3 + coin.mesh.position.z) * 0.1;
            }
        }
    }

    /** 更新金币的世界空间碰撞盒 */
    updateCollisionBoxes(coins) {
        const worldPos = new THREE.Vector3();
        for (const coin of coins) {
            if (coin.collected) continue;
            coin.mesh.getWorldPosition(worldPos);
            coin.box.setFromCenterAndSize(worldPos, PICKUP_SIZE);
        }
    }

    /** 重置 elapsed */
    reset() {
        this._elapsed = 0;
    }

    /** 清除 chunk 的金币 mesh */
    clearCoins(chunkGroup, coins) {
        for (const coin of coins) {
            chunkGroup.remove(coin.mesh);
        }
    }

    // ─── 排列模式 ───

    _choosePattern(difficulty) {
        if (difficulty < 0.3) return (z) => this._line(z);
        const r = Math.random();
        if (r < 0.4) return (z) => this._line(z);
        if (r < 0.7) return (z) => this._arc(z);
        return (z) => this._cluster(z);
    }

    /** 单车道直线 5-8 个 */
    _line(startZ) {
        const lane = Math.floor(Math.random() * 3);
        const count = 5 + Math.floor(Math.random() * 4);
        const entries = [];
        for (let i = 0; i < count; i++) {
            entries.push({ lane, z: startZ - i * 2.0 });
        }
        return entries;
    }

    /** 弧线跨车道 */
    _arc(startZ) {
        const laneSeq = [0, 1, 2, 1, 0];
        return laneSeq.map((lane, i) => ({
            lane,
            z: startZ - i * 2.5,
        }));
    }

    /** 2 车道 x 3 行 网格 */
    _cluster(startZ) {
        const baseLane = Math.floor(Math.random() * 2); // 0 or 1
        const entries = [];
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 2; col++) {
                entries.push({
                    lane: baseLane + col,
                    z: startZ - row * 2.0,
                });
            }
        }
        return entries;
    }
}
