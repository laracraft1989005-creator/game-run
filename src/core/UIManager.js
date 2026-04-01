/**
 * UIManager — 集中管理所有 DOM 操作、过渡动画、分数动画
 */

import { ProgressionManager } from '../gameplay/ProgressionManager.js?v=202604011500';
import { TextureGenerator } from '../rendering/TextureGenerator.js?v=202604011500';
import { ACHIEVEMENT_MISSIONS } from '../gameplay/MissionDefinitions.js?v=202604011500';

export class UIManager {
    constructor() {
        // DOM 引用
        this.elMenu = document.getElementById('menu');
        this.elHud = document.getElementById('hud');
        this.elGameOver = document.getElementById('gameover');
        this.elLoading = document.getElementById('loading');
        this.elCountdown = document.getElementById('countdown');
        this.elCountdownNum = document.querySelector('#countdown .countdown-number');
        this.elShop = document.getElementById('shop');

        this.elScore = document.getElementById('score');
        this.elDistance = document.getElementById('distance');
        this.elFinalScore = document.getElementById('final-score');
        this.elHighScore = document.getElementById('high-score');
        this.elNewRecord = document.getElementById('new-record');
        this.elStatDistance = document.getElementById('stat-distance');
        this.elStatTime = document.getElementById('stat-time');
        this.elStatSpeed = document.getElementById('stat-speed');
        this.elMilestonePopup = document.getElementById('milestone-popup');
        this.elMuteBtn = document.getElementById('btn-mute');
        this.elCoinCount = document.getElementById('coin-count');
        this.elStatCoins = document.getElementById('stat-coins');
        this.elMultiplierBadge = document.getElementById('multiplier-badge');
        this.elPowerUpIndicator = document.getElementById('powerup-indicator');
        this.elPowerUpLabel = document.querySelector('.powerup-label');
        this.elPowerUpFill = document.querySelector('.powerup-timer-fill');
        this.elCoinPopup = document.getElementById('coin-popup');

        // 任务系统 DOM
        this.elMissions = document.getElementById('missions');
        this.elMissionTracker = document.getElementById('mission-tracker');
        this.elMissionToast = document.getElementById('mission-toast');
        this.elMissionSummary = document.getElementById('mission-summary');
        this.elMissionsSession = document.getElementById('missions-session');
        this.elMissionsAchievements = document.getElementById('missions-achievements');

        // 商店 & 钱包 DOM
        this.elShopCoins = document.getElementById('shop-coins');
        this.elMenuCoins = document.getElementById('menu-coins');
        this.elShopSkins = document.getElementById('shop-skins');
        this.elShopUpgrades = document.getElementById('shop-upgrades');
        this.elEarnedCoins = document.getElementById('earned-coins');
        this.elTotalCoins = document.getElementById('total-coins');

        // 分数动画状态
        this._displayScore = 0;
        this._actualScore = 0;

        // 里程碑动画
        this._milestoneTimer = 0;

        // 金币弹窗计时
        this._coinPopupTimer = 0;

        // 道具计时条
        this._powerUpDuration = 0;
        this._powerUpRemaining = 0;

        // 任务 toast 计时
        this._missionToastTimer = 0;
    }

    /* ─── 界面切换 ─── */

    showLoading() {
        this._show(this.elLoading);
        this._hide(this.elMenu);
        this._hide(this.elHud);
        this._hide(this.elGameOver);
        this._hide(this.elCountdown);
    }

    showMenu() {
        this._hide(this.elLoading);
        this._show(this.elMenu);
        this._hide(this.elHud);
        this._hide(this.elGameOver);
        this._hide(this.elCountdown);
        this._hide(this.elShop);
        this._hide(this.elMissions);
    }

    showShop() {
        this._hide(this.elMenu);
        this._show(this.elShop);
        this._hide(this.elHud);
        this._hide(this.elGameOver);
        this._hide(this.elCountdown);
        this._hide(this.elMissions);
    }

    showMissions() {
        this._hide(this.elMenu);
        this._show(this.elMissions);
        this._hide(this.elHud);
        this._hide(this.elGameOver);
        this._hide(this.elCountdown);
        this._hide(this.elShop);
    }

    showCountdown(onComplete) {
        this._hide(this.elMenu);
        this._hide(this.elGameOver);
        this._hide(this.elHud);
        this._hide(this.elShop);
        this._hide(this.elMissions);
        this._show(this.elCountdown);

        const steps = ['3', '2', '1', 'GO!'];
        let i = 0;

        const tick = () => {
            if (i >= steps.length) {
                this._hide(this.elCountdown);
                this._show(this.elHud);
                onComplete();
                return;
            }
            this.elCountdownNum.textContent = steps[i];
            // 重新触发动画
            this.elCountdownNum.classList.remove('animate');
            void this.elCountdownNum.offsetWidth; // force reflow
            this.elCountdownNum.classList.add('animate');
            i++;
            setTimeout(tick, i <= 3 ? 600 : 500);
        };
        tick();
    }

    showPlaying() {
        this._hide(this.elMenu);
        this._hide(this.elGameOver);
        this._hide(this.elCountdown);
        this._hide(this.elMissions);
        this._show(this.elHud);
        this._displayScore = 0;
        this._actualScore = 0;
        this.updateCoinCount(0);
        this.hidePowerUp();
        this.showMultiplier(false);
        this._show(this.elMissionTracker);
    }

    showGameOver(stats) {
        this._hide(this.elHud);
        this._show(this.elGameOver);
        this.hidePowerUp();

        // 填充结算数据
        this.elFinalScore.textContent = stats.score;
        this.elHighScore.textContent = stats.highScore;
        if (this.elStatDistance) this.elStatDistance.textContent = Math.floor(stats.distance) + 'm';
        if (this.elStatCoins) this.elStatCoins.textContent = stats.coins || 0;
        if (this.elStatTime) this.elStatTime.textContent = stats.time.toFixed(1) + 's';
        if (this.elStatSpeed) this.elStatSpeed.textContent = stats.maxSpeed.toFixed(1);

        // 新纪录
        if (this.elNewRecord) {
            if (stats.isNewRecord) {
                this.elNewRecord.classList.remove('hidden');
            } else {
                this.elNewRecord.classList.add('hidden');
            }
        }

        // 触发面板入场动画
        const panel = this.elGameOver.querySelector('.gameover-panel');
        if (panel) {
            panel.classList.remove('animate-in');
            void panel.offsetWidth;
            panel.classList.add('animate-in');
        }
    }

    /* ─── HUD 更新 ─── */

    updateScore(score) {
        this._actualScore = score;
    }

    updateDistance(distance) {
        if (this.elDistance) {
            this.elDistance.textContent = Math.floor(distance) + 'm';
        }
    }

    update(dt) {
        // 分数滚动动画
        if (this._displayScore < this._actualScore) {
            const diff = this._actualScore - this._displayScore;
            const step = Math.max(1, Math.ceil(diff * dt * 8));
            this._displayScore = Math.min(this._actualScore, this._displayScore + step);
            if (this.elScore) this.elScore.textContent = this._displayScore;
        }

        // 里程碑消失计时
        if (this._milestoneTimer > 0) {
            this._milestoneTimer -= dt;
            if (this._milestoneTimer <= 0 && this.elMilestonePopup) {
                this.elMilestonePopup.classList.add('hidden');
            }
        }

        // 金币弹窗消失
        if (this._coinPopupTimer > 0) {
            this._coinPopupTimer -= dt;
            if (this._coinPopupTimer <= 0 && this.elCoinPopup) {
                this.elCoinPopup.classList.add('hidden');
            }
        }

        // 任务完成 toast
        if (this._missionToastTimer > 0) {
            this._missionToastTimer -= dt;
            if (this._missionToastTimer <= 0 && this.elMissionToast) {
                this.elMissionToast.classList.add('hidden');
            }
        }

        // 道具计时条
        if (this._powerUpRemaining > 0) {
            this._powerUpRemaining -= dt;
            if (this.elPowerUpFill && this._powerUpDuration > 0) {
                const ratio = Math.max(0, this._powerUpRemaining / this._powerUpDuration);
                this.elPowerUpFill.style.transform = `scaleX(${ratio})`;
            }
        }
    }

    /* ─── 金币 & 道具 HUD ─── */

    updateCoinCount(count) {
        if (this.elCoinCount) this.elCoinCount.textContent = count;
    }

    flashCoinPopup(amount) {
        if (!this.elCoinPopup) return;
        this.elCoinPopup.textContent = '+' + amount;
        this.elCoinPopup.classList.remove('hidden', 'animate');
        void this.elCoinPopup.offsetWidth;
        this.elCoinPopup.classList.add('animate');
        this._coinPopupTimer = 0.6;
    }

    showPowerUp(type, duration, label) {
        if (!this.elPowerUpIndicator) return;
        if (this.elPowerUpLabel) this.elPowerUpLabel.textContent = label || type;
        this._powerUpDuration = duration;
        this._powerUpRemaining = duration;
        if (this.elPowerUpFill) {
            this.elPowerUpFill.style.transform = 'scaleX(1)';
            this.elPowerUpFill.style.transition = 'none';
        }
        this._show(this.elPowerUpIndicator);
    }

    hidePowerUp() {
        this._hide(this.elPowerUpIndicator);
        this._powerUpRemaining = 0;
    }

    showMultiplier(active) {
        if (this.elMultiplierBadge) {
            this.elMultiplierBadge.classList.toggle('hidden', !active);
        }
        if (this.elScore) {
            this.elScore.classList.toggle('score-multiplied', active);
        }
    }

    /* ─── 里程碑弹窗 ─── */

    flashMilestoneText(text) {
        if (!this.elMilestonePopup) return;
        this.elMilestonePopup.textContent = text;
        this.elMilestonePopup.classList.remove('hidden');
        this.elMilestonePopup.classList.remove('animate');
        void this.elMilestonePopup.offsetWidth;
        this.elMilestonePopup.classList.add('animate');
        this._milestoneTimer = 1.2;
    }

    flashMilestone(score) {
        if (!this.elMilestonePopup) return;

        let text = 'NICE!';
        if (score >= 5000) text = 'INCREDIBLE!';
        else if (score >= 2500) text = 'AMAZING!';
        else if (score >= 1000) text = 'GREAT!';
        else if (score >= 500) text = 'COOL!';

        this.elMilestonePopup.textContent = text;
        this.elMilestonePopup.classList.remove('hidden');
        this.elMilestonePopup.classList.remove('animate');
        void this.elMilestonePopup.offsetWidth;
        this.elMilestonePopup.classList.add('animate');

        this._milestoneTimer = 1.2;

        // 分数闪光
        if (this.elScore) {
            this.elScore.classList.remove('score-flash');
            void this.elScore.offsetWidth;
            this.elScore.classList.add('score-flash');
        }
    }

    flashSpeedUp() {
        // 分数区域短暂变色提示
        if (this.elScore) {
            this.elScore.classList.remove('speed-flash');
            void this.elScore.offsetWidth;
            this.elScore.classList.add('speed-flash');
        }
    }

    /* ─── 静音按钮 ─── */

    setupMuteButton(muted, onToggle) {
        if (!this.elMuteBtn) return;
        this._updateMuteIcon(muted);
        this.elMuteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const newMuted = onToggle();
            this._updateMuteIcon(newMuted);
        });
    }

    _updateMuteIcon(muted) {
        if (this.elMuteBtn) {
            this.elMuteBtn.textContent = muted ? '🔇' : '🔊';
        }
    }

    /* ─── 商店 ─── */

    updateShopCoins(coins) {
        if (this.elShopCoins) this.elShopCoins.textContent = coins;
        if (this.elMenuCoins) this.elMenuCoins.textContent = coins;
    }

    updateGameOverCoins(earned, total) {
        if (this.elEarnedCoins) this.elEarnedCoins.textContent = earned;
        if (this.elTotalCoins) this.elTotalCoins.textContent = total;
    }

    renderShopSkins(progression, selectedCharId, callbacks) {
        if (!this.elShopSkins) return;
        this.elShopSkins.innerHTML = '';

        const skins = TextureGenerator.CHARACTER_SKINS;
        const SKIN_COLORS = {
            runner: '#2244AA', fire: '#CC2222', cyber: '#00FFFF',
            nature: '#226633', royal: '#6622AA', girl: '#FF69B4',
        };

        for (const skin of skins) {
            const unlocked = progression.isSkinUnlocked(skin.id);
            const cost = progression.getSkinCost(skin.id);
            const isSelected = skin.id === selectedCharId;
            const canAfford = progression.getCoins() >= cost;

            const item = document.createElement('div');
            item.className = 'shop-item' + (isSelected ? ' selected' : '') + (!unlocked ? ' locked' : '');

            // 角色名
            const nameDiv = document.createElement('div');
            nameDiv.className = 'shop-item-name';
            const dot = document.createElement('span');
            dot.className = 'shop-item-dot';
            dot.style.background = SKIN_COLORS[skin.id] || skin.body;
            nameDiv.appendChild(dot);
            nameDiv.appendChild(document.createTextNode(skin.name));
            item.appendChild(nameDiv);

            // 价格行
            if (!unlocked && cost > 0) {
                const costDiv = document.createElement('div');
                costDiv.className = 'shop-item-cost';
                costDiv.textContent = '● ' + cost;
                item.appendChild(costDiv);
            }

            // 按钮
            const btn = document.createElement('button');
            btn.className = 'shop-item-btn';

            if (isSelected) {
                btn.textContent = '已装备';
                btn.classList.add('equipped');
            } else if (unlocked) {
                btn.textContent = '选择';
                btn.addEventListener('click', () => callbacks.onSelect(skin.id));
            } else if (canAfford) {
                btn.textContent = '购买';
                btn.addEventListener('click', () => callbacks.onBuy(skin.id));
            } else {
                btn.textContent = '金币不足';
                btn.classList.add('disabled');
            }

            item.appendChild(btn);
            this.elShopSkins.appendChild(item);
        }
    }

    renderShopUpgrades(progression, callbacks) {
        if (!this.elShopUpgrades) return;
        this.elShopUpgrades.innerHTML = '';

        const UPGRADE_INFO = {
            shield:          { label: '护盾', color: '#4488FF' },
            magnet:          { label: '磁铁', color: '#AA44FF' },
            scoreMultiplier: { label: '分数x2', color: '#44FF88' },
        };

        for (const type of ['shield', 'magnet', 'scoreMultiplier']) {
            const info = UPGRADE_INFO[type];
            const level = progression.getUpgradeLevel(type);
            const maxLevel = progression.getMaxLevel(type);
            const cost = progression.getUpgradeCost(type);
            const isMaxed = level >= maxLevel;
            const canAfford = !isMaxed && progression.getCoins() >= cost;

            const item = document.createElement('div');
            item.className = 'shop-item';

            // 名称
            const nameDiv = document.createElement('div');
            nameDiv.className = 'shop-item-name';
            const dot = document.createElement('span');
            dot.className = 'shop-item-dot';
            dot.style.background = info.color;
            nameDiv.appendChild(dot);
            nameDiv.appendChild(document.createTextNode(info.label));
            item.appendChild(nameDiv);

            // 等级圆点
            const pips = document.createElement('div');
            pips.className = 'upgrade-pips';
            for (let i = 0; i < maxLevel; i++) {
                const pip = document.createElement('span');
                pip.className = 'upgrade-pip' + (i < level ? ' filled' : '');
                pips.appendChild(pip);
            }
            item.appendChild(pips);

            // 时长提示
            const duration = progression.getDuration(type);
            const costDiv = document.createElement('div');
            costDiv.className = 'shop-item-cost';
            costDiv.textContent = duration + 's';
            if (!isMaxed) {
                const nextDuration = ProgressionManager.UPGRADE_DURATIONS[type][level + 1];
                costDiv.textContent += ' → ' + nextDuration + 's · ● ' + cost;
            }
            item.appendChild(costDiv);

            // 按钮
            const btn = document.createElement('button');
            btn.className = 'shop-item-btn';
            if (isMaxed) {
                btn.textContent = 'MAX';
                btn.classList.add('maxed');
            } else if (canAfford) {
                btn.textContent = '升级';
                btn.addEventListener('click', () => callbacks.onUpgrade(type));
            } else {
                btn.textContent = '金币不足';
                btn.classList.add('disabled');
            }

            item.appendChild(btn);
            this.elShopUpgrades.appendChild(item);
        }
    }

    /* ─── 任务系统 ─── */

    renderMissionTracker(missions) {
        if (!this.elMissionTracker) return;
        this.elMissionTracker.innerHTML = '';
        for (const m of missions) {
            const row = document.createElement('div');
            row.className = 'mission-row' + (m.completed ? ' completed' : '');

            const desc = document.createElement('span');
            desc.className = 'mission-desc';
            desc.textContent = m.description;

            const prog = document.createElement('span');
            prog.className = 'mission-progress';
            prog.textContent = m.completed ? '\u2713' : `${m.current}/${m.target}`;

            row.appendChild(desc);
            row.appendChild(prog);
            this.elMissionTracker.appendChild(row);
        }
    }

    flashMissionComplete(description, reward) {
        if (!this.elMissionToast) return;
        this.elMissionToast.innerHTML =
            '<div class="mission-toast-title">MISSION COMPLETE!</div>' +
            '<div class="mission-toast-reward">' + description + ' +' + reward + '</div>';
        this.elMissionToast.classList.remove('hidden', 'animate');
        void this.elMissionToast.offsetWidth;
        this.elMissionToast.classList.add('animate');
        this._missionToastTimer = 1.5;
    }

    renderMissionSummary(sessionMissions, completedAchievements) {
        if (!this.elMissionSummary) return;
        const hasMissions = sessionMissions.length > 0;
        const hasAchievements = completedAchievements.length > 0;
        if (!hasMissions && !hasAchievements) {
            this._hide(this.elMissionSummary);
            return;
        }

        this.elMissionSummary.innerHTML = '';
        this._show(this.elMissionSummary);

        // 单局任务
        const title = document.createElement('div');
        title.className = 'mission-summary-title';
        title.textContent = '任务';
        this.elMissionSummary.appendChild(title);

        for (const m of sessionMissions) {
            const row = document.createElement('div');
            row.className = 'mission-summary-row' + (m.completed ? ' completed' : '');

            const status = document.createElement('span');
            status.className = 'mission-summary-status';
            status.textContent = m.completed ? '\u2713' : '\u2717';

            const desc = document.createElement('span');
            desc.className = 'mission-summary-desc';
            desc.textContent = m.def.description;

            const reward = document.createElement('span');
            reward.className = 'mission-summary-reward';
            reward.textContent = m.completed ? '+' + m.def.reward : '';

            row.appendChild(status);
            row.appendChild(desc);
            row.appendChild(reward);
            this.elMissionSummary.appendChild(row);
        }

        // 成就
        for (const a of completedAchievements) {
            const row = document.createElement('div');
            row.className = 'achievement-summary-row';

            const status = document.createElement('span');
            status.className = 'mission-summary-status';
            status.textContent = '\u2605';

            const desc = document.createElement('span');
            desc.className = 'mission-summary-desc';
            desc.textContent = a.description;

            const reward = document.createElement('span');
            reward.className = 'mission-summary-reward';
            reward.textContent = '+' + a.reward;

            row.appendChild(status);
            row.appendChild(desc);
            row.appendChild(reward);
            this.elMissionSummary.appendChild(row);
        }
    }

    renderMissionsPanel(sessionMissions, progression) {
        // 单局任务预览
        if (this.elMissionsSession) {
            this.elMissionsSession.innerHTML = '';
            if (sessionMissions.length === 0) {
                const hint = document.createElement('div');
                hint.style.cssText = 'font-size:0.8rem; color:rgba(255,255,255,0.4); padding:12px;';
                hint.textContent = '开始游戏后将随机分配3个任务';
                this.elMissionsSession.appendChild(hint);
            } else {
                for (const m of sessionMissions) {
                    this.elMissionsSession.appendChild(this._createMissionItem(m));
                }
            }
        }

        // 成就列表
        if (this.elMissionsAchievements) {
            this.elMissionsAchievements.innerHTML = '';
            const completedSet = new Set(progression.getCompletedAchievements());
            const lifetime = progression.getLifetimeStats();
            const skinsCount = progression.getUnlockedSkins().length;

            for (const def of ACHIEVEMENT_MISSIONS) {
                const isCompleted = completedSet.has(def.id);
                let current;
                if (def.stat === 'totalSkinsUnlocked') {
                    current = skinsCount;
                } else {
                    current = lifetime[def.stat] || 0;
                }
                current = Math.min(current, def.value);

                this.elMissionsAchievements.appendChild(this._createMissionItem({
                    description: def.description,
                    current,
                    target: def.value,
                    reward: def.reward,
                    completed: isCompleted,
                }));
            }
        }
    }

    _createMissionItem(m) {
        const item = document.createElement('div');
        item.className = 'mission-item' + (m.completed ? ' completed' : '');

        const info = document.createElement('div');
        info.className = 'mission-item-info';

        const desc = document.createElement('div');
        desc.className = 'mission-item-desc';
        desc.textContent = m.completed ? '\u2713 ' + m.description : m.description;

        const prog = document.createElement('div');
        prog.className = 'mission-item-progress';
        prog.textContent = `${Math.floor(m.current)} / ${m.target}`;

        const bar = document.createElement('div');
        bar.className = 'mission-item-bar';
        const fill = document.createElement('div');
        fill.className = 'mission-item-bar-fill';
        fill.style.width = Math.min(100, m.current / m.target * 100) + '%';
        bar.appendChild(fill);

        info.appendChild(desc);
        info.appendChild(prog);
        info.appendChild(bar);

        const reward = document.createElement('div');
        reward.className = 'mission-item-reward';
        reward.textContent = m.completed ? '\u2713' : '\u25cf ' + m.reward;

        item.appendChild(info);
        item.appendChild(reward);
        return item;
    }

    /* ─── 工具方法 ─── */

    _show(el) {
        if (el) el.classList.remove('hidden');
    }

    _hide(el) {
        if (el) el.classList.add('hidden');
    }
}
