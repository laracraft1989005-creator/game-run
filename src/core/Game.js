import * as THREE from 'three';
import { createRenderer, createCamera, createScene, setupResize } from '../rendering/SceneSetup.js?v=202604011500';
import { LightingRig } from '../rendering/LightingRig.js?v=202604011500';
import { SkyController } from '../rendering/SkyController.js?v=202604011500';
import { CameraController } from '../rendering/CameraController.js?v=202604011500';
import { InputManager } from './InputManager.js?v=202604011500';
import { AssetManager } from './AssetManager.js?v=202604011500';
import { TextureGenerator } from '../rendering/TextureGenerator.js?v=202604011500';
import { PlayerController } from '../player/PlayerController.js?v=202604011500';
import { CollisionDetector } from '../player/CollisionDetector.js?v=202604011500';
import { ChunkManager } from '../world/ChunkManager.js?v=202604011500';
import { ScoreManager } from '../gameplay/ScoreManager.js?v=202604011500';
import { DifficultyManager } from '../gameplay/DifficultyManager.js?v=202604011500';
import { ParticleSystem } from '../effects/ParticleSystem.js?v=202604011500';
import { SpeedLines } from '../effects/SpeedLines.js?v=202604011500';
import { PostProcessing } from '../rendering/PostProcessing.js?v=202604011500';
import { SoundManager } from './SoundManager.js?v=202604011500';
import { UIManager } from './UIManager.js?v=202604011500';
import { CoinSystem } from '../gameplay/CoinSystem.js?v=202604011500';
import { PowerUpSystem } from '../gameplay/PowerUpSystem.js?v=202604011500';
import { ThemeManager, THEME_CONFIGS } from '../rendering/ThemeManager.js?v=202604011500';
import { ProgressionManager } from '../gameplay/ProgressionManager.js?v=202604011500';
import { RideSystem } from '../gameplay/RideSystem.js?v=202604011500';

const STATE = { MENU: 'menu', COUNTDOWN: 'countdown', PLAYING: 'playing', GAME_OVER: 'gameover' };

export class Game {
    constructor(container) {
        // 渲染器
        this.renderer = createRenderer();
        container.appendChild(this.renderer.domElement);
        this.scene = createScene();
        this.camera = createCamera();
        setupResize(this.camera, this.renderer);

        // 程序化纹理 (同步生成，最先初始化，含多主题纹理集)
        this.textureGen = new TextureGenerator();
        this.textureGen.generateAll(THEME_CONFIGS);

        // 子系统
        this.input = new InputManager();
        this.lighting = new LightingRig(this.scene);
        this.sky = new SkyController(this.scene);
        this.cameraCtrl = new CameraController(this.camera);
        this._selectedCharacter = localStorage.getItem('cityRunnerChar') || 'runner';
        // 验证角色是否已解锁（兼容 v0.9 → v1.0 升级，ProgressionManager 尚未创建时先用 runner）
        this.player = new PlayerController(this.scene, this.textureGen, this._selectedCharacter);
        this.collision = new CollisionDetector();
        this.score = new ScoreManager();
        this.difficulty = new DifficultyManager();
        this.sound = new SoundManager();
        this.ui = new UIManager();
        this.coinSystem = new CoinSystem();
        this.powerUpSystem = new PowerUpSystem(this.scene);
        this.progression = new ProgressionManager();
        this.rideSystem = new RideSystem(this.scene);

        // 道具升级时长接线
        this.powerUpSystem.setDurationProvider(type => this.progression.getDuration(type));

        // 地面
        const groundGeo = new THREE.PlaneGeometry(200, 1000);
        const groundTex = this.textureGen.get('ground');
        const groundMat = groundTex
            ? new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95 })
            : new THREE.MeshStandardMaterial({ color: 0x555555 });
        this.ground = new THREE.Mesh(groundGeo, groundMat);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.position.y = -0.05;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

        // 状态
        this.state = STATE.MENU;
        this.worldOffset = 0;
        this.clock = new THREE.Clock();

        // 特效状态追踪
        this._prevGrounded = true;
        this._prevAlive = true;

        // 按钮事件
        document.getElementById('btn-start')?.addEventListener('click', () => {
            this.sound.unlock();
            this.sound.playUIClick();
            this._startCountdown();
        });
        document.getElementById('btn-restart')?.addEventListener('click', () => {
            this.sound.unlock();
            this.sound.playUIClick();
            this._startCountdown();
        });

        // 商店按钮
        document.getElementById('btn-shop')?.addEventListener('click', () => {
            this.sound.unlock();
            this.sound.playUIClick();
            this._openShop();
        });
        document.getElementById('btn-shop-back')?.addEventListener('click', () => {
            this.sound.playUIClick();
            this.ui.showMenu();
            this.ui.updateShopCoins(this.progression.getCoins());
        });

        // 静音按钮
        this.ui.setupMuteButton(this.sound.muted, () => {
            this.sound.unlock();
            return this.sound.toggleMute();
        });

        // 初始隐藏
        this.ui.showLoading();
    }

    async init() {
        // 加载 Kenney 资源
        this.assetManager = new AssetManager();
        const progressFill = document.querySelector('#loading .progress-fill');
        const loadingText = document.querySelector('#loading .loading-text');

        this.assetManager.onProgress = (loaded, total) => {
            const pct = Math.round(loaded / total * 100);
            progressFill.style.width = pct + '%';
            loadingText.textContent = `Loading city assets... ${loaded}/${total}`;
        };

        await this.assetManager.loadAll();

        // 创建世界分块管理器
        this.chunks = new ChunkManager(this.scene, this.assetManager, this.textureGen);
        this.chunks.coinSystem = this.coinSystem;
        this.chunks.powerUpSystem = this.powerUpSystem;
        this.chunks.reset();
        this.chunks.update(0, 0);

        // 特效系统
        this.particles = new ParticleSystem(this.scene);
        this.speedLines = new SpeedLines(this.camera);

        // 后处理 (Bloom)
        try {
            this.postProcessing = new PostProcessing(this.renderer, this.scene, this.camera);
            window.addEventListener('resize', () => {
                this.postProcessing.setSize(window.innerWidth, window.innerHeight);
            });
        } catch (e) {
            console.warn('PostProcessing unavailable:', e);
            this.postProcessing = null;
        }

        // 主题系统
        this.themeManager = new ThemeManager(
            this.scene, this.renderer,
            this.sky, this.lighting, this.postProcessing
        );

        // 验证角色解锁状态
        if (!this.progression.isSkinUnlocked(this._selectedCharacter)) {
            this._selectedCharacter = 'runner';
            localStorage.setItem('cityRunnerChar', 'runner');
            this.player.switchCharacter('runner');
        }

        this.ui.showMenu();
        this.ui.updateShopCoins(this.progression.getCoins());
    }

    _startCountdown() {
        if (this.state === STATE.COUNTDOWN) return;
        this.state = STATE.COUNTDOWN;

        // 预先重置游戏状态
        this.worldOffset = 0;
        this.player.reset();
        this.score.reset();
        this.difficulty.reset();
        this.coinSystem.reset();
        this.powerUpSystem.reset();
        this.rideSystem.reset();
        if (this.themeManager) this.themeManager.reset();
        this.chunks.reset();
        this.chunks.update(0, 0);
        this.clock.getDelta();
        this._prevGrounded = true;
        this._prevAlive = true;
        if (this.particles) this.particles.reset();
        if (this.speedLines) this.speedLines.reset();

        this.ui.showCountdown(() => {
            this.state = STATE.PLAYING;
            this.ui.showPlaying();
            this.sound.startMusic();
        });
    }

    _openShop() {
        this.ui.showShop();
        this.ui.updateShopCoins(this.progression.getCoins());
        this._renderShop();
    }

    _renderShop() {
        this.ui.renderShopSkins(this.progression, this._selectedCharacter, {
            onSelect: (skinId) => {
                this.sound.playUIClick();
                this._selectedCharacter = skinId;
                localStorage.setItem('cityRunnerChar', skinId);
                this.player.switchCharacter(skinId);
                this._renderShop();
            },
            onBuy: (skinId) => {
                this.sound.playUIClick();
                if (this.progression.unlockSkin(skinId)) {
                    this.sound.playMilestone();
                    this._selectedCharacter = skinId;
                    localStorage.setItem('cityRunnerChar', skinId);
                    this.player.switchCharacter(skinId);
                    this.ui.updateShopCoins(this.progression.getCoins());
                    this._renderShop();
                }
            },
        });
        this.ui.renderShopUpgrades(this.progression, {
            onUpgrade: (type) => {
                this.sound.playUIClick();
                if (this.progression.purchaseUpgrade(type)) {
                    this.sound.playPowerupPickup();
                    this.ui.updateShopCoins(this.progression.getCoins());
                    this._renderShop();
                }
            },
        });
    }

    gameOver() {
        this.state = STATE.GAME_OVER;
        const isNewRecord = this.score.saveHighScore();
        this.cameraCtrl.shake(1.0);
        this.sound.playCollision();
        this.sound.stopMusic();
        this.sound.resetFootsteps();

        // 持久化金币
        const earnedCoins = this.score.coins;
        this.progression.addCoins(earnedCoins);

        this.ui.showGameOver({
            score: this.score.score,
            highScore: this.score.highScore,
            distance: this.score.distance,
            coins: earnedCoins,
            time: this.difficulty.elapsed,
            maxSpeed: this.difficulty.maxReachedSpeed,
            isNewRecord,
        });
        this.ui.updateGameOverCoins(earnedCoins, this.progression.getCoins());
    }

    update() {
        const dt = Math.min(this.clock.getDelta(), 0.05);

        // 输入
        const actions = this.input.consume();
        if (this.state === STATE.MENU && (actions.jump || actions.slide)) {
            this.sound.unlock();
            this._startCountdown();
            return;
        }
        if (this.state === STATE.GAME_OVER && actions.jump) {
            this.sound.unlock();
            this._startCountdown();
            return;
        }

        // 天空动画始终更新
        this.sky.update(dt);

        // 特效始终更新 (死亡爆炸需要在 GAME_OVER 状态播完)
        const playerState = {
            alive: this.player.alive,
            isGrounded: this.player.isGrounded,
            isSliding: this.player.isSliding,
        };
        const curSpeed = this.state === STATE.PLAYING ? this.difficulty.speed : 0;

        if (this.particles) {
            this.particles.update(dt, this.player.position, playerState, curSpeed);
        }
        if (this.speedLines) {
            const intensity = Math.max(0, (curSpeed - 20) / 15);
            this.speedLines.update(dt, intensity);
        }

        if (this.state !== STATE.PLAYING) return;

        // 难度 & 速度
        this.difficulty.update(dt);
        const speed = this.difficulty.speed;

        // 主题过渡
        if (this.themeManager) {
            this.themeManager.update(dt, this.difficulty.getDifficulty());
        }

        // 音乐节拍跟随速度
        this.sound.setMusicTempo(speed);

        // 加速提示
        if (this.difficulty.speedChanged) {
            this.sound.playSpeedUp();
            this.ui.flashSpeedUp();
        }

        // 捕获前一帧状态
        const wasGrounded = this._prevGrounded;

        // 音效触发（在 handleInput 之前检测 action）
        if (actions.left || actions.right) this.sound.playLaneSwitch();
        if (actions.slide && this.player.isGrounded) this.sound.playSlide();

        // 玩家输入 & 更新
        this.player.handleInput(actions);
        this.player.update(dt, speed);

        // 粒子触发：跳跃起飞
        if (wasGrounded && !this.player.isGrounded && this.player.velocityY > 0) {
            this.particles.triggerJumpDust(this.player.position);
            this.sound.playJump();
        }
        // 粒子触发：落地
        if (!wasGrounded && this.player.isGrounded) {
            this.particles.triggerLandDust(this.player.position);
            this.sound.playLand();
        }

        // 脚步声
        if (this.player.isGrounded && this.player.alive && !this.player.isSliding) {
            this.sound.updateFootsteps(speed);
        }

        this._prevGrounded = this.player.isGrounded;
        this._prevAlive = this.player.alive;

        // 世界滚动
        const dz = speed * dt;
        this.worldOffset += dz;
        this.chunks.scrollWorld(dz);
        this.ground.position.z += dz;
        if (this.ground.position.z > 500) this.ground.position.z -= 1000;

        // 分块管理
        const worldConfig = this.themeManager ? this.themeManager.getWorldConfig() : null;
        this.chunks.update(this.worldOffset, this.difficulty.getDifficulty(), worldConfig, dt);

        // 金币动画（自旋 + 浮动）
        this.coinSystem.update(dt, this.chunks.chunks);

        // 道具动画 + 效果 (护盾视觉、磁铁吸引、计时)
        this.powerUpSystem.update(dt, this.player.position, this.chunks.chunks, this.chunks.chunks);

        // ─── 碰撞检测 ───

        // 骑乘系统更新
        this.rideSystem.update(dt, this.player.position, speed);
        this.player.setGroundY(this.rideSystem.getGroundY());

        // 骑乘结束音效
        if (this.rideSystem.state === 'descending' && this.rideSystem.timer < dt * 2) {
            this.sound.playRideEnd();
        }

        // 弹射板交互
        const jumpPads = this.chunks.getActiveJumpPads();
        const touchedPads = this.collision.checkInteractables(
            this.player.position, this.player.isSliding, jumpPads
        );
        for (const pad of touchedPads) {
            if (this.player.isGrounded && !pad.triggered) {
                pad.triggered = true;
                if (this.player.applyJumpBoost(2)) {
                    this.player.setInvulnerable(0.5);
                    if (this.particles) this.particles.triggerJumpPadBurst(this.player.position);
                    this.sound.playJumpPad();
                    // 尝试触发骑乘
                    if (this.rideSystem.tryTrigger()) {
                        this.sound.playRideStart();
                        this.ui.flashMilestoneText('BUS RIDE!');
                    }
                }
            }
            if (!this.player.isGrounded) pad.triggered = false;
        }

        // 加速带交互
        const speedZones = this.chunks.getActiveSpeedZones();
        const touchedZones = this.collision.checkInteractables(
            this.player.position, this.player.isSliding, speedZones
        );
        if (touchedZones.length > 0 && !this.difficulty.isSpeedBoosted()) {
            this.difficulty.applySpeedBoost(1.5, 3.0);
            this.cameraCtrl.applyFovBoost(10, 3.0);
            this.sound.playSpeedZone();
            this.ui.showPowerUp('speedBoost', 3.0, '加速');
        }

        // 障碍物碰撞 (骑乘期间跳过地面障碍)
        if (!this.rideSystem.isRiding()) {
            const obstacles = this.chunks.getActiveObstacles();
            const hit = this.collision.check(this.player.position, this.player.isSliding, obstacles);
            if (hit) {
                if (this.player.invulnerable) {
                    hit.active = false;
                } else if (this.powerUpSystem.isShieldActive()) {
                    this.powerUpSystem.breakShield();
                    this.sound.playShieldBreak();
                    this.ui.hidePowerUp();
                    this.cameraCtrl.shake(0.3);
                    hit.active = false;
                } else {
                    this.player.die();
                    if (this.particles) this.particles.triggerExplosion(this.player.position);
                    this.gameOver();
                    return;
                }
            }
        }

        // 骑乘金币收集
        const rideCoins = this.rideSystem.getRideCoins();
        const collectedRideCoins = this.collision.checkPickups(this.player.position, this.player.isSliding, rideCoins);
        if (collectedRideCoins.length > 0) {
            for (const coin of collectedRideCoins) {
                coin.collected = true;
                coin.mesh.visible = false;
                if (this.particles) this.particles.triggerCoinBurst(coin.mesh.position);
            }
            this.score.addCoins(collectedRideCoins.length);
            this.sound.playCoinPickup();
            this.ui.updateCoinCount(this.score.coins);
            this.ui.flashCoinPopup(collectedRideCoins.length * 10 * this.score.multiplier);
        }

        // 金币收集
        const coins = this.chunks.getActiveCoins();
        const collectedCoins = this.collision.checkPickups(this.player.position, this.player.isSliding, coins);
        if (collectedCoins.length > 0) {
            for (const coin of collectedCoins) {
                coin.collected = true;
                coin.mesh.visible = false;
                if (this.particles) this.particles.triggerCoinBurst(coin.mesh.position);
            }
            this.score.addCoins(collectedCoins.length);
            this.sound.playCoinPickup();
            this.ui.updateCoinCount(this.score.coins);
            this.ui.flashCoinPopup(collectedCoins.length * 10 * this.score.multiplier);
        }

        // 道具收集
        const powerUps = this.chunks.getActivePowerUps();
        const collectedPU = this.collision.checkPickups(this.player.position, this.player.isSliding, powerUps);
        if (collectedPU.length > 0) {
            const pu = collectedPU[0];
            pu.collected = true;
            pu.mesh.visible = false;
            this.powerUpSystem.activate(pu.type);
            this.sound.playPowerupPickup();
            this.ui.showPowerUp(
                pu.type,
                this.powerUpSystem.getDuration(pu.type),
                this.powerUpSystem.getLabel(pu.type)
            );

            if (pu.type === 'scoreMultiplier') {
                this.score.setMultiplier(2);
                this.ui.showMultiplier(true);
            }
            if (pu.type === 'shield') {
                this.sound.playShieldActivate();
            }
        }

        // 道具过期检查
        if (this.powerUpSystem.justExpired) {
            const expired = this.powerUpSystem.justExpired;
            this.ui.hidePowerUp();
            if (expired === 'scoreMultiplier') {
                this.score.setMultiplier(1);
                this.ui.showMultiplier(false);
            }
        }

        // 计分 & UI
        this.score.update(dt, speed);
        this.ui.updateScore(this.score.score);
        this.ui.updateDistance(this.score.distance);
        this.ui.update(dt);

        // 里程碑检测
        const milestone = this.score.checkMilestone();
        if (milestone) {
            this.sound.playMilestone();
            this.ui.flashMilestone(milestone);
        }

        // 灯光跟随
        this.lighting.update(0);

        // 相机
        this.cameraCtrl.update(dt, this.player.position, speed,
            this.difficulty.baseSpeed, this.difficulty.maxSpeed);
    }

    render() {
        if (this.postProcessing && this.postProcessing.enabled) {
            this.postProcessing.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }

    run() {
        const loop = () => {
            requestAnimationFrame(loop);
            this.update();
            this.render();
        };
        loop();
    }
}
