// Screenshot scenes behind ?shot=title|drive|chase|mission. Each one stages the
// real game from a fixed seed and steps the real rules forward with a scripted
// autopilot, so the frame is what a short session really looks like — the same
// seed always gives the same frame.

import { CITY } from './config.js';

/** A control object shaped like the live input, driven by a script. */
function scripted(fwd, strafe, extra) {
  return {
    fwd, strafe,
    lookDX: 0, lookDY: 0,
    interact: false, shoot: false, shooting: false,
    handbrake: false, run: false, weaponSlot: -1, reload: false,
    ...(extra || {}),
  };
}

function stepGame(game, seconds, ctlFn) {
  const steps = Math.floor(seconds * 60);
  for (let i = 0; i < steps; i += 1) game.update(1 / 60, ctlFn(i));
}

/**
 * Stage the named scene on `game` and return the screen to show.
 * title: orbit the city with the start screen up.
 * drive: steal the coupe and cruise the avenues.
 * chase: wanted 3, patrol cars ramming, helicopter overhead.
 * mission: the pier shootout, mid-fight.
 */
export function stageShot(name, game) {
  const { state, player, missions } = game;
  if (name === 'title') {
    state.screen = 'title';
    return 'title';
  }

  game.startNewGame();

  if (name === 'drive') {
    // Walk to the yellow coupe by the plaza, steal it, drive down the avenue.
    player.x = 43;
    player.z = 6;
    state.camYaw = Math.PI;
    game.update(1 / 60, scripted(0, 0, { interact: true }));
    stepGame(game, 1, () => scripted(0, 0));
    stepGame(game, 5, () => scripted(1, 0));
    return 'play';
  }

  if (name === 'chase') {
    player.x = 43;
    player.z = 6;
    state.camYaw = Math.PI;
    game.update(1 / 60, scripted(0, 0, { interact: true }));
    // Steal the car at the plaza, then light it up: wanted 3, patrol on us.
    game.update(1 / 60, scripted(0, 0));
    state.wanted = 3;
    game.police.setCount(3, player.x, player.z);
    stepGame(game, 7, () => scripted(1, 0));
    return 'play';
  }

  if (name === 'mission') {
    // Jump to mission 3, the pier shootout, pistol out, mid-fight.
    missions.startMission(2);
    state.owned.pistol = true;
    state.ammo.pistol = 60;
    state.mag.pistol = 12;
    state.weaponIndex = 1;
    player.x = CITY.pier.x;
    player.z = CITY.pier.z - 4;
    state.camYaw = Math.PI * 0.25;
    stepGame(game, 2, () => scripted(0, 0));
    // Fire at the crew for a few seconds.
    stepGame(game, 3, () => scripted(0, 0, { shooting: true }));
    return 'play';
  }

  state.screen = 'title';
  return 'title';
}
