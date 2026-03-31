import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Kenney 城市资源清单
 * key: 内部引用名
 * path: GLB 文件路径
 * category: road | suburban | commercial | prop | obstacle
 */
const ASSET_MANIFEST = [
    // 道路
    { key: 'road_straight',         path: 'assets/city/roads/road_straight.glb',         category: 'road' },
    { key: 'road_crosswalk',        path: 'assets/city/roads/road_crosswalk.glb',        category: 'road' },

    // 住宅 / 商铺建筑
    { key: 'house_A',               path: 'assets/city/buildings/suburban/house_A.glb',   category: 'suburban' },
    { key: 'house_B',               path: 'assets/city/buildings/suburban/house_B.glb',   category: 'suburban' },
    { key: 'house_C',               path: 'assets/city/buildings/suburban/house_C.glb',   category: 'suburban' },
    { key: 'house_D',               path: 'assets/city/buildings/suburban/house_D.glb',   category: 'suburban' },
    { key: 'shop_A',                path: 'assets/city/buildings/suburban/shop_A.glb',    category: 'suburban' },
    { key: 'shop_B',                path: 'assets/city/buildings/suburban/shop_B.glb',    category: 'suburban' },
    { key: 'shop_C',                path: 'assets/city/buildings/suburban/shop_C.glb',    category: 'suburban' },
    { key: 'shop_D',                path: 'assets/city/buildings/suburban/shop_D.glb',    category: 'suburban' },

    // 写字楼 / 高楼
    { key: 'office_A',              path: 'assets/city/buildings/commercial/office_A.glb',     category: 'commercial' },
    { key: 'office_B',              path: 'assets/city/buildings/commercial/office_B.glb',     category: 'commercial' },
    { key: 'office_C',              path: 'assets/city/buildings/commercial/office_C.glb',     category: 'commercial' },
    { key: 'office_D',              path: 'assets/city/buildings/commercial/office_D.glb',     category: 'commercial' },
    { key: 'skyscraper_A',          path: 'assets/city/buildings/commercial/skyscraper_A.glb', category: 'commercial' },
    { key: 'skyscraper_B',          path: 'assets/city/buildings/commercial/skyscraper_B.glb', category: 'commercial' },

    // 街道装饰
    { key: 'streetlight',           path: 'assets/city/props/streetlight.glb',            category: 'prop' },
    { key: 'tree',                  path: 'assets/city/props/tree.glb',                   category: 'prop' },
    { key: 'bench',                 path: 'assets/city/props/bench.glb',                  category: 'prop' },
    { key: 'trash_can',             path: 'assets/city/props/trash_can.glb',              category: 'prop' },
    { key: 'fire_hydrant',          path: 'assets/city/props/fire_hydrant.glb',           category: 'prop' },

    // 障碍物
    { key: 'barrier',               path: 'assets/obstacles/barrier.glb',                 category: 'obstacle' },
    { key: 'construction_fence',    path: 'assets/obstacles/construction_fence.glb',      category: 'obstacle' },
    { key: 'dumpster',              path: 'assets/obstacles/dumpster.glb',                category: 'obstacle' },
    { key: 'cone_group',            path: 'assets/obstacles/cone_group.glb',              category: 'obstacle' },
];

// 障碍物类型到模型 key 的映射
const OBSTACLE_TYPE_MAP = {
    low:  ['barrier', 'cone_group'],
    full: ['construction_fence', 'dumpster'],
};

export class AssetManager {
    constructor() {
        this.loader = new GLTFLoader();
        this.assets = new Map();          // key → { scene, bbox, size }
        this.categoryIndex = new Map();   // category → [key, ...]
        this.ready = false;
        this.progress = { loaded: 0, total: 0 };
        this.onProgress = null;           // (loaded, total) => void
    }

    async loadAll() {
        const manifest = ASSET_MANIFEST;
        this.progress.total = manifest.length;
        this.progress.loaded = 0;

        const promises = manifest.map(entry => this._loadModel(entry));
        await Promise.all(promises);

        this.ready = true;
        console.log(`AssetManager: ${this.assets.size}/${manifest.length} models loaded`);
    }

    async _loadModel({ key, path, category }) {
        try {
            const gltf = await this.loader.loadAsync(path);
            const scene = gltf.scene;

            // 启用阴影
            scene.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            // 计算包围盒
            const bbox = new THREE.Box3().setFromObject(scene);
            const size = bbox.getSize(new THREE.Vector3());

            this.assets.set(key, { scene, bbox, size });

            // 更新分类索引
            if (!this.categoryIndex.has(category)) {
                this.categoryIndex.set(category, []);
            }
            this.categoryIndex.get(category).push(key);
        } catch (e) {
            console.warn(`AssetManager: failed to load "${key}" from ${path}`);
        }

        this.progress.loaded++;
        if (this.onProgress) {
            this.onProgress(this.progress.loaded, this.progress.total);
        }
    }

    /** 返回指定 key 模型的深拷贝，未找到返回 null */
    getModel(key) {
        const entry = this.assets.get(key);
        if (!entry) return null;
        return entry.scene.clone(true);
    }

    /** 返回指定 key 模型的原始尺寸 */
    getModelSize(key) {
        const entry = this.assets.get(key);
        if (!entry) return null;
        return entry.size.clone();
    }

    /** 从指定分类中随机选取一个模型克隆 */
    getRandomBuilding(category) {
        const keys = this.categoryIndex.get(category);
        if (!keys || keys.length === 0) return null;
        const key = keys[Math.floor(Math.random() * keys.length)];
        return { model: this.getModel(key), size: this.getModelSize(key), key };
    }

    /** 按障碍类型获取模型克隆 */
    getObstacleModel(type) {
        const candidates = OBSTACLE_TYPE_MAP[type];
        if (!candidates) return null;

        // 从可用候选中随机选
        const available = candidates.filter(k => this.assets.has(k));
        if (available.length === 0) return null;

        const key = available[Math.floor(Math.random() * available.length)];
        return { model: this.getModel(key), size: this.getModelSize(key) };
    }

    /** 获取随机装饰物 */
    getRandomProp() {
        const keys = this.categoryIndex.get('prop');
        if (!keys || keys.length === 0) return null;
        const key = keys[Math.floor(Math.random() * keys.length)];
        return { model: this.getModel(key), size: this.getModelSize(key), key };
    }

    /** 检查某个分类是否有可用资源 */
    hasCategory(category) {
        const keys = this.categoryIndex.get(category);
        return keys && keys.length > 0;
    }

    dispose() {
        for (const [, entry] of this.assets) {
            entry.scene.traverse(child => {
                if (child.isMesh) {
                    child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
        }
        this.assets.clear();
        this.categoryIndex.clear();
    }
}
