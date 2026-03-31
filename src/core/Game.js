import * as THREE from 'three';
import { createRenderer, createCamera, createScene, setupResize } from '../rendering/SceneSetup.js';
import { LightingRig } from '../rendering/LightingRig.js';
import { SkyController } from '../rendering/SkyController.js';
import { CameraController } from '../rendering/CameraController.js';
import { InputManager } from './InputManager.js';
import { PlayerController } from '../player/PlayerController.js';
import { CollisionDetector } from '../player/CollisionDetector.js';
import { ChunkManager } from '../world/ChunkManager.js';
import { ScoreManager } from '../gameplay/ScoreManager.js';
import { DifficultyManager } from '../gameplay/DifficultyManager.js';

const STATE = { MENU: 'menu', PLAYING: 'playing', GAME_OVER: 'gameover' };

export class Game {
    constructor(container) {
        // 渲染器
        this.renderer = createRenderer();
        container.appendChild(this.renderer.domElement);
        this.scene = createScene();
        this.camera = createCamera();
        setupResize(this.camera, this.renderer);

        // 子系统
        this.input = new InputManager();
        this.lighting = new LightingRig(this.scene);
        this.sky = new SkyController(this.scene);
        this.cameraCtrl = new CameraController(this.camera);
        this.player = new PlayerController(this.scene);
        this.collision = new CollisionDetector();
        this.chunks = new ChunkManager(this.scene);
        this.score = new ScoreManager();
        this.difficulty = new DifficultyManager();

        // 地面 (大平面作为补充)
        const groundGeo = new THREE.PlaneGeometry(200, 1000);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x338833 });
        this.ground = new THREE.Mesh(groundGeo, groundMat);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.position.y = -0.05;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

        // 状态
        this.state = STATE.MENU;
        this.worldOffset = 0;
        this.clock = new THREE.Clock();

        // UI 引用
        this.uiMenu = document.getElementById('menu');
        this.uiHud = document.getElementById('hud');
        this.uiGameOver = document.getElementById('gameover');
        this.uiScore = document.getElementById('score');
        this.uiDistance = document.getElementById('distance');
        this.uiFinalScore = document.getElementById('final-score');
        this.uiHighScore = document.getElementById('high-score');

        // 按钮事件
        document.getElementById('btn-start')?.addEventListener('click', () => this.startGame());
        document.getElementById('btn-restart')?.addEventListener('click', () => this.startGame());

        // 初始化世界
        this.chunks.reset();
        this.chunks.update(0, 0);

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
        this.clock.getDelta(); // 清除累积
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

        // 输入 (菜单中按空格开始)
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

        if (this.state !== STATE.PLAYING) return;

        // 难度 & 速度
        this.difficulty.update(dt);
        const speed = this.difficulty.speed;

        // 玩家输入
        this.player.handleInput(actions);
        this.player.update(dt);

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
        this.renderer.render(this.scene, this.camera);
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
