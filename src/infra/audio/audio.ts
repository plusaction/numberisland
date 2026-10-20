/**
 * Web Audio engine (SPEC §8.2): master limiter (no clipping), BGM/SFX/voice buses with separate volumes,
 * AudioWorklet monster voices, procedural BGM with ducking. Unlocked on the first user gesture.
 */
import { BGM_PRESETS, type BgmId, generatePattern, midiToFreq } from './bgm';
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
    const preset = BGM_PRESETS[id];
    const pattern = generatePattern(id, seed);
    const stepDur = 60 / preset.bpm / 4;
    let step = 0;
    let next = this.ctx.currentTime + 0.1;
    const schedule = () => {
      const ctx = this.ctx;
      if (!ctx) return;
      // after a throttled timer (background tab), skip missed steps instead of firing them all at once
      if (next < ctx.currentTime) next = ctx.currentTime + 0.02;
      while (next < ctx.currentTime + 0.25) {
        const s = pattern[step % pattern.length];
        const swing = step % 2 === 1 ? preset.swing * stepDur : 0;
        if (s?.lead)
          this.note(
            { at: swing, freq: midiToFreq(s.lead), dur: stepDur * 1.6, wave: preset.lead, gain: 0.16 },
            next,
            1,
            this.bus.bgm,
          );
        if (s?.bass)
          this.note(
            { at: 0, freq: midiToFreq(s.bass), dur: stepDur * 3, wave: preset.bass, gain: 0.22 },
            next,
            1,
            this.bus.bgm,
          );
        if (s?.hat)
          this.note(
            { at: swing, freq: 8000, dur: 0.03, wave: 'sine', gain: 0.05, noise: true },
            next,
            1,
            this.bus.bgm,
          );
        next += stepDur;
        step++;
      }
    };
    schedule();
    this.bgmTimer = setInterval(schedule, 60);
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
