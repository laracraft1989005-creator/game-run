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
    }

    update(dt) {
        this.elapsed += dt;
        const prev = this.speed;
        this.speed = Math.min(
            this.maxSpeed,
            this.baseSpeed + Math.floor(this.elapsed / this.speedUpInterval) * this.speedIncrement
        );
        this.speedChanged = this.speed > prev;
        if (this.speed > this.maxReachedSpeed) this.maxReachedSpeed = this.speed;
    }

    getDifficulty() {
        return Math.min(1, (this.speed - this.baseSpeed) / (this.maxSpeed - this.baseSpeed));
    }

    reset() {
        this.elapsed = 0;
        this.speed = this.baseSpeed;
        this.maxReachedSpeed = this.baseSpeed;
        this.speedChanged = false;
    }
}
