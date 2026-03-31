/**
 * ThemeManager — 环境主题渐变系统
 * 郊区黎明 → 都市黄昏 → 霓虹之夜，随难度平滑过渡
 */
import * as THREE from 'three';

// ─── 主题配置 ────────────────────────────────────

const THEME_SUBURBAN = {
    name: 'suburban_dawn',
    sky: { turbidity: 2, rayleigh: 1.5, mieCoefficient: 0.005, mieDirectionalG: 0.8, sunPhi: 55, sunTheta: 200 },
    scene: { background: 0x87CEEB, fogColor: 0xCCDDFF, fogDensity: 0.006, exposure: 1.0 },
    lighting: {
        hemiSky: 0x87CEEB, hemiGround: 0x886633, hemiIntensity: 0.6,
        ambientColor: 0x404060, ambientIntensity: 0.3,
        sunColor: 0xFFFFDD, sunIntensity: 1.2,
    },
    bloom: { strength: 0.4, radius: 0.6, threshold: 0.85 },
    clouds: { color: 0xFFFFFF, opacity: 1.0 },
    world: {
        commercialRatio: 0.4, buildingScaleMin: 0.8, buildingScaleMax: 1.2,
        buildingEmissiveIntensity: 0, propDensity: 0.3,
    },
    textures: {
        wallColors: ['#5a7a9a','#6a8aaa','#4a6a8a','#7a8aaa','#5a6aaa','#8a7a9a','#6a7a7a','#5a8a7a','#7a6a8a','#8a8a7a'],
        windowLitColors: ['#FFE4A0','#FFD080','#FFFFC0','#E0D0A0'],
        windowLitChance: 0.6,
        roadBase: '#3a3a3a', sidewalkBase: '#999999', groundBase: '#4a4a42',
    },
};

const THEME_DOWNTOWN = {
    name: 'downtown_dusk',
    sky: { turbidity: 4, rayleigh: 0.8, mieCoefficient: 0.01, mieDirectionalG: 0.9, sunPhi: 80, sunTheta: 230 },
    scene: { background: 0x664433, fogColor: 0x886655, fogDensity: 0.008, exposure: 0.9 },
    lighting: {
        hemiSky: 0xFF8844, hemiGround: 0x553322, hemiIntensity: 0.5,
        ambientColor: 0x553344, ambientIntensity: 0.4,
        sunColor: 0xFFAA66, sunIntensity: 0.9,
    },
    bloom: { strength: 0.5, radius: 0.6, threshold: 0.75 },
    clouds: { color: 0xFFAA77, opacity: 0.7 },
    world: {
        commercialRatio: 0.8, buildingScaleMin: 0.9, buildingScaleMax: 1.4,
        buildingEmissiveIntensity: 0.15, propDensity: 0.25,
    },
    textures: {
        wallColors: ['#8a6a4a','#7a5a3a','#9a7a5a','#6a5a4a','#aa8a6a','#8a7a5a','#7a6a3a','#9a6a4a','#6a4a3a','#aa7a5a'],
        windowLitColors: ['#FFE4A0','#FFD080','#FF88AA','#88CCFF'],
        windowLitChance: 0.7,
        roadBase: '#333333', sidewalkBase: '#888888', groundBase: '#3a3a38',
    },
};

const THEME_NEON = {
    name: 'neon_night',
    sky: { turbidity: 10, rayleigh: 0.2, mieCoefficient: 0.001, mieDirectionalG: 0.99, sunPhi: 95, sunTheta: 230 },
    scene: { background: 0x0a0a1a, fogColor: 0x110022, fogDensity: 0.01, exposure: 0.8 },
    lighting: {
        hemiSky: 0x111133, hemiGround: 0x220033, hemiIntensity: 0.3,
        ambientColor: 0x110022, ambientIntensity: 0.15,
        sunColor: 0x6644AA, sunIntensity: 0.3,
    },
    bloom: { strength: 0.8, radius: 0.7, threshold: 0.5 },
    clouds: { color: 0x332244, opacity: 0.3 },
    world: {
        commercialRatio: 0.95, buildingScaleMin: 1.0, buildingScaleMax: 1.6,
        buildingEmissiveIntensity: 0.4, propDensity: 0.2,
    },
    textures: {
        wallColors: ['#1a1a2e','#16213e','#0f3460','#1a1a3a','#0e0e2a','#1a0a2e','#0e1a3e','#1a0e40','#0a0a2a','#1e1a3a'],
        windowLitColors: ['#FF44AA','#44FFFF','#AA44FF','#FF4444','#44FF88'],
        windowLitChance: 0.85,
        roadBase: '#1a1a2a', sidewalkBase: '#333344', groundBase: '#1a1a22',
    },
};

const THEMES = [THEME_SUBURBAN, THEME_DOWNTOWN, THEME_NEON];
const BOUNDARIES = [0.0, 0.3, 0.6];
const TRANSITION_DURATION = 4.0;
const HYSTERESIS = 0.05;

export const THEME_CONFIGS = THEMES;

// 霓虹色板
const NEON_COLORS = [0xFF00FF, 0x00FFFF, 0xFF4488, 0x8844FF, 0x44FF88];

// ─── ThemeManager ────────────────────────────────

export class ThemeManager {
    constructor(scene, renderer, skyCtrl, lighting, postProcessing) {
        this.scene = scene;
        this.renderer = renderer;
        this.sky = skyCtrl;
        this.lighting = lighting;
        this.postProcessing = postProcessing;

        this._currentIndex = 0;
        this._targetIndex = 0;
        this._transitioning = false;
        this._elapsed = 0;

        // 快照 "from" 配置（用于过渡起点）
        this._from = this._snapshot(THEMES[0]);
        this._to = THEMES[0];

        // 插值后的当前世界配置
        this._worldConfig = { ...THEMES[0].world, textureSet: THEMES[0].name };

        // 临时变量（避免每帧分配）
        this._c1 = new THREE.Color();
        this._c2 = new THREE.Color();
        this._sunVec = new THREE.Vector3();

        // 应用初始主题
        this._applyTheme(THEMES[0], 1);
    }

    /** 每帧调用 */
    update(dt, difficulty) {
        // 确定目标主题
        let target = 0;
        for (let i = BOUNDARIES.length - 1; i >= 0; i--) {
            if (difficulty >= BOUNDARIES[i]) { target = i; break; }
        }

        // 防抖：需超过阈值才允许回退
        if (target < this._currentIndex) {
            if (difficulty > BOUNDARIES[this._currentIndex] - HYSTERESIS) {
                target = this._currentIndex;
            }
        }

        // 启动新过渡
        if (target !== this._targetIndex) {
            this._from = this._snapshot(THEMES[this._currentIndex]);
            // 如果正在过渡中，从当前插值位置开始
            if (this._transitioning) {
                this._from = this._captureCurrentState();
            }
            this._targetIndex = target;
            this._to = THEMES[target];
            this._transitioning = true;
            this._elapsed = 0;
        }

        // 过渡进度
        if (this._transitioning) {
            this._elapsed += dt;
            let t = Math.min(this._elapsed / TRANSITION_DURATION, 1);
            t = this._easeInOutCubic(t);

            this._applyInterpolated(this._from, this._to, t);
            this._interpolateWorld(this._from.world, this._to.world, t);

            if (t >= 1) {
                this._transitioning = false;
                this._currentIndex = this._targetIndex;
            }
        }
    }

    /** 获取当前世界配置（CityChunk 使用） */
    getWorldConfig() {
        return this._worldConfig;
    }

    /** 重置到初始主题 */
    reset() {
        this._currentIndex = 0;
        this._targetIndex = 0;
        this._transitioning = false;
        this._elapsed = 0;
        this._worldConfig = { ...THEMES[0].world, textureSet: THEMES[0].name };
        this._applyTheme(THEMES[0], 1);
    }

    // ─── 内部方法 ───

    _easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    _snapshot(theme) {
        return JSON.parse(JSON.stringify(theme));
    }

    _captureCurrentState() {
        // 快照当前实际渲染状态
        const u = this.sky.sky.material.uniforms;
        const s = this.scene;
        const r = this.renderer;
        const l = this.lighting;
        const bp = this.postProcessing?.bloomPass;
        return {
            sky: {
                turbidity: u.turbidity.value,
                rayleigh: u.rayleigh.value,
                mieCoefficient: u.mieCoefficient.value,
                mieDirectionalG: u.mieDirectionalG.value,
                sunPhi: this._currentSunPhi || THEMES[this._currentIndex].sky.sunPhi,
                sunTheta: this._currentSunTheta || THEMES[this._currentIndex].sky.sunTheta,
            },
            scene: {
                background: s.background.getHex(),
                fogColor: s.fog.color.getHex(),
                fogDensity: s.fog.density,
                exposure: r.toneMappingExposure,
            },
            lighting: {
                hemiSky: l.hemisphere.color.getHex(),
                hemiGround: l.hemisphere.groundColor.getHex(),
                hemiIntensity: l.hemisphere.intensity,
                ambientColor: l.ambient.color.getHex(),
                ambientIntensity: l.ambient.intensity,
                sunColor: l.sun.color.getHex(),
                sunIntensity: l.sun.intensity,
            },
            bloom: bp ? {
                strength: bp.strength, radius: bp.radius, threshold: bp.threshold,
            } : THEMES[this._currentIndex].bloom,
            clouds: {
                color: this.sky.cloudMaterial.color.getHex(),
                opacity: this.sky.cloudMaterial.opacity,
            },
            world: { ...this._worldConfig },
        };
    }

    _applyTheme(theme, t) {
        this._applyInterpolated(theme, theme, t);
    }

    _applyInterpolated(from, to, t) {
        const lerp = THREE.MathUtils.lerp;

        // Sky uniforms
        const u = this.sky.sky.material.uniforms;
        u.turbidity.value = lerp(from.sky.turbidity, to.sky.turbidity, t);
        u.rayleigh.value = lerp(from.sky.rayleigh, to.sky.rayleigh, t);
        u.mieCoefficient.value = lerp(from.sky.mieCoefficient, to.sky.mieCoefficient, t);
        u.mieDirectionalG.value = lerp(from.sky.mieDirectionalG, to.sky.mieDirectionalG, t);

        const phi = THREE.MathUtils.degToRad(90 - lerp(from.sky.sunPhi, to.sky.sunPhi, t));
        const theta = THREE.MathUtils.degToRad(lerp(from.sky.sunTheta, to.sky.sunTheta, t));
        this._currentSunPhi = lerp(from.sky.sunPhi, to.sky.sunPhi, t);
        this._currentSunTheta = lerp(from.sky.sunTheta, to.sky.sunTheta, t);
        this._sunVec.setFromSphericalCoords(1, phi, theta);
        u.sunPosition.value.copy(this._sunVec);

        // Scene
        this._c1.set(from.scene.background);
        this._c2.set(to.scene.background);
        this.scene.background.copy(this._c1.lerp(this._c2, t));

        this._c1.set(from.scene.fogColor);
        this._c2.set(to.scene.fogColor);
        this.scene.fog.color.copy(this._c1.lerp(this._c2, t));
        this.scene.fog.density = lerp(from.scene.fogDensity, to.scene.fogDensity, t);

        this.renderer.toneMappingExposure = lerp(from.scene.exposure, to.scene.exposure, t);

        // Lighting
        const l = this.lighting;
        this._c1.set(from.lighting.hemiSky); this._c2.set(to.lighting.hemiSky);
        l.hemisphere.color.copy(this._c1.lerp(this._c2, t));
        this._c1.set(from.lighting.hemiGround); this._c2.set(to.lighting.hemiGround);
        l.hemisphere.groundColor.copy(this._c1.lerp(this._c2, t));
        l.hemisphere.intensity = lerp(from.lighting.hemiIntensity, to.lighting.hemiIntensity, t);

        this._c1.set(from.lighting.ambientColor); this._c2.set(to.lighting.ambientColor);
        l.ambient.color.copy(this._c1.lerp(this._c2, t));
        l.ambient.intensity = lerp(from.lighting.ambientIntensity, to.lighting.ambientIntensity, t);

        this._c1.set(from.lighting.sunColor); this._c2.set(to.lighting.sunColor);
        l.sun.color.copy(this._c1.lerp(this._c2, t));
        l.sun.intensity = lerp(from.lighting.sunIntensity, to.lighting.sunIntensity, t);

        // Bloom
        if (this.postProcessing?.bloomPass) {
            const bp = this.postProcessing.bloomPass;
            bp.strength = lerp(from.bloom.strength, to.bloom.strength, t);
            bp.radius = lerp(from.bloom.radius, to.bloom.radius, t);
            bp.threshold = lerp(from.bloom.threshold, to.bloom.threshold, t);
        }

        // Clouds
        this._c1.set(from.clouds.color); this._c2.set(to.clouds.color);
        this.sky.cloudMaterial.color.copy(this._c1.lerp(this._c2, t));
        this.sky.cloudMaterial.opacity = lerp(from.clouds.opacity, to.clouds.opacity, t);
    }

    _interpolateWorld(fromWorld, toWorld, t) {
        const lerp = THREE.MathUtils.lerp;
        const w = this._worldConfig;
        w.commercialRatio = lerp(fromWorld.commercialRatio, toWorld.commercialRatio, t);
        w.buildingScaleMin = lerp(fromWorld.buildingScaleMin, toWorld.buildingScaleMin, t);
        w.buildingScaleMax = lerp(fromWorld.buildingScaleMax, toWorld.buildingScaleMax, t);
        w.buildingEmissiveIntensity = lerp(fromWorld.buildingEmissiveIntensity, toWorld.buildingEmissiveIntensity, t);
        w.propDensity = lerp(fromWorld.propDensity, toWorld.propDensity, t);

        // 纹理集：过渡完成一半后切换到目标
        w.textureSet = t < 0.5 ? (this._from.name || THEMES[this._currentIndex].name) : this._to.name;
    }

    /** 霓虹色板（CityChunk 使用） */
    static NEON_COLORS = NEON_COLORS;
}
