/**
 * Vehicles — 多种乘骑载具配置 + 程序化模型工厂
 * 当前支持：公交车、卡车、直升机
 */
import * as THREE from 'three';

export const VEHICLE_TYPES = {
    bus: {
        name: 'BUS RIDE!',
        chineseName: '公交车',
        rideHeight: 2.8,
        rideDuration: 4.0,
        riseDuration: 0.5,
        descendDuration: 0.8,
        coinRows: 8,
        coinLanes: 3,
        coinYOffset: 0.8,
        weight: 50,           // 50% 概率
        entryDirection: 'side', // 从右侧驶入
    },
    truck: {
        name: 'TRUCK RIDE!',
        chineseName: '卡车',
        rideHeight: 2.4,
        rideDuration: 3.5,
        riseDuration: 0.5,
        descendDuration: 0.8,
        coinRows: 6,
        coinLanes: 3,
        coinYOffset: 0.8,
        weight: 35,           // 35% 概率
        entryDirection: 'side',
    },
    helicopter: {
        name: 'HELI RIDE!',
        chineseName: '直升机',
        rideHeight: 4.5,
        rideDuration: 5.0,
        riseDuration: 0.6,
        descendDuration: 0.9,
        coinRows: 10,
        coinLanes: 3,
        coinYOffset: 0.8,
        weight: 15,           // 15% 概率（稀有）
        entryDirection: 'air', // 从空中降落
    },
};

export function pickVehicleType() {
    const total = Object.values(VEHICLE_TYPES).reduce((s, v) => s + v.weight, 0);
    let r = Math.random() * total;
    for (const [id, v] of Object.entries(VEHICLE_TYPES)) {
        r -= v.weight;
        if (r <= 0) return id;
    }
    return 'bus';
}

export function createVehicleMesh(type) {
    switch (type) {
        case 'truck':      return _createTruck();
        case 'helicopter': return _createHelicopter();
        case 'bus':
        default:           return _createBus();
    }
}

// ─── 公交车 ───
function _createBus() {
    const cfg = VEHICLE_TYPES.bus;
    const group = new THREE.Group();
    const bodyH = 2.5;
    const bodyLen = 20;
    const roofY = cfg.rideHeight;

    // 车身
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(8, bodyH, bodyLen),
        new THREE.MeshStandardMaterial({
            color: 0x2288AA,
            emissive: 0x114455,
            emissiveIntensity: 0.3,
            roughness: 0.4,
            metalness: 0.2,
        })
    );
    body.position.y = roofY - bodyH / 2;
    body.castShadow = true;
    group.add(body);

    // 车顶
    const roof = new THREE.Mesh(
        new THREE.BoxGeometry(8.2, 0.1, bodyLen + 0.2),
        new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.8 })
    );
    roof.position.y = roofY;
    roof.receiveShadow = true;
    group.add(roof);

    // 窗户
    const winMat = new THREE.MeshStandardMaterial({
        color: 0x88DDFF,
        emissive: 0x44AACC,
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.6,
    });
    for (const side of [-1, 1]) {
        const win = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.8, bodyLen - 2),
            winMat
        );
        win.position.set(side * 4.05, roofY - bodyH / 2 + 0.5, 0);
        group.add(win);
    }

    // 车轮
    _addWheels(group, [
        [-3.5, 0.5, -7], [3.5, 0.5, -7],
        [-3.5, 0.5, 7],  [3.5, 0.5, 7],
    ]);

    return group;
}

// ─── 卡车 ───
function _createTruck() {
    const cfg = VEHICLE_TYPES.truck;
    const group = new THREE.Group();
    const cabinH = 2.2;
    const cargoH = 2.3;
    const cabinLen = 5;
    const cargoLen = 13;
    const roofY = cfg.rideHeight;

    // 驾驶室
    const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(7, cabinH, cabinLen),
        new THREE.MeshStandardMaterial({
            color: 0xCC4422,
            emissive: 0x441100,
            emissiveIntensity: 0.3,
            roughness: 0.4,
            metalness: 0.3,
        })
    );
    cabin.position.set(0, roofY - cabinH / 2, 9);
    cabin.castShadow = true;
    group.add(cabin);

    // 驾驶室前窗
    const cabWin = new THREE.Mesh(
        new THREE.BoxGeometry(6, 0.8, 0.1),
        new THREE.MeshStandardMaterial({
            color: 0x88DDFF,
            emissive: 0x44AACC,
            emissiveIntensity: 0.4,
            transparent: true,
            opacity: 0.6,
        })
    );
    cabWin.position.set(0, roofY - 0.5, 9 + cabinLen / 2 + 0.05);
    group.add(cabWin);

    // 货箱
    const cargo = new THREE.Mesh(
        new THREE.BoxGeometry(8, cargoH, cargoLen),
        new THREE.MeshStandardMaterial({
            color: 0x884422,
            roughness: 0.9,
        })
    );
    cargo.position.set(0, roofY - cargoH / 2, -4);
    cargo.castShadow = true;
    group.add(cargo);

    // 货箱顶（平台）
    const cargoRoof = new THREE.Mesh(
        new THREE.BoxGeometry(8.2, 0.1, cargoLen + 0.2),
        new THREE.MeshStandardMaterial({ color: 0xAAAAAA, roughness: 0.8 })
    );
    cargoRoof.position.set(0, roofY, -4);
    cargoRoof.receiveShadow = true;
    group.add(cargoRoof);

    // 驾驶室顶
    const cabRoof = new THREE.Mesh(
        new THREE.BoxGeometry(7.2, 0.1, cabinLen + 0.2),
        new THREE.MeshStandardMaterial({ color: 0xAAAAAA, roughness: 0.8 })
    );
    cabRoof.position.set(0, roofY, 9);
    group.add(cabRoof);

    // 车轮 (6 个 — 双后轮)
    _addWheels(group, [
        [-3.5, 0.5, 9],   [3.5, 0.5, 9],
        [-3.5, 0.5, -2],  [3.5, 0.5, -2],
        [-3.5, 0.5, -8],  [3.5, 0.5, -8],
    ]);

    return group;
}

// ─── 直升机 ───
function _createHelicopter() {
    const cfg = VEHICLE_TYPES.helicopter;
    const group = new THREE.Group();
    const bodyH = 1.6;
    const bodyLen = 12;
    const platformY = cfg.rideHeight;
    const bodyY = platformY - bodyH - 0.3;

    // 机身（流线型）
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(6, bodyH, bodyLen),
        new THREE.MeshStandardMaterial({
            color: 0x444444,
            emissive: 0x111111,
            emissiveIntensity: 0.2,
            roughness: 0.5,
            metalness: 0.6,
        })
    );
    body.position.y = bodyY + bodyH / 2;
    body.castShadow = true;
    group.add(body);

    // 机舱玻璃（前部）
    const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(5.5, 1.2, 4),
        new THREE.MeshStandardMaterial({
            color: 0x88DDFF,
            emissive: 0x44AACC,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.55,
        })
    );
    cabin.position.set(0, bodyY + 0.7, 3.5);
    group.add(cabin);

    // 平台（支架在身体上方，玩家站立处）
    const platform = new THREE.Mesh(
        new THREE.BoxGeometry(8, 0.15, 10),
        new THREE.MeshStandardMaterial({
            color: 0x666666,
            emissive: 0x222222,
            emissiveIntensity: 0.3,
            roughness: 0.7,
            metalness: 0.5,
        })
    );
    platform.position.y = platformY;
    platform.receiveShadow = true;
    group.add(platform);

    // 平台支架
    const supportMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7 });
    for (const [sx, sz] of [[-3, -4], [3, -4], [-3, 4], [3, 4]]) {
        const support = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1, 0.1, 0.5, 6),
            supportMat
        );
        support.position.set(sx, platformY - 0.25, sz);
        group.add(support);
    }

    // 主旋翼（顶部，需要旋转动画 → 标记）
    const rotorMat = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.8,
        transparent: true,
        opacity: 0.85,
    });
    const rotor = new THREE.Mesh(
        new THREE.BoxGeometry(14, 0.1, 0.4),
        rotorMat
    );
    rotor.position.y = platformY + 1.0;
    rotor.name = 'mainRotor';
    group.add(rotor);

    const rotor2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.1, 14),
        rotorMat
    );
    rotor2.position.y = platformY + 1.0;
    rotor2.name = 'mainRotor';
    group.add(rotor2);

    // 旋翼轴
    const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 1.0, 8),
        new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.8 })
    );
    shaft.position.y = platformY + 0.5;
    group.add(shaft);

    // 尾梁
    const tail = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.6, 5),
        new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5 })
    );
    tail.position.set(0, bodyY + 0.3, -bodyLen / 2 - 1.5);
    group.add(tail);

    // 尾旋翼
    const tailRotor = new THREE.Mesh(
        new THREE.BoxGeometry(2.5, 0.05, 0.15),
        rotorMat
    );
    tailRotor.position.set(0.5, bodyY + 0.3, -bodyLen / 2 - 4);
    tailRotor.name = 'tailRotor';
    group.add(tailRotor);

    // 起落架
    const skidMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6 });
    for (const side of [-1, 1]) {
        const skid = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1, 0.1, 8, 6),
            skidMat
        );
        skid.rotation.x = Math.PI / 2;
        skid.position.set(side * 2.2, bodyY - 0.3, 0);
        group.add(skid);
    }

    return group;
}

function _addWheels(group, positions) {
    const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 8);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
    for (const [wx, wy, wz] of positions) {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.position.set(wx, wy, wz);
        group.add(wheel);
    }
}
