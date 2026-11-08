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
  /** Gift toys the child already has (bomb shelf); the next one is the reward for finishing this round. */
  toys?: readonly string[];
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
  wrong: { value: number; made?: number; tag?: string } | null;
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
  /** A big one-tap key the child should press now (e.g. "감아요!"), with dots for the presses left. */
  primary?: { label: string; left: number; off?: boolean };
  /** The friend says this (speech bubble + read-aloud); spoken again only when `key` changes. */
  say?: { key: string; text: string };
  /** Scene-change card (iris wipe + big title) while `key` is the same. */
  cut?: { key: string; title: string };
  /** Big on-screen toggle keys (e.g. + / −); the stage maps an id to an action with `toggleAction`. */
  toggles?: { id: string; label: string; on: boolean }[];
  /** Step guide: 0 find, 1 think, 2 pick; `found`/`need` for the find step. */
  steps?: { at: 0 | 1 | 2; found: number; need: number };
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
  /** Dispatched when the child closes hint step 4: same kind of puzzle, new numbers. */
  retryAction: A;
  /** One correct item to glow at hint step 3+ (pair puzzles). */
  glowTarget?(state: S): number | null;
  undoAction?: A;
  /** Ids picked so far, in order (their numbers fly into the goal's ? boxes). */
  picks?(state: S): readonly number[];
  pickValue?(state: S, id: number): number | undefined;
  /** The action for a HUD toggle key. */
  toggleAction?(id: string): A;
  /** Dispatched by the HUD's big `primary` key. */
  primaryAction?: A;
  /**
   * A scene point (a `screenPos` id) the toggle keys sit under — e.g. just below the child's cards. The
   * primary key then joins the same row; without it the toggles stay in the bottom-left corner.
   */
  toggleAnchor?: number;
  /** 'top': the praise toast shows just under the goal (when the middle of the scene holds numbers). */
  praiseSpot?: 'top';
}
