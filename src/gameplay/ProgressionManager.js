/**
 * ProgressionManager — 永久进度数据管理
 * 管理金币钱包、角色解锁、道具升级
 * 唯一数据权威，单一 localStorage key
 */
export class ProgressionManager {
    static STORAGE_KEY = 'cityRunnerProgress';

    static SKIN_COSTS = {
        runner: 0,
        fire: 500,
        cyber: 800,
        nature: 1200,
        royal: 2000,
    };

    static UPGRADE_COSTS = {
        shield:          [300, 500, 800],
        magnet:          [300, 500, 800],
        scoreMultiplier: [300, 500, 800],
    };

    static UPGRADE_DURATIONS = {
        shield:          [15, 18, 22, 27],
        magnet:          [8,  10, 13, 16],
        scoreMultiplier: [10, 13, 16, 20],
    };

    constructor() {
        this._data = this._load();
    }

    // ─── Coins ───

    getCoins() { return this._data.coins; }

    addCoins(amount) {
        this._data.coins += amount;
        this._save();
    }

    spendCoins(amount) {
        if (this._data.coins < amount) return false;
        this._data.coins -= amount;
        this._save();
        return true;
    }

    // ─── Skins ───

    isSkinUnlocked(id) {
        return this._data.unlockedSkins.includes(id);
    }

    getSkinCost(id) {
        return ProgressionManager.SKIN_COSTS[id] ?? 0;
    }

    getUnlockedSkins() {
        return [...this._data.unlockedSkins];
    }

    unlockSkin(id) {
        if (this.isSkinUnlocked(id)) return false;
        const cost = this.getSkinCost(id);
        if (!this.spendCoins(cost)) return false;
        this._data.unlockedSkins.push(id);
        this._save();
        return true;
    }

    // ─── Upgrades ───

    getUpgradeLevel(type) {
        return this._data.upgrades[type] || 0;
    }

    getMaxLevel(type) {
        return ProgressionManager.UPGRADE_COSTS[type]?.length ?? 0;
    }

    getUpgradeCost(type) {
        const level = this.getUpgradeLevel(type);
        const costs = ProgressionManager.UPGRADE_COSTS[type];
        if (!costs || level >= costs.length) return -1;
        return costs[level];
    }

    purchaseUpgrade(type) {
        const cost = this.getUpgradeCost(type);
        if (cost < 0) return false;
        if (!this.spendCoins(cost)) return false;
        this._data.upgrades[type] = (this._data.upgrades[type] || 0) + 1;
        this._save();
        return true;
    }

    getDuration(type) {
        const level = this.getUpgradeLevel(type);
        const durations = ProgressionManager.UPGRADE_DURATIONS[type];
        if (!durations) return 0;
        return durations[Math.min(level, durations.length - 1)];
    }

    // ─── Persistence ───

    _load() {
        const defaults = {
            coins: 0,
            unlockedSkins: ['runner'],
            upgrades: { shield: 0, magnet: 0, scoreMultiplier: 0 },
        };

        try {
            const raw = localStorage.getItem(ProgressionManager.STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                return {
                    coins: typeof parsed.coins === 'number' ? parsed.coins : 0,
                    unlockedSkins: Array.isArray(parsed.unlockedSkins) ? parsed.unlockedSkins : ['runner'],
                    upgrades: {
                        shield: parsed.upgrades?.shield || 0,
                        magnet: parsed.upgrades?.magnet || 0,
                        scoreMultiplier: parsed.upgrades?.scoreMultiplier || 0,
                    },
                };
            }
        } catch (e) {
            console.warn('ProgressionManager: failed to load, using defaults', e);
        }

        // v0.9 迁移：如果没有进度数据但有旧版角色选择，自动解锁该角色
        const oldChar = localStorage.getItem('cityRunnerChar');
        if (oldChar && oldChar !== 'runner' && ProgressionManager.SKIN_COSTS[oldChar] !== undefined) {
            defaults.unlockedSkins.push(oldChar);
        }

        this._save_raw(defaults);
        return defaults;
    }

    _save() {
        this._save_raw(this._data);
    }

    _save_raw(data) {
        try {
            localStorage.setItem(ProgressionManager.STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn('ProgressionManager: failed to save', e);
        }
    }
}
