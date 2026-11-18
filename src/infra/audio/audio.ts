/**
 * Web Audio engine (SPEC §8.2): master limiter (no clipping), BGM/SFX/voice buses with separate volumes,
 * AudioWorklet monster voices, procedural BGM with ducking. Unlocked on the first user gesture.
 */
import { type BgmEvent, type BgmId, expandSong, midiToFreq, songTiming } from './bgm';
import { type Note, SFX, type SfxId } from './sfx';

export interface Volumes {
  bgm: number;
  sfx: number;
  voice: number;
}

export interface VoiceParams {
  pitch: number;
  vibrato: number;
  syllables: number;
  dur: number;
  kind?: 'voice' | 'squeak';
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private bus!: Record<keyof Volumes, GainNode>;
  private duckGain!: GainNode;
  private noise: AudioBuffer | null = null;
  private voiceNode: AudioWorkletNode | null = null;
  private bgmTimer: ReturnType<typeof setInterval> | null = null;
  private bgmId: BgmId | null = null;
  private volumes: Volumes = { bgm: 0.5, sfx: 0.8, voice: 0.8 };
  muted = false;
  /** Counts played SFX (debug HUD / tests). */
  played = 0;

  get unlocked(): boolean {
    return this.ctx?.state === 'running';
  }

  /** Call from a user gesture. Safe to call many times. */
  async unlock(): Promise<void> {
    if (!this.ctx) {
      const Ctor = globalThis.AudioContext;
      if (!Ctor) return;
      const ctx = new Ctor({ latencyHint: 'interactive' });
      this.ctx = ctx;
      // resume inside the user gesture (iOS Safari loses activation after the first await)
      void ctx.resume();
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) void ctx.suspend();
        else void ctx.resume();
      });
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.knee.value = 4;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.15;
      this.master = ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(limiter).connect(ctx.destination);
      this.duckGain = ctx.createGain();
      this.duckGain.connect(this.master);
      this.bus = {
        bgm: ctx.createGain(),
        sfx: ctx.createGain(),
        voice: ctx.createGain(),
      };
      this.bus.bgm.connect(this.duckGain);
      this.bus.sfx.connect(this.master);
      this.bus.voice.connect(this.master);
      this.applyVolumes();
      const len = ctx.sampleRate;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      try {
        await ctx.audioWorklet.addModule(
          new URL(`${import.meta.env.BASE_URL}voice-worklet.js`, location.href),
        );
        this.voiceNode = new AudioWorkletNode(ctx, 'voice-processor', { outputChannelCount: [2] });
        this.voiceNode.connect(this.bus.voice);
      } catch (err) {
        console.warn('[audio] worklet unavailable, voices use oscillators', err);
      }
    }
    const state = this.ctx.state as string;
    if (state !== 'running') await this.ctx.resume();
  }

  setVolumes(v: Partial<Volumes>) {
    this.volumes = { ...this.volumes, ...v };
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const m = this.muted ? 0 : 1;
    this.bus.bgm.gain.value = this.volumes.bgm * 0.35 * m;
    this.bus.sfx.gain.value = this.volumes.sfx * m;
    this.bus.voice.gain.value = this.volumes.voice * m;
  }

  play(id: SfxId, opts: { pitch?: number; delay?: number } = {}) {
    const ctx = this.ctx;
    if (ctx?.state !== 'running') return;
    this.played++;
    // ±3% random detune so repeated sounds don't fatigue (SOUND_LIST mixing rule)
    const pitch = (opts.pitch ?? 1) * (0.97 + Math.random() * 0.06);
    const t0 = ctx.currentTime + (opts.delay ?? 0) + 0.005;
    for (const n of SFX[id]) this.note(n, t0, pitch, this.bus.sfx);
  }

  private note(n: Note, t0: number, pitch: number, out: AudioNode) {
    const ctx = this.ctx as AudioContext;
    const start = t0 + n.at;
    const end = start + n.dur;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(n.gain, start + Math.min(0.015, n.dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    g.connect(out);
    if (n.noise && this.noise) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = n.freq * pitch;
      bp.Q.value = 1.2;
      src.connect(bp).connect(g);
      src.start(start, Math.random() * 0.5);
      src.stop(end + 0.02);
      return;
    }
    const osc = ctx.createOscillator();
    osc.type = n.wave;
    osc.frequency.setValueAtTime(n.freq * pitch, start);
    if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to * pitch, end);
    osc.connect(g);
    osc.start(start);
    osc.stop(end + 0.02);
  }

  /** Monster voice / squeak through the AudioWorklet (oscillator fallback). */
  voice(p: VoiceParams) {
    if (this.ctx?.state !== 'running') return;
    if (this.voiceNode) {
      this.voiceNode.port.postMessage({ type: 'say', ...p, kind: p.kind ?? 'voice' });
      return;
    }
    const t0 = this.ctx.currentTime + 0.01;
    const syl = Math.max(1, p.syllables);
    for (let i = 0; i < syl; i++) {
      this.note(
        {
          at: (i * p.dur) / syl,
          freq: p.pitch,
          to: p.pitch * 1.25,
          dur: (p.dur / syl) * 0.9,
          wave: 'triangle',
          gain: 0.2,
        },
        t0,
        1,
        this.bus.voice,
      );
    }
  }

  playBgm(id: BgmId, seed: number | string = 0) {
    if (!this.ctx) return;
    if (this.bgmId === id && this.bgmTimer) return;
    this.stopBgm();
    this.bgmId = id;
    const events = expandSong(id, seed);
    const { loop, stepDur, swing } = songTiming(id);
    let loopStart = this.ctx.currentTime + 0.1;
    let i = 0;
    const schedule = () => {
      const ctx = this.ctx;
      if (!ctx) return;
      // after a throttled timer (background tab), start the loop fresh instead of firing missed notes
      if (loopStart + (events[i]?.step ?? loop) * stepDur < ctx.currentTime - 0.1) {
        loopStart = ctx.currentTime + 0.05;
        i = 0;
      }
      const horizon = ctx.currentTime + 0.3;
      for (;;) {
        if (i >= events.length) {
          i = 0;
          loopStart += loop * stepDur;
        }
        const ev = events[i] as (typeof events)[number];
        const at = loopStart + ev.step * stepDur + (ev.step % 2 === 1 ? swing * stepDur : 0);
        if (at > horizon) break;
        this.instrument(ev, at, stepDur);
        i++;
      }
    };
    schedule();
    this.bgmTimer = setInterval(schedule, 80);
  }

  /** One BGM sound: the instrument's oscillators, envelope and filter (all short-lived nodes). */
  private instrument(ev: BgmEvent, at: number, stepDur: number) {
    const ctx = this.ctx as AudioContext;
    const out = this.bus.bgm;
    const f = midiToFreq(ev.midi);
    const len = ev.len * stepDur;
    const env = (g: GainNode, peak: number, attack: number, hold: number, release: number) => {
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
      g.gain.setValueAtTime(Math.max(0.0002, peak), at + attack + hold);
      g.gain.exponentialRampToValueAtTime(0.0001, at + attack + hold + release);
      return at + attack + hold + release + 0.02;
    };
    const osc = (type: OscillatorType, freq: number, dest: AudioNode, stop: number, detune = 0) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq, at);
      o.detune.value = detune;
      o.connect(dest);
      o.start(at);
      o.stop(stop);
      return o;
    };
    const lowpass = (freq: number, q = 0.7) => {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = freq;
      lp.Q.value = q;
      return lp;
    };
    const noise = (filter: BiquadFilterType, freq: number, peak: number, dur: number, q = 1) => {
      if (!this.noise) return;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const bp = ctx.createBiquadFilter();
      bp.type = filter;
      bp.frequency.value = freq;
      bp.Q.value = q;
      const g = ctx.createGain();
      const stop = env(g, peak, 0.002, 0, dur);
      src.connect(bp).connect(g).connect(out);
      src.start(at, Math.random() * 0.5);
      src.stop(stop);
    };
    const g = ctx.createGain();
    switch (ev.inst) {
      case 'pluck': {
        const lp = lowpass(2600);
        lp.frequency.setValueAtTime(3400, at);
        lp.frequency.exponentialRampToValueAtTime(900, at + 0.25);
        g.connect(lp).connect(out);
        const stop = env(g, ev.gain, 0.004, 0, Math.min(0.45, len + 0.15));
        osc('triangle', f, g, stop);
        // a little bite on the attack
        const bite = ctx.createGain();
        bite.gain.value = 0.3;
        bite.connect(g);
        osc('square', f, bite, stop, 4);
        return;
      }
      case 'bell': {
        g.connect(out);
        const stop = env(g, ev.gain, 0.003, 0, Math.max(0.6, len * 1.4));
        osc('sine', f, g, stop);
        const g2 = ctx.createGain();
        g2.gain.value = 0.25;
        g2.connect(g);
        osc('sine', f * 2.76, g2, stop); // the glassy partial
        return;
      }
      case 'marimba': {
        g.connect(out);
        const stop = env(g, ev.gain, 0.002, 0, 0.35);
        osc('sine', f, g, stop);
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.5, at);
        g2.gain.exponentialRampToValueAtTime(0.001, at + 0.05);
        g2.connect(g);
        osc('sine', f * 4, g2, stop); // the wooden knock
        return;
      }
      case 'pad': {
        const lp = lowpass(1100);
        g.connect(lp).connect(out);
        const stop = env(g, ev.gain, Math.min(0.35, len * 0.3), Math.max(0, len - 0.4), 0.5);
        osc('sawtooth', f, g, stop, -7);
        osc('sawtooth', f, g, stop, 7);
        return;
      }
      case 'organ': {
        const lp = lowpass(1900);
        g.connect(lp).connect(out);
        const stop = env(g, ev.gain, 0.01, Math.max(0, len - 0.05), 0.08);
        osc('square', f, g, stop, -5);
        osc('square', f * 2, g, stop, 5);
        return;
      }
      case 'lead': {
        const lp = lowpass(2400);
        g.connect(lp).connect(out);
        const stop = env(g, ev.gain, 0.01, Math.max(0, len - 0.06), 0.12);
        const o = osc('square', f, g, stop);
        // a gentle vibrato on long notes
        if (len > 0.3) {
          const lfo = ctx.createOscillator();
          lfo.frequency.value = 5.5;
          const depth = ctx.createGain();
          depth.gain.value = f * 0.008;
          lfo.connect(depth).connect(o.frequency);
          lfo.start(at + 0.15);
          lfo.stop(stop);
        }
        return;
      }
      case 'bass': {
        const lp = lowpass(700);
        g.connect(lp).connect(out);
        const stop = env(g, ev.gain, 0.006, Math.max(0, len * 0.6), 0.12);
        osc('triangle', f, g, stop);
        osc('sine', f / 2, g, stop);
        return;
      }
      case 'wobble': {
        const lp = lowpass(400, 6);
        lp.frequency.setValueAtTime(1400, at);
        lp.frequency.exponentialRampToValueAtTime(260, at + Math.min(0.4, len));
        g.connect(lp).connect(out);
        const stop = env(g, ev.gain, 0.006, Math.max(0, len * 0.5), 0.1);
        const o = osc('square', f * 1.06, g, stop);
        o.frequency.exponentialRampToValueAtTime(f, at + 0.08); // the boing: slides down into the note
        return;
      }
      case 'kick': {
        g.connect(out);
        const stop = env(g, ev.gain, 0.002, 0, 0.22);
        const o = osc('sine', 130, g, stop);
        o.frequency.exponentialRampToValueAtTime(42, at + 0.16);
        return;
      }
      case 'snare':
        noise('bandpass', 2000, ev.gain, 0.13, 0.8);
        g.connect(out);
        osc('triangle', 190, g, env(g, ev.gain * 0.6, 0.002, 0, 0.08));
        return;
      case 'clap':
        for (const k of [0, 0.012, 0.024]) {
          const t = at + k;
          if (!this.noise) break;
          const src = ctx.createBufferSource();
          src.buffer = this.noise;
          const bp = lowpass(2600, 0.5);
          const cg = ctx.createGain();
          cg.gain.setValueAtTime(ev.gain, t);
          cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
          src.connect(bp).connect(cg).connect(out);
          src.start(t, Math.random() * 0.5);
          src.stop(t + 0.1);
        }
        return;
      case 'hat':
        noise('highpass', 7500, ev.gain, 0.04);
        return;
      case 'shaker':
        noise('bandpass', 6000, ev.gain, 0.07, 1.5);
        return;
      case 'tick': {
        g.connect(out);
        osc('sine', 2400, g, env(g, ev.gain, 0.001, 0, 0.03));
        return;
      }
    }
  }

  stopBgm() {
    if (this.bgmTimer) clearInterval(this.bgmTimer);
    this.bgmTimer = null;
    this.bgmId = null;
  }

  /** Lower BGM while the child is solving (SPEC §8.2). */
  duck(on: boolean) {
    if (!this.ctx) return;
    this.duckGain.gain.setTargetAtTime(on ? 0.45 : 1, this.ctx.currentTime, 0.15);
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.applyVolumes();
  }
}

export const audio = new AudioEngine();
