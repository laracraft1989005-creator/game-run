export class InputManager {
    constructor() {
        this.actions = { left: false, right: false, jump: false, slide: false };
        this._pressed = {};
        this._touchStartX = 0;
        this._touchStartY = 0;

        window.addEventListener('keydown', e => this._onKeyDown(e));
        window.addEventListener('keyup', e => this._onKeyUp(e));
        window.addEventListener('touchstart', e => this._onTouchStart(e), { passive: false });
        window.addEventListener('touchend', e => this._onTouchEnd(e), { passive: false });
    }

    _onKeyDown(e) {
        if (this._pressed[e.code]) return;
        this._pressed[e.code] = true;

        switch (e.code) {
            case 'ArrowLeft': case 'KeyA': this.actions.left = true; break;
            case 'ArrowRight': case 'KeyD': this.actions.right = true; break;
            case 'ArrowUp': case 'KeyW': case 'Space': this.actions.jump = true; break;
            case 'ArrowDown': case 'KeyS': this.actions.slide = true; break;
        }
    }

    _onKeyUp(e) {
        this._pressed[e.code] = false;
    }

    _onTouchStart(e) {
        const t = e.touches[0];
        this._touchStartX = t.clientX;
        this._touchStartY = t.clientY;
    }

    _onTouchEnd(e) {
        const t = e.changedTouches[0];
        const dx = t.clientX - this._touchStartX;
        const dy = t.clientY - this._touchStartY;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        const threshold = 30;

        if (absDx < threshold && absDy < threshold) {
            this.actions.jump = true; // tap = jump
        } else if (absDx > absDy) {
            if (dx > 0) this.actions.right = true;
            else this.actions.left = true;
        } else {
            if (dy < 0) this.actions.jump = true;
            else this.actions.slide = true;
        }
    }

    consume() {
        const a = { ...this.actions };
        this.actions.left = false;
        this.actions.right = false;
        this.actions.jump = false;
        this.actions.slide = false;
        return a;
    }
}
