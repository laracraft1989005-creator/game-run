import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

export class SkyController {
    constructor(scene) {
        // Sky shader
        this.sky = new Sky();
        this.sky.scale.setScalar(10000);
        scene.add(this.sky);

        const uniforms = this.sky.material.uniforms;
        uniforms['turbidity'].value = 2;
        uniforms['rayleigh'].value = 1.5;
        uniforms['mieCoefficient'].value = 0.005;
        uniforms['mieDirectionalG'].value = 0.8;

        const sun = new THREE.Vector3();
        const phi = THREE.MathUtils.degToRad(90 - 35);
        const theta = THREE.MathUtils.degToRad(200);
        sun.setFromSphericalCoords(1, phi, theta);
        uniforms['sunPosition'].value.copy(sun);

        // 程序化云朵
        this.clouds = [];
        const cloudMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF, flatShading: true });
        for (let i = 0; i < 25; i++) {
            const cloud = this._createCloud(cloudMat);
            cloud.position.set(
                (Math.random() - 0.5) * 200,
                40 + Math.random() * 40,
                (Math.random() - 0.5) * 300
            );
            cloud.userData.speed = 0.5 + Math.random() * 1.5;
            scene.add(cloud);
            this.clouds.push(cloud);
        }
    }

    _createCloud(mat) {
        const group = new THREE.Group();
        const count = 4 + Math.floor(Math.random() * 4);
        for (let i = 0; i < count; i++) {
            const geo = new THREE.SphereGeometry(Math.random() * 3 + 1.5, 7, 7);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(
                (Math.random() - 0.5) * 6,
                (Math.random() - 0.5) * 1,
                (Math.random() - 0.5) * 6
            );
            mesh.scale.y = 0.5;
            group.add(mesh);
        }
        return group;
    }

    update(dt) {
        for (const cloud of this.clouds) {
            cloud.position.x += cloud.userData.speed * dt;
            if (cloud.position.x > 120) cloud.position.x = -120;
        }
    }
}
