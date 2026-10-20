import { useEffect, useRef, useState } from 'react';
import { createFixedLoop, type FixedLoop } from '../engine/loop/fixed-loop';
import { RenderWorld } from '../engine/world';
import { buildEngineDemo } from '../scenes/demo/engine-demo';
import { DebugHud } from '../ui/hud/DebugHud';

export function EngineDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [world, setWorld] = useState<RenderWorld | null>(null);
  const loopRef = useRef<FixedLoop | null>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const tierParam = new URLSearchParams(location.search).get('tier');
      const w = await RenderWorld.create({
        canvas,
        ...(tierParam ? { tier: tierParam as 'low', lockTier: true } : {}),
      });
      if (disposed) {
        w.dispose();
        return;
      }
      const demo = await buildEngineDemo(w);
      const loop = createFixedLoop({
        update: (dt) => demo.update(dt),
        render: (_a, dt) => w.frame(dt, loop.frameMs),
      });
      loopRef.current = loop;
      loop.start();
      setWorld(w);
      (globalThis as { __world?: RenderWorld }).__world = w;
      cleanup = () => {
        loop.dispose();
        demo.dispose();
        w.dispose();
      };
    })();
    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return (
    <div className="fixed inset-0">
      <canvas ref={canvasRef} className="block h-full w-full" data-testid="world-canvas" />
      <DebugHud world={world} frameMs={() => loopRef.current?.frameMs ?? 0} />
    </div>
  );
}
