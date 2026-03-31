import * as THREE from 'three';

const MAX_LINES = 30;

const speedLineVert = `
attribute float alpha;
varying float vAlpha;
void main() {
    vAlpha = alpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const speedLineFrag = `
uniform float uIntensity;
varying float vAlpha;
void main() {
    gl_FragColor = vec4(1.0, 1.0, 1.0, vAlpha * uIntensity * 0.3);
}`;

export class SpeedLines {
    constructor(camera) {
        this.camera = camera;

        const vertexCount = MAX_LINES * 2;
        const positions = new Float32Array(vertexCount * 3);
        const alphas = new Float32Array(vertexCount);

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

        const mat = new THREE.ShaderMaterial({
            uniforms: {
                uIntensity: { value: 0 },
            },
            vertexShader: speedLineVert,
            fragmentShader: speedLineFrag,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        this.mesh = new THREE.LineSegments(geo, mat);
        this.mesh.frustumCulled = false;
        camera.add(this.mesh);

        this.geo = geo;
        this.positions = positions;
        this.alphas = alphas;
        this.mat = mat;

        // 每条线的状态
        this.lines = [];
        for (let i = 0; i < MAX_LINES; i++) {
            this.lines.push({
                active: false,
                z: 0,
                x: 0, y: 0,
                length: 0,
                speed: 0,
            });
        }
    }

    update(dt, intensity) {
        this.mat.uniforms.uIntensity.value = intensity;

        const activeCount = Math.floor(MAX_LINES * Math.min(1, intensity));

        for (let i = 0; i < MAX_LINES; i++) {
            const line = this.lines[i];
            const vi = i * 2;     // vertex index (2 per line)
            const pi = vi * 3;    // position index

            if (i >= activeCount) {
                // 超出活跃数量，隐藏
                if (line.active) {
                    line.active = false;
                    this.alphas[vi] = 0;
                    this.alphas[vi + 1] = 0;
                }
                continue;
            }

            if (!line.active) {
                // 激活：在相机前方随机位置
                line.active = true;
                line.x = (Math.random() - 0.5) * 12;
                line.y = (Math.random() - 0.5) * 8 + 1;
                line.z = -8 - Math.random() * 12;
                line.length = 2 + Math.random() * 4;
                line.speed = 20 + Math.random() * 15;
            }

            // 向相机方向移动
            line.z += line.speed * dt;
            if (line.z > 2) {
                // 重生
                line.z = -20;
                line.x = (Math.random() - 0.5) * 12;
                line.y = (Math.random() - 0.5) * 8 + 1;
                line.length = 2 + Math.random() * 4;
                line.speed = 20 + Math.random() * 15;
            }

            // 写入顶点
            this.positions[pi]     = line.x;
            this.positions[pi + 1] = line.y;
            this.positions[pi + 2] = line.z;
            this.positions[pi + 3] = line.x;
            this.positions[pi + 4] = line.y;
            this.positions[pi + 5] = line.z + line.length;

            // 距离相机越近越亮
            const d = Math.abs(line.z);
            const a = d > 15 ? 0.2 : d < 5 ? 0.3 : 1.0;
            this.alphas[vi] = a;
            this.alphas[vi + 1] = a * 0.3; // 尾端淡
        }

        this.geo.attributes.position.needsUpdate = true;
        this.geo.attributes.alpha.needsUpdate = true;
    }

    reset() {
        for (const line of this.lines) line.active = false;
        this.alphas.fill(0);
        this.geo.attributes.alpha.needsUpdate = true;
    }
}
