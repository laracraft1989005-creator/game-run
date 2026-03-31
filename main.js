import { Game } from './src/core/Game.js';

const container = document.getElementById('game-container');
const game = new Game(container);
game.run();
