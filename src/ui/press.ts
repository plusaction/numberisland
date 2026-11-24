/**
 * Press feel for the whole app (one listener, every button): the key goes down the instant a finger or
 * mouse touches it — not on release — with its tick sound and a tiny buzz, and springs back on release
 * (held at least a moment so a quick tap still shows). A tap on the 3D scene leaves a small ripple at the
 * finger. Reduced motion keeps the colour/shadow change only (CSS).
 */
import { audio } from '../infra/audio/audio';
import { buzz } from '../infra/platform/haptics';

const PRESSABLE = 'button:not(:disabled), [role="button"]:not([aria-disabled="true"])';
const MIN_HOLD = 90;

export function installPressFeel(doc: Document = document) {
  let held: { el: HTMLElement; at: number } | null = null;

  const release = () => {
    if (!held) return;
    const { el, at } = held;
    held = null;
    const wait = Math.max(0, MIN_HOLD - (performance.now() - at));
    globalThis.setTimeout(() => {
      el.removeAttribute('data-pressed');
      // the spring-back overshoot (CSS animation, restarted every press)
      el.classList.remove('press-release');
      void el.offsetWidth;
      el.classList.add('press-release');
    }, wait);
  };

  const ripple = (x: number, y: number) => {
    const r = doc.createElement('span');
    r.className = 'touch-ripple';
    r.style.left = `${x}px`;
    r.style.top = `${y}px`;
    doc.body.append(r);
    globalThis.setTimeout(() => r.remove(), 450);
  };

  doc.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button > 0) return;
      void audio.unlock();
      const target = e.target as Element | null;
      const el = target?.closest?.(PRESSABLE) as HTMLElement | null;
      if (el) {
        release();
        el.setAttribute('data-pressed', '');
        held = { el, at: performance.now() };
        audio.play('ui.tap');
        buzz('tap');
        return;
      }
      // a tap on the 3D world: a ripple where the finger landed (the scene answers with its own effects)
      if (target instanceof HTMLCanvasElement) {
        ripple(e.clientX, e.clientY);
        buzz('tap');
      }
    },
    { capture: true, passive: true },
  );
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const)
    doc.addEventListener(ev, release, { capture: true, passive: true });
  // iOS only applies :active styles when a touch listener exists
  doc.addEventListener('touchstart', () => {}, { passive: true });
}
