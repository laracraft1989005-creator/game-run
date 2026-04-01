/**
 * PowerUpSystem — 道具生成、效果管理、视觉
 * 三种道具: shield / magnet / scoreMultiplier
 */
import * as THREE from 'three';
import { LANES } from '../world/LaneConfig.js?v=202604010900';

const POWERUP_Y = 1.0;
const PICKUP_SIZE = new THREE.Vector3(1.0, 1.2, 1.0);
const MAGNET_RANGE = 5.0;
const MAGNET_SPEED = 14.0;

const TYPES = {
    shield:          { color: 0x4488FF, emissive: 0x2244AA, duration: 15, label: '护盾' },
    magnet:          { color: 0xAA44FF, emissive: 0x6622AA, duration: 8,  label: '磁铁' },
    scoreMultiplier: { color: 0x44FF88, emissive: 0x22AA44, duration: 10, label: 'x2' },
};

const TYPE_KEYS = Object.keys(TYPES);
const TYPE_WEIGHTS = [0.4, 0.35, 0.25]; // shield, magnet, multiplier

export class PowerUpSystem {
    constructor(scene) {
        this.scene = scene;
        this._elapsed = 0;
        this._chunksSinceLastSpawn = 0;

        // 共享几何
        this._geo = new THREE.IcosahedronGeometry(0.5, 0);

        // 每种道具材质
        this._materials = {};
        for (const [key, cfg] of Object.entries(TYPES)) {
            this._materials[key] = new THREE.MeshStandardMaterial({
                color: cfg.color,
                emissive: cfg.emissive,
                emissiveIntensity: 0.6,
                transparent: true,
                opacity: 0.85,
            });
        }

        // 活跃效果
        this._active = null;   // { type, timer }
        this.justExpired = null; // 帧间通信
        this._durationProvider = null; // 外部升级时长回调

        // 护盾视觉 mesh
        this._shieldMesh = null;
        this._buildShieldMesh(scene);
    }

    _buildShieldMesh(scene) {
        const geo = new THREE.SphereGeometry(1.2, 16, 12);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x4488FF,
            emissive: 0x2244AA,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        this._shieldMesh = new THREE.Mesh(geo, mat);
        this._shieldMesh.visible = false;
        scene.add(this._shieldMesh);
    }

    /** 为 chunk 创建道具（可能返回 null） */
    createForChunk(chunkGroup, difficulty) {
        this._chunksSinceLastSpawn++;

        // 生成概率
        let chance = 0;
        if (this._chunksSinceLastSpawn >= 5) {
            chance = 1;
        } else if (this._chunksSinceLastSpawn >= 3) {
            chance = 0.35 + difficulty * 0.15;
        }

        if (Math.random() > chance) return null;

        this._chunksSinceLastSpawn = 0;

        // 选类型
        const type = this._selectType();
        const lane = Math.floor(Math.random() * 3);

        const mesh = new THREE.Mesh(this._geo, this._materials[type]);
        mesh.position.set(LANES[lane], POWERUP_Y, -12); // chunk 中段
        mesh.castShadow = false;
        chunkGroup.add(mesh);

        return {
            mesh,
            box: new THREE.Box3(),
            type,
            collected: false,
            lane,
            baseY: POWERUP_Y,
        };
    }

    _selectType() {
        let r = Math.random();
        for (let i = 0; i < TYPE_KEYS.length; i++) {
            r -= TYPE_WEIGHTS[i];
            if (r <= 0) return TYPE_KEYS[i];
        }
        return TYPE_KEYS[0];
    }

    /** 每帧更新：道具动画 + 活跃效果 */
    update(dt, playerPos, activeChunks, coinChunks) {
        this._elapsed += dt;
        this.justExpired = null;

        // 道具浮动旋转
        for (const chunk of activeChunks) {
            if (!chunk.powerUp || chunk.powerUp.collected) continue;
            const pu = chunk.powerUp;
            pu.mesh.rotation.y += 2.0 * dt;
            pu.mesh.position.y = pu.baseY + Math.sin(this._elapsed * 2 + pu.mesh.position.z) * 0.15;
        }

        // 活跃效果计时
        if (this._active) {
            this._active.timer -= dt;

            // 护盾视觉
            if (this._active.type === 'shield' && this._shieldMesh.visible) {
                this._shieldMesh.position.copy(playerPos);
                this._shieldMesh.position.y += 0.8;
                this._shieldMesh.material.opacity = 0.15 + Math.sin(this._elapsed * 4) * 0.05;
            }

            // 磁铁吸引
            if (this._active.type === 'magnet' && coinChunks) {
                this._attractCoins(playerPos, coinChunks, dt);
            }

            if (this._active.timer <= 0) {
                this.justExpired = this._active.type;
                this._deactivate();
            }
        }
    }

    _attractCoins(playerPos, chunks, dt) {
        const tempWorld = new THREE.Vector3();
        for (const chunk of chunks) {
            for (const coin of chunk.coins) {
                if (coin.collected) continue;
                coin.mesh.getWorldPosition(tempWorld);
                const dist = tempWorld.distanceTo(playerPos);
                if (dist < MAGNET_RANGE && dist > 0.3) {
                    const dir = new THREE.Vector3().subVectors(playerPos, tempWorld).normalize();
                    coin.mesh.position.addScaledVector(dir, MAGNET_SPEED * dt);
                }
            }
        }
    }

    /** 更新道具世界碰撞盒 */
    updateCollisionBox(powerUp) {
        if (!powerUp || powerUp.collected) return;
        const worldPos = new THREE.Vector3();
        powerUp.mesh.getWorldPosition(worldPos);
        powerUp.box.setFromCenterAndSize(worldPos, PICKUP_SIZE);
    }

    /** 设置外部时长回调（用于道具升级） */
    setDurationProvider(fn) {
        this._durationProvider = fn;
    }

    /** 激活道具效果 */
    activate(type) {
        // 如果已有效果，先清除
        if (this._active) this._deactivate();

        this._active = { type, timer: this.getDuration(type) };

        if (type === 'shield') {
            this._shieldMesh.visible = true;
            this._shieldMesh.material.opacity = 0.2;
        }
    }

    _deactivate() {
        if (!this._active) return;
        if (this._active.type === 'shield') {
            this._shieldMesh.visible = false;
        }
        this._active = null;
    }

    /** 护盾被撞碎 */
    breakShield() {
        if (!this._active || this._active.type !== 'shield') return;
        this._shieldMesh.visible = false;
        this.justExpired = 'shield';
        this._active = null;
    }

    /** 查询 */
    isShieldActive() {
        return this._active?.type === 'shield';
    }

    isMagnetActive() {
        return this._active?.type === 'magnet';
    }

    getScoreMultiplier() {
        return this._active?.type === 'scoreMultiplier' ? 2 : 1;
    }

    getActiveType() {
        return this._active?.type || null;
    }

    getDuration(type) {
        if (this._durationProvider) {
            const d = this._durationProvider(type);
            if (d > 0) return d;
        }
        return TYPES[type]?.duration || 0;
    }

    getLabel(type) {
        return TYPES[type]?.label || '';
    }

    /** 清除道具 mesh */
    clearPowerUp(chunkGroup, powerUp) {
        if (!powerUp) return;
        chunkGroup.remove(powerUp.mesh);
    }

    /** 重置 */
    reset() {
        this._elapsed = 0;
        this._chunksSinceLastSpawn = 0;
        this._deactivate();
        this.justExpired = null;
    }
}
