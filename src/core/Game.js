import * as THREE from 'three';
import { createRenderer, createCamera, createScene, setupResize } from '../rendering/SceneSetup.js';
import { LightingRig } from '../rendering/LightingRig.js';
import { SkyController } from '../rendering/SkyController.js';
import { CameraController } from '../rendering/CameraController.js';
import { InputManager } from './InputManager.js';
import { AssetManager } from './AssetManager.js';
import { TextureGenerator } from '../rendering/TextureGenerator.js';
import { PlayerController } from '../player/PlayerController.js';
import { CollisionDetector } from '../player/CollisionDetector.js';
import { ChunkManager } from '../world/ChunkManager.js';
import { ScoreManager } from '../gameplay/ScoreManager.js';
import { DifficultyManager } from '../gameplay/DifficultyManager.js';
import { ParticleSystem } from '../effects/ParticleSystem.js';
import { SpeedLines } from '../effects/SpeedLines.js';
import { PostProcessing } from '../rendering/PostProcessing.js';

const STATE = { MENU: 'menu', PLAYING: 'playing', GAME_OVER: 'gameover' };

export class Game {
    constructor(container) {
        // 渲染器
        this.renderer = createRenderer();
        container.appendChild(this.renderer.domElement);
        this.scene = createScene();
        this.camera = createCamera();
        setupResize(this.camera, this.renderer);

        // 程序化纹理 (同步生成，最先初始化)
        this.textureGen = new TextureGenerator();
        this.textureGen.generateAll();

        // 子系统
        this.input = new InputManager();
        this.lighting = new LightingRig(this.scene);
        this.sky = new SkyController(this.scene);
        this.cameraCtrl = new CameraController(this.camera);
        this.player = new PlayerController(this.scene, this.textureGen);
        this.collision = new CollisionDetector();
        this.score = new ScoreManager();
        this.difficulty = new DifficultyManager();

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

        // UI 引用
        this.uiMenu = document.getElementById('menu');
        this.uiHud = document.getElementById('hud');
        this.uiGameOver = document.getElementById('gameover');
        this.uiLoading = document.getElementById('loading');
        this.uiScore = document.getElementById('score');
        this.uiDistance = document.getElementById('distance');
        this.uiFinalScore = document.getElementById('final-score');
        this.uiHighScore = document.getElementById('high-score');

        // 按钮事件
        document.getElementById('btn-start')?.addEventListener('click', () => this.startGame());
        document.getElementById('btn-restart')?.addEventListener('click', () => this.startGame());

        // 初始时隐藏菜单和 HUD，只显示 loading
        this.uiMenu.classList.add('hidden');
        this.uiHud.classList.add('hidden');
        this.uiGameOver.classList.add('hidden');
    }

    async init() {
        // 加载 Kenney 资源
        this.assetManager = new AssetManager();
        const progressFill = this.uiLoading.querySelector('.progress-fill');
        const loadingText = this.uiLoading.querySelector('.loading-text');

        this.assetManager.onProgress = (loaded, total) => {
            const pct = Math.round(loaded / total * 100);
            progressFill.style.width = pct + '%';
            loadingText.textContent = `Loading city assets... ${loaded}/${total}`;
        };

        await this.assetManager.loadAll();

        // 隐藏 loading，显示菜单
        this.uiLoading.classList.add('hidden');

        // 创建世界分块管理器
        this.chunks = new ChunkManager(this.scene, this.assetManager, this.textureGen);
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

        this._showUI(STATE.MENU);
    }

    startGame() {
        this.state = STATE.PLAYING;
        this.worldOffset = 0;
        this.player.reset();
        this.score.reset();
        this.difficulty.reset();
        this.chunks.reset();
        this.chunks.update(0, 0);
        this.clock.getDelta();
        this._prevGrounded = true;
        this._prevAlive = true;
        if (this.particles) this.particles.reset();
        if (this.speedLines) this.speedLines.reset();
        this._showUI(STATE.PLAYING);
    }

    gameOver() {
        this.state = STATE.GAME_OVER;
        this.score.saveHighScore();
        this.cameraCtrl.shake(1.0);
        this.uiFinalScore.textContent = this.score.score;
        this.uiHighScore.textContent = this.score.highScore;
        this._showUI(STATE.GAME_OVER);
    }

    _showUI(state) {
        this.uiMenu.classList.toggle('hidden', state !== STATE.MENU);
        this.uiHud.classList.toggle('hidden', state !== STATE.PLAYING);
        this.uiGameOver.classList.toggle('hidden', state !== STATE.GAME_OVER);
    }

    update() {
        const dt = Math.min(this.clock.getDelta(), 0.05);

        // 输入
        const actions = this.input.consume();
        if (this.state === STATE.MENU && (actions.jump || actions.slide)) {
            this.startGame();
            return;
        }
        if (this.state === STATE.GAME_OVER && actions.jump) {
            this.startGame();
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

        // 捕获前一帧状态
        const wasGrounded = this._prevGrounded;
        const wasAlive = this._prevAlive;

        // 玩家输入 & 更新
        this.player.handleInput(actions);
        this.player.update(dt, speed);

        // 粒子触发：跳跃起飞
        if (wasGrounded && !this.player.isGrounded && this.player.velocityY > 0) {
            this.particles.triggerJumpDust(this.player.position);
        }
        // 粒子触发：落地
        if (!wasGrounded && this.player.isGrounded) {
            this.particles.triggerLandDust(this.player.position);
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
        this.chunks.update(this.worldOffset, this.difficulty.getDifficulty());

        // 碰撞检测
        const obstacles = this.chunks.getActiveObstacles();
        const hit = this.collision.check(this.player.position, this.player.isSliding, obstacles);
        if (hit) {
            this.player.die();
            if (this.particles) this.particles.triggerExplosion(this.player.position);
            this.gameOver();
            return;
        }

        // 计分
        this.score.update(dt, speed);
        this.uiScore.textContent = this.score.score;
        this.uiDistance.textContent = Math.floor(this.score.distance) + 'm';

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
