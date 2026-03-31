/**
 * ObstaclePatterns — 障碍物组合模式
 * 根据难度选择不同 pattern，返回 [{ lane, type, zOffset }]
 */

function random() {
    const lane = Math.floor(Math.random() * 3);
    const type = Math.random() < 0.5 ? 'low' : 'full';
    return [{ lane, type, zOffset: 0 }];
}

function wall() {
    // 两车道满高，留一条通道
    const open = Math.floor(Math.random() * 3);
    const lanes = [0, 1, 2].filter(l => l !== open);
    return lanes.map(lane => ({ lane, type: 'full', zOffset: 0 }));
}

function gap() {
    // 三车道矮障碍，必须跳
    return [0, 1, 2].map(lane => ({ lane, type: 'low', zOffset: 0 }));
}

function zigzag() {
    // 交替左右，需快速变道
    const startLane = Math.random() < 0.5 ? 0 : 2;
    const entries = [
        { lane: startLane, type: 'full', zOffset: 0 },
        { lane: 2 - startLane, type: 'full', zOffset: 4 },
        { lane: startLane, type: 'full', zOffset: 8 },
    ];
    return entries;
}

function corridor() {
    // 两侧满高 + 中间矮障碍，需滑铲
    return [
        { lane: 0, type: 'full', zOffset: 0 },
        { lane: 2, type: 'full', zOffset: 0 },
        { lane: 1, type: 'low', zOffset: 0 },
    ];
}

const PATTERNS = [
    { name: 'random', fn: random, minDifficulty: 0 },
    { name: 'wall', fn: wall, minDifficulty: 0.2 },
    { name: 'gap', fn: gap, minDifficulty: 0.3 },
    { name: 'zigzag', fn: zigzag, minDifficulty: 0.4 },
    { name: 'corridor', fn: corridor, minDifficulty: 0.5 },
];

export function selectPattern(difficulty) {
    const available = PATTERNS.filter(p => difficulty >= p.minDifficulty);
    // random 权重较高（尤其低难度）
    const randomWeight = Math.max(0.35, 1.0 - difficulty);
    const otherWeight = available.length > 1
        ? (1 - randomWeight) / (available.length - 1)
        : 0;

    let r = Math.random();
    for (const p of available) {
        const w = p.name === 'random' ? randomWeight : otherWeight;
        r -= w;
        if (r <= 0) return p.fn;
    }
    return random;
}

/** zigzag 等多位置 pattern 的 Z 跨度 */
export function getPatternSpan(entries) {
    if (entries.length === 0) return 0;
    let maxZ = 0;
    for (const e of entries) {
        if (Math.abs(e.zOffset) > maxZ) maxZ = Math.abs(e.zOffset);
    }
    return maxZ;
}
