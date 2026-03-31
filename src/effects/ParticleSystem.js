import * as THREE from 'three';

const TRAIL_MAX = 80;
const DUST_MAX = 40;
const EXPLOSION_MAX = 120;
const COIN_BURST_MAX = 30;

// 共享粒子点纹理 (32×32 径向渐变)
function createDotTexture() {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
}

// 粒子着色器
const particleVert = `
attribute float alpha;
attribute float size;
varying float vAlpha;
void main() {
    vAlpha = alpha;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (200.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
}`;

const particleFrag = `
uniform sampler2D uTexture;
uniform vec3 uColor;
varying float vAlpha;
void main() {
    vec4 texColor = texture2D(uTexture, gl_PointCoord);
    gl_FragColor = vec4(uColor * texColor.rgb, texColor.a * vAlpha);
    if (gl_FragColor.a < 0.01) discard;
}`;

function createParticlePoints(maxCount, color, scene) {
    const positions = new Float32Array(maxCount * 3);
    const alphas = new Float32Array(maxCount);
    const sizes = new Float32Array(maxCount);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uTexture: { value: createDotTexture() },
            uColor: { value: new THREE.Color(color) },
        },
        vertexShader: particleVert,
        fragmentShader: particleFrag,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });

    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);

    return { points, geo, positions, alphas, sizes };
}

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;

        // 拖尾
        this._trail = createParticlePoints(TRAIL_MAX, 0x4488FF, scene);
        this._trailHead = 0;

        // 尘土
        this._dust = createParticlePoints(DUST_MAX, 0xB0A080, scene);
        this._dustVel = new Array(DUST_MAX).fill(null).map(() => ({ x: 0, y: 0, z: 0 }));
        this._dustHead = 0;

        // 爆炸
        this._explosion = createParticlePoints(EXPLOSION_MAX, 0xFF6622, scene);
        this._expVel = new Array(EXPLOSION_MAX).fill(null).map(() => ({ x: 0, y: 0, z: 0 }));
        this._expActive = false;

        // 金币拾取
        this._coinBurst = createParticlePoints(COIN_BURST_MAX, 0xFFD700, scene);
        this._coinVel = new Array(COIN_BURST_MAX).fill(null).map(() => ({ x: 0, y: 0, z: 0 }));
        this._coinActive = false;
    }

    update(dt, playerPos, state, speed) {
        this._updateTrail(dt, playerPos, state, speed);
        this._updateDust(dt);
        this._updateExplosion(dt);
        this._updateCoinBurst(dt);
    }

    triggerJumpDust(pos) {
        this._emitDust(pos, 18, 4, 2);
    }

    triggerLandDust(pos) {
        this._emitDust(pos, 14, 5, 0.8);
    }

    triggerCoinBurst(pos) {
        const { positions, alphas, sizes } = this._coinBurst;
        const count = 12;
        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            positions[i3] = pos.x;
            positions[i3 + 1] = pos.y + 0.8;
            positions[i3 + 2] = pos.z;
            const angle = Math.random() * Math.PI * 2;
            const mag = 2 + Math.random() * 3;
            this._coinVel[i].x = Math.cos(angle) * mag;
            this._coinVel[i].y = 2 + Math.random() * 4;
            this._coinVel[i].z = Math.sin(angle) * mag;
            alphas[i] = 1.0;
            sizes[i] = 0.15 + Math.random() * 0.15;
        }
        this._coinBurst.geo.attributes.position.needsUpdate = true;
        this._coinBurst.geo.attributes.alpha.needsUpdate = true;
        this._coinBurst.geo.attributes.size.needsUpdate = true;
        this._coinActive = true;
    }

    triggerExplosion(pos) {
        const { positions, alphas, sizes } = this._explosion;
        for (let i = 0; i < EXPLOSION_MAX; i++) {
            const i3 = i * 3;
            positions[i3] = pos.x;
            positions[i3 + 1] = pos.y + 1;
            positions[i3 + 2] = pos.z;

            // 球形随机方向
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const mag = 3 + Math.random() * 7;
            this._expVel[i].x = Math.sin(phi) * Math.cos(theta) * mag;
            this._expVel[i].y = Math.sin(phi) * Math.sin(theta) * mag;
            this._expVel[i].z = Math.cos(phi) * mag;

            alphas[i] = 1.0;
            sizes[i] = 0.1 + Math.random() * 0.5;
        }
        this._explosion.geo.attributes.position.needsUpdate = true;
        this._explosion.geo.attributes.alpha.needsUpdate = true;
        this._explosion.geo.attributes.size.needsUpdate = true;
        this._expActive = true;
    }

    reset() {
        // 清空所有粒子
        this._trail.alphas.fill(0);
        this._trail.geo.attributes.alpha.needsUpdate = true;
        this._dust.alphas.fill(0);
        this._dust.geo.attributes.alpha.needsUpdate = true;
        this._explosion.alphas.fill(0);
        this._explosion.geo.attributes.alpha.needsUpdate = true;
        this._expActive = false;
        this._coinBurst.alphas.fill(0);
        this._coinBurst.geo.attributes.alpha.needsUpdate = true;
        this._coinActive = false;
    }

    // ─── 拖尾 ───────────────────────────────────

    _updateTrail(dt, playerPos, state, speed) {
        const { positions, alphas, sizes, geo } = this._trail;

        // 发射新粒子
        if (state.alive && state.isGrounded && speed > 0) {
            for (let e = 0; e < 2; e++) {
                const i = this._trailHead;
                const i3 = i * 3;
                positions[i3] = playerPos.x + (Math.random() - 0.5) * 0.6;
                positions[i3 + 1] = playerPos.y + 0.05;
                positions[i3 + 2] = playerPos.z + 0.3 + Math.random() * 0.5;
                alphas[i] = 1.0;
                sizes[i] = 0.08 + Math.random() * 0.08;
                this._trailHead = (this._trailHead + 1) % TRAIL_MAX;
            }
        }

        // 更新所有拖尾粒子
        for (let i = 0; i < TRAIL_MAX; i++) {
            if (alphas[i] <= 0) continue;
            alphas[i] -= 2.0 * dt;
            positions[i * 3 + 1] += 0.5 * dt; // 上飘
            if (alphas[i] < 0) alphas[i] = 0;
        }

        geo.attributes.position.needsUpdate = true;
        geo.attributes.alpha.needsUpdate = true;
    }

    // ─── 尘土 ───────────────────────────────────

    _emitDust(pos, count, spreadXZ, upForce) {
        const { positions, alphas, sizes, geo } = this._dust;
        for (let e = 0; e < count; e++) {
            const i = this._dustHead;
            const i3 = i * 3;
            positions[i3] = pos.x;
            positions[i3 + 1] = pos.y + 0.1;
            positions[i3 + 2] = pos.z;

            this._dustVel[i].x = (Math.random() - 0.5) * spreadXZ;
            this._dustVel[i].y = upForce * (0.3 + Math.random() * 0.7);
            this._dustVel[i].z = (Math.random() - 0.5) * spreadXZ;

            alphas[i] = 0.8;
            sizes[i] = 0.15 + Math.random() * 0.2;
            this._dustHead = (this._dustHead + 1) % DUST_MAX;
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.alpha.needsUpdate = true;
        geo.attributes.size.needsUpdate = true;
    }

    _updateDust(dt) {
        const { positions, alphas, sizes, geo } = this._dust;
        let changed = false;
        for (let i = 0; i < DUST_MAX; i++) {
            if (alphas[i] <= 0) continue;
            changed = true;
            const v = this._dustVel[i];
            const i3 = i * 3;
            positions[i3] += v.x * dt;
            positions[i3 + 1] += v.y * dt;
            positions[i3 + 2] += v.z * dt;
            v.y -= 5 * dt; // 重力
            alphas[i] -= 1.5 * dt;
            sizes[i] += 0.5 * dt; // 扩散
            if (alphas[i] < 0) alphas[i] = 0;
        }
        if (changed) {
            geo.attributes.position.needsUpdate = true;
            geo.attributes.alpha.needsUpdate = true;
            geo.attributes.size.needsUpdate = true;
        }
    }

    // ─── 爆炸 ───────────────────────────────────

    _updateExplosion(dt) {
        if (!this._expActive) return;
        const { positions, alphas, sizes, geo } = this._explosion;
        let anyAlive = false;
        for (let i = 0; i < EXPLOSION_MAX; i++) {
            if (alphas[i] <= 0) continue;
            anyAlive = true;
            const v = this._expVel[i];
            const i3 = i * 3;
            positions[i3] += v.x * dt;
            positions[i3 + 1] += v.y * dt;
            positions[i3 + 2] += v.z * dt;
            v.x *= 0.97; v.z *= 0.97; // 空气阻力
            v.y -= 8 * dt; // 重力
            alphas[i] -= 0.8 * dt;
            sizes[i] *= 0.995;
            if (alphas[i] < 0) alphas[i] = 0;
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.alpha.needsUpdate = true;
        geo.attributes.size.needsUpdate = true;
        if (!anyAlive) this._expActive = false;
    }

    // ─── 金币拾取 ──────────────────────────────────

    _updateCoinBurst(dt) {
        if (!this._coinActive) return;
        const { positions, alphas, sizes, geo } = this._coinBurst;
        let anyAlive = false;
        for (let i = 0; i < COIN_BURST_MAX; i++) {
            if (alphas[i] <= 0) continue;
            anyAlive = true;
            const v = this._coinVel[i];
            const i3 = i * 3;
            positions[i3] += v.x * dt;
            positions[i3 + 1] += v.y * dt;
            positions[i3 + 2] += v.z * dt;
            v.y -= 6 * dt; // 重力
            alphas[i] -= 2.0 * dt;
            if (alphas[i] < 0) alphas[i] = 0;
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.alpha.needsUpdate = true;
        if (!anyAlive) this._coinActive = false;
    }
}
