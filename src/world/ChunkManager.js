import { CityChunk } from './CityChunk.js';
import { CHUNK_LENGTH } from './LaneConfig.js';

const VISIBLE_DISTANCE = 160;
const RECYCLE_DISTANCE = 40;
const POOL_SIZE = 6;

export class ChunkManager {
    constructor(scene, assetManager) {
        this.scene = scene;
        this.assetManager = assetManager;
        this.chunks = [];
        this.pool = [];
        this.nextChunkZ = 0;

        // 预创建分块池
        for (let i = 0; i < POOL_SIZE; i++) {
            this.pool.push(new CityChunk(scene, assetManager));
        }
    }

    reset() {
        for (const chunk of this.chunks) {
            chunk.recycle();
            chunk.group.visible = false;
            this.pool.push(chunk);
        }
        this.chunks = [];
        this.nextChunkZ = CHUNK_LENGTH; // 从玩家前面一点开始
    }

    update(worldOffset, difficulty) {
        // worldOffset: 世界已滚动的距离 (正数, 递增)
        const playerWorldZ = 0; // 玩家始终在 z=0

        // 向前生成
        while (this.nextChunkZ - worldOffset > -VISIBLE_DISTANCE) {
            const chunk = this._getChunk();
            chunk.group.visible = true;
            chunk.generate(this.nextChunkZ, difficulty);
            this.chunks.push(chunk);
            this.nextChunkZ -= CHUNK_LENGTH;
        }

        // 回收后方
        for (let i = this.chunks.length - 1; i >= 0; i--) {
            const cz = this.chunks[i].group.position.z + worldOffset;
            if (cz > RECYCLE_DISTANCE) {
                const chunk = this.chunks.splice(i, 1)[0];
                chunk.recycle();
                chunk.group.visible = false;
                this.pool.push(chunk);
            }
        }

        // 更新碰撞盒 + 阴影纪律: 仅近处 chunk 投射阴影
        for (const chunk of this.chunks) {
            chunk.updateCollisionBoxes();
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

    _getChunk() {
        if (this.pool.length > 0) return this.pool.pop();
        return new CityChunk(this.scene, this.assetManager);
    }
}
