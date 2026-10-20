/**
 * Hub scene (SPEC §10): round toy island, 8 stage portals in 3 zones, growth tree, buildings.
 * Selection by tap/click (big hit proxies), arrow keys, or gamepad; camera dollies to the selection.
 */
import { CylinderGeometry, Group, Mesh, MeshBasicNodeMaterial, type Object3D, Vector3 } from 'three/webgpu';
import { createRng } from '../../domain/rng/rng';
import { STAGE_GROUP, STAGE_IDS, type StageId } from '../../domain/stage/types';
import { Spring } from '../../engine/fx/juice';
import { ball, blob, disc, ring, roundedBox } from '../../engine/geo/shapes';
import { PALETTE } from '../../engine/palette';
import { addOutline, toyMaterial, waterMaterial } from '../../engine/tsl/materials';
import { type RenderWorld, SKIES } from '../../engine/world';
import type { ActionSnapshot } from '../../infra/input/input';
import type { PointerInfo, SceneController } from '../common/controller';
import { portalModel } from './portal-models';

const ZONE_COLOR = { block: PALETTE.peach, collect: PALETTE.sky, together: PALETTE.lavender } as const;
/** Portal angles: block (left), collect (front-right), together (back). */
const ANGLES: Record<StageId, number> = {
  bomb: 200,
  zombie: 230,
  fishing: 280,
  slime: 315,
  escape: 350,
  pizza: 50,
  cardbattle: 95,
  race: 140,
};

export interface IslandOptions {
  selected: StageId;
  fruits: number;
  reducedMotion: boolean;
  onSelect(stage: StageId): void;
  onEnter(stage: StageId): void;
}

export interface IslandController extends SceneController {
  select(stage: StageId): void;
  setFruits(n: number): void;
  portalScreenPos(stage: StageId): { x: number; y: number };
}

export function createIsland(world: RenderWorld, opts: IslandOptions): IslandController {
  const rng = createRng('island');
  const root = new Group();
  root.name = 'island';
  world.scene.add(root);
  const hour = new Date().getHours();
  world.setSky(hour >= 19 || hour < 6 ? SKIES.night : hour >= 17 ? SKIES.sunset : SKIES.day);

  // ground
  const sea = new Mesh(disc(18, 0.1, 64), waterMaterial('#5cc4dc', '#a5e6f2'));
  sea.position.y = -0.9;
  root.add(sea);
  const base = new Mesh(disc(7.2, 1.4, 64), toyMaterial(PALETTE.sand));
  base.position.y = -0.7;
  base.receiveShadow = true;
  root.add(base);
  const grass = new Mesh(disc(6.6, 0.3, 64), toyMaterial(PALETTE.leaf));
  grass.position.y = 0.1;
  grass.receiveShadow = true;
  root.add(grass);

  // zone paths (coloured stepping stones toward each portal)
  const portals = new Map<StageId, { group: Group; ring: Mesh; spring: Spring; pos: Vector3 }>();
  const proxies: Object3D[] = [];
  for (const id of STAGE_IDS) {
    const a = (ANGLES[id] * Math.PI) / 180;
    const pos = new Vector3(Math.cos(a) * 4.7, 0.25, Math.sin(a) * 4.7);
    const g = new Group();
    g.position.copy(pos);
    g.lookAt(0, 0.25, 0);
    g.rotateY(Math.PI);
    const pedestal = new Mesh(disc(0.85, 0.3), toyMaterial(ZONE_COLOR[STAGE_GROUP[id]]));
    pedestal.position.y = 0.15;
    pedestal.receiveShadow = true;
    pedestal.castShadow = true;
    addOutline(pedestal, 0.03);
    const model = portalModel(id);
    model.position.y = 0.3;
    const sel = new Mesh(ring(0.98, 0.07), toyMaterial(PALETTE.sun, { rimStrength: 0.6 }));
    sel.rotation.x = Math.PI / 2;
    sel.position.y = 0.32;
    sel.visible = false;
    g.add(pedestal, model, sel);
    // invisible, generous hit proxy (≥ 64 px on a 1080p screen)
    const proxyMat = new MeshBasicNodeMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const proxy = new Mesh(new CylinderGeometry(1.25, 1.25, 2.2, 12), proxyMat);
    proxy.position.y = 0.9;
    proxy.userData.stage = id;
    g.add(proxy);
    proxies.push(proxy);
    for (let s = 1; s <= 3; s++) {
      const stone = new Mesh(disc(0.22, 0.08, 16), toyMaterial(ZONE_COLOR[STAGE_GROUP[id]]));
      stone.position.set(Math.cos(a) * (4.7 - s * 0.85), 0.28, Math.sin(a) * (4.7 - s * 0.85));
      stone.receiveShadow = true;
      root.add(stone);
    }
    root.add(g);
    portals.set(id, { group: model, ring: sel, spring: new Spring(0, 160, 10), pos });
  }

  // growth tree (centre): trunk + crown; fruits = mastered skills (SPEC §12.2)
  const tree = new Group();
  const trunk = new Mesh(new CylinderGeometry(0.22, 0.32, 1.6, 16), toyMaterial(PALETTE.cocoa));
  trunk.position.y = 1.0;
  trunk.castShadow = true;
  const crown = new Mesh(blob(1.1, rng, 0.15), toyMaterial('#6cc47a'));
  crown.position.y = 2.25;
  crown.castShadow = true;
  addOutline(crown, 0.03);
  tree.add(trunk, crown);
  const fruitGroup = new Group();
  tree.add(fruitGroup);
  root.add(tree);
  const setFruits = (n: number) => {
    fruitGroup.clear();
    for (let i = 0; i < Math.min(n, 14); i++) {
      const f = new Mesh(ball(0.13, 16), toyMaterial(PALETTE.sun, { rimStrength: 0.5 }));
      const a = i * 2.4;
      const h = 1.95 + (i % 3) * 0.32;
      f.position.set(Math.cos(a) * 0.95, h, Math.sin(a) * 0.95);
      fruitGroup.add(f);
    }
  };
  setFruits(opts.fruits);

  // buildings (M7/M8 content later): museum, shop, board, home, parent door
  const buildings: [number, string, number][] = [
    [20, PALETTE.lavender, 0.9],
    [-25, PALETTE.peach, 0.75],
    [170, PALETTE.sky, 0.7],
    [255, PALETTE.mint, 0.8],
  ];
  for (const [deg, color, size] of buildings) {
    const a = (deg * Math.PI) / 180;
    const house = new Mesh(roundedBox(size, size * 0.9, size), toyMaterial(color));
    house.position.set(Math.cos(a) * 2.6, 0.25 + size * 0.45, Math.sin(a) * 2.6);
    house.castShadow = true;
    addOutline(house, 0.03);
    const roof = new Mesh(new CylinderGeometry(0, size * 0.8, size * 0.6, 4), toyMaterial(PALETTE.berry));
    roof.position.set(house.position.x, house.position.y + size * 0.75, house.position.z);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    root.add(house, roof);
  }
  for (let i = 0; i < 9; i++) {
    const a = rng.float() * Math.PI * 2;
    const r = 5.6 + rng.float() * 0.8;
    const bush = new Mesh(blob(0.32 + rng.float() * 0.2, rng, 0.2), toyMaterial(PALETTE.mint));
    bush.position.set(Math.cos(a) * r, 0.4, Math.sin(a) * r);
    bush.castShadow = true;
    root.add(bush);
  }

  let selected = opts.selected;
  let t = 0;
  const camPos = new Vector3();
  const camLook = new Vector3();
  const wantPos = new Vector3();
  const wantLook = new Vector3();

  const applySelection = (id: StageId) => {
    selected = id;
    for (const [sid, p] of portals) p.ring.visible = sid === id;
    portals.get(id)?.spring.impulse(4);
  };
  applySelection(selected);
  const target = () => {
    const p = portals.get(selected)?.pos ?? new Vector3();
    const dir = p.clone().setY(0).normalize();
    wantLook.set(p.x * 0.6, 1.0, p.z * 0.6);
    wantPos.copy(dir.multiplyScalar(13)).setY(8.2);
    if (!opts.reducedMotion) wantPos.applyAxisAngle(new Vector3(0, 1, 0), Math.sin(t * 0.1) * 0.05);
  };
  target();
  camPos.copy(wantPos);
  camLook.copy(wantLook);

  return {
    select: (id) => applySelection(id),
    setFruits,
    portalScreenPos(stage) {
      const p = (portals.get(stage)?.pos ?? new Vector3()).clone().setY(1.6).project(world.camera);
      return { x: p.x, y: p.y };
    },
    update(dt: number, input: ActionSnapshot) {
      t += dt;
      void input; // navigation keys are handled immediately by the hub UI (no frame latency)
      target();
      const k = 1 - Math.exp(-dt * 3.2);
      camPos.lerp(wantPos, k);
      camLook.lerp(wantLook, k);
      world.camera.position.copy(camPos);
      world.camera.lookAt(camLook);
      for (const [sid, p] of portals) {
        const bob = sid === selected && !opts.reducedMotion ? Math.sin(t * 3) * 0.06 : 0;
        const s = 1 + p.spring.update(dt) * 0.05;
        p.group.position.y = 0.3 + bob;
        p.group.scale.setScalar(sid === selected ? 1.12 * s : s);
        if (!opts.reducedMotion) p.group.rotation.y += dt * (sid === selected ? 0.8 : 0.15);
      }
      crown.scale.setScalar(1 + Math.sin(t * 1.3) * 0.015);
    },
    pointer(p: PointerInfo) {
      if (p.type !== 'down') return;
      const hit = p.raycaster.intersectObjects(proxies, false)[0];
      const id = hit?.object.userData.stage as StageId | undefined;
      if (!id) return;
      if (id === selected) opts.onEnter(id);
      else {
        applySelection(id);
        opts.onSelect(id);
      }
    },
    dispose() {
      world.scene.remove(root);
      root.traverse((o) => {
        if (o instanceof Mesh) {
          o.geometry.dispose();
          const mat = o.material as { dispose?: () => void };
          mat.dispose?.();
        }
      });
    },
  };
}
