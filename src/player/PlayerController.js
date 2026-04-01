import * as THREE from 'three';
import { LANES, LANE_SWITCH_SPEED } from '../world/LaneConfig.js?v=202604011500';
import { CharacterModel } from './CharacterModel.js?v=202604011500';
import { AnimationController } from './AnimationController.js?v=202604011500';

const JUMP_VELOCITY = 12;
const GRAVITY = -30;
const SLIDE_DURATION = 0.8;

export class PlayerController {
    constructor(scene, textureGen, characterId) {
        this.scene = scene;
        this.textureGen = textureGen;
        this.characterModel = new CharacterModel();
        this.animController = null;

        // 备用方块 (加载完成前显示)
        const geo = new THREE.BoxGeometry(0.8, 1.8, 0.8);
        const mat = new THREE.MeshStandardMaterial({ color: 0x4488FF });
        this.fallbackMesh = new THREE.Mesh(geo, mat);
        this.fallbackMesh.castShadow = true;
        this.fallbackMesh.position.set(0, 0.9, 0);
        scene.add(this.fallbackMesh);

        this.laneIndex = 1;
        this.position = new THREE.Vector3(0, 0, 0);
        this.velocityY = 0;
        this.isGrounded = true;
        this.isSliding = false;
        this.slideTimer = 0;
        this.alive = true;
        this.invulnerable = false;
        this.invulnerableTimer = 0;
        this._groundY = 0; // 动态地面高度（骑乘系统用）
        this.modelReady = false;

        this._loadCharacter(characterId || 'runner');
    }

    async _loadCharacter(characterId = 'runner') {
        try {
            await this.characterModel.load(this.scene, this.textureGen, characterId);
            this.animController = new AnimationController(this.characterModel);
            this.animController.transitionTo('Idle', 0);
            this.modelReady = true;
            // 隐藏备用方块
            this.scene.remove(this.fallbackMesh);
            console.log('Character model loaded!');
        } catch (e) {
            console.error('Failed to load character:', e);
        }
    }

    handleInput(actions) {
        if (!this.alive) return;
        if (actions.left && this.laneIndex > 0) this.laneIndex--;
        if (actions.right && this.laneIndex < 2) this.laneIndex++;
        if (actions.jump && this.isGrounded && !this.isSliding) {
            this.velocityY = JUMP_VELOCITY;
            this.isGrounded = false;
            if (this.animController) this.animController.transitionTo('Jump', 0.1);
        }
        if (actions.slide && this.isGrounded && !this.isSliding) {
            this.isSliding = true;
            this.slideTimer = SLIDE_DURATION;
            // 没有专门的滑铲动画，用 Punch 替代（低姿态）
            if (this.animController) this.animController.transitionTo('Punch', 0.1);
        }
    }

    update(dt, speed) {
        if (!this.alive) return;

        // 无敌计时
        if (this.invulnerableTimer > 0) {
            this.invulnerableTimer -= dt;
            if (this.invulnerableTimer <= 0) {
                this.invulnerable = false;
                this.invulnerableTimer = 0;
            }
        }

        // 车道切换
        const targetX = LANES[this.laneIndex];
        this.position.x += (targetX - this.position.x) * Math.min(1, LANE_SWITCH_SPEED * dt);

        // 跳跃物理
        if (!this.isGrounded) {
            this.velocityY += GRAVITY * dt;
            this.position.y += this.velocityY * dt;
            if (this.position.y <= this._groundY) {
                this.position.y = this._groundY;
                this.velocityY = 0;
                this.isGrounded = true;
                if (this.animController) this.animController.transitionTo('Run', 0.15);
            }
        }

        // 滑铲计时
        if (this.isSliding) {
            this.slideTimer -= dt;
            if (this.slideTimer <= 0) {
                this.isSliding = false;
                if (this.animController) this.animController.transitionTo('Run', 0.15);
            }
        }

        // 跑步状态 & 动画速度
        if (this.isGrounded && !this.isSliding && this.alive) {
            if (this.animController && this.animController.currentState !== 'Run') {
                this.animController.transitionTo('Run', 0.2);
            }
            // 动画速度匹配游戏速度
            if (this.animController && speed) {
                this.animController.setTimeScale(Math.max(1, speed / 15));
            }
        }

        // 更新角色模型位置
        if (this.modelReady) {
            this.characterModel.setPosition(this.position.x, this.position.y, this.position.z);
            if (this.isSliding) {
                this.characterModel.setScaleY(0.5);
            } else {
                this.characterModel.setScaleY(1.0);
            }
            this.animController.update(dt);
        } else {
            // 备用方块
            this.fallbackMesh.position.x = this.position.x;
            this.fallbackMesh.position.y = this.position.y + (this.isSliding ? 0.45 : 0.9);
            this.fallbackMesh.scale.y = this.isSliding ? 0.5 : 1.0;
        }
    }

    /** 切换角色皮肤 */
    async switchCharacter(characterId) {
        if (!this.modelReady || !this.characterModel.mesh) return;
        // 重新上色
        if (this.textureGen) {
            this.textureGen.applyCharacterSkin(this.characterModel.mesh, characterId);
        }
    }

    /** 设置动态地面高度（骑乘系统用） */
    setGroundY(y) { this._groundY = y; }

    /** 弹射板超级跳 */
    applyJumpBoost(multiplier = 2) {
        if (!this.alive || !this.isGrounded) return false;
        this.velocityY = JUMP_VELOCITY * multiplier;
        this.isGrounded = false;
        if (this.animController) this.animController.transitionTo('Jump', 0.1);
        return true;
    }

    /** 设置无敌状态 */
    setInvulnerable(duration) {
        this.invulnerable = true;
        this.invulnerableTimer = duration;
    }

    die() {
        this.alive = false;
        if (this.animController) this.animController.transitionTo('Death', 0.2);
    }

    reset() {
        this.laneIndex = 1;
        this.position.set(0, 0, 0);
        this.velocityY = 0;
        this.isGrounded = true;
        this.isSliding = false;
        this.slideTimer = 0;
        this.alive = true;
        this.invulnerable = false;
        this.invulnerableTimer = 0;
        this._groundY = 0;
        if (this.modelReady) {
            this.characterModel.setPosition(0, 0, 0);
            this.characterModel.setScaleY(1);
            this.animController.transitionTo('Idle', 0);
        } else {
            this.fallbackMesh.position.set(0, 0.9, 0);
            this.fallbackMesh.scale.y = 1;
        }
    }
}
