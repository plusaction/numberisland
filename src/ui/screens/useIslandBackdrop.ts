/** The 3D island behind the title and placement screens (so the very first screen is not a flat card). */
import { useEffect, useRef } from 'react';
import { useWorld } from '../../app/WorldHost';
import { createIsland, type IslandController } from '../../scenes/island/island';

export function useIslandBackdrop(reducedMotion: boolean) {
  const api = useWorld();
  const ref = useRef<IslandController | null>(null);
  useEffect(() => {
    if (!api) return;
    const island = createIsland(api.world, {
      selected: 'fishing',
      fruits: 3,
      reducedMotion,
      showcase: true,
      onSelect: () => {},
      onEnter: () => {},
    });
    ref.current = island;
    api.setController(island);
    api.world.camera.fov = 42;
    api.world.camera.updateProjectionMatrix();
    return () => {
      api.setController(null);
      ref.current = null;
    };
  }, [api, reducedMotion]);
  return ref;
}
