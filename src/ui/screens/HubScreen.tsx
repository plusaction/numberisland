/** Hub overlay (SPEC §10): info card, stage arrows, next-reward bar, coins/trophies, random adventure. */
import { useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import { useWorld } from '../../app/WorldHost';
import type { GameStore } from '../../application/stores/game';
import { BALANCE } from '../../domain/balance';
import { rankFor, recommendedStage } from '../../domain/progression/progression';
import { STAGE_SKILLS } from '../../domain/stage/catalog';
import { PLAYABLE, STAGE_GROUP, STAGE_IDS, STAGE_PLAYERS, type StageId } from '../../domain/stage/types';
import { fmt, ko } from '../../i18n/ko';
import { createIsland, type IslandController } from '../../scenes/island/island';
import { Button } from '../components/Button';
import { ProgressBar } from '../components/ProgressBar';
import { SpeakButton } from '../components/SpeakButton';
import { Stars } from '../components/Stars';

const ORDER: StageId[] = ['bomb', 'zombie', 'fishing', 'slime', 'escape', 'pizza', 'cardbattle', 'race'];

export function HubScreen({ store, reducedMotion }: { store: GameStore; reducedMotion: boolean }) {
  const api = useWorld();
  const profile = useStore(store, (s) => s.profile);
  const selected = useStore(store, (s) => s.selected);
  const shift = useStore(store, (s) => s.shift);
  const islandRef = useRef<IslandController | null>(null);
  const fruits = profile ? Object.values(profile.adaptive.mastery).filter((m) => m >= 0.85).length : 0;

  useEffect(() => {
    if (!api) return;
    const island = createIsland(api.world, {
      selected: store.getState().selected,
      fruits,
      reducedMotion,
      onSelect: (s) => store.getState().select(s),
      onEnter: (s) => {
        store.getState().select(s);
        store.getState().go('intro');
      },
    });
    islandRef.current = island;
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
      if (st.screen !== 'hub') return;
      const i = ORDER.indexOf(st.selected);
      if (a === 'left' || a === 'p2.left') st.select(ORDER[(i - 1 + ORDER.length) % ORDER.length] as StageId);
      if (a === 'right' || a === 'p2.right') st.select(ORDER[(i + 1) % ORDER.length] as StageId);
    });
  }, [api, store]);
  useEffect(() => islandRef.current?.select(selected), [selected]);

  if (!profile) return null;
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
      </header>

      <section className="hub-card card" aria-live="polite" data-testid="info-card" data-stage={selected}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold opacity-70">{ko.groups[STAGE_GROUP[selected]]}</p>
            <h2 className="text-4xl font-extrabold">{name}</h2>
          </div>
          <SpeakButton text={name} />
        </div>
        {rec === selected && <p className="ribbon">{ko.hub.recommended}</p>}
        <div className="mt-2 flex flex-wrap gap-2">
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
        <p className="mt-1 text-lg">{fmt(ko.hub.rewardHint, { n: BALANCE.trophies.byStars[3] })}</p>
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
              <Button tone="sun" onClick={random}>
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
