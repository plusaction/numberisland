// AudioWorklet: tiny formant-ish "monster voice" + squeak generator (SPEC §8.2).
// Parameters arrive via port messages: { type:'say', pitch, vibrato, syllables, dur, kind }
class VoiceProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.events = [];
    this.phase = 0;
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d && d.type === 'say') this.events.push({ ...d, t: 0 });
    };
  }
  process(_inputs, outputs) {
    const out = outputs[0][0];
    if (!out) return true;
    const sr = sampleRate;
    for (let i = 0; i < out.length; i++) {
      let s = 0;
      for (const ev of this.events) {
        const t = ev.t;
        if (t >= ev.dur) continue;
        const syl = Math.max(1, ev.syllables | 0);
        const sylLen = ev.dur / syl;
        const local = (t % sylLen) / sylLen;
        const env = Math.sin(Math.PI * Math.min(1, local * 1.15)) ** 1.5;
        const bend = ev.kind === 'squeak' ? 1 + local * 0.9 : 1 + 0.25 * Math.sin(local * Math.PI);
        const f = ev.pitch * bend * (1 + ev.vibrato * Math.sin(2 * Math.PI * 6 * t));
        ev.ph = (ev.ph || 0) + f / sr;
        const x = ev.ph % 1;
        // soft pulse + sine blend → friendly buzzy voice
        const tone =
          0.6 * Math.sin(2 * Math.PI * x) + 0.25 * (x < 0.3 ? 1 : -0.4) + 0.15 * Math.sin(4 * Math.PI * x);
        s += tone * env * 0.22;
        ev.t += 1 / sr;
      }
      out[i] = Math.max(-0.9, Math.min(0.9, s));
    }
    this.events = this.events.filter((ev) => ev.t < ev.dur);
    for (let c = 1; c < outputs[0].length; c++) outputs[0][c].set(out);
    return true;
  }
}
registerProcessor('voice-processor', VoiceProcessor);
