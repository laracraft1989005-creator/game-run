/**
 * MissionSystem — 任务核心逻辑
 * 管理单局任务（每局随机3个）和永久成就
 * 统计追踪、完成检测、奖励发放
 */

import { SESSION_MISSIONS, ACHIEVEMENT_MISSIONS } from './MissionDefinitions.js?v=202604011500';

export class MissionSystem {
    constructor(progressionManager) {
        this.progression = progressionManager;

        // 当前单局任务（3个）
        this.activeMissions = [];
        // 单局统计
        this.sessionStats = {};

        // 上次 UI 更新时的进度快照（用于节流）
        this._lastProgress = [];
    }

    // ─── 单局生命周期 ───

    startSession() {
        this.sessionStats = {
            sessionCoins: 0,
            sessionDistance: 0,
            sessionScore: 0,
            sessionJumps: 0,
            sessionSlides: 0,
            sessionLaneSwitches: 0,
            sessionPowerUps: 0,
            sessionShieldsUsed: 0,
            sessionRides: 0,
            sessionMaxSpeed: 0,
        };

        this.activeMissions = this._pickSessionMissions(3);
        this._lastProgress = [];
    }

    endSession() {
        // 累加到终身统计
        const lifetime = this.progression.getLifetimeStats();
        lifetime.totalDistance += this.sessionStats.sessionDistance;
        lifetime.totalCoins += this.sessionStats.sessionCoins;
        lifetime.totalGames += 1;
        lifetime.totalJumps += this.sessionStats.sessionJumps;
        lifetime.totalSlides += this.sessionStats.sessionSlides;
        lifetime.totalRides += this.sessionStats.sessionRides;
        this.progression.updateLifetimeStats(lifetime);

        // 检查成就
        const completedAchievements = this._checkAchievements();

        // 计算总奖励
        let totalReward = 0;
        for (const m of this.activeMissions) {
            if (m.completed) totalReward += m.def.reward;
        }
        for (const a of completedAchievements) {
            totalReward += a.reward;
            this.progression.addCoins(a.reward);
        }

        return {
            sessionMissions: this.activeMissions,
            completedAchievements,
            totalReward,
        };
    }

    // ─── 统计记录 ───

    incrementStat(name, delta = 1) {
        if (name in this.sessionStats) {
            this.sessionStats[name] += delta;
        }
    }

    recordStat(name, value) {
        if (name in this.sessionStats) {
            this.sessionStats[name] = Math.max(this.sessionStats[name], value);
        }
    }

    // ─── 任务检查 ───

    checkSessionMissions() {
        const newlyCompleted = [];
        for (const m of this.activeMissions) {
            if (m.completed) continue;
            const current = this.sessionStats[m.def.stat] || 0;
            if (current >= m.def.value) {
                m.completed = true;
                this.progression.addCoins(m.def.reward);
                newlyCompleted.push(m);
            }
        }
        return newlyCompleted;
    }

    // ─── 查询 ───

    getActiveSessionMissions() {
        return this.activeMissions.map(m => ({
            description: m.def.description,
            current: Math.min(this.sessionStats[m.def.stat] || 0, m.def.value),
            target: m.def.value,
            reward: m.def.reward,
            completed: m.completed,
        }));
    }

    hasProgressChanged() {
        const current = this.activeMissions.map(m =>
            Math.min(this.sessionStats[m.def.stat] || 0, m.def.value)
        );
        if (this._lastProgress.length !== current.length) {
            this._lastProgress = current;
            return true;
        }
        for (let i = 0; i < current.length; i++) {
            if (current[i] !== this._lastProgress[i]) {
                this._lastProgress = current;
                return true;
            }
        }
        return false;
    }

    // ─── 内部方法 ───

    _pickSessionMissions(count) {
        // 按 category 去重，确保多样性
        const pool = [...SESSION_MISSIONS];
        const picked = [];
        const usedCategories = new Set();

        // 打乱顺序
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.random() * (i + 1) | 0;
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }

        for (const def of pool) {
            if (picked.length >= count) break;
            if (usedCategories.has(def.category)) continue;
            usedCategories.add(def.category);
            picked.push({ def, completed: false });
        }

        // 如果去重后不够（极端情况），放宽限制
        if (picked.length < count) {
            for (const def of pool) {
                if (picked.length >= count) break;
                if (picked.some(p => p.def.id === def.id)) continue;
                picked.push({ def, completed: false });
            }
        }

        return picked;
    }

    _checkAchievements() {
        const completed = this.progression.getCompletedAchievements();
        const completedSet = new Set(completed);
        const newlyCompleted = [];

        for (const def of ACHIEVEMENT_MISSIONS) {
            if (completedSet.has(def.id)) continue;

            const value = this._getLifetimeStat(def.stat);
            if (value >= def.value) {
                this.progression.addCompletedAchievement(def.id);
                newlyCompleted.push(def);
            }
        }

        return newlyCompleted;
    }

    _getLifetimeStat(stat) {
        if (stat === 'totalSkinsUnlocked') {
            return this.progression.getUnlockedSkins().length;
        }
        const lifetime = this.progression.getLifetimeStats();
        return lifetime[stat] || 0;
    }
}
