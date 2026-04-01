import { CityChunk } from './CityChunk.js?v=202604011200';
import { CHUNK_LENGTH } from './LaneConfig.js?v=202604011200';

const VISIBLE_DISTANCE = 160;
const RECYCLE_DISTANCE = 40;
const POOL_SIZE = 6;

export class ChunkManager {
    constructor(scene, assetManager, textureGen) {
        this.scene = scene;
        this.assetManager = assetManager;
        this.textureGen = textureGen;
        this.chunks = [];
        this.pool = [];
        this.nextChunkZ = 0;

        // 可选子系统引用（由 Game.js 设置）
        this.coinSystem = null;
        this.powerUpSystem = null;

        // 交互物生成计数
        this._chunksSinceJumpPad = 0;
        this._chunksSinceSpeedZone = 0;

        // 预创建分块池
        for (let i = 0; i < POOL_SIZE; i++) {
            this.pool.push(new CityChunk(scene, assetManager, textureGen));
        }
    }

    reset() {
        for (const chunk of this.chunks) {
            chunk.recycle(this.coinSystem, this.powerUpSystem);
            chunk.group.visible = false;
            this.pool.push(chunk);
        }
        this.chunks = [];
        this.nextChunkZ = CHUNK_LENGTH;
        this._chunksSinceJumpPad = 0;
        this._chunksSinceSpeedZone = 0;
    }

    update(worldOffset, difficulty, themeWorldConfig, dt = 0) {
        // 向前生成
        while (this.nextChunkZ > -VISIBLE_DISTANCE) {
            const chunk = this._getChunk();
            chunk.group.visible = true;

            const interactableOpts = {
                spawnJumpPad: this._shouldSpawnJumpPad(),
                spawnSpeedZone: this._shouldSpawnSpeedZone(difficulty),
            };

            chunk.generate(this.nextChunkZ, difficulty, this.coinSystem, this.powerUpSystem, themeWorldConfig, interactableOpts);
            this.chunks.push(chunk);
            this.nextChunkZ -= CHUNK_LENGTH;
        }

        // 回收后方
        for (let i = this.chunks.length - 1; i >= 0; i--) {
            if (this.chunks[i].group.position.z > RECYCLE_DISTANCE) {
                const chunk = this.chunks.splice(i, 1)[0];
                chunk.recycle(this.coinSystem, this.powerUpSystem);
                chunk.group.visible = false;
                this.pool.push(chunk);
            }
        }

        // 更新碰撞盒 + 移动障碍 + 交互物
        for (const chunk of this.chunks) {
            // 移动障碍必须在碰撞盒更新之前
            chunk.updateMovingObstacles(dt, difficulty);
            chunk.updateCollisionBoxes();
            chunk.updateJumpPadBoxes();
            chunk.updateSpeedZoneBoxes();

            if (this.coinSystem) {
                this.coinSystem.updateCollisionBoxes(chunk.coins);
            }
            if (this.powerUpSystem) {
                this.powerUpSystem.updateCollisionBox(chunk.powerUp);
            }

            const dist = Math.abs(chunk.group.position.z);
            const castShadow = dist < CHUNK_LENGTH * 2.5;
            for (const b of chunk.buildings) {
                b.traverse(c => {
                    if (c.isMesh) c.castShadow = castShadow;
                });
            }
        }
    }

    scrollWorld(dz) {
        for (const chunk of this.chunks) {
            chunk.group.position.z += dz;
        }
        this.nextChunkZ += dz;
    }

    getActiveObstacles() {
        const all = [];
        for (const chunk of this.chunks) {
            for (const obs of chunk.obstacles) {
                if (obs.active) all.push(obs);
            }
        }
        return all;
    }

    getActiveCoins() {
        const all = [];
        for (const chunk of this.chunks) {
            for (const coin of chunk.coins) {
                if (!coin.collected) all.push(coin);
            }
        }
        return all;
    }

    getActivePowerUps() {
        const all = [];
        for (const chunk of this.chunks) {
            if (chunk.powerUp && !chunk.powerUp.collected) {
                all.push(chunk.powerUp);
            }
        }
        return all;
    }

    getActiveJumpPads() {
        const all = [];
        for (const chunk of this.chunks) {
            for (const jp of chunk.jumpPads) {
                if (jp.active) all.push(jp);
            }
        }
        return all;
    }

    getActiveSpeedZones() {
        const all = [];
        for (const chunk of this.chunks) {
            for (const sz of chunk.speedZones) {
                if (sz.active) all.push(sz);
            }
        }
        return all;
    }

    _shouldSpawnJumpPad() {
        this._chunksSinceJumpPad++;
        if (this._chunksSinceJumpPad >= 4 + Math.floor(Math.random() * 3)) {
            this._chunksSinceJumpPad = 0;
            return true;
        }
        return false;
    }

    _shouldSpawnSpeedZone(difficulty) {
        if (difficulty < 0.2) return false;
        this._chunksSinceSpeedZone++;
        if (this._chunksSinceSpeedZone >= 3 + Math.floor(Math.random() * 3)) {
            this._chunksSinceSpeedZone = 0;
            return true;
        }
        return false;
    }

    _getChunk() {
        if (this.pool.length > 0) return this.pool.pop();
        return new CityChunk(this.scene, this.assetManager, this.textureGen);
    }
}
