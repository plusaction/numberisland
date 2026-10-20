/** Hosts a stage plugin (lazy-loaded per stage, SPEC §5 code split). */
import { useStore } from 'zustand';
import type { GameStore } from '../../application/stores/game';
import { ko } from '../../i18n/ko';
import { Button } from '../components/Button';

export function StageScreen({ store }: { store: GameStore; reducedMotion: boolean }) {
  const selected = useStore(store, (s) => s.selected);
  return (
    <div className="screen-center" data-testid="stage">
      <div className="card text-center">
        <h2 className="title">{ko.stages[selected].name}</h2>
        <p className="text-2xl">{ko.hub.soon}</p>
        <Button className="mt-4" onClick={() => store.getState().go('hub')}>
          {ko.intro.back}
        </Button>
      </div>
    </div>
  );
}
