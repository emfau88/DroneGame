import { Game } from './core/Game.js';

const game = new Game();
await game.init();
game.start();
