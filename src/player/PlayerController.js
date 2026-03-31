import * as THREE from 'three';
import { LANES, LANE_SWITCH_SPEED } from '../world/LaneConfig.js';

const JUMP_VELOCITY = 12;
const GRAVITY = -30;
const SLIDE_DURATION = 0.8;

export class PlayerController {
    constructor(scene) {
        // v0.1: 方块人
        const geo = new THREE.BoxGeometry(0.8, 1.8, 0.8);
        const mat = new THREE.MeshStandardMaterial({ color: 0x4488FF });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.castShadow = true;
        this.mesh.position.set(0, 0.9, 0);
        scene.add(this.mesh);

        this.laneIndex = 1; // 中间道
        this.position = new THREE.Vector3(0, 0, 0);
        this.velocityY = 0;
        this.isGrounded = true;
        this.isSliding = false;
        this.slideTimer = 0;
        this.alive = true;
    }

    handleInput(actions) {
        if (!this.alive) return;
        if (actions.left && this.laneIndex > 0) this.laneIndex--;
        if (actions.right && this.laneIndex < 2) this.laneIndex++;
        if (actions.jump && this.isGrounded && !this.isSliding) {
            this.velocityY = JUMP_VELOCITY;
            this.isGrounded = false;
        }
        if (actions.slide && this.isGrounded && !this.isSliding) {
            this.isSliding = true;
            this.slideTimer = SLIDE_DURATION;
        }
    }

    update(dt) {
        if (!this.alive) return;

        // 车道切换 (lerp)
        const targetX = LANES[this.laneIndex];
        this.position.x += (targetX - this.position.x) * Math.min(1, LANE_SWITCH_SPEED * dt);

        // 跳跃物理
        if (!this.isGrounded) {
            this.velocityY += GRAVITY * dt;
            this.position.y += this.velocityY * dt;
            if (this.position.y <= 0) {
                this.position.y = 0;
                this.velocityY = 0;
                this.isGrounded = true;
            }
        }

        // 滑铲计时
        if (this.isSliding) {
            this.slideTimer -= dt;
            if (this.slideTimer <= 0) {
                this.isSliding = false;
            }
        }

        // 更新 mesh
        this.mesh.position.x = this.position.x;
        this.mesh.position.y = this.position.y + (this.isSliding ? 0.45 : 0.9);
        this.mesh.scale.y = this.isSliding ? 0.5 : 1.0;
    }

    die() {
        this.alive = false;
    }

    reset() {
        this.laneIndex = 1;
        this.position.set(0, 0, 0);
        this.velocityY = 0;
        this.isGrounded = true;
        this.isSliding = false;
        this.slideTimer = 0;
        this.alive = true;
        this.mesh.position.set(0, 0.9, 0);
        this.mesh.scale.y = 1;
    }
}
