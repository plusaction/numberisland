/** Hosts a stage plugin: runtime + 3D scene + HUD + hints + tutorial + result hand-off. */
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { useWorld } from '../../app/WorldHost';
import { SESSION, type SessionEvent, type SessionState, sessionFlags } from '../../application/machines';
import type { GameStore } from '../../application/stores/game';
import { next } from '../../domain/fsm';
import { applyPartialRound, applyRoundResult } from '../../domain/progression/progression';
import { createRng } from '../../domain/rng/rng';
import { pickPraise, praiseCategory } from '../../domain/scoring/praise';
import { PLAYABLE } from '../../domain/stage/types';
import { fmt, ko, PRAISE_POOL_SIZES, praiseText } from '../../i18n/ko';
import { audio } from '../../infra/audio/audio';
import { stopSpeaking } from '../../infra/tts/tts';
import type { HudView } from '../../stages/_shared/module';
import { createStageRuntime, type StageRuntime } from '../../stages/_shared/runtime';
import { type AnyStageModule, STAGE_LOADERS } from '../../stages/registry';
import { Button } from '../components/Button';
import { FeedbackOverlay } from '../hints/FeedbackOverlay';
import { HintBody, HintPanel } from '../hints/HintPanel';
import { RaceBar, RoomCut, SayBubble, StepGuide } from '../hud/StageGuide';
import { ChoiceCross } from '../question/ChoiceCross';
import { flyToGoal } from '../question/flyToGoal';
import { GoalTiles } from '../question/GoalTiles';
import { Tutorial } from './Tutorial';

/** Local calendar day number (the child's device clock, e.g. Asia/Seoul). */
const today = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60_000) / 86_400_000);

export function StageScreen({ store, reducedMotion }: { store: GameStore; reducedMotion: boolean }) {
  const api = useWorld();
  const selected = useStore(store, (s) => s.selected);
  const runId = useStore(store, (s) => s.runId);
  const voice = useStore(store, (s) => s.profile?.settings.tts ?? false);
  const [mod, setMod] = useState<AnyStageModule | null>(null);
  const [hud, setHud] = useState<HudView | null>(null);
  const [praise, setPraise] = useState<string | null>(null);
  const [finale, setFinale] = useState(false);
  const sessionRef = useRef<SessionState>(SESSION.initial);
  // one explicit state for the sitting (tutorial / playing / hint / finished) instead of loose flags
  const [session, send] = useReducer(
    (st: SessionState, ev: SessionEvent) => next(SESSION, st, ev),
    SESSION.initial,
  );
  const rtRef = useRef<StageRuntime<unknown, unknown> | null>(null);
  const praiseHistory = useRef<string[]>([]);
  const togglesRef = useRef<HTMLDivElement | null>(null);
  /** The toggle key just pressed (flash + burst); `n` restarts the burst on every press. */
  const [pop, setPop] = useState<{ id: string; n: number } | null>(null);
  useEffect(() => {
    if (!pop) return;
    const t = window.setTimeout(() => setPop(null), 450);
    return () => window.clearTimeout(t);
  }, [pop]);
  const anchor = mod?.toggleAnchor;

  // toggle keys that belong to a 3D spot (card battle: under the hand) follow it on screen
  useEffect(() => {
    if (anchor === undefined) return;
    const place = () => {
      const el = togglesRef.current;
      const p = rtRef.current?.screenPos(anchor);
      const box = el?.offsetParent?.getBoundingClientRect();
      if (!el || !p || !box) return;
      el.style.setProperty('--ax', `${((p.x + 1) / 2) * window.innerWidth - box.left}px`);
      el.style.setProperty('--ay', `${((1 - p.y) / 2) * window.innerHeight - box.top}px`);
    };
    place();
    const timer = window.setInterval(place, 250);
    window.addEventListener('resize', place);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', place);
    };
  }, [anchor]);

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
      ...(st.shift === -1 && selected === 'bomb' ? { easyStep: st.easyStep ?? profile.bombEasyStep } : {}),
      term: profile.settings.term,
      day: today(),
      adaptive: profile.adaptive,
    });
    const rt = createStageRuntime(
      mod,
      api.world,
      init,
      { reducedMotion, shakeIntensity: profile.settings.shakeIntensity, toys: profile.toys },
      (final) => {
        send('round.done');
        const result = mod.rules.summary(final);
        const outcome = applyRoundResult(
          store.getState().profile ?? profile,
          result,
          new Date().toISOString(),
          PLAYABLE,
          new Date().getTimezoneOffset(),
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
      // for coding agents and tests: where the stage is and whether it takes input right now
      info: () => ({
        stage: mod.id,
        phase: rt.state.phase,
        acceptsInput: mod.phases[rt.state.phase]?.input === true && !rt.locked,
        next: mod.phases[rt.state.phase]?.to ?? [],
        session: sessionRef.current,
      }),
    };
    api.setController(rt);
    audio.playBgm(mod.bgm, seed);
    audio.duck(true);
    let lastCorrect = init.core.correct;
    let lastHints = init.core.puzzleHints;
    let lastSig = '';
    let praiseTimer = 0;
    let lastPicks = mod.picks?.(init)?.length ?? 0;
    const rng = createRng(seed);
    const update = (s: typeof init) => {
      // re-render the HUD only when something it shows changed (state changes every tick)
      const c = s.core;
      const sig = `${s.phase}|${c.asked?.question.key ?? ''}|${c.index}|${c.coins}|${c.correct}|${c.wrong}|${c.puzzleHints}|${mod.hudKey(s)}`;
      if (sig !== lastSig) {
        lastSig = sig;
        setHud(mod.hud(s));
        setFinale(!!mod.finale?.(s));
      }
      // a picked number flies from the 3D thing into its ? box (bomb wires)
      const picks = mod.picks?.(s);
      if (picks && picks.length > lastPicks && !reducedMotion) {
        const id = picks[picks.length - 1] as number;
        const from = rt.screenPos(id);
        const value = mod.pickValue?.(s, id);
        if (from && value !== undefined)
          requestAnimationFrame(() => requestAnimationFrame(() => flyToGoal(from, String(value))));
      }
      lastPicks = picks?.length ?? 0;
      if (c.puzzleHints > lastHints) send('hint.open'); // keyboard H / pad X opens the panel too
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
        setPraise(mod.praise?.(s) ?? praiseText(id));
        send('hint.close');
        // one timer at a time: a quick second right answer must not have its praise cut short by the first
        window.clearTimeout(praiseTimer);
        praiseTimer = window.setTimeout(() => setPraise(null), 1400);
      }
    };
    update(init);
    const unsub = rt.subscribe(update);
    send(profile.tutorialSeen[selected] ? 'start' : 'start.tutorial');
    const offKeys = api.input.onAction((a) => {
      if (a !== 'cancel' || store.getState().screen !== 'stage') return;
      if (document.querySelector('[data-testid="hint-panel"]')) closeHintRef.current();
      else exitRef.current();
    });
    return () => {
      offKeys();
      unsub();
      window.clearTimeout(praiseTimer);
      setPraise(null);
      stopSpeaking(); // the friend's line stops with the stage
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
      store
        .getState()
        .finishRound(
          result,
          applyRoundResult(p, result, new Date().toISOString(), PLAYABLE, new Date().getTimezoneOffset()),
        );
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
    send('hint.close');
    const rt = rtRef.current as StageRuntime<{ core: { puzzleHints: number } }, unknown> | null;
    if (mod && rt && rt.state.core.puzzleHints >= 4) rt.dispatch(mod.retryAction);
  };
  const closeHintRef = useRef(closeHint);
  closeHintRef.current = closeHint;
  const exitRef = useRef(exit);
  exitRef.current = exit;
  const finishTutorial = useCallback(() => {
    send('tutorial.done');
    const p = store.getState().profile;
    if (p) store.getState().setProfile({ ...p, tutorialSeen: { ...p.tutorialSeen, [selected]: true } });
  }, [store, selected]);

  // what the session state means for the runtime: input lock (tutorial) and pause (hint in real-time stages)
  sessionRef.current = session;
  const flags = sessionFlags(session, !!mod?.realtime);
  const { hintPanel: hintOpen, tutorial } = flags;
  useEffect(() => {
    const rt = rtRef.current;
    if (!rt) return;
    rt.locked = flags.inputLocked;
    rt.paused = flags.simPaused;
  }, [flags.inputLocked, flags.simPaused]);

  if (!mod || !hud) return null;
  const q = hud.question;
  const core = hud.core;
  const openHint = () => {
    // a hint step is only spent when the panel is not already showing an unread step
    if (!hintOpen || core.puzzleHints === 0) rtRef.current?.dispatch(mod.hintAction);
    send('hint.open');
  };
  const anchored = anchor !== undefined;
  const primaryKey = hud.primary && mod.primaryAction && (
    <Button
      tone="sea"
      className={`hud-primary${hud.primary.off ? ' primary-off' : ''}`}
      onClick={() => rtRef.current?.dispatch(mod.primaryAction)}
      disabled={hud.primary.off === true}
      data-testid="primary"
      aria-keyshortcuts="Space"
    >
      {hud.primary.label}
      <span className="primary-dots" aria-hidden="true">
        {['a', 'b', 'c', 'd', 'e'].slice(0, hud.primary.left).map((k) => (
          <span key={k} />
        ))}
      </span>
    </Button>
  );
  return (
    <div
      className={`stage-hud${hud.cross ? ' has-cross' : ''}${hintOpen && core.puzzleHints > 0 ? ' hint-open' : ''}`}
      data-testid="stage"
      data-stage={selected}
      data-session={session}
      data-puzzle={core.index}
      data-phase={(rtRef.current?.state as { phase?: string } | undefined)?.phase}
    >
      <header className="hud-top">
        <Button onClick={exit} aria-label={ko.stageHud.exit} data-testid="exit">
          ✕ <span className="hide-narrow ml-1 text-xl">{ko.stageHud.exit}</span>
        </Button>
        <div
          className={`pill${core.puzzles > 9 ? ' dots-many' : ''}`}
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
        {finale && (
          <p className="finale-ribbon" data-testid="finale">
            {selected === 'cardbattle' ? ko.stageHud.matchPoint : ko.stageHud.finale}
          </p>
        )}
        <GoalTiles goal={hud.goal} />
        {hud.steps && <StepGuide steps={hud.steps} />}
        {hud.race && <RaceBar race={hud.race} />}
        {/* two misses on one puzzle: the picture comes by itself (no hint is spent) */}
        {q && core.puzzleWrong >= 2 && !hintOpen && !tutorial && hud.hintMode !== 'pair' && (
          <div className="auto-help" data-testid="auto-help">
            <p className="auto-help-title">{ko.stageHud.countTogether}</p>
            <HintBody q={q} level={1} />
          </div>
        )}
        {/* praise hangs right under the goal box: never over the numbers in the scene */}
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
      </section>
      {hud.say && !tutorial && <SayBubble say={hud.say} voice={voice} />}
      {hud.toggles && mod.toggleAction && (
        <div ref={togglesRef} className={`hud-toggles${anchored ? ' anchored' : ''}`} data-testid="toggles">
          {hud.toggles.map((tg) => (
            <button
              key={tg.id}
              type="button"
              aria-pressed={tg.on}
              data-testid={`toggle-${tg.id}`}
              className={`toy-btn toggle-key key-sea${pop?.id === tg.id ? ' toggle-pop' : ''}`}
              onClick={() => {
                if (mod.toggleAction) rtRef.current?.dispatch(mod.toggleAction(tg.id));
                setPop((p) => ({ id: tg.id, n: (p?.n ?? 0) + 1 }));
              }}
            >
              {tg.label}
              {pop?.id === tg.id && <span key={pop.n} className="toggle-burst" aria-hidden="true" />}
            </button>
          ))}
          {anchored && primaryKey}
        </div>
      )}
      {hud.cross && mod.crossAction && (
        <div className="hud-cross">
          <ChoiceCross
            choices={hud.cross.choices}
            dim={hud.cross.tried}
            disabled={hud.cross.off}
            keys={false}
            shake={hud.cross.tried.at(-1) ?? null}
            onPick={(v) => mod.crossAction && rtRef.current?.dispatch(mod.crossAction(v))}
          />
        </div>
      )}
      {hud.cut && <RoomCut cut={hud.cut} />}

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

      {!(anchored && hud.toggles) && primaryKey}
      {hud.stuck && (
        <p className="toast" data-testid="stuck">
          {ko.stageHud.stuck}
        </p>
      )}
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
