/**
 * SoundManager — Web Audio API 程序化音效系统
 * 所有声音由 oscillator / noise buffer 实时合成，无需外部音频文件
 */
export class SoundManager {
    constructor() {
        this.audioCtx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.noiseBuffer = null;

        this.muted = localStorage.getItem('cityRunnerMuted') === 'true';
        this.unlocked = false;

        // 脚步声状态
        this._nextFootstepTime = 0;
        this._footstepAlt = false;

        // 音乐状态
        this._musicPlaying = false;
        this._musicInterval = null;
        this._musicNodes = [];
        this._nextNoteTime = 0;
        this._noteIndex = 0;
        this._musicTempo = 130; // BPM
    }

    /* ─── 初始化 & 解锁 ─── */

    unlock() {
        if (this.unlocked && this.audioCtx.state === 'running') return;

        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this._buildGraph();
            this._buildNoiseBuffer();
        }

        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        this.unlocked = true;
    }

    _buildGraph() {
        const ctx = this.audioCtx;
        this.masterGain = ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 1;
        this.masterGain.connect(ctx.destination);

        this.sfxGain = ctx.createGain();
        this.sfxGain.gain.value = 0.6;
        this.sfxGain.connect(this.masterGain);

        this.musicGain = ctx.createGain();
        this.musicGain.gain.value = 0.2;
        this.musicGain.connect(this.masterGain);
    }

    _buildNoiseBuffer() {
        const ctx = this.audioCtx;
        const len = ctx.sampleRate; // 1 秒白噪声
        this.noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }

    /* ─── 静音控制 ─── */

    setMuted(muted) {
        this.muted = muted;
        localStorage.setItem('cityRunnerMuted', muted);
        if (this.masterGain) {
            this.masterGain.gain.value = muted ? 0 : 1;
        }
    }

    toggleMute() {
        this.setMuted(!this.muted);
        return this.muted;
    }

    /* ─── 工具方法 ─── */

    _now() {
        return this.audioCtx ? this.audioCtx.currentTime : 0;
    }

    _tone(freq, duration, type = 'sine', gain = 0.3, dest = null) {
        if (!this.audioCtx) return;
        const ctx = this.audioCtx;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + duration);
        osc.connect(g);
        g.connect(dest || this.sfxGain);
        osc.start(t);
        osc.stop(t + duration);
    }

    _sweep(startFreq, endFreq, duration, type = 'sine', gain = 0.3, dest = null) {
        if (!this.audioCtx) return;
        const ctx = this.audioCtx;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(startFreq, t);
        osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + duration);
        osc.connect(g);
        g.connect(dest || this.sfxGain);
        osc.start(t);
        osc.stop(t + duration);
    }

    _noise(duration, filterFreq = 1000, gain = 0.2, dest = null) {
        if (!this.audioCtx || !this.noiseBuffer) return;
        const ctx = this.audioCtx;
        const t = ctx.currentTime;
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = filterFreq;
        filter.Q.value = 1;
        const g = ctx.createGain();
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + duration);
        src.connect(filter);
        filter.connect(g);
        g.connect(dest || this.sfxGain);
        src.start(t);
        src.stop(t + duration);
    }

    /* ─── 一次性音效 ─── */

    playUIClick() {
        if (!this.audioCtx) return;
        this._tone(800, 0.04, 'square', 0.15);
    }

    playJump() {
        if (!this.audioCtx) return;
        this._sweep(300, 800, 0.15, 'sine', 0.25);
    }

    playLand() {
        if (!this.audioCtx) return;
        this._tone(80, 0.1, 'sine', 0.35);
        this._noise(0.05, 200, 0.15);
    }

    playSlide() {
        if (!this.audioCtx) return;
        const ctx = this.audioCtx;
        const t = ctx.currentTime;
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2000, t);
        filter.frequency.exponentialRampToValueAtTime(500, t + 0.2);
        filter.Q.value = 2;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.2, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        src.connect(filter);
        filter.connect(g);
        g.connect(this.sfxGain);
        src.start(t);
        src.stop(t + 0.2);
    }

    playLaneSwitch() {
        if (!this.audioCtx) return;
        this._tone(1200, 0.03, 'sine', 0.12);
    }

    playCollision() {
        if (!this.audioCtx) return;
        // 噪声 crunch
        this._noise(0.25, 800, 0.4);
        // 低频 rumble
        this._tone(50, 0.4, 'sine', 0.35);
        // 冲击
        this._tone(120, 0.06, 'sine', 0.5);
    }

    playMilestone() {
        if (!this.audioCtx) return;
        const ctx = this.audioCtx;
        const t = ctx.currentTime;
        const notes = [523, 659, 784]; // C5, E5, G5
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const start = t + i * 0.08;
            g.gain.setValueAtTime(0, start);
            g.gain.linearRampToValueAtTime(0.3, start + 0.01);
            g.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
            osc.connect(g);
            g.connect(this.sfxGain);
            osc.start(start);
            osc.stop(start + 0.15);
        });
    }

    playSpeedUp() {
        if (!this.audioCtx) return;
        this._sweep(400, 1200, 0.3, 'sine', 0.2);
    }

    playCoinPickup() {
        if (!this.audioCtx) return;
        const ctx = this.audioCtx;
        const t = ctx.currentTime;
        // 两个快速上升音
        [1400, 1800].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const start = t + i * 0.03;
            g.gain.setValueAtTime(0.25, start);
            g.gain.exponentialRampToValueAtTime(0.001, start + 0.06);
            osc.connect(g);
            g.connect(this.sfxGain);
            osc.start(start);
            osc.stop(start + 0.06);
        });
    }

    playPowerupPickup() {
        if (!this.audioCtx) return;
        const ctx = this.audioCtx;
        const t = ctx.currentTime;
        const notes = [660, 880, 1320]; // E5, A5, E6
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const start = t + i * 0.06;
            g.gain.setValueAtTime(0, start);
            g.gain.linearRampToValueAtTime(0.25, start + 0.01);
            g.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
            osc.connect(g);
            g.connect(this.sfxGain);
            osc.start(start);
            osc.stop(start + 0.12);
        });
    }

    playShieldActivate() {
        if (!this.audioCtx) return;
        this._sweep(200, 1000, 0.3, 'sine', 0.2);
        this._noise(0.15, 2000, 0.1);
    }

    playShieldBreak() {
        if (!this.audioCtx) return;
        this._noise(0.2, 4000, 0.3);
        this._tone(2000, 0.05, 'square', 0.15);
    }

    playJumpPad() {
        if (!this.audioCtx) return;
        this._sweep(200, 1600, 0.2, 'sine', 0.3);
        this._sweep(150, 1200, 0.25, 'triangle', 0.15);
    }

    playSpeedZone() {
        if (!this.audioCtx) return;
        this._sweep(300, 900, 0.25, 'sawtooth', 0.2);
        this._noise(0.15, 3000, 0.15);
    }

    playRideStart() {
        if (!this.audioCtx) return;
        this._tone(220, 0.3, 'sawtooth', 0.25);
        this._tone(330, 0.3, 'sawtooth', 0.2);
        this._sweep(200, 600, 0.5, 'sine', 0.15);
    }

    playRideEnd() {
        if (!this.audioCtx) return;
        this._sweep(400, 100, 0.6, 'sawtooth', 0.2);
        this._noise(0.3, 500, 0.15);
    }

    /* ─── 脚步声 ─── */

    updateFootsteps(speed) {
        if (!this.audioCtx) return;
        const t = this._now();
        const interval = 0.5 / (speed / 15); // 速度 15 → 0.5s, 速度 35 → ~0.21s
        if (t >= this._nextFootstepTime) {
            const freq = this._footstepAlt ? 110 : 130;
            this._tone(freq, 0.02, 'sine', 0.12);
            this._noise(0.015, 300, 0.06);
            this._footstepAlt = !this._footstepAlt;
            this._nextFootstepTime = t + interval;
        }
    }

    resetFootsteps() {
        this._nextFootstepTime = 0;
    }

    /* ─── 背景音乐 ─── */

    // 五声音阶 pattern
    static SCALE = [262, 294, 330, 392, 440]; // C4 D4 E4 G4 A4
    static BASS = [131, 196, 131, 165]; // C3 G3 C3 E3
    static PATTERN = [
        0, 2, 4, 2, 1, 3, 4, 3,
        0, 4, 2, 3, 1, 2, 0, 4,
    ];

    startMusic() {
        if (!this.audioCtx || this._musicPlaying) return;
        this._musicPlaying = true;
        this._noteIndex = 0;
        this._nextNoteTime = this._now() + 0.1;

        this.musicGain.gain.setValueAtTime(0.2, this._now());

        this._musicInterval = setInterval(() => this._scheduleMusic(), 25);
    }

    stopMusic() {
        if (!this._musicPlaying) return;
        this._musicPlaying = false;
        if (this._musicInterval) {
            clearInterval(this._musicInterval);
            this._musicInterval = null;
        }
        // fade out
        if (this.musicGain) {
            const t = this._now();
            this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, t);
            this.musicGain.gain.linearRampToValueAtTime(0, t + 0.5);
        }
    }

    setMusicTempo(speed) {
        // 游戏速度 15→35 映射到 BPM 120→160
        this._musicTempo = 120 + (speed - 15) / 20 * 40;
    }

    _scheduleMusic() {
        if (!this.audioCtx || !this._musicPlaying) return;
        const ctx = this.audioCtx;
        const LOOKAHEAD = 0.1;

        while (this._nextNoteTime < ctx.currentTime + LOOKAHEAD) {
            const patIdx = this._noteIndex % SoundManager.PATTERN.length;
            const scaleIdx = SoundManager.PATTERN[patIdx];
            const freq = SoundManager.SCALE[scaleIdx];
            const noteDur = 60 / this._musicTempo / 2; // 八分音符

            // 旋律音
            this._scheduleNote(freq, this._nextNoteTime, noteDur * 0.8, 'triangle', 0.15);

            // 每 4 个音一个 bass
            if (this._noteIndex % 4 === 0) {
                const bassIdx = (this._noteIndex / 4) % SoundManager.BASS.length;
                this._scheduleNote(SoundManager.BASS[bassIdx], this._nextNoteTime, noteDur * 1.5, 'triangle', 0.12);
            }

            // 每个八分音符一个 hi-hat
            this._scheduleHiHat(this._nextNoteTime, 0.02);

            this._nextNoteTime += noteDur;
            this._noteIndex++;
        }
    }

    _scheduleNote(freq, time, duration, type = 'triangle', gain = 0.15) {
        const ctx = this.audioCtx;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        // ADSR: attack 10ms, sustain, release
        g.gain.setValueAtTime(0, time);
        g.gain.linearRampToValueAtTime(gain, time + 0.01);
        g.gain.setValueAtTime(gain * 0.7, time + duration * 0.3);
        g.gain.exponentialRampToValueAtTime(0.001, time + duration);
        osc.connect(g);
        g.connect(this.musicGain);
        osc.start(time);
        osc.stop(time + duration + 0.01);
    }

    _scheduleHiHat(time, duration) {
        const ctx = this.audioCtx;
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 8000;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.04, time);
        g.gain.exponentialRampToValueAtTime(0.001, time + duration);
        src.connect(filter);
        filter.connect(g);
        g.connect(this.musicGain);
        src.start(time);
        src.stop(time + duration + 0.01);
    }
}
