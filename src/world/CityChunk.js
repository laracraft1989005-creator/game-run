import * as THREE from 'three';
import { CHUNK_LENGTH, ROAD_WIDTH, LANES } from './LaneConfig.js?v=202603311420';
import { selectPattern } from '../gameplay/ObstaclePatterns.js?v=202603311420';

// 程序化兜底用的颜色
const BUILDING_COLORS = [0x6688AA, 0x7799BB, 0x5577AA, 0x8899BB, 0x6677CC, 0x9988AA];

// 碰撞盒尺寸 (游戏性关键，不随视觉变化)
const COLLISION_DIMS = {
    low:  { w: 2, h: 1,   yOff: 0.5  },
    full: { w: 2, h: 2.0, yOff: 1.0 },
};

export class CityChunk {
    constructor(scene, assetManager, textureGen) {
        this.assetManager = assetManager;
        this.textureGen = textureGen;
        this.group = new THREE.Group();
        this.obstacles = [];
        this.coins = [];
        this.powerUp = null;
        this.buildings = [];
        this.props = [];
        this.roadMeshes = [];
        this.active = false;
        scene.add(this.group);

        // 构建道路 (静态，不随回收重建)
        this._buildRoad();

        // 人行道
        this._buildSidewalks();
    }

    // ─── 道路系统 ───────────────────────────────────

    _buildRoad() {
        if (this.assetManager && this.assetManager.hasCategory('road')) {
            this._buildKenneyRoad();
        } else {
            this._buildFallbackRoad();
        }
    }

    _buildKenneyRoad() {
        const roadModel = this.assetManager.getModel('road_straight');
        if (!roadModel) { this._buildFallbackRoad(); return; }

        // 测量瓦片尺寸
        const bbox = new THREE.Box3().setFromObject(roadModel);
        const tileSize = bbox.getSize(new THREE.Vector3());

        // 计算铺满所需的行列数和缩放
        const tilesAcross = Math.max(1, Math.ceil(ROAD_WIDTH / tileSize.x));
        const scale = ROAD_WIDTH / (tilesAcross * tileSize.x);
        const scaledTileZ = tileSize.z * scale;
        const tilesDeep = Math.max(1, Math.ceil(CHUNK_LENGTH / scaledTileZ));

        // 用完后释放测量模型
        roadModel.traverse(c => { if (c.isMesh) c.geometry.dispose(); });

        for (let row = 0; row < tilesDeep; row++) {
            for (let col = 0; col < tilesAcross; col++) {
                // 偶尔用人行横道变体
                const useCrosswalk = row === Math.floor(tilesDeep / 2)
                    && this.assetManager.getModel('road_crosswalk');
                const tileKey = useCrosswalk ? 'road_crosswalk' : 'road_straight';
                const tile = this.assetManager.getModel(tileKey);
                if (!tile) continue;

                tile.scale.setScalar(scale);
                tile.position.set(
                    -ROAD_WIDTH / 2 + (col + 0.5) * tileSize.x * scale,
                    0,
                    -CHUNK_LENGTH / 2 + (row + 0.5) * scaledTileZ
                );
                tile.traverse(c => {
                    if (c.isMesh) {
                        c.receiveShadow = true;
                        c.matrixAutoUpdate = false;
                    }
                });
                tile.updateMatrixWorld(true);
                this.group.add(tile);
                this.roadMeshes.push(tile);
            }
        }
    }

    _buildFallbackRoad() {
        const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, CHUNK_LENGTH);
        const roadTex = this.textureGen ? this.textureGen.get('road') : null;
        const roadMat = roadTex
            ? new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.9 })
            : new THREE.MeshStandardMaterial({ color: 0x444444 });
        const road = new THREE.Mesh(roadGeo, roadMat);
        road.rotation.x = -Math.PI / 2;
        road.receiveShadow = true;
        road.matrixAutoUpdate = false;
        road.updateMatrix();
        this.group.add(road);
        this.roadMeshes.push(road);

        // 纹理已包含标线，无需手动车道线
        if (!roadTex) {
            const lineGeo = new THREE.PlaneGeometry(0.15, CHUNK_LENGTH);
            const lineMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
            for (let i = -1; i <= 1; i += 2) {
                const line = new THREE.Mesh(lineGeo, lineMat);
                line.rotation.x = -Math.PI / 2;
                line.position.set(i * 3, 0.01, 0);
                line.matrixAutoUpdate = false;
                line.updateMatrix();
                this.group.add(line);
                this.roadMeshes.push(line);
            }
        }
    }

    _buildSidewalks() {
        for (const side of [-1, 1]) {
            const swGeo = new THREE.BoxGeometry(2, 0.25, CHUNK_LENGTH);
            const swTex = this.textureGen ? this.textureGen.get('sidewalk') : null;
            const swMat = swTex
                ? new THREE.MeshStandardMaterial({ map: swTex, roughness: 0.85 })
                : new THREE.MeshStandardMaterial({ color: 0xAAAAAA });
            const sw = new THREE.Mesh(swGeo, swMat);
            sw.position.set(side * (ROAD_WIDTH / 2 + 1), 0.125, 0);
            sw.receiveShadow = true;
            sw.matrixAutoUpdate = false;
            sw.updateMatrix();
            this.group.add(sw);
        }
    }

    // ─── 建筑系统 ───────────────────────────────────

    _generateBuildings() {
        const hasSuburban = this.assetManager && this.assetManager.hasCategory('suburban');
        const hasCommercial = this.assetManager && this.assetManager.hasCategory('commercial');
        const useKenney = hasSuburban || hasCommercial;

        for (const side of [-1, 1]) {
            const baseX = side * (ROAD_WIDTH / 2 + 3);
            let z = -CHUNK_LENGTH / 2;

            while (z < CHUNK_LENGTH / 2 - 2) {
                if (useKenney) {
                    const placed = this._placeKenneyBuilding(side, baseX, z);
                    z += placed + 0.5;
                } else {
                    z += this._placeFallbackBuilding(side, baseX, z) + 0.5;
                }
            }
        }
    }

    _placeKenneyBuilding(side, baseX, z) {
        const tc = this._themeConfig;
        const ratio = tc ? tc.commercialRatio : 0.6;
        const cat = Math.random() < ratio ? 'commercial' : 'suburban';
        const result = this.assetManager.getRandomBuilding(cat);

        if (!result) {
            return this._placeFallbackBuilding(side, baseX, z);
        }

        const { model, size } = result;

        const scaleMin = tc ? tc.buildingScaleMin : 0.8;
        const scaleMax = tc ? tc.buildingScaleMax : 1.2;
        const scaleFactor = scaleMin + Math.random() * (scaleMax - scaleMin);
        model.scale.setScalar(scaleFactor);

        // 随机轴对齐旋转
        const rotations = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
        model.rotation.y = rotations[Math.floor(Math.random() * rotations.length)];

        // 计算实际占用深度
        const effectiveDepth = Math.max(size.z, size.x) * scaleFactor;
        const effectiveWidth = Math.min(size.z, size.x) * scaleFactor;

        model.position.set(
            baseX + side * Math.max(effectiveWidth / 2, 1),
            0,
            z + effectiveDepth / 2
        );

        model.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                // 霓虹 emissive（主题强度 > 0 时）
                if (tc && tc.buildingEmissiveIntensity > 0) {
                    const neonColors = [0xFF00FF, 0x00FFFF, 0xFF4488, 0x8844FF, 0x44FF88];
                    const mat = child.material.clone();
                    mat.emissive = new THREE.Color(neonColors[Math.floor(Math.random() * neonColors.length)]);
                    mat.emissiveIntensity = tc.buildingEmissiveIntensity;
                    child.material = mat;
                }
            }
        });

        this.group.add(model);
        this.buildings.push(model);
        return effectiveDepth;
    }

    _placeFallbackBuilding(side, baseX, z) {
        const tc = this._themeConfig;
        const w = 3 + Math.random() * 4;
        const h = 4 + Math.random() * 12;
        const d = 4 + Math.random() * 4;
        const geo = new THREE.BoxGeometry(w, h, d);
        // 使用主题纹理集
        const texPrefix = tc && tc.textureSet ? tc.textureSet + '/' : '';
        const texKey = texPrefix + 'building_' + Math.floor(Math.random() * 10);
        const buildTex = this.textureGen ? this.textureGen.get(texKey) : null;
        const matOpts = buildTex
            ? { map: buildTex, roughness: 0.7, metalness: 0.1 }
            : { color: BUILDING_COLORS[Math.floor(Math.random() * BUILDING_COLORS.length)], flatShading: true };
        // 霓虹 emissive
        if (tc && tc.buildingEmissiveIntensity > 0) {
            const neonColors = [0xFF00FF, 0x00FFFF, 0xFF4488, 0x8844FF, 0x44FF88];
            matOpts.emissive = neonColors[Math.floor(Math.random() * neonColors.length)];
            matOpts.emissiveIntensity = tc.buildingEmissiveIntensity;
        }
        const mat = new THREE.MeshStandardMaterial(matOpts);
        const bld = new THREE.Mesh(geo, mat);
        bld.position.set(baseX + side * w / 2, h / 2, z + d / 2);
        bld.castShadow = true;
        bld.receiveShadow = true;
        this.group.add(bld);
        this.buildings.push(bld);
        return d;
    }

    _clearBuildings() {
        for (const b of this.buildings) {
            this.group.remove(b);
            b.traverse(child => {
                if (child.isMesh) {
                    child.geometry.dispose();
                }
            });
        }
        this.buildings = [];
    }

    // ─── 街道装饰 ───────────────────────────────────

    _generateProps() {
        if (!this.assetManager || !this.assetManager.hasCategory('prop')) return;

        for (const side of [-1, 1]) {
            const baseX = side * (ROAD_WIDTH / 2 + 1); // 人行道中心
            let z = -CHUNK_LENGTH / 2 + 2;

            while (z < CHUNK_LENGTH / 2 - 2) {
                const density = this._themeConfig ? this._themeConfig.propDensity : 0.3;
                if (Math.random() < density) {
                    const result = this.assetManager.getRandomProp();
                    if (result) {
                        const { model, size } = result;
                        const scaleFactor = 0.6 + Math.random() * 0.4;
                        model.scale.setScalar(scaleFactor);
                        model.position.set(baseX, 0.25, z);
                        // 随机朝向
                        model.rotation.y = Math.random() * Math.PI * 2;

                        model.traverse(child => {
                            if (child.isMesh) {
                                child.castShadow = true;
                                child.receiveShadow = true;
                            }
                        });

                        this.group.add(model);
                        this.props.push(model);
                    }
                }
                z += 4 + Math.random() * 4; // 间距 4-8
            }
        }
    }

    _clearProps() {
        for (const p of this.props) {
            this.group.remove(p);
            p.traverse(child => {
                if (child.isMesh) {
                    child.geometry.dispose();
                }
            });
        }
        this.props = [];
    }

    // ─── 障碍物系统 ─────────────────────────────────

    generate(zPos, difficulty, coinSystem, powerUpSystem, themeWorldConfig) {
        this.group.position.z = zPos;
        this.active = true;
        this._themeConfig = themeWorldConfig || null;

        // 重建建筑和装饰 (每次回收都刷新，增加多样性)
        this._clearBuildings();
        this._generateBuildings();
        this._clearProps();
        this._generateProps();

        // 清除旧障碍
        for (const obs of this.obstacles) {
            this.group.remove(obs.mesh);
            obs.mesh.traverse(c => { if (c.isMesh) c.geometry.dispose(); });
        }
        this.obstacles = [];

        // 清除旧金币 & 道具
        this._clearPickups(coinSystem, powerUpSystem);

        // 生成障碍（使用 pattern 系统）
        const count = 2 + Math.floor(difficulty * 3);
        const spacing = CHUNK_LENGTH / (count + 1);

        for (let i = 0; i < count; i++) {
            const slotZ = -CHUNK_LENGTH / 2 + spacing * (i + 1);
            const patternFn = selectPattern(difficulty);
            const entries = patternFn();

            for (const entry of entries) {
                const z = Math.max(-CHUNK_LENGTH / 2 + 1,
                    Math.min(CHUNK_LENGTH / 2 - 1, slotZ + (entry.zOffset || 0)));
                const obs = this._createObstacle(entry.type, entry.lane, z);
                this.obstacles.push(obs);
            }
        }

        // 生成金币
        if (coinSystem) {
            this.coins = coinSystem.createCoinsForChunk(this.group, difficulty);
        }

        // 生成道具
        if (powerUpSystem) {
            this.powerUp = powerUpSystem.createForChunk(this.group, difficulty);
        }
    }

    _clearPickups(coinSystem, powerUpSystem) {
        if (coinSystem && this.coins.length > 0) {
            coinSystem.clearCoins(this.group, this.coins);
        }
        this.coins = [];
        if (powerUpSystem && this.powerUp) {
            powerUpSystem.clearPowerUp(this.group, this.powerUp);
        }
        this.powerUp = null;
    }

    _createObstacle(type, lane, z) {
        const dims = COLLISION_DIMS[type];
        let mesh;

        // 尝试用 Kenney 模型
        const modelResult = this.assetManager
            ? this.assetManager.getObstacleModel(type)
            : null;

        if (modelResult) {
            mesh = modelResult.model;
            // 缩放模型到与碰撞盒大致匹配
            const bbox = new THREE.Box3().setFromObject(mesh);
            const size = bbox.getSize(new THREE.Vector3());
            const targetScale = dims.w / Math.max(size.x, size.z, 0.01);
            mesh.scale.setScalar(targetScale);
            // 重新计算缩放后的底部偏移
            const scaledBbox = new THREE.Box3().setFromObject(mesh);
            const scaledSize = scaledBbox.getSize(new THREE.Vector3());
            mesh.position.set(LANES[lane], scaledSize.y / 2, z);
        } else {
            // 兜底: 贴图方块
            let geo, fallbackColor, texKey, emissive;
            if (type === 'low') {
                geo = new THREE.BoxGeometry(2, 1, 1);
                fallbackColor = 0xFF4444;
                texKey = 'obstacle_low';
                emissive = 0x331111;
            } else {
                geo = new THREE.BoxGeometry(2, 2.5, 1);
                fallbackColor = 0xFF8800;
                texKey = 'obstacle_full';
                emissive = 0x332200;
            }
            const obsTex = this.textureGen ? this.textureGen.get(texKey) : null;
            const mat = obsTex
                ? new THREE.MeshStandardMaterial({ map: obsTex, roughness: 0.6, emissive, emissiveIntensity: 0.2 })
                : new THREE.MeshStandardMaterial({ color: fallbackColor });
            mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(LANES[lane], dims.yOff, z);
        }

        mesh.castShadow = true;
        this.group.add(mesh);

        // 碰撞盒: 固定尺寸，与视觉解耦
        const box = new THREE.Box3();

        return { mesh, box, type, active: true, lane, dims };
    }

    updateCollisionBoxes() {
        const worldPos = new THREE.Vector3();
        for (const obs of this.obstacles) {
            if (!obs.active) continue;
            obs.mesh.getWorldPosition(worldPos);
            const d = obs.dims;
            obs.box.setFromCenterAndSize(
                worldPos,
                new THREE.Vector3(d.w, d.h, 1)
            );
        }
    }

    recycle(coinSystem, powerUpSystem) {
        this.active = false;
        this._clearPickups(coinSystem, powerUpSystem);
    }
}
