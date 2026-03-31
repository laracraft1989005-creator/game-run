import * as THREE from 'three';

const BUILDING_WALL_COLORS = [
    '#5a7a9a', '#6a8aaa', '#4a6a8a', '#7a8aaa',
    '#5a6aaa', '#8a7a9a', '#6a7a7a', '#5a8a7a',
    '#7a6a8a', '#8a8a7a',
];

const WINDOW_LIT_COLORS = ['#FFE4A0', '#FFD080', '#FFFFC0', '#E0D0A0'];

export class TextureGenerator {
    constructor() {
        this.cache = new Map();
    }

    generateAll() {
        this.cache.set('road', this._generateRoad());
        this.cache.set('sidewalk', this._generateSidewalk());
        this.cache.set('ground', this._generateGround());
        this.cache.set('obstacle_low', this._generateObstacleLow());
        this.cache.set('obstacle_full', this._generateObstacleFull());

        for (let i = 0; i < 10; i++) {
            this.cache.set('building_' + i, this._generateBuilding(i));
        }
    }

    get(key) {
        return this.cache.get(key) || null;
    }

    dispose() {
        for (const [, tex] of this.cache) tex.dispose();
        this.cache.clear();
    }

    // ─── 道路：沥青 + 标线 ────────────────────────

    _generateRoad() {
        const W = 512, H = 1024;
        const ctx = this._ctx(W, H);

        // 沥青底色
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(0, 0, W, H);

        // 噪点颗粒
        for (let y = 0; y < H; y += 2) {
            for (let x = 0; x < W; x += 2) {
                const v = 0x33 + Math.floor(Math.random() * 0x11);
                ctx.fillStyle = `rgb(${v},${v},${v})`;
                ctx.fillRect(x, y, 2, 2);
            }
        }

        // 裂缝
        for (let i = 0; i < 10; i++) {
            ctx.beginPath();
            let cx = Math.random() * W, cy = Math.random() * H;
            ctx.moveTo(cx, cy);
            for (let s = 0; s < 4; s++) {
                cx += (Math.random() - 0.5) * 80;
                cy += Math.random() * 60;
                ctx.lineTo(cx, cy);
            }
            ctx.strokeStyle = '#2a2a2a';
            ctx.lineWidth = 1 + Math.random();
            ctx.stroke();
        }

        // 磨损斑
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.ellipse(
                Math.random() * W, Math.random() * H,
                20 + Math.random() * 40, 10 + Math.random() * 20,
                Math.random() * Math.PI, 0, Math.PI * 2
            );
            ctx.fillStyle = 'rgba(66,66,66,0.3)';
            ctx.fill();
        }

        // 边线 (对应道路宽度两侧)
        const edgeL = 42, edgeR = W - 42;
        ctx.strokeStyle = '#CCCCCC';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(edgeL, 0); ctx.lineTo(edgeL, H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(edgeR, 0); ctx.lineTo(edgeR, H); ctx.stroke();

        // 中心虚线
        ctx.setLineDash([40, 40]);
        ctx.strokeStyle = '#CCCCCC';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();

        // 车道分隔线 (±1/4 处)
        ctx.setLineDash([30, 50]);
        ctx.strokeStyle = '#888888';
        ctx.lineWidth = 2;
        const lane1 = W * 0.333, lane2 = W * 0.667;
        ctx.beginPath(); ctx.moveTo(lane1, 0); ctx.lineTo(lane1, H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(lane2, 0); ctx.lineTo(lane2, H); ctx.stroke();
        ctx.setLineDash([]);

        return this._toTexture(ctx, THREE.ClampToEdgeWrapping, THREE.RepeatWrapping);
    }

    // ─── 人行道：混凝土方砖 ──────────────────────

    _generateSidewalk() {
        const W = 256, H = 512;
        const ctx = this._ctx(W, H);

        // 底色
        ctx.fillStyle = '#999999';
        ctx.fillRect(0, 0, W, H);

        // 方砖网格
        const tile = 64;
        for (let y = 0; y < H; y += tile) {
            for (let x = 0; x < W; x += tile) {
                // 砖块色差
                const v = 0x90 + Math.floor(Math.random() * 0x18);
                ctx.fillStyle = `rgb(${v},${v},${v})`;
                ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);
            }
        }

        // 缝隙
        ctx.strokeStyle = '#777777';
        ctx.lineWidth = 2;
        for (let y = 0; y <= H; y += tile) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }
        for (let x = 0; x <= W; x += tile) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
        }

        // 裂缝
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            let cx = Math.random() * W, cy = Math.random() * H;
            ctx.moveTo(cx, cy);
            for (let s = 0; s < 3; s++) {
                cx += (Math.random() - 0.5) * 60;
                cy += Math.random() * 40;
                ctx.lineTo(cx, cy);
            }
            ctx.strokeStyle = '#777777';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // 污渍
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.arc(Math.random() * W, Math.random() * H, 5 + Math.random() * 12, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(80,80,80,0.15)';
            ctx.fill();
        }

        return this._toTexture(ctx, THREE.RepeatWrapping, THREE.RepeatWrapping);
    }

    // ─── 建筑立面：窗户网格 ─────────────────────

    _generateBuilding(index) {
        const W = 256, H = 512;
        const ctx = this._ctx(W, H);

        // 墙体色
        const wallColor = BUILDING_WALL_COLORS[index % BUILDING_WALL_COLORS.length];
        ctx.fillStyle = wallColor;
        ctx.fillRect(0, 0, W, H);

        // 窗户参数
        const cols = 4 + (index % 3);      // 4-6 列
        const rows = 8 + (index % 7);      // 8-14 行
        const winW = 20, winH = 28;
        const gapX = (W - cols * winW) / (cols + 1);
        const gapY = (H - rows * winH) / (rows + 1);

        for (let r = 0; r < rows; r++) {
            const y = gapY + r * (winH + gapY);

            // 楼层分隔线
            ctx.strokeStyle = this._darken(wallColor, 15);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, y - gapY / 2);
            ctx.lineTo(W, y - gapY / 2);
            ctx.stroke();

            for (let c = 0; c < cols; c++) {
                const x = gapX + c * (winW + gapX);

                // 窗框
                ctx.fillStyle = '#1a2a3a';
                ctx.fillRect(x, y, winW, winH);

                // 60% 亮窗
                if (Math.random() < 0.6) {
                    const litColor = WINDOW_LIT_COLORS[Math.floor(Math.random() * WINDOW_LIT_COLORS.length)];
                    ctx.globalAlpha = 0.7 + Math.random() * 0.25;
                    ctx.fillStyle = litColor;
                    ctx.fillRect(x + 2, y + 2, winW - 4, winH - 4);
                    ctx.globalAlpha = 1;
                }

                // 十字窗棂
                ctx.strokeStyle = '#2a3a4a';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x + winW / 2, y); ctx.lineTo(x + winW / 2, y + winH);
                ctx.moveTo(x, y + winH / 2); ctx.lineTo(x + winW, y + winH / 2);
                ctx.stroke();
            }
        }

        // 边缘立柱
        ctx.fillStyle = this._lighten(wallColor, 10);
        ctx.fillRect(0, 0, 4, H);
        ctx.fillRect(W - 4, 0, 4, H);

        return this._toTexture(ctx, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping);
    }

    // ─── 低障碍物：红白斜条纹 ──────────────────

    _generateObstacleLow() {
        const W = 128, H = 64;
        const ctx = this._ctx(W, H);
        const stripe = 16;

        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.rotate(-Math.PI / 4);

        const diag = Math.max(W, H) * 2;
        for (let i = -diag; i < diag; i += stripe * 2) {
            ctx.fillStyle = '#CC3333';
            ctx.fillRect(-diag / 2, i, diag, stripe);
            ctx.fillStyle = '#EEEEEE';
            ctx.fillRect(-diag / 2, i + stripe, diag, stripe);
        }
        ctx.restore();

        // 黑色边框
        ctx.strokeStyle = '#222222';
        ctx.lineWidth = 3;
        ctx.strokeRect(1, 1, W - 2, H - 2);

        return this._toTexture(ctx, THREE.RepeatWrapping, THREE.ClampToEdgeWrapping);
    }

    // ─── 高障碍物：工地围栏 ─────────────────────

    _generateObstacleFull() {
        const W = 128, H = 128;
        const ctx = this._ctx(W, H);

        // 橙色底
        ctx.fillStyle = '#DD7700';
        ctx.fillRect(0, 0, W, H);

        // 上下警示条 (黄黑斜条纹)
        const bandH = 28;
        for (const bandY of [0, H - bandH]) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, bandY, W, bandH);
            ctx.clip();
            ctx.translate(W / 2, bandY + bandH / 2);
            ctx.rotate(-Math.PI / 4);
            const diag = W * 2;
            for (let i = -diag; i < diag; i += 24) {
                ctx.fillStyle = '#FFCC00';
                ctx.fillRect(-diag / 2, i, diag, 12);
                ctx.fillStyle = '#222222';
                ctx.fillRect(-diag / 2, i + 12, diag, 12);
            }
            ctx.restore();
        }

        // 中部菱形网格
        ctx.strokeStyle = '#AA5500';
        ctx.lineWidth = 1;
        const spacing = 10;
        for (let x = 0; x < W; x += spacing) {
            ctx.beginPath(); ctx.moveTo(x, bandH); ctx.lineTo(x + (H - 2 * bandH), H - bandH); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x, H - bandH); ctx.lineTo(x + (H - 2 * bandH), bandH); ctx.stroke();
        }

        // 立柱
        ctx.fillStyle = '#995500';
        ctx.fillRect(0, 0, 5, H);
        ctx.fillRect(W - 5, 0, 5, H);

        return this._toTexture(ctx, THREE.RepeatWrapping, THREE.ClampToEdgeWrapping);
    }

    // ─── 地面：暗色地表 ─────────────────────────

    _generateGround() {
        const W = 512, H = 512;
        const ctx = this._ctx(W, H);

        // 底色
        ctx.fillStyle = '#4a4a42';
        ctx.fillRect(0, 0, W, H);

        // 土壤噪点
        for (let y = 0; y < H; y += 4) {
            for (let x = 0; x < W; x += 4) {
                const r = 0x3a + Math.floor(Math.random() * 0x1b);
                const g = 0x3a + Math.floor(Math.random() * 0x15);
                const b = 0x35 + Math.floor(Math.random() * 0x13);
                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.fillRect(x, y, 4, 4);
            }
        }

        // 碎石点
        for (let i = 0; i < 50; i++) {
            ctx.beginPath();
            ctx.arc(Math.random() * W, Math.random() * H, 2 + Math.random() * 4, 0, Math.PI * 2);
            const v = 0x55 + Math.floor(Math.random() * 0x10);
            ctx.fillStyle = `rgb(${v},${v},${v - 8})`;
            ctx.fill();
        }

        // 淡绿草斑
        for (let i = 0; i < 10; i++) {
            const cx = Math.random() * W, cy = Math.random() * H;
            for (let j = 0; j < 4; j++) {
                ctx.beginPath();
                ctx.arc(cx + (Math.random() - 0.5) * 20, cy + (Math.random() - 0.5) * 20,
                    5 + Math.random() * 10, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(80,100,60,0.12)';
                ctx.fill();
            }
        }

        const tex = this._toTexture(ctx, THREE.RepeatWrapping, THREE.RepeatWrapping);
        tex.repeat.set(10, 50);
        return tex;
    }

    // ─── 工具 ───────────────────────────────────

    _ctx(w, h) {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        return canvas.getContext('2d');
    }

    _toTexture(ctx, wrapS, wrapT) {
        const tex = new THREE.CanvasTexture(ctx.canvas);
        tex.wrapS = wrapS;
        tex.wrapT = wrapT;
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }

    _darken(hex, amount) {
        const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
        const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
        const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
        return `rgb(${r},${g},${b})`;
    }

    _lighten(hex, amount) {
        const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
        const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
        const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
        return `rgb(${r},${g},${b})`;
    }
}
