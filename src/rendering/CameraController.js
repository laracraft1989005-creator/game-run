import * as THREE from 'three';

export class CameraController {
    constructor(camera) {
        this.camera = camera;
        this.offset = new THREE.Vector3(0, 5, 12);
        this.lookAhead = new THREE.Vector3(0, 1, -15);
        this.lookTarget = new THREE.Vector3();
        this.shakeIntensity = 0;
        this.baseFov = 60;
        this.maxFov = 75;
    }

    update(dt, playerPos, speed, minSpeed, maxSpeed) {
        // 跟随位置
        const target = playerPos.clone().add(this.offset);
        this.camera.position.lerp(target, Math.min(1, 5 * dt));

        // 看向前方
        const lookAt = playerPos.clone().add(this.lookAhead);
        this.lookTarget.lerp(lookAt, Math.min(1, 5 * dt));
        this.camera.lookAt(this.lookTarget);

        // 动态 FOV
        const t = Math.min(1, (speed - minSpeed) / (maxSpeed - minSpeed));
        this.camera.fov = THREE.MathUtils.lerp(this.baseFov, this.maxFov, t);
        this.camera.updateProjectionMatrix();

        // 震动衰减
        if (this.shakeIntensity > 0.01) {
            this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
            this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity;
            this.shakeIntensity *= 0.9;
        }
    }

    shake(intensity = 0.5) {
        this.shakeIntensity = intensity;
    }
}
