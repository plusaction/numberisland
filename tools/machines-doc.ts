/** Renders docs/STATE_MACHINES.md from the machine tables in the code (single source of truth). */
import { SCREENS, SESSION, sessionFlags } from '../src/application/machines';
import { type PhaseTable, phasesToMermaid, toMermaid } from '../src/domain/fsm';
import { BOMB_PHASES, BOMB_PHASES_INITIAL } from '../src/stages/bomb/rules';
import { CARD_PHASES, CARD_PHASES_INITIAL } from '../src/stages/cardbattle/rules';
import { ESCAPE_PHASES, ESCAPE_PHASES_INITIAL } from '../src/stages/escape/rules';
import { FISHING_PHASES, FISHING_PHASES_INITIAL } from '../src/stages/fishing/rules';
import { PIZZA_PHASES, PIZZA_PHASES_INITIAL } from '../src/stages/pizza/rules';
import { RACE_PHASES, RACE_PHASES_INITIAL } from '../src/stages/race/rules';
import { SLIME_PHASES, SLIME_PHASES_INITIAL } from '../src/stages/slime/rules';
import { ZOMBIE_PHASES, ZOMBIE_PHASES_INITIAL } from '../src/stages/zombie/rules';

const STAGES: [string, string, string, PhaseTable<string>][] = [
  ['bomb', '① 폭탄 해체반', BOMB_PHASES_INITIAL, BOMB_PHASES],
  ['zombie', '② 좀비 숫자 막기', ZOMBIE_PHASES_INITIAL, ZOMBIE_PHASES],
  ['fishing', '③ 숫자 낚시', FISHING_PHASES_INITIAL, FISHING_PHASES],
  ['slime', '④ 슬라임 합체', SLIME_PHASES_INITIAL, SLIME_PHASES],
  ['escape', '⑤ 이상한 자물쇠 방탈출', ESCAPE_PHASES_INITIAL, ESCAPE_PHASES],
  ['pizza', '⑥ 피자 가게 둘이서', PIZZA_PHASES_INITIAL, PIZZA_PHASES],
  ['cardbattle', '⑦ 숫자 카드 배틀', CARD_PHASES_INITIAL, CARD_PHASES],
  ['race', '⑧ 정답 달리기 레이스', RACE_PHASES_INITIAL, RACE_PHASES],
];

const fence = (body: string) => `\`\`\`mermaid\n${body}\n\`\`\``;

export function renderMachinesDoc(): string {
  const out: string[] = [];
  out.push(
    '# 상태 머신 (자동 생성 — 직접 고치지 말 것)',
    '',
    '`pnpm machines:doc`이 코드의 전이표에서 이 문서를 만든다(`tools/machines-doc.ts`). 표를 고치면 문서·테스트가 따라온다.',
    '',
    '- 정의: `src/domain/fsm.ts`(도구), `src/application/machines.ts`(화면·세션), 각 `src/stages/<id>/rules.ts`의 `*_PHASES`(스테이지 단계).',
    '- 강제: `store.go()`는 화면 머신에 없는 이동을 거부, `tests/replay/phases.test.ts`는 놀이 중 일어난 모든 단계 전이가 표에 있는지 확인, `tests/unit/machines.test.ts`는 화면·세션 머신.',
    '',
    '## 에이전트·테스트용 빠른 조회',
    '',
    '| 무엇 | 어디서 |',
    '|---|---|',
    '| 지금 화면, 갈 수 있는 다음 화면, 스테이지 단계 | 브라우저 콘솔 `__game.snapshot()` |',
    '| 스테이지가 지금 입력을 받는가 | `__stage.info().acceptsInput` (= 단계 표의 `input` + 튜토리얼 잠금 아님) |',
    '| 세션 상태(튜토리얼/놀이/힌트/끝) | DOM `[data-testid=stage]`의 `data-session` 속성 |',
    '| 한 문제 풀기(같은 입력 경로) | `__stage.solveOne()` — `acceptsInput`일 때만 효과 |',
    '',
    '## 1. 화면 흐름 (`SCREENS`)',
    '',
    fence(toMermaid(SCREENS)),
    '',
    '## 2. 스테이지 세션 (`SESSION`)',
    '',
    '한 스테이지 안에서의 진행: 무언 튜토리얼 → 놀이 ↔ 힌트 → 끝. 예전의 `tutorial`·`hintOpen`·`locked`·`paused` 불리언을 대신한다.',
    '',
    fence(toMermaid(SESSION)),
    '',
    '| 상태 | 입력 잠금 | 시뮬레이션 멈춤(실시간 스테이지) | 힌트 창 |',
    '|---|---|---|---|',
  );
  for (const st of Object.keys(SESSION.states) as (keyof typeof SESSION.states)[]) {
    const f = sessionFlags(st, true);
    out.push(
      `| ${st} | ${f.inputLocked ? '예' : '—'} | ${f.simPaused ? '예' : '—'} | ${f.hintPanel ? '예' : '—'} |`,
    );
  }
  out.push(
    '',
    '## 3. 스테이지 단계',
    '',
    '`입력` = 아이의 답을 받는 단계, `연출` = 정해진 틱 뒤 스스로 끝나는 단계.',
    '',
  );
  for (const [id, name, initial, table] of STAGES) {
    out.push(
      `### ${name} (\`${id}\`)`,
      '',
      fence(phasesToMermaid(initial, table)),
      '',
      '| 단계 | 입력 | 연출 | 다음 | 설명 |',
      '|---|---|---|---|---|',
    );
    for (const [phase, spec] of Object.entries(table))
      out.push(
        `| ${phase} | ${spec.input ? '예' : '—'} | ${spec.timed ? '예' : '—'} | ${spec.to.join(', ') || '—'} | ${spec.note} |`,
      );
    out.push('');
  }
  out.push(
    '## 4. 일부러 암묵적으로 둔 작은 머신',
    '',
    '표로 만들면 코드만 늘고 얻는 것이 적어 그대로 둔 것들(찾을 수 있게 목록만 남김):',
    '',
    '| 무엇 | 어디 | 상태 | 그대로 둔 이유 |',
    '|---|---|---|---|',
    '| 섬 드래그 | `src/scenes/island/island.ts` | 없음 → 눌림 → 끄는 중 | 한 함수 안의 지역 상태 3개, e2e로 검증 |',
    '| 장면 연출 타이머 | 각 `scene.ts`의 `xxxT`(−1 = 꺼짐), `once()` | 꺼짐 ↔ 재생 중 | 판정과 무관한 장식(P5), 프레임마다 스스로 끝남 |',
    '| 힌트 사다리 | `RoundCore.puzzleHints` 0→4, 4에서 닫으면 새 숫자 | 0..4 | 숫자 하나로 충분, E4 테스트가 지킴 |',
    '| 말풍선 | `SayBubble` 큰 글씨 → 7초 뒤 작게 | 큼 ↔ 작음 | 컴포넌트 지역 상태 |',
    '| 렌더러 | `WorldHost`/`RenderWorld` WebGPU → WebGL2 폴백 → 장치 손실 복구 → 치명 오류 | 4 | 브라우저 이벤트 주도, e2e `engine.spec`이 검증 |',
    '| 저장 | `createSaver` 한가함 → 대기(디바운스) → 저장 중 | 3 | infra 내부, 단위 테스트 있음 |',
    '| 적응 엔진 | `adaptive.ts` 승급/강등/구조 모드 | 레벨 × 연속 기록 | 이미 순수 함수 + 속성 테스트 |',
    '',
  );
  return `${out.join('\n')}`;
}
