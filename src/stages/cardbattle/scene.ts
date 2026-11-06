/**
 * ⑦ 숫자 카드 배틀 diorama: a glowing toy arena. The child's three holo cards stand at the front, the
 * monster's face down at the back; the target stays in the HUD goal line (🎯).
 * - Deal: cards fly in spinning from the deck and fan out.
 * - Pick: chosen cards float up and sway; the + / − chips light up.
 * - Reveal: both pairs fly to the middle, the monster's flip over, each pair's result pops above it, then a
 *   number line rolls out with the target flag and both results sliding in — the gaps are drawn as bars
 *   (the difference made visible). The closer side gets a burst and a gem; PERFECT = slow-mo + rainbow ring.
 */
import { Group, Mesh, TorusGeometry, Vector3 } from 'three/webgpu';
import { HitStop, Shake, Spring } from '../../engine/fx/juice';
import { disc, roundedBox } from '../../engine/geo/shapes';
import { NumberLabel } from '../../engine/numbers/number-label';
import { PALETTE } from '../../engine/palette';
import { toyMaterial } from '../../engine/tsl/materials';
import type { RenderWorld } from '../../engine/world';
import { audio } from '../../infra/audio/audio';
import type { PointerInfo } from '../../scenes/common/controller';
import { baseDiorama, disposeTree, hitId, hitSphere, stageCamera } from '../_shared/diorama';
import { celebrate } from '../_shared/fx';
import type { StageCtx, StageScene } from '../_shared/module';
import { type Bot, botModel, type Card, card, gem, holoMaterial } from './cards3d';
import { type CardAction, type CardState, DEAL_TICKS, HAND, REVEAL_TICKS, WINS_NEEDED } from './rules';

const HAND_X = [-1.65, 0, 1.65];
/** `screenPos` id of the point under the hand (the HUD's + / − row). */
export const TOGGLE_ANCHOR = 20;
const BOT_X = [-1.05, 0, 1.05];
/** The monster's cards sit small at the back (face down) so they never overlap it or each other. */
const BOT_SCALE = 0.6;
const TINTS = ['#bfe6ff', '#ffd6e8', '#fff1b8'];
const ease = (x: number) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};
const pop = (x: number) => {
  const k = Math.min(1, Math.max(0, x));
  return k < 1 ? 0.3 + k * 0.85 + Math.sin(k * Math.PI) * 0.35 : 1.15;
};

interface CardView {
  card: Card;
  spring: Spring;
  proxy?: Mesh;
}

export function createCardScene(world: RenderWorld, ctx: StageCtx): StageScene<CardState, CardAction> {
  const root = new Group();
  root.name = 'stage-cardbattle';
  world.scene.add(root);
  stageCamera(world, 10.5, 7.6, 42, 1.0);
  root.add(baseDiorama('#2b2f6b', 7));

  // neon arena: a dark felt table ringed by glowing light strips that breathe
  const table = new Mesh(disc(5.4, 0.25, 96), toyMaterial('#33397a', { finish: 'satin' }));
  table.position.y = 0.12;
  table.receiveShadow = true;
  const neonA = new Mesh(new TorusGeometry(5.45, 0.07, 10, 120), toyMaterial('#6fe3ff', { rimStrength: 1 }));
  neonA.rotation.x = Math.PI / 2;
  neonA.position.y = 0.28;
  const neonB = new Mesh(new TorusGeometry(2.4, 0.05, 10, 90), toyMaterial('#ff8fd0', { rimStrength: 1 }));
  neonB.rotation.x = Math.PI / 2;
  neonB.position.set(0, 0.26, 0.6);
  root.add(table, neonA, neonB);

  // score gems: the child's (left, front), the monster's (right, back)
  const gems: Mesh[] = [];
  const gemAt = (side: 0 | 1, i: number) =>
    side === 0 ? new Vector3(-4.3, 0.55, 2.4 - i * 0.75) : new Vector3(4.3, 0.55, -0.6 - i * 0.75);
  const renderGems = (wins: number, losses: number) => {
    for (const g of gems) disposeTree(g);
    gems.length = 0;
    for (let i = 0; i < WINS_NEEDED; i++) {
      const a = gem(i < wins, PALETTE.sea);
      a.position.copy(gemAt(0, i));
      const b = gem(i < losses, PALETTE.berry);
      b.position.copy(gemAt(1, i));
      root.add(a, b);
      gems.push(a, b);
    }
  };

  // the monster
  let bot: Bot | null = null;
  const botSpring = new Spring(0, 160, 7);

  // reveal props: results and the number line
  const resultMine = new NumberLabel(0, { size: 0.95, placeColors: true });
  const resultBot = new NumberLabel(0, { size: 0.95, placeColors: true });
  resultMine.visible = resultBot.visible = false;
  root.add(resultMine, resultBot);
  const line = new Group();
  line.position.set(0, 0.3, 1.9);
  const bar = new Mesh(roundedBox(7.6, 0.08, 0.16, 0.04), toyMaterial(PALETTE.white, { rimStrength: 0.5 }));
  const flag = new Mesh(roundedBox(0.1, 0.9, 0.1, 0.04), toyMaterial(PALETTE.sun, { rimStrength: 0.8 }));
  const flagLabel = new NumberLabel(0, { size: 0.5, placeColors: true });
  const markMine = new Mesh(disc(0.2, 0.2, 20), toyMaterial(PALETTE.sea, { rimStrength: 0.6 }));
  const markBot = new Mesh(disc(0.2, 0.2, 20), toyMaterial(PALETTE.berry, { rimStrength: 0.6 }));
  const gapMine = new Mesh(roundedBox(1, 0.1, 0.1, 0.04), toyMaterial(PALETTE.sea, { rimStrength: 1 }));
  const gapBot = new Mesh(roundedBox(1, 0.1, 0.1, 0.04), toyMaterial(PALETTE.berry, { rimStrength: 1 }));
  gapMine.position.z = 0.22;
  gapBot.position.z = -0.22;
  line.add(bar, flag, flagLabel, markMine, markBot, gapMine, gapBot);
  line.visible = false;
  root.add(line);
  // perfect ring
  const ringMat = holoMaterial('#fff6c8', 1);
  const ring = new Mesh(new TorusGeometry(1, 0.08, 10, 80), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.visible = false;
  root.add(ring);

  const mine: CardView[] = [];
  const theirs: CardView[] = [];
  const proxies: Mesh[] = [];
  let duelRef: CardState['duel'] = null;
  const hitStop = new HitStop();
  const shake = new Shake(!ctx.reducedMotion && ctx.shakeIntensity > 0);
  let cursorId: number | null = null;
  let glowId: number | null = null;
  let t = 0;
  let ringT = -1;
  let gemsShown = '';
  const tmp = new Vector3();
  const tmp2 = new Vector3();

  const build = (s: CardState) => {
    for (const v of [...mine, ...theirs]) disposeTree(v.card.group);
    mine.length = theirs.length = proxies.length = 0;
    const d = s.duel;
    if (!d) return;
    if (!bot) {
      bot = botModel(s.bot);
      bot.group.position.set(0, 0.25, -3.9);
      root.add(bot.group);
    }
    d.hand.forEach((v, i) => {
      const c = card(TINTS[i % TINTS.length] as string, v);
      root.add(c.group);
      const proxy = hitSphere(0.95, i);
      root.add(proxy);
      proxies.push(proxy);
      mine.push({ card: c, spring: new Spring(0, 200, 10), proxy });
    });
    d.botHand.forEach((v) => {
      const c = card('#e8dcff', v);
      root.add(c.group);
      theirs.push({ card: c, spring: new Spring(0, 200, 10) });
    });
    resultMine.visible = resultBot.visible = false;
    line.visible = false;
    audio.play('whoosh');
  };

  return {
    sync(state, prev, dt) {
      const vdt = hitStop.filter(dt);
      t += vdt;
      if (state.duel !== duelRef) {
        duelRef = state.duel;
        build(state);
      }
      const d = state.duel;
      const gemKey = `${state.wins}|${state.losses}`;
      if (gemKey !== gemsShown) {
        gemsShown = gemKey;
        renderGems(state.wins, state.losses);
      }
      if (!d) return;
      // one-shot effects
      if (prev && state.picked.length !== prev.picked.length) {
        audio.play(state.picked.length > prev.picked.length ? 'ui.tap' : 'ui.back', { pitch: 1.1 });
        for (const id of state.picked) if (!prev.picked.includes(id)) mine[id]?.spring.impulse(6);
      }
      if (prev && state.op !== prev.op) audio.play('pop', { pitch: state.op === '+' ? 1.2 : 0.9 });
      const reveal = state.phase === 'reveal' ? 1 - state.phaseLeft / REVEAL_TICKS : -1;
      if (prev && prev.phase !== 'reveal' && state.phase === 'reveal') {
        audio.play('whoosh');
        audio.play('snip', { delay: 0.35, pitch: 0.8 });
      }
      // beats of the reveal
      const beat = (at: number) =>
        prev?.phase === 'reveal' && reveal >= at && 1 - prev.phaseLeft / REVEAL_TICKS < at;
      if (beat(0.3)) audio.play('pop', { pitch: 1.3 });
      if (beat(0.45)) audio.play('reel', { pitch: 1.2 });
      if (beat(0.72) && state.mine) {
        const perfect = state.mine.result === d.target;
        const at = state.outcome === -1 ? tmp.set(2.2, 2.4, 0.4) : tmp.set(-2.2, 2.4, 0.4);
        if (state.outcome !== 0) celebrate(world, at, state.core.streak, perfect);
        if (perfect) {
          ringT = 0;
          hitStop.trigger(120);
          audio.play('levelup');
          audio.play('firework', { delay: 0.2 });
        } else if (state.outcome === 1) audio.play('correct.big');
        else if (state.outcome === -1) {
          audio.play('wrong.boing', { pitch: 1.2 });
          botSpring.impulse(-6);
        } else audio.play('correct');
        if (state.outcome === 1) botSpring.impulse(-8);
        else botSpring.impulse(6);
        shake.add(0.15 * ctx.shakeIntensity);
      }

      // the child's cards: fan at the front, picked ones float; at the reveal the pair flies to the middle
      const dealK = state.phase === 'deal' ? 1 - state.phaseLeft / DEAL_TICKS : 1;
      mine.forEach((v, i) => {
        const g = v.card.group;
        const sp = v.spring.update(vdt);
        const delay = i * 0.18;
        const k = ease((dealK - delay) / 0.55);
        const picked = state.picked.includes(i);
        const idx = state.mine?.cards.indexOf(i) ?? -1;
        tmp.set(HAND_X[i] as number, 1.25, 2.4);
        if (picked) tmp.y += 0.5 + (ctx.reducedMotion ? 0 : Math.sin(t * 2.5 + i) * 0.06);
        if (cursorId === i && !picked) tmp.y += 0.2;
        if (reveal >= 0) {
          const m = ease(reveal / 0.25);
          if (idx >= 0) tmp.lerp(tmp2.set(-2.9 + idx * 1.45, 1.55, 0.55), m);
          else tmp.y -= m * 1.6;
        }
        // deal: fly from the deck (front right), spinning
        tmp2.set(4.5, 0.6, 3.6);
        g.position.lerpVectors(tmp2, tmp, k);
        g.rotation.set(
          -0.28,
          (1 - k) * Math.PI * 2 + (picked ? Math.sin(t * 1.8 + i) * 0.12 : 0),
          (1 - k) * 0.6,
        );
        const glow = glowId === i ? 1 + Math.abs(Math.sin(t * 4)) * 0.08 : 1;
        g.scale.setScalar((picked ? 1.1 : 1) * (1 + sp * 0.05) * glow);
        if (v.proxy) v.proxy.position.copy(g.position);
      });
      // the monster's cards: face down at the back; its pair flips and flies to the middle at the reveal
      theirs.forEach((v, i) => {
        const g = v.card.group;
        const delay = 0.3 + i * 0.12;
        const k = ease((dealK - delay) / 0.5);
        const idx = d.bot.cards.indexOf(i);
        tmp.set(BOT_X[i] as number, 0.85, -1.9);
        let flip = 0;
        let grow = 0;
        if (reveal >= 0) {
          const m = ease(reveal / 0.25);
          if (idx >= 0) {
            tmp.lerp(tmp2.set(1.45 + idx * 1.45, 1.55, 0.55), m);
            flip = ease((reveal - 0.12) / 0.2);
            grow = m;
          } else tmp.y -= m * 1.6;
        }
        tmp2.set(-4.5, 0.6, -3.6);
        g.position.lerpVectors(tmp2, tmp, k);
        g.rotation.set(-0.28, Math.PI * (1 - flip) + (1 - k) * Math.PI * 2, 0);
        g.scale.setScalar(BOT_SCALE + (1 - BOT_SCALE) * grow);
      });
      // results pop over each pair
      const showResults = reveal >= 0.3;
      resultMine.visible = resultBot.visible = showResults && !!state.mine;
      if (showResults && state.mine) {
        resultMine.set(state.mine.result);
        resultBot.set(d.bot.result);
        const s = pop((reveal - 0.3) / 0.12);
        resultMine.position.set(-2.2, 3.05, 0.55);
        resultBot.position.set(2.2, 3.05, 0.55);
        resultMine.scale.setScalar(s * (state.outcome === 1 ? 1.2 : 1));
        resultBot.scale.setScalar(s * (state.outcome === -1 ? 1.2 : 1));
      }
      // number line: the target flag and both results, with the gaps drawn as bars
      line.visible = reveal >= 0.45 && !!state.mine;
      if (line.visible && state.mine) {
        const vals = [d.target, state.mine.result, d.bot.result];
        const lo = Math.min(...vals) - 2;
        const hi = Math.max(...vals) + 2;
        const X = (v: number) => -3.6 + ((v - lo) / Math.max(1, hi - lo)) * 7.2;
        const slide = ease((reveal - 0.45) / 0.22);
        line.scale.x = ease((reveal - 0.45) / 0.1);
        flag.position.set(X(d.target), 0.45, 0);
        flagLabel.set(d.target);
        flagLabel.position.set(X(d.target), 1.2, 0);
        const xm = X(d.target) + (X(state.mine.result) - X(d.target)) * slide;
        const xb = X(d.target) + (X(d.bot.result) - X(d.target)) * slide;
        markMine.position.set(xm, 0.12, 0.22);
        markBot.position.set(xb, 0.12, -0.22);
        const gm = Math.abs(xm - X(d.target));
        const gb = Math.abs(xb - X(d.target));
        gapMine.scale.x = Math.max(0.001, gm);
        gapMine.position.x = (xm + X(d.target)) / 2;
        gapBot.scale.x = Math.max(0.001, gb);
        gapBot.position.x = (xb + X(d.target)) / 2;
      }
      // the monster: thinks while you choose, dances or flops after
      if (bot) {
        const b = botSpring.update(vdt);
        const thinking = state.phase === 'play';
        bot.think.visible = thinking;
        bot.think.children.forEach((dot, i) => {
          dot.position.y = ctx.reducedMotion ? 0 : Math.max(0, Math.sin(t * 5 - i * 0.7)) * 0.15;
        });
        const dance = reveal > 0.72 && state.outcome === -1 && !ctx.reducedMotion;
        bot.group.rotation.y = dance ? Math.sin(t * 8) * 0.4 : Math.sin(t * 0.8) * 0.15;
        bot.group.position.y = 0.25 + (dance ? Math.abs(Math.sin(t * 8)) * 0.35 : 0);
        bot.body.scale.set(1 - b * 0.05, 0.9 + b * 0.08, 1 - b * 0.05);
      }
      // neon breathing + perfect ring
      const breathe = ctx.reducedMotion ? 1 : 1 + Math.sin(t * 1.6) * 0.04;
      neonA.scale.set(breathe, breathe, 1);
      if (ringT >= 0) {
        ringT += dt;
        const k = Math.min(1, ringT / 1.2);
        ring.visible = k < 1;
        ring.position.set(-2.2, 1.6, 0.55);
        ring.scale.setScalar(0.5 + k * 4);
        if (k >= 1) ringT = -1;
      }
      const sh = shake.update(dt);
      world.camera.position.x = sh.x;
      world.camera.position.y = 7.6 + sh.y;
    },
    pointer(p: PointerInfo, state, emit) {
      if (p.type !== 'down' || state.phase !== 'play') return;
      const id = hitId(proxies, p.raycaster);
      if (id !== null && id < HAND) emit({ t: 'card', id });
    },
    screenPos(_s, id) {
      // just below the middle card of the hand: where the + / − keys sit
      if (id === TOGGLE_ANCHOR) {
        const v = tmp.set(0, 0.05, 2.65).project(world.camera);
        return { x: v.x, y: v.y };
      }
      const obj = proxies[id];
      if (!obj) return null;
      const v = obj.getWorldPosition(tmp).project(world.camera);
      return { x: v.x, y: v.y };
    },
    setCursor(id) {
      cursorId = id;
    },
    setGlow(id) {
      glowId = id;
    },
    dispose() {
      disposeTree(root);
    },
  };
}
