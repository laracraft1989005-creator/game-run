import { Game } from './src/core/Game.js?v=20260331r1';

const container = document.getElementById('game-container');
const game = new Game(container);
await game.init();
game.run();
