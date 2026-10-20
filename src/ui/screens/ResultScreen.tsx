/** Result screen — fixed order (SPEC §12.2): ① stars one by one ② "새로 해낸 것" ③ next goal. */
import { motion, useReducedMotion } from 'motion/react';
import { useEffect } from 'react';
import { useStore } from 'zustand';
import type { GameStore } from '../../application/stores/game';
import type { Achievement, NextGoal } from '../../domain/progression/progression';
import { fmt, ko } from '../../i18n/ko';
import { audio } from '../../infra/audio/audio';
import { Button } from '../components/Button';
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
  }, [result]);
  if (!result || !outcome) return null;
  const newThing = achievementText(outcome.achievement);
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
        <p className="mt-3 text-xl">
          {fmt(ko.result.coins, { n: outcome.coins })} · {fmt(ko.result.trophies, { n: outcome.trophies })}
        </p>
        <SpeakButton text={`${newThing}. ${ko.result.nextGoal}: ${goal}`} className="mx-auto mt-2" />
        <div className="mt-6 flex justify-center gap-3">
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
