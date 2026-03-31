export class ScoreManager {
    static MILESTONES = [100, 250, 500, 1000, 2500, 5000, 10000];

    constructor() {
        this.distance = 0;
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('cityRunnerHigh') || '0');
        this._lastMilestoneIdx = -1;
    }

    update(dt, speed) {
        this.distance += speed * dt;
        this.score = Math.floor(this.distance);
    }

    /** 返回刚跨过的里程碑值，无则返回 0 */
    checkMilestone() {
        const ms = ScoreManager.MILESTONES;
        for (let i = ms.length - 1; i >= 0; i--) {
            if (this.score >= ms[i] && i > this._lastMilestoneIdx) {
                this._lastMilestoneIdx = i;
                return ms[i];
            }
        }
        return 0;
    }

    saveHighScore() {
        const isNew = this.score > this.highScore;
        if (isNew) {
            this.highScore = this.score;
            localStorage.setItem('cityRunnerHigh', String(this.highScore));
        }
        return isNew;
    }

    reset() {
        this.distance = 0;
        this.score = 0;
        this._lastMilestoneIdx = -1;
    }
}
