// Boot and the one loop: input is read every frame, the game advances in fixed
// 1/60 s steps, and the renderer paints what is there. Screens: title, play,
// paused. The shop is a panel over play.
//
// ?seed=N fixes the city. ?shot=title|drive|chase|mission (with &seed=N) stages
// that scene instead of running the loop, paints it a few times and sets
// window.__shotReady for a screenshot.

import * as THREE from 'three';
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createGame } from './game.js';
import { createInput, ACTION_INTERACT, ACTION_SHOOT, ACTION_PAUSE, ACTION_RELOAD } from './input.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const scene = new THREE.Scene();
const game = createGame(scene, createRandom(seed));
game.scene = scene;
const renderer = createRenderer(canvas, game);

function readControl(input, actions) {
  const move = input.move();
  const mouse = input.takeMouse();
  return {
    fwd: move.forward,
    strafe: move.strafe,
    lookDX: mouse.dx,
    lookDY: mouse.dy,
    interact: !!(actions & ACTION_INTERACT),
    shoot: !!(actions & ACTION_SHOOT),
    shooting: input.shooting,
    handbrake: input.handbrake,
    run: input.running,
    weaponSlot: input.weaponSlot(),
    reload: !!(actions & ACTION_RELOAD),
  };
}

function runShot(name) {
  stageShot(name, game);
  let painted = 0;
  function paint() {
    renderer.render(1 / 60);
    painted += 1;
    if (painted < 4) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let paused = false;
  let accumulator = 0;
  let last = performance.now();
  let radioKeyDown = false;

  const status = document.getElementById('status');
  function announce(message) {
    if (status) status.textContent = message;
  }

  function showTitle() {
    game.state.screen = 'title';
    const newBtn = document.getElementById('btn-new');
    const contBtn = document.getElementById('btn-continue');
    if (contBtn) contBtn.style.display = game.hasSave() ? 'inline-block' : 'none';
    if (newBtn) newBtn.focus();
    announce('Verde Bay. Press Enter to start a new game.');
  }

  function startFresh() {
    game.audio.unlock();
    game.startNewGame();
    paused = false;
    announce('Playing. Follow the yellow marker.');
  }

  function startContinued() {
    game.audio.unlock();
    if (game.loadSave()) {
      game.state.screen = 'play';
      paused = false;
      announce('Continued your saved game.');
    } else {
      startFresh();
    }
  }

  document.getElementById('btn-new').addEventListener('click', startFresh);
  document.getElementById('btn-continue').addEventListener('click', startContinued);
  document.getElementById('btn-buy-pistol').addEventListener('click', () => game.buy('pistol'));
  document.getElementById('btn-buy-smg').addEventListener('click', () => game.buy('smg'));
  document.getElementById('btn-buy-ammo').addEventListener('click', () => game.buy('ammo'));
  document.getElementById('btn-close-shop').addEventListener('click', () => {
    game.state.shopOpen = false;
  });
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Enter' && game.state.screen === 'title') startFresh();
    if (event.code === 'KeyM' && !radioKeyDown) {
      radioKeyDown = true;
      game.audio.nextStation();
    }
    if (event.code === 'KeyC') game.audio.unlock();
  });
  window.addEventListener('keyup', (event) => {
    if (event.code === 'KeyM') radioKeyDown = false;
  });

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (actions & ACTION_PAUSE && game.state.screen === 'play') {
      paused = !paused;
      announce(paused ? 'Paused.' : 'Playing.');
    }
    if (game.state.screen === 'title') {
      // The city lives behind the title screen: traffic and pedestrians move.
      game.traffic.update(dt);
      game.peds.update(dt, null);
      renderer.render(dt);
      return;
    }
    if (!paused) {
      accumulator += dt;
      while (accumulator >= STEP) {
        game.update(STEP, readControl(input, actions));
        accumulator -= STEP;
      }
    }
    renderer.render(dt);
    const pauseEl = document.getElementById('paused');
    if (pauseEl) pauseEl.style.display = paused ? 'flex' : 'none';
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state.screen === 'play') paused = true;
  });

  showTitle();
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
