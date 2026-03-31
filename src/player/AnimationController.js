import * as THREE from 'three';

export class AnimationController {
    constructor(characterModel) {
        this.model = characterModel;
        this.currentAction = null;
        this.currentState = null;
    }

    transitionTo(stateName, duration = 0.2) {
        if (!this.model.ready) return;
        if (stateName === this.currentState) return;

        const nextAction = this.model.animations[stateName];
        if (!nextAction) {
            console.warn('Animation not found:', stateName);
            return;
        }

        // 配置循环模式
        const loopStates = ['Idle', 'Run', 'Walk'];
        if (loopStates.includes(stateName)) {
            nextAction.setLoop(THREE.LoopRepeat);
        } else {
            nextAction.setLoop(THREE.LoopOnce);
            nextAction.clampWhenFinished = true;
        }

        // 交叉淡入
        nextAction.reset();
        nextAction.setEffectiveWeight(1);
        nextAction.play();

        if (this.currentAction) {
            this.currentAction.crossFadeTo(nextAction, duration, true);
        }

        this.currentAction = nextAction;
        this.currentState = stateName;
    }

    setTimeScale(scale) {
        if (this.currentAction) {
            this.currentAction.timeScale = scale;
        }
    }

    isFinished() {
        if (!this.currentAction) return false;
        return !this.currentAction.isRunning();
    }

    update(dt) {
        this.model.update(dt);

        // 一次性动画结束后自动回到 Run
        if (this.currentState && !['Idle', 'Run', 'Walk', 'Death'].includes(this.currentState)) {
            if (this.isFinished()) {
                this.transitionTo('Run', 0.15);
            }
        }
    }
}
