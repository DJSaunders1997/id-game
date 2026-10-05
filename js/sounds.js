// Web Audio API sound effects - no external files needed
const SFX = (() => {
  let ctx = null;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function play(fn) {
    try {
      const c = getCtx();
      if (c.state === 'suspended') c.resume();
      fn(c);
    } catch (_) {
      // Audio not supported - fail silently
    }
  }

  return {
    tap() {
      play(c => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(800, c.currentTime);
        o.frequency.exponentialRampToValueAtTime(600, c.currentTime + 0.08);
        g.gain.setValueAtTime(0.15, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
        o.connect(g).connect(c.destination);
        o.start(); o.stop(c.currentTime + 0.08);
      });
    },

    select() {
      play(c => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(500, c.currentTime);
        o.frequency.exponentialRampToValueAtTime(900, c.currentTime + 0.12);
        g.gain.setValueAtTime(0.15, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
        o.connect(g).connect(c.destination);
        o.start(); o.stop(c.currentTime + 0.15);
      });
    },

    correct() {
      play(c => {
        [523, 659, 784].forEach((freq, i) => {
          const o = c.createOscillator();
          const g = c.createGain();
          o.type = 'sine';
          o.frequency.value = freq;
          g.gain.setValueAtTime(0.12, c.currentTime + i * 0.1);
          g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.1 + 0.2);
          o.connect(g).connect(c.destination);
          o.start(c.currentTime + i * 0.1);
          o.stop(c.currentTime + i * 0.1 + 0.2);
        });
      });
    },

    wrong() {
      play(c => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(300, c.currentTime);
        o.frequency.exponentialRampToValueAtTime(150, c.currentTime + 0.3);
        g.gain.setValueAtTime(0.1, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);
        o.connect(g).connect(c.destination);
        o.start(); o.stop(c.currentTime + 0.3);
      });
    },

    tick() {
      play(c => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sine';
        o.frequency.value = 1000;
        g.gain.setValueAtTime(0.06, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.04);
        o.connect(g).connect(c.destination);
        o.start(); o.stop(c.currentTime + 0.04);
      });
    },

    timeUp() {
      play(c => {
        [400, 400, 300].forEach((freq, i) => {
          const o = c.createOscillator();
          const g = c.createGain();
          o.type = 'square';
          o.frequency.value = freq;
          g.gain.setValueAtTime(0.12, c.currentTime + i * 0.15);
          g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.15 + 0.12);
          o.connect(g).connect(c.destination);
          o.start(c.currentTime + i * 0.15);
          o.stop(c.currentTime + i * 0.15 + 0.12);
        });
      });
    },

    victory() {
      play(c => {
        [523, 659, 784, 1047].forEach((freq, i) => {
          const o = c.createOscillator();
          const g = c.createGain();
          o.type = 'sine';
          o.frequency.value = freq;
          g.gain.setValueAtTime(0.12, c.currentTime + i * 0.12);
          g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.12 + 0.3);
          o.connect(g).connect(c.destination);
          o.start(c.currentTime + i * 0.12);
          o.stop(c.currentTime + i * 0.12 + 0.3);
        });
      });
    },

    swoosh() {
      play(c => {
        const o = c.createOscillator();
        const g = c.createGain();
        const f = c.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.setValueAtTime(2000, c.currentTime);
        f.frequency.exponentialRampToValueAtTime(400, c.currentTime + 0.25);
        f.Q.value = 0.5;
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(600, c.currentTime);
        o.frequency.exponentialRampToValueAtTime(200, c.currentTime + 0.2);
        g.gain.setValueAtTime(0.12, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.25);
        o.connect(f).connect(g).connect(c.destination);
        o.start(); o.stop(c.currentTime + 0.25);
      });
    },

    roundStart() {
      play(c => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(400, c.currentTime);
        o.frequency.exponentialRampToValueAtTime(800, c.currentTime + 0.2);
        g.gain.setValueAtTime(0.1, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.25);
        o.connect(g).connect(c.destination);
        o.start(); o.stop(c.currentTime + 0.25);
      });
    }
  };
})();
