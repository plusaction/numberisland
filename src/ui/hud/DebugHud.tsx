import { useEffect, useState } from 'react';
import type { RenderWorld } from '../../engine/world';

/** `?debug=1` HUD: backend, tier, frame time, draw calls (SPEC §7.2). */
export function DebugHud({ world, frameMs }: { world: RenderWorld | null; frameMs: () => number }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);
  if (!world) return null;
  return (
    <div
      data-testid="debug-hud"
      data-backend={world.backend}
      data-tier={world.tier}
      className="pointer-events-none fixed top-2 left-2 z-50 rounded-lg bg-black/60 px-3 py-2 font-mono text-xs text-white"
    >
      <div>backend: {world.backend}</div>
      <div>tier: {world.tier}</div>
      <div>frame: {frameMs().toFixed(1)} ms</div>
      <div>draws: {world.drawCalls}</div>
      <div>particles: {world.particles.gpu ? 'gpu' : 'cpu'}</div>
    </div>
  );
}
