/**
 * Wordless tutorial (SPEC §11): a ghost hand shows the solution of the first puzzle twice (~15 s),
 * input stays locked meanwhile, then the child solves that same puzzle. Skippable at any time.
 */
import { useEffect, useRef, useState } from 'react';
import { ko } from '../../i18n/ko';
import type { StageRuntime } from '../../stages/_shared/runtime';
import type { AnyStageModule } from '../../stages/registry';
import { Button } from '../components/Button';

export function Tutorial({
  runtime,
  mod,
  onDone,
}: {
  runtime: StageRuntime<unknown, unknown>;
  mod: AnyStageModule;
  onDone(): void;
}) {
  const [pos, setPos] = useState<{ x: number; y: number; press: boolean } | null>(null);
  // keep the latest callback without restarting the demo when the parent re-renders
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    runtime.locked = true;
    const plan = mod.solution(runtime.state) as { id?: number; from?: number; to?: number }[];
    const targets: number[] = [];
    for (const a of plan) {
      if (a.from !== undefined && a.to !== undefined) targets.push(a.from, a.to);
      else if (a.id !== undefined) targets.push(a.id);
    }
    let i = 0;
    let loops = 0;
    if (!targets.length) {
      doneRef.current();
      return;
    }
    const timer = window.setInterval(() => {
      const id = targets[i % targets.length] as number;
      const p = runtime.screenPos(id);
      if (p) setPos({ x: (p.x + 1) / 2, y: (1 - p.y) / 2, press: false });
      window.setTimeout(() => setPos((q) => (q ? { ...q, press: true } : q)), 700);
      i++;
      if (i % targets.length === 0) loops++;
      if (loops >= 2) {
        window.clearInterval(timer);
        window.setTimeout(() => doneRef.current(), 1400);
      }
    }, 1600);
    return () => {
      window.clearInterval(timer);
      runtime.locked = false;
    };
  }, [runtime, mod]);
  return (
    <div className="tutorial" data-testid="tutorial">
      <p className="toast">{ko.stageHud.watch}</p>
      {pos && (
        <span
          aria-hidden="true"
          className={`ghost-hand ${pos.press ? 'ghost-press' : ''}`}
          style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
        >
          👆
        </span>
      )}
      <Button className="tutorial-skip" onClick={onDone} data-testid="skip-tutorial">
        {ko.stageHud.skip} ⏭
      </Button>
    </div>
  );
}
