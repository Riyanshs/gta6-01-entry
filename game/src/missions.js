// The story: seven missions, a getaway-driver arc for Leo Marin, new in Verde
// Bay, working for fixer Carmen Reyes against the Los Tiburones crew. Each
// mission is a list of steps; the runner tracks which step is live, what the
// player must do, and when the mission — and the story — is done.

import { MISSIONS } from './config.js';
import { dist2d } from './random.js';

export function missionCount() {
  return MISSIONS.length;
}

export function getMission(index) {
  return MISSIONS[index] || null;
}

export function createMissionRunner() {
  let missionIndex = 0;
  let stepIndex = 0;
  let killsDone = 0;
  let heatReached = false;
  let finished = false;

  function current() {
    if (finished) return null;
    return MISSIONS[missionIndex] || null;
  }

  function step() {
    const m = current();
    return m ? m.steps[stepIndex] : null;
  }

  function objectiveText() {
    if (finished) return 'Story complete — Verde Bay is yours, Leo.';
    const m = current();
    if (!m) return 'Free roam — explore Verde Bay.';
    const s = step();
    if (!s) return m.name;
    if (s.type === 'kill') return s.text.replace('(0/', `(${killsDone}/`);
    if (s.type === 'wanted' && heatReached) return 'Lose the heat — stay out of sight';
    return s.text;
  }

  function advance() {
    const m = current();
    if (!m) return 'none';
    stepIndex += 1;
    killsDone = 0;
    heatReached = false;
    if (stepIndex >= m.steps.length) {
      const reward = m.reward;
      missionIndex += 1;
      stepIndex = 0;
      if (missionIndex >= MISSIONS.length) {
        finished = true;
        return 'allDone';
      }
      return 'missionDone';
    }
    return 'stepDone';
  }

  return {
    get missionIndex() {
      return missionIndex;
    },
    get finished() {
      return finished;
    },
    get killsDone() {
      return killsDone;
    },
    current,
    step,
    objectiveText,
    startMission(index) {
      missionIndex = index;
      stepIndex = 0;
      killsDone = 0;
      heatReached = false;
      finished = false;
    },
    onKill() {
      killsDone += 1;
    },
    /**
     * Check the live step against the world. `ctx` carries the player's
     * position, whether they are in a car, the wanted level and the live
     * enemy count. Returns 'none' | 'stepDone' | 'missionDone' | 'allDone'.
     */
    update(ctx) {
      const s = step();
      if (!s) return 'none';
      if (s.type === 'goto') {
        if (dist2d(ctx.x, ctx.z, s.at.x, s.at.z) < 9) return advance();
      } else if (s.type === 'enterCar' || s.type === 'stealCar') {
        if (ctx.inCar) return advance();
      } else if (s.type === 'kill') {
        if (killsDone >= (s.count || 1)) return advance();
      } else if (s.type === 'wanted') {
        if (ctx.wanted >= (s.level || 1)) heatReached = true;
        if (heatReached && ctx.wanted === 0) return advance();
      }
      return 'none';
    },
    /** Where the mission marker (the yellow beacon) should stand, if anywhere. */
    marker() {
      const s = step();
      if (!s) return null;
      if (s.type === 'goto' || s.type === 'stealCar' || s.type === 'kill') return s.at;
      if (s.type === 'enterCar') return s.at;
      return null;
    },
  };
}
