/**
 * Owns the single canvas + RenderWorld + fixed loop for the whole app; screens swap scene controllers.
 * Pointer events are turned into rays for the active controller (big invisible hit proxies live in scenes).
 */
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { Raycaster, Vector2 } from 'three/webgpu';
import { createFixedLoop, type FixedLoop } from '../engine/loop/fixed-loop';
import { initDigitAtlas } from '../engine/numbers/number-label';
import { tierFromUrl } from '../engine/quality/quality';
import { RenderWorld } from '../engine/world';
import { ko } from '../i18n/ko';
import { InputManager } from '../infra/input/input';
import type { SceneController } from '../scenes/common/controller';
import { DebugHud } from '../ui/hud/DebugHud';

export interface WorldApi {
  world: RenderWorld;
  input: InputManager;
  setController(c: SceneController | null): void;
}

const Ctx = createContext<WorldApi | null>(null);
export const useWorld = () => useContext(Ctx);

const debug = new URLSearchParams(location.search).get('debug') === '1';

export function WorldHost({ children }: { children: ReactNode }) {
  const holder = useRef<HTMLDivElement>(null);
  const [api, setApi] = useState<WorldApi | null>(null);
  const loopRef = useRef<FixedLoop | null>(null);
  const [fatal, setFatal] = useState(false);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const host = holder.current;
      if (!host) return;
      const canvas = document.createElement('canvas');
      canvas.className = 'block h-full w-full';
      canvas.dataset.testid = 'world-canvas';
      canvas.setAttribute('aria-label', ko.a11y.canvas);
      canvas.setAttribute('role', 'img');
      host.appendChild(canvas);
      const input = new InputManager(window);
      let controller: SceneController | null = null;
      const ray = new Raycaster();
      const ndc = new Vector2();
      let world: RenderWorld | null = null;
      const onPointer = (type: 'down' | 'move' | 'up') => (e: PointerEvent) => {
        if (!world || !controller?.pointer) return;
        const c = e.currentTarget as HTMLCanvasElement;
        const r = c.getBoundingClientRect();
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ndc, world.camera);
        controller.pointer({ type, raycaster: ray, x: ndc.x, y: ndc.y });
      };
      const handlers = { down: onPointer('down'), move: onPointer('move'), up: onPointer('up') };
      const attach = (cv: HTMLCanvasElement) => {
        cv.addEventListener('pointerdown', handlers.down);
        cv.addEventListener('pointermove', handlers.move);
        cv.addEventListener('pointerup', handlers.up);
      };
      attach(canvas);
      const tier = tierFromUrl();
      world = await RenderWorld.create({
        canvas,
        ...(tier ? { tier, lockTier: true } : {}),
        onFatal: () => setFatal(true),
        onCanvasReplaced: (cv) => {
          cv.className = canvas.className;
          cv.dataset.testid = 'world-canvas';
          attach(cv);
        },
      });
      if (disposed) {
        world.dispose();
        input.dispose();
        return;
      }
      const w = world;
      await initDigitAtlas();
      const loop = createFixedLoop({
        update: (dt) => controller?.update(dt, input.snapshot()),
        render: (_a, dt) => w.frame(dt, loop.frameMs),
      });
      loopRef.current = loop;
      loop.start();
      (globalThis as { __world?: RenderWorld }).__world = w;
      setApi({
        world: w,
        input,
        setController(c) {
          controller?.dispose();
          controller = c;
        },
      });
      cleanup = () => {
        loop.dispose();
        controller?.dispose();
        input.dispose();
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
    <Ctx.Provider value={api}>
      <div ref={holder} className="fixed inset-0" />
      {debug && <DebugHud world={api?.world ?? null} frameMs={() => loopRef.current?.frameMs ?? 0} />}
      {children}
      {fatal && (
        <div className="screen-center" role="alertdialog" aria-label={ko.errors.title} data-testid="fatal">
          <div className="card text-center">
            <p className="title">{ko.errors.title}</p>
            <button type="button" className="toy-btn mt-4 bg-white px-8" onClick={() => location.reload()}>
              {ko.errors.retry}
            </button>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
