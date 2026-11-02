/**
 * "The number I picked flies up into the ? box": a copy of the freshly filled goal tile starts at the picked
 * thing on screen (NDC from the scene), arcs up and lands in its slot, which then does its little "click".
 * Pure DOM + Web Animations (no React re-render); skipped entirely with reduced motion by the caller.
 */
export function flyToGoal(from: { x: number; y: number }, value: string) {
  const goal = document.querySelector('[data-testid="goal"]');
  if (!goal) return;
  const fresh = [...goal.querySelectorAll<HTMLElement>('.gt-new')];
  const target = fresh.find((el) => el.textContent === value) ?? fresh[fresh.length - 1];
  if (!target) return;
  const r = target.getBoundingClientRect();
  const sx = ((from.x + 1) / 2) * window.innerWidth;
  const sy = ((1 - from.y) / 2) * window.innerHeight;
  const dx = sx - (r.left + r.width / 2);
  const dy = sy - (r.top + r.height / 2);
  const chip = target.cloneNode(true) as HTMLElement;
  chip.classList.remove('gt-new');
  chip.classList.add('gt-fly');
  Object.assign(chip.style, {
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
  });
  document.body.appendChild(chip);
  target.style.visibility = 'hidden';
  const anim = chip.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(0.6)` },
      { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 90}px) scale(1.2) rotate(-8deg)`, offset: 0.55 },
      { transform: 'none' },
    ],
    { duration: 560, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)' },
  );
  anim.onfinish = anim.oncancel = () => {
    chip.remove();
    target.style.visibility = '';
    // replay the landing "click" now that it has arrived
    target.classList.remove('gt-new');
    void target.offsetWidth;
    target.classList.add('gt-new');
  };
}
