/** Hosts a stage plugin: runtime + 3D scene + HUD + hints + tutorial + result hand-off. */
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { useWorld } from '../../app/WorldHost';
import type { GameStore } from '../../application/stores/game';
import { applyPartialRound, applyRoundResult } from '../../domain/progression/progression';
import { createRng } from '../../domain/rng/rng';
import { pickPraise, praiseCategory } from '../../domain/scoring/praise';
import { PLAYABLE } from '../../domain/stage/types';
import { fmt, ko, PRAISE_POOL_SIZES, praiseText } from '../../i18n/ko';
import { audio } from '../../infra/audio/audio';
import type { HudView } from '../../stages/_shared/module';
import { createStageRuntime, type StageRuntime } from '../../stages/_shared/runtime';
import { type AnyStageModule, STAGE_LOADERS } from '../../stages/registry';
import { Button } from '../components/Button';
import { SpeakButton } from '../components/SpeakButton';
import { FeedbackOverlay } from '../hints/FeedbackOverlay';
import { HintPanel } from '../hints/HintPanel';
import { Tutorial } from './Tutorial';

/** Local calendar day number (the child's device clock, e.g. Asia/Seoul). */
const today = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60_000) / 86_400_000);

export function StageScreen({ store, reducedMotion }: { store: GameStore; reducedMotion: boolean }) {
  const api = useWorld();
  const selected = useStore(store, (s) => s.selected);
  const runId = useStore(store, (s) => s.runId);
  const [mod, setMod] = useState<AnyStageModule | null>(null);
  const [hud, setHud] = useState<HudView | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [praise, setPraise] = useState<string | null>(null);
  const [tutorial, setTutorial] = useState(false);
  const rtRef = useRef<StageRuntime<unknown, unknown> | null>(null);
  const praiseHistory = useRef<string[]>([]);

  useEffect(() => {
    let alive = true;
    void STAGE_LOADERS[selected]?.().then((m) => alive && setMod(m));
    return () => {
      alive = false;
    };
  }, [selected]);

  useEffect(() => {
    if (!api || !mod) return;
    const st = store.getState();
    const profile = st.profile;
    if (!profile) return;
    const seed = `${profile.id}-${runId}-${Date.now()}`;
    const init = mod.rules.init(seed, profile.adaptive.level, {
      shift: st.shift,
      day: today(),
      adaptive: profile.adaptive,
    });
    const rt = createStageRuntime(
      mod,
      api.world,
      init,
      { reducedMotion, shakeIntensity: profile.settings.shakeIntensity },
      (final) => {
        const result = mod.rules.summary(final);
        const outcome = applyRoundResult(
          store.getState().profile ?? profile,
          result,
          new Date().toISOString(),
          PLAYABLE,
        );
        // the child may have pressed "나가기" in the last 400 ms: then stay on the island
        window.setTimeout(() => {
          if (store.getState().screen === 'stage') store.getState().finishRound(result, outcome);
        }, 400);
      },
    );
    rtRef.current = rt as StageRuntime<unknown, unknown>;
    // test/automation hook (e2e plays rounds through the same action path as a child)
    (globalThis as { __stage?: unknown }).__stage = {
      runtime: rt,
      solveOne: () => {
        for (const a of mod.solution(rt.state)) rt.dispatch(a);
      },
    };
    api.setController(rt);
    audio.playBgm(mod.bgm, seed);
    audio.duck(true);
    let lastCorrect = init.core.correct;
    let lastHints = init.core.puzzleHints;
    let lastSig = '';
    const rng = createRng(seed);
    const update = (s: typeof init) => {
      // re-render the HUD only when something it shows changed (state changes every tick)
      const c = s.core;
      const sig = `${s.phase}|${c.asked?.question.key ?? ''}|${c.index}|${c.coins}|${c.correct}|${c.wrong}|${c.puzzleHints}|${(s as { puzzle?: unknown }).puzzle ? 1 : 0}|${(s as { undo?: unknown[] }).undo?.length ?? 0}|${(s as { slimes?: unknown[] }).slimes?.length ?? 0}`;
      if (sig !== lastSig) {
        lastSig = sig;
        setHud(mod.hud(s));
      }
      if (c.puzzleHints > lastHints) setHintOpen(true); // keyboard H / pad X opens the panel too
      lastHints = c.puzzleHints;
      if (s.core.correct > lastCorrect) {
        lastCorrect = s.core.correct;
        const cat = praiseCategory({
          correct: true,
          afterWrong: s.core.puzzleWrong > 0,
          hintsUsed: s.core.puzzleHints,
          streak: s.core.streak,
        });
        const id = pickPraise(cat, PRAISE_POOL_SIZES, praiseHistory.current, rng);
        praiseHistory.current = [...praiseHistory.current, id].slice(-16);
        setPraise(praiseText(id));
        setHintOpen(false);
        window.setTimeout(() => setPraise(null), 1400);
      }
    };
    update(init);
    const unsub = rt.subscribe(update);
    if (!profile.tutorialSeen[selected]) setTutorial(true);
    const offKeys = api.input.onAction((a) => {
      if (a !== 'cancel' || store.getState().screen !== 'stage') return;
      if (document.querySelector('[data-testid="hint-panel"]')) closeHintRef.current();
      else exitRef.current();
    });
    return () => {
      offKeys();
      unsub();
      audio.duck(false);
      api.setController(null);
      rtRef.current = null;
    };
  }, [api, mod, store, selected, runId, reducedMotion]);

  const exit = () => {
    audio.play('ui.back');
    const rt = rtRef.current as StageRuntime<{ phase: string }, unknown> | null;
    const p = store.getState().profile;
    // finished in the last moment: hand the full result over (the result screen shows it)
    if (rt && mod && p && rt.state.phase === 'done') {
      const result = mod.rules.summary(rt.state);
      store.getState().finishRound(result, applyRoundResult(p, result, new Date().toISOString(), PLAYABLE));
      return;
    }
    // keep what was learned in an unfinished round (P2: nothing is lost)
    if (rt && mod && p && rt.state.phase !== 'done') {
      store
        .getState()
        .setProfile(applyPartialRound(p, mod.rules.summary(rt.state), new Date().toISOString()));
    }
    store.getState().go('hub');
  };
  /** Closing the panel after step 4 (button, Esc or pad) always starts the new-numbers retry. */
  const closeHint = () => {
    setHintOpen(false);
    const rt = rtRef.current as StageRuntime<{ core: { puzzleHints: number } }, unknown> | null;
    if (mod && rt && rt.state.core.puzzleHints >= 4) rt.dispatch(mod.retryAction);
  };
  const closeHintRef = useRef(closeHint);
  closeHintRef.current = closeHint;
  const exitRef = useRef(exit);
  exitRef.current = exit;
  const finishTutorial = useCallback(() => {
    setTutorial(false);
    const p = store.getState().profile;
    if (p) store.getState().setProfile({ ...p, tutorialSeen: { ...p.tutorialSeen, [selected]: true } });
    if (rtRef.current) rtRef.current.locked = false;
  }, [store, selected]);

  if (!mod || !hud) return null;
  const q = hud.question;
  const core = hud.core;
  const openHint = () => {
    // a hint step is only spent when the panel is not already showing an unread step
    if (!hintOpen || core.puzzleHints === 0) rtRef.current?.dispatch(mod.hintAction);
    setHintOpen(true);
  };
  return (
    <div
      className="stage-hud"
      data-testid="stage"
      data-stage={selected}
      data-puzzle={core.index}
      data-phase={(rtRef.current?.state as { phase?: string } | undefined)?.phase}
    >
      <header className="hud-top">
        <Button onClick={exit} aria-label={ko.stageHud.exit} data-testid="exit">
          ✕ <span className="ml-1 text-xl">{ko.stageHud.exit}</span>
        </Button>
        <div
          className="pill"
          role="img"
          aria-label={fmt(ko.stageHud.progress, { i: core.index + 1, n: core.puzzles })}
          data-testid="progress"
        >
          {Array.from({ length: core.puzzles }, (_, i) => `p${i}`).map((key, i) => (
            <span
              key={key}
              aria-hidden="true"
              className={`dot ${i < core.index ? 'dot-done' : i === core.index ? 'dot-now' : ''}`}
            />
          ))}
        </div>
        <div className="pill" data-testid="stage-coins">
          <span aria-hidden="true">🪙</span> {core.coins}
        </div>
      </header>

      <section className="hud-goal card" data-testid="goal" aria-live="polite">
        <p className="question-main text-5xl">{hud.goal}</p>
        <SpeakButton text={hud.goal} />
      </section>

      <div className="hud-bottom">
        <Button tone="sun" onClick={openHint} disabled={!q} data-testid="hint" aria-keyshortcuts="H">
          💡 {ko.hint.button}
        </Button>
        {mod.undoAction && (
          <Button
            onClick={() => rtRef.current?.dispatch(mod.undoAction)}
            disabled={!hud.canUndo}
            data-testid="undo"
          >
            ↩ {ko.stageHud.undo}
          </Button>
        )}
      </div>

      {hud.stuck && (
        <p className="toast" data-testid="stuck">
          {ko.stageHud.stuck}
        </p>
      )}
      <AnimatePresence>
        {praise && (
          <motion.p
            key={praise}
            className="toast toast-good"
            data-testid="praise"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {praise}
          </motion.p>
        )}
      </AnimatePresence>
      {hud.wrong && q && !hintOpen && (
        <FeedbackOverlay
          key={`${core.wrong}`}
          q={q}
          given={hud.wrong.value}
          {...(hud.wrong.tag ? { tag: hud.wrong.tag } : {})}
          {...(hud.wrong.made !== undefined && hud.target !== undefined
            ? { made: hud.wrong.made, target: hud.target }
            : {})}
        />
      )}
      {hintOpen && q && core.puzzleHints > 0 && (
        <HintPanel
          q={q}
          level={core.puzzleHints}
          onMore={() => rtRef.current?.dispatch(mod.hintAction)}
          onClose={closeHint}
          pair={
            hud.hintMode === 'pair' && hud.target !== undefined
              ? { target: hud.target, op: hud.pairOp ?? '+' }
              : undefined
          }
        />
      )}
      {tutorial && rtRef.current && <Tutorial runtime={rtRef.current} mod={mod} onDone={finishTutorial} />}
    </div>
  );
}
