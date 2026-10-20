/** Stage plugin contract for the presentation layer (SPEC §6.4): pure rules + 3D scene + HUD hooks. */
import type { LevelId, Question } from '../../domain/edu/types';
import type { StageId, StageRules } from '../../domain/stage/types';
import type { RenderWorld } from '../../engine/world';
import type { BgmId } from '../../infra/audio/bgm';
import type { PointerInfo } from '../../scenes/common/controller';
import type { RoundCore, RoundOptions } from './round';

export interface StageCtx {
  reducedMotion: boolean;
  shakeIntensity: number;
}

export interface StageScene<S, A> {
  /** Called every frame with the latest state (and the previous one, to fire one-shot effects). */
  sync(state: S, prev: S | null, dt: number): void;
  /** Pointer → actions (stages with drag keep their own gesture state). */
  pointer(p: PointerInfo, state: S, emit: (a: A) => void): void;
  /** Screen position (NDC) of a keyboard/tutorial target. */
  screenPos(state: S, targetId: number): { x: number; y: number } | null;
  /** Keyboard cursor highlight (null = none). */
  setCursor(targetId: number | null, held: number | null): void;
  /** Hint step ≥3 in "pair" puzzles: make one correct item glow (null = none). */
  setGlow?(targetId: number | null): void;
  dispose(): void;
}

export interface KeyboardSpec<S, A> {
  /** Ordered selectable targets for ← → navigation. */
  targets(state: S): number[];
  /** Confirm on a target; `held` is a first-step selection (e.g. slime to drag). */
  confirm(state: S, target: number, held: number | null): { action?: A; hold?: number | null };
}

/** What the HUD needs from any stage state. */
export interface HudView {
  core: RoundCore;
  question: Question | null;
  /** Short goal line, e.g. "🎯 13" / "□ + 5 = 13". */
  goal: string;
  /** Ask the HUD to suggest undo (slime dead end). */
  stuck?: boolean;
  /** Wrong-try feedback to show (changes identity per try). */
  wrong: { value: number; tag?: string } | null;
  /** Something good just happened (praise toast). */
  success: boolean;
  canUndo?: boolean;
  /**
   * 'pair': the child must *find* the operands (fishing sum/diff, bomb). The hint ladder then shows the
   * target, a strategy and a glowing item — never the operands themselves.
   */
  hintMode?: 'standard' | 'pair';
  target?: number;
  pairOp?: '+' | '-';
}

export interface StageModule<S extends { phase: string; core: RoundCore }, A> {
  id: StageId;
  rules: StageRules<S, A> & { init(seed: number | string, level: LevelId, opts?: RoundOptions): S };
  bgm: BgmId;
  createScene(world: RenderWorld, ctx: StageCtx): StageScene<S, A>;
  keyboard: KeyboardSpec<S, A>;
  hud(state: S): HudView;
  /** Actions that solve the current puzzle (tutorial ghost hand + bots). */
  solution(state: S): A[];
  hintAction: A;
  /** One correct item to glow at hint step 3+ (pair puzzles). */
  glowTarget?(state: S): number | null;
  undoAction?: A;
}
