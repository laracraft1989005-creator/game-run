import * as THREE from 'three';
import { CHUNK_LENGTH, ROAD_WIDTH, LANES } from './LaneConfig.js';

const BUILDING_COLORS = [0x6688AA, 0x7799BB, 0x5577AA, 0x8899BB, 0x6677CC, 0x9988AA];
const OBSTACLE_TYPES = ['low', 'full'];

export class CityChunk {
    constructor(scene) {
        this.group = new THREE.Group();
        this.obstacles = [];
        this.active = false;
        scene.add(this.group);

        // 路面
        const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, CHUNK_LENGTH);
        const roadMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
        this.road = new THREE.Mesh(roadGeo, roadMat);
        this.road.rotation.x = -Math.PI / 2;
        this.road.receiveShadow = true;
        this.group.add(this.road);

        // 车道线
        const lineGeo = new THREE.PlaneGeometry(0.15, CHUNK_LENGTH);
        const lineMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
        for (let i = -1; i <= 1; i += 2) {
            const line = new THREE.Mesh(lineGeo, lineMat);
            line.rotation.x = -Math.PI / 2;
            line.position.set(i * 3, 0.01, 0);
            this.group.add(line);
        }

        // 人行道
        for (const side of [-1, 1]) {
            const swGeo = new THREE.BoxGeometry(2, 0.2, CHUNK_LENGTH);
            const swMat = new THREE.MeshStandardMaterial({ color: 0x999999 });
            const sw = new THREE.Mesh(swGeo, swMat);
            sw.position.set(side * (ROAD_WIDTH / 2 + 1), 0.1, 0);
            sw.receiveShadow = true;
            this.group.add(sw);
        }

        // 预建建筑容器
        this.buildings = [];
        this._generateBuildings();
    }

    _generateBuildings() {
        for (const side of [-1, 1]) {
            const baseX = side * (ROAD_WIDTH / 2 + 3);
            let z = -CHUNK_LENGTH / 2;
            while (z < CHUNK_LENGTH / 2 - 2) {
                const w = 3 + Math.random() * 4;
                const h = 4 + Math.random() * 12;
                const d = 4 + Math.random() * 4;
                const geo = new THREE.BoxGeometry(w, h, d);
                const color = BUILDING_COLORS[Math.floor(Math.random() * BUILDING_COLORS.length)];
                const mat = new THREE.MeshStandardMaterial({ color, flatShading: true });
                const bld = new THREE.Mesh(geo, mat);
                bld.position.set(baseX + side * w / 2, h / 2, z + d / 2);
                bld.castShadow = true;
                bld.receiveShadow = true;
                this.group.add(bld);
                this.buildings.push(bld);
                z += d + 0.5;
            }
        }
    }

    generate(zPos, difficulty) {
        this.group.position.z = zPos;
        this.active = true;

        // 清除旧障碍
        for (const obs of this.obstacles) {
            this.group.remove(obs.mesh);
        }
        this.obstacles = [];

        // 生成障碍
        const count = 2 + Math.floor(difficulty * 3);
        const spacing = CHUNK_LENGTH / (count + 1);

        for (let i = 0; i < count; i++) {
            const lane = Math.floor(Math.random() * 3);
            const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
            const z = -CHUNK_LENGTH / 2 + spacing * (i + 1);
            const obs = this._createObstacle(type, lane, z);
            this.obstacles.push(obs);
        }
    }

    _createObstacle(type, lane, z) {
        let geo, color, h, yOff;
        if (type === 'low') {
            geo = new THREE.BoxGeometry(2, 1, 1);
            color = 0xFF4444;
            h = 1; yOff = 0.5;
        } else {
            geo = new THREE.BoxGeometry(2, 2.5, 1);
            color = 0xFF8800;
            h = 2.5; yOff = 1.25;
        }
        const mat = new THREE.MeshStandardMaterial({ color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(LANES[lane], yOff, z);
        mesh.castShadow = true;
        this.group.add(mesh);

        const box = new THREE.Box3().setFromObject(mesh);
        return { mesh, box, type, active: true, lane };
    }

    updateCollisionBoxes() {
        for (const obs of this.obstacles) {
            if (!obs.active) continue;
            // box 需要世界坐标
            obs.box.setFromObject(obs.mesh);
            // 把 group 偏移加上
            obs.box.translate(new THREE.Vector3(0, 0, 0)); // setFromObject 已包含世界坐标
        }
    }

    recycle() {
        this.active = false;
    }
}
