/**
 * The five maps of the selected stage on the island card (D62): open ones can be picked (the newest is
 * chosen by default), locked ones show a padlock and the mission that opens them. Icon + name + number:
 * never colour alone (P9).
 */
import { useStore } from 'zustand';
import { currentMap, type GameStore } from '../../application/stores/game';
import { MAP_COUNT } from '../../domain/maps';
import type { StageId } from '../../domain/stage/types';
import { fmt, ko } from '../../i18n/ko';
import { audio } from '../../infra/audio/audio';

export function MapRow({ store, stage }: { store: GameStore; stage: StageId }) {
  const open = useStore(store, (s) => Math.max(1, s.profile?.maps?.[stage] ?? 1));
  const cur = useStore(store, (s) => currentMap(s, stage));
  const maps = ko.maps.stages[stage];
  const next = maps[open];
  return (
    <div className="map-row-wrap">
      <fieldset
        className="map-row"
        aria-label={ko.maps.title}
        data-testid="maps"
        data-open={open}
        data-map={cur}
      >
        {maps.slice(0, MAP_COUNT).map((m, i) => {
          const locked = i >= open;
          return (
            <button
              key={m.name}
              type="button"
              className={`map-slot ${i === cur ? 'map-on' : ''} ${locked ? 'map-locked' : ''}`}
              aria-pressed={i === cur}
              disabled={locked}
              data-testid={`map-${i}`}
              onClick={() => {
                store.getState().pickMap(stage, i);
                audio.play('pop', { pitch: 0.9 + i * 0.08 });
              }}
            >
              <span className="map-icon" aria-hidden="true">
                {locked ? '🔒' : m.icon}
              </span>
              <span className="map-no">{i + 1}</span>
              <span className="sr-only">
                {m.name}
                {locked ? ` (${ko.maps.locked})` : ''}
              </span>
            </button>
          );
        })}
      </fieldset>
      <p className="map-caption" data-testid="map-caption">
        <b>{maps[cur]?.name}</b> · {ko.maps.mission}: {maps[cur]?.mission}
        {next && cur === open - 1 && (
          <span className="map-next"> → 🔓 {fmt(ko.maps.cut, { n: open + 1, name: next.name })}</span>
        )}
      </p>
    </div>
  );
}
