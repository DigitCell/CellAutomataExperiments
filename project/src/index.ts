//import { init } from './main';
import { Graphics } from './graphicClass';

async function start() {
    const graphics = new Graphics();
    await graphics.init();
    graphics.runLoop();
}

start();