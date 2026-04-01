import { Game } from './src/core/Game.js?v=202604011500';

const container = document.getElementById('game-container');
const game = new Game(container);
await game.init();
game.run();
