import { CityChunk } from './CityChunk.js';
import { CHUNK_LENGTH } from './LaneConfig.js';

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

        // 预创建分块池
        for (let i = 0; i < POOL_SIZE; i++) {
            this.pool.push(new CityChunk(scene, assetManager, textureGen));
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
        // 向前生成 (nextChunkZ 已跟随 scrollWorld 同步滚动，直接比较屏幕空间)
        while (this.nextChunkZ > -VISIBLE_DISTANCE) {
            const chunk = this._getChunk();
            chunk.group.visible = true;
            chunk.generate(this.nextChunkZ, difficulty);
            this.chunks.push(chunk);
            this.nextChunkZ -= CHUNK_LENGTH;
        }

        // 回收后方 (position.z 已包含滚动偏移，无需再加 worldOffset)
        for (let i = this.chunks.length - 1; i >= 0; i--) {
            if (this.chunks[i].group.position.z > RECYCLE_DISTANCE) {
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
        // nextChunkZ 也跟随滚动，保持屏幕空间一致性
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

    _getChunk() {
        if (this.pool.length > 0) return this.pool.pop();
        return new CityChunk(this.scene, this.assetManager, this.textureGen);
    }
}
