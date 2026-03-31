export class ScoreManager {
    constructor() {
        this.distance = 0;
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('cityRunnerHigh') || '0');
    }

    update(dt, speed) {
        this.distance += speed * dt;
        this.score = Math.floor(this.distance);
    }

    saveHighScore() {
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('cityRunnerHigh', String(this.highScore));
        }
    }

    reset() {
        this.distance = 0;
        this.score = 0;
    }
}
