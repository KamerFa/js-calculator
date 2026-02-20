let audioCtx = null;

export function initMessageSoundContext() {
  if (!audioCtx) {
    try { audioCtx = new AudioContext(); } catch { /* ignore */ }
  }
}

export function playMessageSound() {
  if (localStorage.getItem('msg_sound_muted') === '1') return;
  try {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const tone = (freq, start, dur) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.start(start);
      osc.stop(start + dur);
    };
    tone(523, now, 0.15);       // C5
    tone(659, now + 0.1, 0.2);  // E5 — gentle two-note ascending "pop"
  } catch { /* ignore */ }
}
