/**
 * Hub scene (SPEC §10): round toy island, 8 stage portals in 3 zones, growth tree, buildings.
 * Selection by tap/click (big hit proxies), arrow keys, or gamepad; camera dollies to the selection.
 */
import {
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicNodeMaterial,
  type Object3D,
  Plane,
  Quaternion,
  Raycaster,
  Vector2,
  Vector3,
} from 'three/webgpu';
import { createRng } from '../../domain/rng/rng';
import { STAGE_GROUP, STAGE_IDS, type StageId } from '../../domain/stage/types';
import { Spring } from '../../engine/fx/juice';
import { markStatic, mergeStatic } from '../../engine/geo/merge';
import { releaseTree } from '../../engine/geo/release';
import { ball, blob, disc, ring, roundedBox, waterPlane, waterRing } from '../../engine/geo/shapes';
import { PALETTE } from '../../engine/palette';
import {
  grassMaterial,
  sandMaterial,
  toyMaterial,
  waterMaterial,
  woodMaterial,
} from '../../engine/tsl/materials';
import { WAVES_SEA } from '../../engine/water/waves';
import { type RenderWorld, SKIES } from '../../engine/world';
import type { ActionSnapshot } from '../../infra/input/input';
import type { PointerInfo, SceneController } from '../common/controller';
import { createFriend } from './friend';
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
  /** Title / placement backdrop: slow camera sway, no selection, the monster friend on the beach. */
  showcase?: boolean;
  onSelect(stage: StageId): void;
  onEnter(stage: StageId): void;
}

export interface IslandController extends SceneController {
  /** Showcase only: the monster friend reacts to an answer. */
  cheer(ok: boolean): void;
  select(stage: StageId): void;
  setFruits(n: number): void;
  portalScreenPos(stage: StageId): { x: number; y: number };
}

export function createIsland(world: RenderWorld, opts: IslandOptions): IslandController {
  const rng = createRng('island');
  const root = new Group();
  root.name = 'island';
  world.scene.add(root);
  world.setGround(0.25, 6.6);
  const hour = new Date().getHours();
  world.setSky(hour >= 19 || hour < 6 ? SKIES.night : hour >= 17 ? SKIES.sunset : SKIES.day);

  // ground
  // sea: Gerstner swell + sky reflection + sun glints; shallow turquoise near the beach
  const sea = new Mesh(waterPlane(22, 96), waterMaterial('#0b5f86', '#2fb4cc', 22, WAVES_SEA, true));
  sea.position.y = -0.55;
  sea.receiveShadow = true;
  root.add(sea);
  // far sea to the horizon: same material (flat beyond the wave radius), 1/40 of the vertices
  const farSea = new Mesh(waterRing(22, 140), sea.material);
  farSea.position.y = sea.position.y;
  root.add(farSea);
  const base = new Mesh(disc(7.2, 1.4, 96), sandMaterial(PALETTE.sand));
  base.position.y = -0.7;
  base.receiveShadow = true;
  root.add(markStatic(base));
  const grass = new Mesh(disc(6.6, 0.3, 96), grassMaterial('#7cc96f'));
  grass.position.y = 0.1;
  grass.receiveShadow = true;
  root.add(markStatic(grass));

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
    markStatic(pedestal);
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
    proxy.layers.set(1); // pointer-only layer: never rendered
    proxy.userData.stage = id;
    g.add(proxy);
    proxies.push(proxy);
    for (let s = 1; s <= 3; s++) {
      const stone = new Mesh(
        disc(0.22, 0.08, 16),
        toyMaterial(ZONE_COLOR[STAGE_GROUP[id]], { finish: 'satin' }),
      );
      stone.position.set(Math.cos(a) * (4.7 - s * 0.85), 0.28, Math.sin(a) * (4.7 - s * 0.85));
      stone.receiveShadow = true;
      root.add(markStatic(stone));
    }
    root.add(g);
    portals.set(id, { group: model, ring: sel, spring: new Spring(0, 160, 10), pos });
  }

  // growth tree (centre): trunk + crown; fruits = mastered skills (SPEC §12.2)
  const tree = new Group();
  const trunk = new Mesh(new CylinderGeometry(0.22, 0.32, 1.6, 16), woodMaterial('#8a5a3c'));
  trunk.position.y = 1.0;
  trunk.castShadow = true;
  markStatic(trunk);
  const crown = new Mesh(blob(1.1, rng, 0.15), grassMaterial('#5fb86c'));
  crown.position.y = 2.25;
  crown.castShadow = true;
  tree.add(trunk, crown);
  // fruits: one instanced draw call for up to 14 fruits
  const fruits = new InstancedMesh(ball(0.13, 16), toyMaterial(PALETTE.sun, { rimStrength: 0.5 }), 14);
  fruits.castShadow = true;
  tree.add(fruits);
  root.add(tree);
  const tmp = new Matrix4();
  const setFruits = (n: number) => {
    fruits.count = Math.min(n, 14);
    for (let i = 0; i < fruits.count; i++) {
      const a = i * 2.4;
      const h = 1.95 + (i % 3) * 0.32;
      fruits.setMatrixAt(i, tmp.makeTranslation(Math.cos(a) * 0.95, h, Math.sin(a) * 0.95));
    }
    fruits.instanceMatrix.needsUpdate = true;
    fruits.computeBoundingSphere();
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
    const house = new Mesh(roundedBox(size, size * 0.9, size), toyMaterial(color, { finish: 'satin' }));
    house.position.set(Math.cos(a) * 2.6, 0.25 + size * 0.45, Math.sin(a) * 2.6);
    house.castShadow = true;
    house.receiveShadow = true;
    const roof = new Mesh(new CylinderGeometry(0, size * 0.8, size * 0.6, 4), toyMaterial(PALETTE.berry));
    roof.position.set(house.position.x, house.position.y + size * 0.75, house.position.z);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    root.add(markStatic(house), markStatic(roof));
  }
  // bushes: one shared lumpy geometry, instanced with seeded scale/rotation/tint (1 draw call)
  const bushGeo = blob(0.42, rng, 0.2);
  const bushes = new InstancedMesh(bushGeo, grassMaterial('#ffffff'), 14);
  bushes.castShadow = true;
  bushes.receiveShadow = true;
  const q = new Quaternion();
  const tint = new Color();
  for (let i = 0; i < bushes.count; i++) {
    const a = rng.float() * Math.PI * 2;
    const r = 5.6 + rng.float() * 0.8;
    const sc = 0.75 + rng.float() * 0.55;
    q.setFromAxisAngle(new Vector3(0, 1, 0), rng.float() * Math.PI * 2);
    bushes.setMatrixAt(
      i,
      tmp.compose(new Vector3(Math.cos(a) * r, 0.4, Math.sin(a) * r), q, new Vector3(sc, sc * 0.85, sc)),
    );
    bushes.setColorAt(i, tint.set(i % 3 ? '#86d49a' : '#a8ebd8'));
  }
  root.add(bushes);
  const batch = mergeStatic(root);
  root.userData.batch = batch;

  let selected = opts.selected;
  let t = 0;
  const camPos = new Vector3();
  const camLook = new Vector3();
  const wantPos = new Vector3();
  const wantLook = new Vector3();

  const applySelection = (id: StageId) => {
    selected = id;
    for (const [sid, p] of portals) p.ring.visible = sid === id && !opts.showcase;
    portals.get(id)?.spring.impulse(4);
  };
  applySelection(selected);
  const friend = opts.showcase ? createFriend() : null;
  const friendRay = new Raycaster();
  const friendNdc = new Vector2();
  const friendGround = new Plane(new Vector3(0, 1, 0), -0.3);
  const friendHit = new Vector3();
  if (friend) {
    friend.group.position.set(3.9, 0.25, 5.0);
    root.add(friend.group);
    for (const p of portals.values()) p.ring.visible = false;
  }
  const target = () => {
    if (opts.showcase) {
      const a = opts.reducedMotion ? 0 : Math.sin(t * 0.12) * 0.18;
      wantPos.set(Math.sin(a) * 12.5, 5.2, Math.cos(a) * 12.5);
      wantLook.set(0, 1.1, 2.2);
      return;
    }
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
      if (friend) {
        // keep the friend in the lower-right corner of the screen (beside the card) on any aspect ratio
        friendRay.setFromCamera(friendNdc.set(0.7, -0.58), world.camera);
        if (friendRay.ray.intersectPlane(friendGround, friendHit)) {
          const r = Math.hypot(friendHit.x, friendHit.z);
          if (r > 6.2) friendHit.multiplyScalar(6.2 / r);
          friend.group.position.lerp(friendHit.setY(0.25), 1 - Math.exp(-dt * 4));
        }
        friend.group.rotation.y = Math.atan2(
          world.camera.position.x - friend.group.position.x,
          world.camera.position.z - friend.group.position.z,
        );
        friend.update(dt, t, opts.reducedMotion);
      }
    },
    cheer(ok) {
      friend?.cheer(ok);
      if (ok && friend) world.particles.emit('sparkle', friend.group.position.clone().setY(1.8), 30);
    },
    pointer(p: PointerInfo) {
      if (p.type !== 'down' || opts.showcase) return;
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
      releaseTree(root);
    },
  };
}
