/** M2 engine showcase (`?demo=engine`): toy diorama, jelly, water, place-value numbers, particles. */
import { Group, Mesh } from 'three/webgpu';
import { createRng } from '../../domain/rng/rng';
import { HitStop, Spring, squashScale } from '../../engine/fx/juice';
import { ball, blob, disc, roundedBox } from '../../engine/geo/shapes';
import { initDigitAtlas, NumberLabel } from '../../engine/numbers/number-label';
import { PALETTE } from '../../engine/palette';
import { addOutline, jellyMaterial, toyMaterial, waterMaterial } from '../../engine/tsl/materials';
import type { RenderWorld } from '../../engine/world';

export async function buildEngineDemo(world: RenderWorld) {
  const skip = new Set((new URLSearchParams(location.search).get('skip') ?? '').split(','));
  if (skip.has('shadow')) world.renderer.shadowMap.enabled = false;
  if (!skip.has('atlas')) await initDigitAtlas();
  const rng = createRng('demo');
  const root = new Group();
  world.scene.add(root);
  world.camera.position.set(0, 7.5, 10);
  world.camera.lookAt(0, 0.6, 0);

  const island = new Mesh(disc(6, 1.2), toyMaterial(PALETTE.sand));
  island.position.y = -0.6;
  island.receiveShadow = true;
  root.add(island);
  const grass = new Mesh(disc(5.6, 0.25), toyMaterial(PALETTE.leaf));
  grass.position.y = 0.1;
  grass.receiveShadow = true;
  root.add(grass);

  const pond = new Mesh(disc(1.8, 0.05, 64), waterMaterial());
  pond.position.set(-2.4, 0.26, 1.2);
  root.add(pond);

  const colors = [PALETTE.berry, PALETTE.sun, PALETTE.sea, PALETTE.lavender, PALETTE.peach];
  for (let i = 0; i < 5; i++) {
    const b = new Mesh(roundedBox(0.8, 0.8, 0.8), toyMaterial(colors[i] as string));
    b.position.set(1 + (i % 3) * 1.0, 0.65 + Math.floor(i / 3) * 0.82, -1.5 + (i % 2) * 0.3);
    b.rotation.y = rng.float() * 0.6;
    b.castShadow = true;
    addOutline(b, 0.03);
    root.add(b);
  }
  for (let i = 0; i < 6; i++) {
    const bush = new Mesh(blob(0.45, rng, 0.2), toyMaterial(PALETTE.mint));
    const a = (i / 6) * Math.PI * 2;
    bush.position.set(Math.cos(a) * 4.6, 0.45, Math.sin(a) * 4.6);
    bush.castShadow = true;
    root.add(bush);
  }

  const jelly = jellyMaterial(PALETTE.berry);
  const slime = new Mesh(ball(0.7), jelly.material);
  slime.position.set(2.2, 0.85, 1.6);
  slime.castShadow = true;
  root.add(slime);
  const spring = new Spring(0, 180, 9);

  if (!skip.has('atlas')) {
    const n1 = new NumberLabel(47, { size: 0.9, placeColors: true });
    n1.position.set(-2.4, 2.2, 1.2);
    const n2 = new NumberLabel(3582, { size: 0.7, placeColors: true });
    n2.position.set(1.8, 3.0, -1.4);
    const n3 = new NumberLabel('8+□=13', { size: 0.6, tint: PALETTE.white });
    n3.position.set(0, 4.2, 0);
    root.add(n1, n2, n3);
  }

  const hitStop = new HitStop();
  let t = 0;
  let nextBurst = 0.3;
  return {
    update(dt: number) {
      t += dt;
      if (t > nextBurst) {
        nextBurst = t + 1.6;
        world.particles.emit('confetti', { x: 2.2, y: 1.4, z: 1.6 }, 80);
        world.particles.emit('droplet', { x: -2.4, y: 0.4, z: 1.2 }, 40);
        world.particles.emit('sparkle', { x: 0, y: 3.6, z: 0 }, 30);
        spring.impulse(-2.5);
        jelly.wobble.value = 1;
        hitStop.trigger(40);
      }
      const s = squashScale(spring.update(dt));
      slime.scale.set(s.x, s.y, s.z);
      jelly.wobble.value *= Math.exp(-dt * 2.5);
      root.rotation.y = Math.sin(t * 0.2) * 0.15;
    },
    dispose() {
      world.scene.remove(root);
    },
  };
}
