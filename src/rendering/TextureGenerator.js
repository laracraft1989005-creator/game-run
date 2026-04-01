import * as THREE from 'three';

// 默认纹理参数（兼容不传主题配置的场景）
const DEFAULT_TEXTURES = {
    wallColors: ['#5a7a9a','#6a8aaa','#4a6a8a','#7a8aaa','#5a6aaa','#8a7a9a','#6a7a7a','#5a8a7a','#7a6a8a','#8a8a7a'],
    windowLitColors: ['#FFE4A0','#FFD080','#FFFFC0','#E0D0A0'],
    windowLitChance: 0.6,
    roadBase: '#3a3a3a',
    sidewalkBase: '#999999',
    groundBase: '#4a4a42',
};

export class TextureGenerator {
    constructor() {
        this.cache = new Map();
    }

    generateAll(themeConfigs) {
        // 障碍物纹理（不分主题）
        this.cache.set('obstacle_low', this._generateObstacleLow());
        this.cache.set('obstacle_full', this._generateObstacleFull());

        if (themeConfigs && themeConfigs.length > 0) {
            // 为每个主题生成一套纹理
            for (const theme of themeConfigs) {
                this._generateSet(theme.name, theme.textures);
            }
            // 兼容：默认 key 指向第一个主题
            this._aliasSet(themeConfigs[0].name);
        } else {
            // 无主题配置时，用默认参数
            this._generateSet('default', DEFAULT_TEXTURES);
            this._aliasSet('default');
        }
    }

    _generateSet(setName, tex) {
        this.cache.set(setName + '/road', this._generateRoad(tex.roadBase));
        this.cache.set(setName + '/sidewalk', this._generateSidewalk(tex.sidewalkBase));
        this.cache.set(setName + '/ground', this._generateGround(tex.groundBase));
        for (let i = 0; i < 10; i++) {
            this.cache.set(setName + '/building_' + i,
                this._generateBuilding(i, tex.wallColors, tex.windowLitColors, tex.windowLitChance));
        }
    }

    /** 创建无前缀别名，兼容旧代码 */
    _aliasSet(setName) {
        for (const suffix of ['road', 'sidewalk', 'ground']) {
            const themed = this.cache.get(setName + '/' + suffix);
            if (themed) this.cache.set(suffix, themed);
        }
        for (let i = 0; i < 10; i++) {
            const themed = this.cache.get(setName + '/building_' + i);
            if (themed) this.cache.set('building_' + i, themed);
        }
    }

    get(key) {
        return this.cache.get(key) || null;
    }

    // ─── 角色皮肤系统 ─────────────────────────────

    /** 角色配色方案 */
    static CHARACTER_SKINS = [
        { id: 'runner',  name: '跑者',  skin: '#E8B88A', body: '#2244AA', stripe: '#44FFAA', pants: '#333344', emissive: 0x111122 },
        { id: 'fire',    name: '烈焰',  skin: '#D4A574', body: '#CC2222', stripe: '#FFAA22', pants: '#442222', emissive: 0x331111 },
        { id: 'cyber',   name: '赛博',  skin: '#C8D8E8', body: '#1a1a2e', stripe: '#00FFFF', pants: '#0a0a1e', emissive: 0x002233 },
        { id: 'nature',  name: '森林',  skin: '#E8C89A', body: '#226633', stripe: '#88FF44', pants: '#223322', emissive: 0x112211 },
        { id: 'royal',   name: '皇家',  skin: '#F0C8A0', body: '#6622AA', stripe: '#FFD700', pants: '#332244', emissive: 0x221133 },
        { id: 'girl',    name: '女孩',  skin: '#F5D5C0', body: '#FF69B4', stripe: '#FFB6C1', pants: '#4A0028', emissive: 0x331122, hair: '#8B4513' },
    ];

    /** 给角色模型上色（按角色 ID） */
    applyCharacterSkin(meshRoot, characterId = 'runner') {
        const skinDef = TextureGenerator.CHARACTER_SKINS.find(s => s.id === characterId)
            || TextureGenerator.CHARACTER_SKINS[0];

        const skinKey = 'char_skin_' + skinDef.id;
        const outfitKey = 'char_outfit_' + skinDef.id;

        if (!this.cache.has(skinKey)) {
            this.cache.set(skinKey, this._generateCharSkin(skinDef.skin));
            this.cache.set(outfitKey, this._generateCharOutfit(skinDef.body, skinDef.stripe, skinDef.pants, skinDef.hair));
        }
        const skinTex = this.cache.get(skinKey);
        const outfitTex = this.cache.get(outfitKey);

        meshRoot.traverse(child => {
            if (!child.isMesh) return;
            const isLikelySkin = child.name.toLowerCase().includes('head')
                || child.name.toLowerCase().includes('hand')
                || child.name.toLowerCase().includes('skin');
            if (isLikelySkin) {
                child.material = new THREE.MeshStandardMaterial({
                    map: skinTex, roughness: 0.8, metalness: 0.0
                });
            } else {
                child.material = new THREE.MeshStandardMaterial({
                    map: outfitTex, roughness: 0.6, metalness: 0.05,
                    emissive: skinDef.emissive, emissiveIntensity: 0.1
                });
            }
        });
    }

    dispose() {
        for (const [, tex] of this.cache) tex.dispose();
        this.cache.clear();
    }

    // ─── 道路：沥青 + 标线 ────────────────────────

    _generateRoad(baseColor = '#3a3a3a') {
        const W = 512, H = 1024;
        const ctx = this._ctx(W, H);

        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, W, H);

        // 解析基础亮度做噪点
        const bv = parseInt(baseColor.slice(1, 3), 16);
        for (let y = 0; y < H; y += 2) {
            for (let x = 0; x < W; x += 2) {
                const v = bv - 7 + Math.floor(Math.random() * 14);
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
            ctx.strokeStyle = this._darken(baseColor, 16);
            ctx.lineWidth = 1 + Math.random();
            ctx.stroke();
        }

        // 磨损斑
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.ellipse(Math.random() * W, Math.random() * H,
                20 + Math.random() * 40, 10 + Math.random() * 20,
                Math.random() * Math.PI, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(66,66,66,0.3)';
            ctx.fill();
        }

        // 标线颜色（暗色路面用亮标线）
        const markColor = bv < 0x30 ? '#666666' : '#CCCCCC';
        const laneColor = bv < 0x30 ? '#444444' : '#888888';

        const edgeL = 42, edgeR = W - 42;
        ctx.strokeStyle = markColor;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(edgeL, 0); ctx.lineTo(edgeL, H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(edgeR, 0); ctx.lineTo(edgeR, H); ctx.stroke();

        ctx.setLineDash([40, 40]);
        ctx.strokeStyle = markColor;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();

        ctx.setLineDash([30, 50]);
        ctx.strokeStyle = laneColor;
        ctx.lineWidth = 2;
        const lane1 = W * 0.333, lane2 = W * 0.667;
        ctx.beginPath(); ctx.moveTo(lane1, 0); ctx.lineTo(lane1, H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(lane2, 0); ctx.lineTo(lane2, H); ctx.stroke();
        ctx.setLineDash([]);

        return this._toTexture(ctx, THREE.ClampToEdgeWrapping, THREE.RepeatWrapping);
    }

    // ─── 人行道：混凝土方砖 ──────────────────────

    _generateSidewalk(baseColor = '#999999') {
        const W = 256, H = 512;
        const ctx = this._ctx(W, H);
        const bv = parseInt(baseColor.slice(1, 3), 16);

        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, W, H);

        const tile = 64;
        for (let y = 0; y < H; y += tile) {
            for (let x = 0; x < W; x += tile) {
                const v = bv - 10 + Math.floor(Math.random() * 20);
                ctx.fillStyle = `rgb(${v},${v},${v})`;
                ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);
            }
        }

        ctx.strokeStyle = this._darken(baseColor, 30);
        ctx.lineWidth = 2;
        for (let y = 0; y <= H; y += tile) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }
        for (let x = 0; x <= W; x += tile) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
        }

        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            let cx = Math.random() * W, cy = Math.random() * H;
            ctx.moveTo(cx, cy);
            for (let s = 0; s < 3; s++) {
                cx += (Math.random() - 0.5) * 60;
                cy += Math.random() * 40;
                ctx.lineTo(cx, cy);
            }
            ctx.strokeStyle = this._darken(baseColor, 30);
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.arc(Math.random() * W, Math.random() * H, 5 + Math.random() * 12, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(80,80,80,0.15)';
            ctx.fill();
        }

        return this._toTexture(ctx, THREE.RepeatWrapping, THREE.RepeatWrapping);
    }

    // ─── 建筑立面：窗户网格 ─────────────────────

    _generateBuilding(index, wallColors, windowLitColors, windowLitChance) {
        wallColors = wallColors || DEFAULT_TEXTURES.wallColors;
        windowLitColors = windowLitColors || DEFAULT_TEXTURES.windowLitColors;
        windowLitChance = windowLitChance ?? DEFAULT_TEXTURES.windowLitChance;

        const W = 256, H = 512;
        const ctx = this._ctx(W, H);

        const wallColor = wallColors[index % wallColors.length];
        ctx.fillStyle = wallColor;
        ctx.fillRect(0, 0, W, H);

        const cols = 4 + (index % 3);
        const rows = 8 + (index % 7);
        const winW = 20, winH = 28;
        const gapX = (W - cols * winW) / (cols + 1);
        const gapY = (H - rows * winH) / (rows + 1);

        for (let r = 0; r < rows; r++) {
            const y = gapY + r * (winH + gapY);

            ctx.strokeStyle = this._darken(wallColor, 15);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, y - gapY / 2);
            ctx.lineTo(W, y - gapY / 2);
            ctx.stroke();

            for (let c = 0; c < cols; c++) {
                const x = gapX + c * (winW + gapX);

                ctx.fillStyle = '#1a2a3a';
                ctx.fillRect(x, y, winW, winH);

                if (Math.random() < windowLitChance) {
                    const litColor = windowLitColors[Math.floor(Math.random() * windowLitColors.length)];
                    ctx.globalAlpha = 0.7 + Math.random() * 0.25;
                    ctx.fillStyle = litColor;
                    ctx.fillRect(x + 2, y + 2, winW - 4, winH - 4);
                    ctx.globalAlpha = 1;
                }

                ctx.strokeStyle = '#2a3a4a';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x + winW / 2, y); ctx.lineTo(x + winW / 2, y + winH);
                ctx.moveTo(x, y + winH / 2); ctx.lineTo(x + winW, y + winH / 2);
                ctx.stroke();
            }
        }

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

        ctx.strokeStyle = '#222222';
        ctx.lineWidth = 3;
        ctx.strokeRect(1, 1, W - 2, H - 2);

        return this._toTexture(ctx, THREE.RepeatWrapping, THREE.ClampToEdgeWrapping);
    }

    // ─── 高障碍物：工地围栏 ─────────────────────

    _generateObstacleFull() {
        const W = 128, H = 128;
        const ctx = this._ctx(W, H);

        ctx.fillStyle = '#DD7700';
        ctx.fillRect(0, 0, W, H);

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

        ctx.strokeStyle = '#AA5500';
        ctx.lineWidth = 1;
        const spacing = 10;
        for (let x = 0; x < W; x += spacing) {
            ctx.beginPath(); ctx.moveTo(x, bandH); ctx.lineTo(x + (H - 2 * bandH), H - bandH); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x, H - bandH); ctx.lineTo(x + (H - 2 * bandH), bandH); ctx.stroke();
        }

        ctx.fillStyle = '#995500';
        ctx.fillRect(0, 0, 5, H);
        ctx.fillRect(W - 5, 0, 5, H);

        return this._toTexture(ctx, THREE.RepeatWrapping, THREE.ClampToEdgeWrapping);
    }

    // ─── 地面：暗色地表 ─────────────────────────

    _generateGround(baseColor = '#4a4a42') {
        const W = 512, H = 512;
        const ctx = this._ctx(W, H);

        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, W, H);

        const bv = parseInt(baseColor.slice(1, 3), 16);
        for (let y = 0; y < H; y += 4) {
            for (let x = 0; x < W; x += 4) {
                const r = bv - 12 + Math.floor(Math.random() * 24);
                const g = bv - 12 + Math.floor(Math.random() * 20);
                const b = bv - 16 + Math.floor(Math.random() * 18);
                ctx.fillStyle = `rgb(${Math.max(0,r)},${Math.max(0,g)},${Math.max(0,b)})`;
                ctx.fillRect(x, y, 4, 4);
            }
        }

        for (let i = 0; i < 50; i++) {
            ctx.beginPath();
            ctx.arc(Math.random() * W, Math.random() * H, 2 + Math.random() * 4, 0, Math.PI * 2);
            const v = bv + 10 + Math.floor(Math.random() * 16);
            ctx.fillStyle = `rgb(${v},${v},${v - 8})`;
            ctx.fill();
        }

        // 草斑（仅亮色地面时可见）
        if (bv > 0x30) {
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
        }

        const tex = this._toTexture(ctx, THREE.RepeatWrapping, THREE.RepeatWrapping);
        tex.repeat.set(10, 50);
        return tex;
    }

    // ─── 角色皮肤 ────────────────────────────────

    _generateCharSkin(baseHex = '#E8B88A') {
        const W = 128, H = 128;
        const ctx = this._ctx(W, H);
        ctx.fillStyle = baseHex;
        ctx.fillRect(0, 0, W, H);
        const br = parseInt(baseHex.slice(1, 3), 16);
        const bg = parseInt(baseHex.slice(3, 5), 16);
        const bb = parseInt(baseHex.slice(5, 7), 16);
        for (let y = 0; y < H; y += 4) {
            for (let x = 0; x < W; x += 4) {
                const r = Math.min(255, br - 8 + Math.floor(Math.random() * 16));
                const g = Math.min(255, bg - 8 + Math.floor(Math.random() * 16));
                const b = Math.min(255, bb - 8 + Math.floor(Math.random() * 16));
                ctx.fillStyle = `rgba(${r},${g},${b},0.3)`;
                ctx.fillRect(x, y, 4, 4);
            }
        }
        return this._toTexture(ctx, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping);
    }

    _generateCharOutfit(bodyHex = '#2244AA', stripeHex = '#44FFAA', pantsHex = '#333344', hairHex = null) {
        const W = 256, H = 256;
        const ctx = this._ctx(W, H);
        ctx.fillStyle = bodyHex;
        ctx.fillRect(0, 0, W, H);
        const bodyR = parseInt(bodyHex.slice(1, 3), 16);
        const bodyG = parseInt(bodyHex.slice(3, 5), 16);
        const bodyB = parseInt(bodyHex.slice(5, 7), 16);
        for (let y = 0; y < H; y += 2) {
            for (let x = 0; x < W; x += 2) {
                const v = Math.random() * 20 - 10;
                ctx.fillStyle = `rgba(${Math.max(0, bodyR + v)},${Math.max(0, bodyG + v)},${Math.max(0, bodyB + v)},0.4)`;
                ctx.fillRect(x, y, 2, 2);
            }
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, H * 0.35, W, 4);
        ctx.fillRect(0, H * 0.38, W, 2);
        ctx.fillStyle = stripeHex;
        ctx.fillRect(0, 0, 6, H);
        ctx.fillRect(W - 6, 0, 6, H);
        const pantsY = H * 0.55;
        ctx.fillStyle = pantsHex;
        ctx.fillRect(0, pantsY, W, H - pantsY);
        const pR = parseInt(pantsHex.slice(1, 3), 16);
        const pG = parseInt(pantsHex.slice(3, 5), 16);
        const pB = parseInt(pantsHex.slice(5, 7), 16);
        for (let y = pantsY; y < H; y += 2) {
            for (let x = 0; x < W; x += 2) {
                const v = Math.random() * 10 - 5;
                ctx.fillStyle = `rgba(${Math.max(0, pR + v)},${Math.max(0, pG + v)},${Math.max(0, pB + v)},0.3)`;
                ctx.fillRect(x, y, 2, 2);
            }
        }
        // 头发色带（girl 皮肤使用）
        if (hairHex) {
            const hairH = Math.floor(H * 0.08);
            ctx.fillStyle = hairHex;
            ctx.fillRect(0, 0, W, hairH);
            const hR = parseInt(hairHex.slice(1, 3), 16);
            const hG = parseInt(hairHex.slice(3, 5), 16);
            const hB = parseInt(hairHex.slice(5, 7), 16);
            for (let y = 0; y < hairH; y += 2) {
                for (let x = 0; x < W; x += 2) {
                    const v = Math.random() * 15 - 7;
                    ctx.fillStyle = `rgba(${Math.max(0, hR + v)},${Math.max(0, hG + v)},${Math.max(0, hB + v)},0.3)`;
                    ctx.fillRect(x, y, 2, 2);
                }
            }
        }

        return this._toTexture(ctx, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping);
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
