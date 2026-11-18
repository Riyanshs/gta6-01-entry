// All sound is synthesized with WebAudio — no audio files, no network.
// Three radio stations (chord pads, bassline, arpeggio), plus engine hum, siren,
// gunshots and UI blips. Everything is guarded: no gesture yet, no audio context.

export const STATIONS = [
  { name: 'VERDE FM — Sunset Chill', kind: 'chill' },
  { name: 'BASS BAY — 98.4', kind: 'bass' },
  { name: 'SOL ROCK — Verde Rock', kind: 'rock' },
];

const CHORDS = [
  [220.0, 261.63, 329.63],
  [174.61, 220.0, 261.63],
  [196.0, 246.94, 293.66],
  [146.83, 220.0, 261.63],
];
const BASSLINE = [55, 55, 65.41, 49, 55, 82.41, 73.42, 49];
const ARP = [440, 554.37, 659.25, 880, 659.25, 554.37];

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let station = 0;
  let step = 0;
  let timer = null;
  let enabled = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function note(freq, when, dur, type, gainValue, dest) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gainValue, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(g);
    g.connect(dest || musicGain);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  function tick() {
    if (!ctx || !enabled) return;
    const kind = STATIONS[station].kind;
    const now = ctx.currentTime + 0.05;
    if (kind === 'chill') {
      const chord = CHORDS[Math.floor(step / 4) % CHORDS.length];
      if (step % 4 === 0) {
        for (const f of chord) note(f, now, 1.8, 'triangle', 0.5);
      }
      if (step % 2 === 0) note(chord[0] * 2, now, 0.4, 'sine', 0.25);
    } else if (kind === 'bass') {
      const f = BASSLINE[step % BASSLINE.length];
      note(f, now, 0.42, 'square', 0.4);
      if (step % 4 === 2) note(f * 4, now, 0.12, 'sine', 0.3);
    } else {
      const f = ARP[step % ARP.length];
      note(f, now, 0.22, 'sawtooth', 0.22);
      if (step % 8 === 0) note(f / 4, now, 0.5, 'triangle', 0.4);
    }
    step += 1;
  }

  return {
    get stationName() {
      return STATIONS[station].name;
    },
    /** Call from a user gesture (click / key) to unlock audio. */
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (!enabled) {
        enabled = true;
        timer = window.setInterval(tick, 240);
      }
    },
    nextStation() {
      station = (station + 1) % STATIONS.length;
      step = 0;
    },
    setEngine(speed01, on) {
      if (!ctx || !enabled) return;
      engineGain.gain.value = on ? 0.05 + speed01 * 0.06 : 0;
      engineOsc.frequency.value = 55 + speed01 * 140;
    },
    setSiren(on) {
      if (!ctx || !enabled) return;
      sirenGain.gain.value = on ? 0.05 : 0;
      if (on) sirenOsc.frequency.value = 660 + Math.sin(performance.now() / 300) * 180;
    },
    gunshot() {
      if (!ctx || !enabled) return;
      try {
        const dur = 0.12;
        const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const g = ctx.createGain();
        g.gain.value = 0.5;
        src.connect(g);
        g.connect(master);
        src.start();
      } catch {
        // Sound is garnish; a failure never breaks the game.
      }
    },
    blip(freq) {
      if (!ctx || !enabled) return;
      try {
        note(freq || 880, ctx.currentTime, 0.12, 'sine', 0.4, master);
      } catch {
        // Ignore.
      }
    },
  };
}
