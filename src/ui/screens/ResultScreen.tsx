/** Result screen — fixed order (SPEC §12.2): ① stars one by one ② "새로 해낸 것" ③ next goal. */
import { motion, useReducedMotion } from 'motion/react';
import { useEffect } from 'react';
import { useStore } from 'zustand';
import type { GameStore } from '../../application/stores/game';
import type { BadgeKind } from '../../domain/badges';
import type { Achievement, NextGoal } from '../../domain/progression/progression';
import { fmt, ko } from '../../i18n/ko';
import { audio } from '../../infra/audio/audio';
import { Button } from '../components/Button';
import { GemIcon } from '../components/GemIcon';
import { SpeakButton } from '../components/SpeakButton';

export function achievementText(a: Achievement): string {
  switch (a.kind) {
    case 'firstSkill':
      return fmt(ko.achievements.firstSkill, { skill: ko.skills[a.skill] });
    case 'firstClear':
      return fmt(ko.achievements.firstClear, { stage: ko.stages[a.stage].name });
    case 'moreStars':
      return fmt(ko.achievements.moreStars, { stars: a.stars });
    case 'fewerHints':
      return fmt(ko.achievements.fewerHints, { diff: a.diff });
    case 'moreCorrect':
      return fmt(ko.achievements.moreCorrect, { diff: a.diff });
    case 'perfect':
      return ko.achievements.perfect;
    case 'effort':
      return fmt(ko.achievements.effort, { correct: a.correct });
    case 'rankUp':
      return fmt(ko.achievements.rankUp, { rank: ko.ranks[a.rank] ?? '' });
  }
}

export function goalText(g: NextGoal): string {
  switch (g.kind) {
    case 'rank':
      return fmt(ko.goals.rank, { have: g.have, need: g.need, rank: ko.ranks[g.rank] ?? '' });
    case 'stars':
      return fmt(ko.goals.stars, { stage: ko.stages[g.stage].name, stars: g.stars });
    case 'tryStage':
      return fmt(ko.goals.tryStage, { stage: ko.stages[g.stage].name });
  }
}

export function ResultScreen({ store }: { store: GameStore }) {
  const result = useStore(store, (s) => s.lastResult);
  const outcome = useStore(store, (s) => s.lastOutcome);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!result) return;
    audio.playBgm('result', result.correct);
    for (let i = 0; i < result.stars; i++)
      audio.play('star', { delay: 0.35 + i * 0.45, pitch: 1 + i * 0.12 });
    if (store.getState().lastOutcome?.mapUnlocked !== undefined) audio.play('levelup', { delay: 2.2 });
  }, [result, store]);
  if (!result || !outcome) return null;
  const newThing = achievementText(outcome.achievement);
  const badges = [...new Set(result.highlights)]
    .map((h) => ko.result.highlights[h])
    .filter((b): b is string => !!b)
    .slice(0, 4);
  const goal = goalText(outcome.next);
  const delay = (i: number) => (reduce ? 0 : 0.35 + i * 0.45);
  return (
    <div className="screen-center" data-testid="result">
      <div className="card max-w-2xl text-center">
        <h2 className="title">{ko.result.title}</h2>
        <div
          className="my-4 flex justify-center gap-3 text-7xl"
          data-testid="result-stars"
          data-stars={result.stars}
          role="img"
          aria-label={fmt(ko.a11y.stars, { n: result.stars })}
        >
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              aria-hidden="true"
              className={i < result.stars ? 'star-on' : 'star-off'}
              initial={reduce ? false : { scale: 0, rotate: -40 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 12, delay: delay(i) }}
            >
              {i < result.stars ? '★' : '☆'}
            </motion.span>
          ))}
        </div>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay(3) }}
        >
          <p className="text-xl font-bold opacity-70">{ko.result.newThing}</p>
          <p className="text-3xl font-extrabold" data-testid="new-thing">
            {newThing}
          </p>
        </motion.div>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay(4) }}
          className="mt-4"
        >
          <p className="text-xl font-bold opacity-70">{ko.result.nextGoal}</p>
          <p className="text-2xl font-bold" data-testid="next-goal">
            {goal}
          </p>
        </motion.div>
        {badges.length > 0 && (
          <ul className="result-badges" data-testid="highlights">
            {badges.map((b) => (
              <li key={b} className="tag">
                {b}
              </li>
            ))}
          </ul>
        )}
        {outcome.newBadges.length > 0 && (
          <motion.ul
            className="result-badges new-badges"
            data-testid="new-badges"
            initial={reduce ? false : { scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 12, delay: delay(5) }}
          >
            <li className="new-badges-title">{ko.badges.fresh}</li>
            {outcome.newBadges.map((id) => {
              const kind = id.split('.')[1] as BadgeKind;
              return (
                <li key={id} className="badge badge-on">
                  <span aria-hidden="true">{ko.badges.icons[kind]}</span>
                  {kind === 'special' ? ko.badges.special[result.stage] : ko.badges.kinds[kind]}
                </li>
              );
            })}
          </motion.ul>
        )}
        {outcome.stamped && (
          <p className="ribbon mx-auto mt-3" data-testid="stamped">
            {ko.daily.stamped}
          </p>
        )}
        {/* the map mission (D62): a new map opened, met again, or what to try next time (never a penalty) */}
        {(() => {
          const maps = ko.maps.stages[result.stage];
          const m = maps[result.map ?? 0];
          const opened = outcome.mapUnlocked !== undefined ? maps[outcome.mapUnlocked] : undefined;
          if (!m) return null;
          return (
            <motion.p
              className={`ribbon mx-auto mt-4 ${opened ? 'map-prize' : outcome.missionMet ? '' : 'map-again'}`}
              data-testid="map-mission"
              data-met={outcome.missionMet ? '1' : '0'}
              initial={reduce ? false : { scale: 0, rotate: 4 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 12, delay: delay(5.5) }}
            >
              {opened
                ? `🗺️ ${ko.maps.success} ${fmt(ko.maps.opened, { icon: opened.icon, name: opened.name })}`
                : outcome.missionMet
                  ? `🗺️ ${ko.maps.success} · ${m.mission}`
                  : `🗺️ ${fmt(ko.maps.again, { mission: m.mission })}`}
            </motion.p>
          );
        })()}
        {outcome.newToy && (
          <motion.p
            className="ribbon toy-prize mx-auto mt-4"
            data-testid="new-toy"
            initial={reduce ? false : { scale: 0, rotate: -6 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 11, delay: delay(5) }}
          >
            🎁 {fmt(ko.result.newToy, { toy: ko.toys[outcome.newToy] })}
          </motion.p>
        )}
        <p className="mt-3 text-xl">
          <GemIcon /> {fmt(ko.result.coins, { n: outcome.coins })} ·{' '}
          {fmt(ko.result.trophies, { n: outcome.trophies })}
        </p>
        <SpeakButton text={`${newThing}. ${ko.result.nextGoal}: ${goal}`} className="mx-auto mt-2" />
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={() => store.getState().go('hub')} data-testid="to-hub">
            {ko.result.home}
          </Button>
          <Button tone="primary" big autoFocus data-testid="again" onClick={() => store.getState().restart()}>
            {ko.result.again}
          </Button>
        </div>
      </div>
    </div>
  );
}
