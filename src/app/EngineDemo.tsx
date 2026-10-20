import { useEffect, useRef, useState } from 'react';
import { createFixedLoop, type FixedLoop } from '../engine/loop/fixed-loop';
import { tierFromUrl } from '../engine/quality/quality';
import { RenderWorld } from '../engine/world';
import { buildEngineDemo } from '../scenes/demo/engine-demo';
import { DebugHud } from '../ui/hud/DebugHud';

export function EngineDemo() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [world, setWorld] = useState<RenderWorld | null>(null);
  const loopRef = useRef<FixedLoop | null>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const host = hostRef.current;
      if (!host) return;
      // engine-owned canvas (recovery may swap it; React must not own it)
      const canvas = document.createElement('canvas');
      canvas.className = 'block h-full w-full';
      canvas.dataset.testid = 'world-canvas';
      host.appendChild(canvas);
      const tier = tierFromUrl();
      const w = await RenderWorld.create({
        canvas,
        ...(tier ? { tier, lockTier: true } : {}),
        onCanvasReplaced: (cv) => {
          cv.className = canvas.className;
          cv.dataset.testid = 'world-canvas';
        },
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
        host.replaceChildren();
      };
    })();
    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return (
    <div className="fixed inset-0">
      <div ref={hostRef} className="h-full w-full" />
      <DebugHud world={world} frameMs={() => loopRef.current?.frameMs ?? 0} />
    </div>
  );
}
