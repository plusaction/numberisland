/** Hub overlay (SPEC §10): info card, stage arrows, next-reward bar, coins/trophies, random adventure. */
import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { useWorld } from '../../app/WorldHost';
import type { GameStore } from '../../application/stores/game';
import { stageBadges } from '../../domain/badges';
import { BALANCE } from '../../domain/balance';
import {
  DECOR,
  dailyCourse,
  dailyDone,
  dayKey,
  decorOpen,
  feedFriend,
  friendStage,
  nextDecorAt,
  snacksLeft,
} from '../../domain/meta';
import type { Profile } from '../../domain/profile';
import { rankFor, recommendedStage } from '../../domain/progression/progression';
import { restDue } from '../../domain/rest';
import { STAGE_SKILLS } from '../../domain/stage/catalog';
import { PLAYABLE, STAGE_GROUP, STAGE_IDS, STAGE_PLAYERS, type StageId } from '../../domain/stage/types';
import { fmt, ko } from '../../i18n/ko';
import { audio } from '../../infra/audio/audio';
import { createIsland, type IslandController, type IslandMeta } from '../../scenes/island/island';
import { Button } from '../components/Button';
import { ProgressBar } from '../components/ProgressBar';
import { SettingsSheet } from '../components/SettingsSheet';
import { SpeakButton } from '../components/SpeakButton';
import { Stars } from '../components/Stars';

/** When play (or the last rest reminder) started in this visit — the reminder is per sitting, not saved. */
let restSince = performance.now();

/** What the island shows of the profile: star pennants, open decorations, how big the friend is. */
function islandMeta(p: Profile): IslandMeta {
  const stars: IslandMeta['stars'] = {};
  for (const s of STAGE_IDS) stars[s] = p.stageStats[s].stars;
  return { stars, decor: decorOpen(p.economy.coins), friendStage: friendStage(p.friendFed) };
}

const ORDER: StageId[] = ['bomb', 'zombie', 'fishing', 'slime', 'escape', 'pizza', 'cardbattle', 'race'];

export function HubScreen({
  store,
  reducedMotion,
  quiet = false,
}: {
  store: GameStore;
  reducedMotion: boolean;
  /** Keep the 3D island alive but hide the hub's own UI and ignore input (the intro card is on top). */
  quiet?: boolean;
}) {
  const api = useWorld();
  const profile = useStore(store, (s) => s.profile);
  const selected = useStore(store, (s) => s.selected);
  const shift = useStore(store, (s) => s.shift);
  const pickedStep = useStore(store, (s) => s.easyStep);
  const easyStep = pickedStep ?? profile?.bombEasyStep ?? 1;
  const islandRef = useRef<IslandController | null>(null);
  const fruits = profile ? Object.values(profile.adaptive.mastery).filter((m) => m >= 0.85).length : 0;

  const [settingsOpen, setSettingsOpen] = useState(false);
  // while the settings sheet is open the island ignores keys and taps
  const gearRef = useRef<HTMLButtonElement | null>(null);
  // back on the island after a while of play: suggest resting the eyes (never blocks, nothing counts down)
  const [rest, setRest] = useState(() =>
    restDue(performance.now(), restSince, store.getState().profile?.settings.restMinutes ?? 0),
  );
  const sheetRef = useRef(false);
  sheetRef.current = settingsOpen || quiet;
  /** A short cheer line over the island (fed, grew, new decoration). */
  const [note, setNote] = useState<{ key: number; text: string } | null>(null);
  const noteTimer = useRef(0);
  const say = (text: string) => {
    window.clearTimeout(noteTimer.current);
    setNote({ key: performance.now(), text });
    noteTimer.current = window.setTimeout(() => setNote(null), 2600);
  };
  useEffect(() => () => window.clearTimeout(noteTimer.current), []);
  const feed = () => {
    const p = store.getState().profile;
    if (!p || sheetRef.current) return;
    if (snacksLeft(p) <= 0) {
      say(ko.friend.empty);
      return;
    }
    const fed = feedFriend(p);
    store.getState().setProfile(fed);
    islandRef.current?.feed();
    audio.play('star', { pitch: 1.2 });
    say(friendStage(fed.friendFed) > friendStage(p.friendFed) ? ko.friend.grew : ko.friend.yum);
  };
  const feedRef = useRef(feed);
  feedRef.current = feed;
  useEffect(() => {
    if (!api) return;
    const island = createIsland(api.world, {
      selected: store.getState().selected,
      fruits,
      reducedMotion,
      onSelect: (s) => {
        if (!sheetRef.current) store.getState().select(s);
      },
      onEnter: (s) => {
        if (sheetRef.current) return;
        store.getState().select(s);
        store.getState().go('intro');
      },
      onFriend: () => feedRef.current(),
    });
    islandRef.current = island;
    const now = store.getState().profile;
    if (now) island.setMeta(islandMeta(now));
    api.setController(island);
    api.world.camera.fov = 40;
    api.world.camera.updateProjectionMatrix();
    return () => {
      api.setController(null);
      islandRef.current = null;
    };
    // fruits is read once at mount; changes re-render the tree via setFruits below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, store, reducedMotion, fruits]);

  useEffect(() => islandRef.current?.setFruits(fruits), [fruits]);
  useEffect(() => {
    if (!api) return;
    return api.input.onAction((a) => {
      const st = store.getState();
      if (st.screen !== 'hub' || sheetRef.current) return;
      const i = ORDER.indexOf(st.selected);
      if (a === 'left' || a === 'p2.left') st.select(ORDER[(i - 1 + ORDER.length) % ORDER.length] as StageId);
      if (a === 'right' || a === 'p2.right') st.select(ORDER[(i + 1) % ORDER.length] as StageId);
    });
  }, [api, store]);
  useEffect(() => islandRef.current?.select(selected), [selected]);
  useEffect(() => {
    if (profile) islandRef.current?.setMeta(islandMeta(profile));
  }, [profile]);
  // a decoration opened since the last visit: say so once, then remember it was seen
  const opened = profile ? decorOpen(profile.economy.coins) : 0;
  const seen = profile?.decorSeen ?? 0;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `say` is stable enough; only the counts matter
  useEffect(() => {
    if (quiet || opened <= seen) return;
    const p = store.getState().profile;
    const id = DECOR[opened - 1];
    if (!p || !id) return;
    say(fmt(ko.decor.fresh, { name: ko.decor.names[id] }));
    audio.play('star');
    store.getState().setProfile({ ...p, decorSeen: opened });
  }, [opened, seen, quiet, store]);

  if (!profile) return null;
  if (quiet) return null;
  // e2e hook: prove the error boundary catches a screen crash
  if ((globalThis as { __crashUi?: boolean }).__crashUi) throw new Error('test crash');
  const stat = profile.stageStats[selected];
  const playable = PLAYABLE.includes(selected);
  const rec = recommendedStage(profile, STAGE_SKILLS, PLAYABLE);
  const rank = rankFor(profile.trophies.total);
  const nextNeed = BALANCE.ranks[rank + 1];
  const players = STAGE_PLAYERS[selected];
  const step = (d: 1 | -1) => {
    const i = ORDER.indexOf(selected);
    store.getState().select(ORDER[(i + d + ORDER.length) % ORDER.length] as StageId);
  };
  const random = () => {
    const options = PLAYABLE.filter((s) => s !== selected);
    const pick = options[Math.floor(Math.random() * options.length)] ?? selected;
    store.getState().select(pick);
  };
  const name = ko.stages[selected].name;
  const tz = new Date().getTimezoneOffset();
  const today = dayKey(new Date().toISOString(), tz);
  const course = dailyCourse(today, PLAYABLE);
  const courseDone = dailyDone(course, profile, today, tz);
  const courseNext = course.find((_, i) => !courseDone[i]);
  const snacks = snacksLeft(profile);
  const decorNext = nextDecorAt(profile.economy.coins);
  const decorNextId = DECOR[opened];
  const badges = stageBadges(profile.badges, selected);

  return (
    <div className="hub-overlay" data-testid="hub">
      <header className="hub-top">
        <div className="pill" data-testid="coins">
          <span aria-hidden="true">🪙</span> {profile.economy.coins}
          <span className="sr-only">{ko.hub.coins}</span>
        </div>
        <div className="pill" data-testid="trophies">
          <span aria-hidden="true">🏆</span> {profile.trophies.total}
          <span className="sr-only">{ko.hub.trophies}</span>
          <span className="ml-2 text-base">{ko.ranks[rank]}</span>
        </div>
        {nextNeed !== undefined && (
          <div className="pill" data-testid="next-reward">
            <span className="text-base">{ko.hub.nextReward}</span>
            <ProgressBar value={profile.trophies.total} max={nextNeed} label={ko.hub.nextReward} />
            <span className="text-base">{ko.ranks[rank + 1]}</span>
          </div>
        )}
        {store.getState().storageWarning && <div className="pill text-base">{ko.hub.storageWarning}</div>}
        <button
          type="button"
          className="pill hub-gear"
          aria-label={ko.settings.open}
          ref={gearRef}
          data-testid="open-settings"
          onClick={() => setSettingsOpen(true)}
        >
          <span aria-hidden="true">⚙️</span>
        </button>
      </header>
      <aside className="hub-meta" aria-label={ko.daily.title}>
        <button
          type="button"
          className="pill meta-pill"
          data-testid="daily"
          data-done={courseDone.filter(Boolean).length}
          onClick={() => courseNext && store.getState().select(courseNext)}
        >
          <span aria-hidden="true">📅</span>
          <span className="meta-text">{courseNext ? ko.daily.title : ko.daily.done}</span>
          <span className="daily-dots" aria-hidden="true">
            {course.map((s, i) => (
              <span key={s} className={courseDone[i] ? 'daily-dot daily-on' : 'daily-dot'} />
            ))}
          </span>
          <span className="sr-only">
            {fmt(ko.daily.progress, { n: courseDone.filter(Boolean).length, all: course.length })}
          </span>
          {courseNext && <span className="meta-go">{ko.stages[courseNext].name} ▶</span>}
        </button>
        <button
          type="button"
          className={`pill meta-pill ${snacks > 0 ? 'meta-ready' : ''}`}
          data-testid="feed"
          data-snacks={snacks}
          data-fed={profile.friendFed}
          onClick={feed}
        >
          <span aria-hidden="true">🍪</span>
          <span className="meta-text">{fmt(ko.friend.bag, { n: snacks })}</span>
          <span className="meta-go">{ko.friend.feed}</span>
        </button>
        <p className="pill meta-pill meta-quiet" data-testid="decor-next">
          {decorNext !== null && decorNextId
            ? fmt(ko.decor.next, { n: decorNext, name: ko.decor.names[decorNextId] })
            : ko.decor.all}
        </p>
        {profile.stamps.length > 0 && (
          <p className="pill meta-pill meta-quiet" data-testid="stamps">
            📅 {fmt(ko.daily.stamps, { n: profile.stamps.length })}
          </p>
        )}
      </aside>
      {note && (
        <p key={note.key} className="hub-note" role="status" data-testid="hub-note">
          {note.text}
        </p>
      )}
      {rest && (
        <div className="rest-card card" role="status" data-testid="rest">
          <p className="stage-name">{ko.rest.title}</p>
          <p className="mt-1 text-xl">{ko.rest.body}</p>
          <Button
            tone="primary"
            className="mt-3"
            data-testid="rest-ok"
            onClick={() => {
              restSince = performance.now();
              setRest(false);
            }}
          >
            {ko.rest.ok}
          </Button>
        </div>
      )}
      {settingsOpen && (
        <SettingsSheet
          store={store}
          onClose={() => {
            setSettingsOpen(false);
            // focus goes back to the key that opened the sheet
            gearRef.current?.focus();
          }}
        />
      )}

      <section className="hub-card card" aria-live="polite" data-testid="info-card" data-stage={selected}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="stage-group">{ko.groups[STAGE_GROUP[selected]]}</p>
            <h2 className="stage-name">{name}</h2>
          </div>
          <SpeakButton text={name} />
        </div>
        {rec === selected && <p className="ribbon">{ko.hub.recommended}</p>}
        {/* phones: the card stays short so the picked portal shows above it */}
        <div className="mt-2 flex flex-wrap gap-2 max-sm:hidden">
          {STAGE_SKILLS[selected].slice(0, 3).map((k) => (
            <span key={k} className="tag">
              {ko.skills[k]}
            </span>
          ))}
          <span className="tag tag-players">
            {players === 1 ? ko.hub.players1 : players === 2 ? ko.hub.players2 : ko.hub.playersBoth}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-4">
          <Stars n={stat.stars} />
          {stat.plays > 0 && (
            <span className="text-lg">
              {ko.hub.best}: {fmt(ko.hub.bestValue, { n: stat.bestCorrect })}
            </span>
          )}
        </div>
        <ul className="badge-row" aria-label={ko.badges.title} data-testid="badges">
          {badges.map((b) => {
            const label = b.kind === 'special' ? ko.badges.special[selected] : ko.badges.kinds[b.kind];
            return (
              <li key={b.id} className={b.owned ? 'badge badge-on' : 'badge'} data-owned={b.owned}>
                <span aria-hidden="true">{b.owned ? ko.badges.icons[b.kind] : '○'}</span>
                {label}
                {!b.owned && <span className="sr-only"> ({ko.badges.locked})</span>}
              </li>
            );
          })}
        </ul>
        <p className="mt-1 text-lg max-sm:hidden">
          {fmt(ko.hub.rewardHint, { n: BALANCE.trophies.byStars[3] })}
        </p>
        {playable ? (
          <>
            <fieldset className="seg mt-3" aria-label="난이도">
              {([-1, 0, 1] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={shift === v}
                  className={`seg-btn ${shift === v ? 'seg-on' : ''}`}
                  onClick={() => store.getState().setShift(v)}
                >
                  {v === -1 ? ko.hub.easier : v === 0 ? ko.hub.auto : ko.hub.harder}
                </button>
              ))}
            </fieldset>
            {selected === 'bomb' && shift === -1 && (
              <div className="mt-3" data-testid="easy-steps">
                <fieldset className="seg" aria-label={ko.hub.easyStep}>
                  {ko.hub.easySteps.map((name, i) => {
                    const step = i + 1;
                    return (
                      <button
                        key={name}
                        type="button"
                        aria-pressed={easyStep === step}
                        aria-label={`${step}${ko.hub.easyStep} ${name}`}
                        data-testid={`easy-step-${step}`}
                        className={`seg-btn step-btn ${easyStep === step ? 'seg-on' : ''}`}
                        onClick={() => store.getState().setEasyStep(step)}
                      >
                        {step}
                        {profile && step <= profile.bombEasyStep && (
                          <span className="step-done" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </fieldset>
                <p className="mt-1 text-lg" data-testid="easy-step-name">
                  {easyStep}
                  {ko.hub.easyStep} · {ko.hub.easySteps[easyStep - 1]}
                </p>
              </div>
            )}
            <div className="mt-4 flex gap-3">
              <Button
                tone="primary"
                big
                autoFocus
                data-testid="start"
                onClick={() => store.getState().go('intro')}
              >
                {ko.hub.start}
              </Button>
              <Button tone="sea" onClick={random}>
                {ko.hub.random}
              </Button>
            </div>
          </>
        ) : (
          <p className="mt-4 text-2xl font-bold" data-testid="soon">
            {ko.hub.soon}
          </p>
        )}
      </section>

      <div className="hub-arrows">
        <Button aria-label={ko.hub.prev} onClick={() => step(-1)}>
          ◀
        </Button>
        <Button aria-label={ko.hub.next} onClick={() => step(1)}>
          ▶
        </Button>
      </div>
      <nav className="sr-only" aria-label="지역">
        {STAGE_IDS.map((s) => (
          <button key={s} type="button" onClick={() => store.getState().select(s)}>
            {ko.stages[s].name}
          </button>
        ))}
      </nav>
    </div>
  );
}
