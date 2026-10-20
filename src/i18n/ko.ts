/**
 * All user-facing Korean strings (SPEC §0). Keep lines short (P4: ≤12 chars where possible).
 * Placeholders use {name} and are filled by `fmt`.
 */
import type { PraiseCategory } from '../domain/scoring/praise';

export const ko = {
  app: {
    title: '숫자섬 탐험대',
    loading: '섬으로 가는 중…',
  },
  praise: {
    correct: [
      '딩동댕!',
      '정답이야!',
      '와, 맞았어!',
      '척척박사!',
      '멋져요!',
      '최고야!',
      '반짝반짝!',
      '숫자 천재!',
      '좋았어!',
      '완벽해!',
    ],
    streak: [
      '오늘 컨디션 최고!',
      '연속 정답!',
      '불꽃 같아!',
      '멈출 수 없어!',
      '계속 맞히네!',
      '숫자 로켓!',
      '척척 연속!',
      '대단한 집중!',
    ],
    retrySuccess: [
      '또 해 보니 됐다!',
      '끝까지 해봤구나!',
      '다시 해서 해냈어!',
      '포기 안 했네!',
      '한 번 더 멋졌어!',
      '고쳐서 맞혔어!',
      '도전 성공!',
      '다시 생각했구나!',
    ],
    hintSuccess: [
      '단서를 잘 봤어!',
      '힌트 잘 썼어!',
      '도움 받아 해냈어!',
      '똑똑하게 풀었어!',
      '방법을 찾았구나!',
      '잘 따라 했어!',
      '힌트 박사!',
      '같이 해서 성공!',
    ],
    strategy: [
      '좋은 방법이야!',
      '10 만들기 멋졌어!',
      '자리를 잘 봤어!',
      '거꾸로 생각 최고!',
      '뛰어 세기 짱!',
      '묶어 세기 굿!',
      '나눠서 잘 풀었어!',
      '머리를 잘 썼어!',
    ],
    finish: [
      '멋진 하루였어!',
      '다음 모험도 기대돼!',
      '오늘도 해냈다!',
      '탐험 완료!',
      '친구들이 기뻐해!',
      '구슬을 찾았어!',
      '대장 탐험가!',
      '섬이 반짝여!',
    ],
  } satisfies Record<PraiseCategory, readonly string[]>,
  levelEvents: {
    promote: '새 코스가 열렸어요!',
    demote: '쉬운 코스 열렸어요',
    rescue: '같이 천천히 해요',
  },
  word: {
    /** Nouns with the right Korean counter; only food can be "eaten". */
    nouns: [
      { name: '사과', unit: '개', food: true },
      { name: '구슬', unit: '개', food: false },
      { name: '조개', unit: '개', food: false },
      { name: '사탕', unit: '개', food: true },
      { name: '물고기', unit: '마리', food: false },
      { name: '풍선', unit: '개', food: false },
      { name: '쿠키', unit: '개', food: true },
      { name: '연필', unit: '자루', food: false },
      { name: '도토리', unit: '개', food: false },
      { name: '딸기', unit: '개', food: true },
      { name: '스티커', unit: '장', food: false },
      { name: '오리', unit: '마리', food: false },
    ],
    JOIN: '{noun} {a}{unit}, {b}{unit} 더! 모두 몇 {unit}?',
    TAKE_FOOD: '{noun} {a}{unit} 중 {b}{unit} 먹었어. 남은 건?',
    TAKE_GIVE: '{noun} {a}{unit} 중 {b}{unit} 친구 줬어. 남은 건?',
    COMPARE_MORE: '{noun} {a}{unit}와 {b}{unit}. 몇 {unit} 더 많아?',
    GROUPS: '{noun} {b}{unit}씩 {count}묶음. 모두 몇 {unit}?',
  },
  /** Parent report "이렇게 도와주세요" tips per skill/misconception (SPEC §13). */
  parentTips: {
    PLACE_VALUE: '십 모형 막대와 낱개로 수를 만들어 보세요.',
    SKIP_COUNT: '계단을 오르며 10씩, 100씩 소리 내어 세어 보세요.',
    COMPOSE_10: '손가락 10개로 "몇과 몇이 10"을 놀이처럼 해 보세요.',
    ADD_NOCARRY: '일의 자리끼리, 십의 자리끼리 따로 더해 보게 하세요.',
    ADD_CARRY: '구슬 10개를 컵 하나로 묶는 "10 만들기"를 보여 주세요.',
    SUB_NOBORROW: '같은 자리끼리 빼는지 손가락으로 짚어 보게 하세요.',
    SUB_BORROW: '십 막대 하나를 낱개 10개로 바꾸는 장면을 보여 주세요.',
    THREE_TERM: '앞에서부터 차례로 계산하고 중간 답을 적게 하세요.',
    MISSING_TERM: '□를 "얼마를 더하면?"으로 바꿔 말해 보세요.',
    RELATION: '덧셈식 하나로 뺄셈식 두 개를 만들어 보세요.',
    COMPARE_EXPR: '큰 자리 숫자부터 비교하는 습관을 칭찬해 주세요.',
    ESTIMATE_CLOSE: '수직선에서 목표와 거리를 손가락으로 재 보세요.',
    REPEATED_ADD: '같은 개수씩 묶은 간식을 함께 세어 보세요.',
    WORD: '문제를 그림으로 그려 보게 하면 이해가 쉬워요.',
    CARRY_FORGOTTEN: '받아올린 1을 작은 점으로 표시하게 해 보세요.',
    BORROW_REVERSED: '큰 수에서 작은 수를 빼는 실수: 자리마다 위-아래 순서를 짚어 주세요.',
    OP_CONFUSED: '식의 +, − 기호를 먼저 소리 내어 읽게 하세요.',
    PLACE_SHIFT: '세로셈 칸을 그려 자리를 맞춰 쓰게 해 주세요.',
    OFF_BY_TEN: '십의 자리만 따로 다시 세어 보게 하세요.',
    OFF_BY_ONE: '마지막 하나를 셀 때 손가락으로 짚게 해 주세요.',
  },
} as const;

export type Strings = typeof ko;

export const PRAISE_POOL_SIZES: Record<PraiseCategory, number> = Object.fromEntries(
  Object.entries(ko.praise).map(([k, v]) => [k, v.length]),
) as Record<PraiseCategory, number>;

export function praiseText(id: string): string {
  const [cat, idx] = id.split('.') as [PraiseCategory, string];
  const list: readonly string[] = ko.praise[cat] ?? ko.praise.correct;
  return list[Number(idx)] ?? '딩동댕!';
}

export function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));
}
