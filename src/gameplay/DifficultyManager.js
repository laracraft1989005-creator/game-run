export class DifficultyManager {
    constructor() {
        this.baseSpeed = 15;
        this.maxSpeed = 35;
        this.speedIncrement = 0.5;
        this.speedUpInterval = 10; // 秒
        this.elapsed = 0;
        this.speed = this.baseSpeed;
        this.maxReachedSpeed = this.baseSpeed;
        this.speedChanged = false;

        // 加速带 boost
        this._speedBoostTimer = 0;
        this._speedBoostMultiplier = 1.0;
    }

    update(dt) {
        this.elapsed += dt;
        const prev = this.speed;
        const baseCalcSpeed = Math.min(
            this.maxSpeed,
            this.baseSpeed + Math.floor(this.elapsed / this.speedUpInterval) * this.speedIncrement
        );

        // 加速带计时
        if (this._speedBoostTimer > 0) {
            this._speedBoostTimer -= dt;
            if (this._speedBoostTimer <= 0) {
                this._speedBoostMultiplier = 1.0;
                this._speedBoostTimer = 0;
            }
        }

        this.speed = baseCalcSpeed * this._speedBoostMultiplier;
        this.speedChanged = this.speed > prev;
        if (this.speed > this.maxReachedSpeed) this.maxReachedSpeed = this.speed;
    }

    getDifficulty() {
        return Math.min(1, (this.speed / this._speedBoostMultiplier - this.baseSpeed) / (this.maxSpeed - this.baseSpeed));
    }

    applySpeedBoost(multiplier, duration) {
        this._speedBoostMultiplier = multiplier;
        this._speedBoostTimer = duration;
    }

    isSpeedBoosted() {
        return this._speedBoostTimer > 0;
    }

    reset() {
        this.elapsed = 0;
        this.speed = this.baseSpeed;
        this.maxReachedSpeed = this.baseSpeed;
        this.speedChanged = false;
        this._speedBoostTimer = 0;
        this._speedBoostMultiplier = 1.0;
    }
}
