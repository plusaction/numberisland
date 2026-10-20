/** Shared celebration: grows with the correct-answer streak (SPEC §7.4 "정답 연속 시 점진적 연출 상승"). */
import type { Vector3Like } from 'three/webgpu';
import type { RenderWorld } from '../../engine/world';
import { audio } from '../../infra/audio/audio';

/** Particle budget per streak step (1 → 3+). Exported for tests. */
export function celebrationSize(streak: number): { confetti: number; sparkle: number; big: boolean } {
  const s = Math.max(1, Math.min(4, streak));
  return { confetti: 60 + s * 50, sparkle: s >= 2 ? 20 * s : 0, big: s >= 3 };
}

export function celebrate(world: RenderWorld, at: Vector3Like, streak: number, sixSeven: boolean) {
  const c = celebrationSize(streak);
  world.particles.emit('confetti', at, c.confetti);
  if (c.sparkle) world.particles.emit('sparkle', { x: at.x, y: at.y + 1, z: at.z }, c.sparkle);
  if (c.big) audio.play('star', { delay: 0.5, pitch: 1 + Math.min(streak, 6) * 0.05 });
  if (sixSeven) {
    // hidden 13 firework for 6 + 7
    audio.play('firework', { delay: 0.3 });
    world.particles.emit('confetti', { x: 0, y: 4, z: 0 }, 220);
    world.particles.emit('sparkle', { x: 0, y: 4.5, z: 0 }, 120);
  }
}
