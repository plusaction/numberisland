import { useStore } from 'zustand';
import type { GameStore } from '../../application/stores/game';
import { STAGE_SKILLS } from '../../domain/stage/catalog';
import { PLAYABLE } from '../../domain/stage/types';
import { ko } from '../../i18n/ko';
import { Button } from '../components/Button';
import { SpeakButton } from '../components/SpeakButton';

export function IntroScreen({ store }: { store: GameStore }) {
  const selected = useStore(store, (s) => s.selected);
  const name = ko.stages[selected].name;
  const playable = PLAYABLE.includes(selected);
  return (
    <div className="screen-center" data-testid="intro">
      <div className="card max-w-xl text-center">
        <h2 className="title">{name}</h2>
        <SpeakButton text={name} className="mx-auto mt-2" />
        <p className="mt-3 text-xl">{ko.intro.skills}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {STAGE_SKILLS[selected].map((k) => (
            <span key={k} className="tag">
              {ko.skills[k]}
            </span>
          ))}
        </div>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => store.getState().go('hub')}>{ko.intro.back}</Button>
          {playable ? (
            <Button tone="primary" big autoFocus data-testid="go" onClick={() => store.getState().restart()}>
              {ko.intro.go}
            </Button>
          ) : (
            <p className="text-2xl font-bold">{ko.hub.soon}</p>
          )}
        </div>
      </div>
    </div>
  );
}
