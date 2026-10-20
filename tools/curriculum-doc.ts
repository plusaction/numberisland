import { CURRICULUM, levelSpec } from '../src/domain/curriculum/curriculum';
import { generateQuestion } from '../src/domain/edu/generate';
import { createRng } from '../src/domain/rng/rng';

const STATUS: Record<string, string> = {
  confirmed: '✅ confirmed',
  partial: '🟡 partial',
  assumed: '🟠 assumed',
  advanced: '⭐ 선행(교과 초과)',
};

function sample(levelId: (typeof CURRICULUM)[number]['id']): string {
  const rng = createRng(`doc-${levelId}`);
  const out: string[] = [];
  // one example per skill so the parent sees every kind of problem in the level
  for (const skill of levelSpec(levelId).skills) {
    const q = generateQuestion({ level: levelId, skill, rng });
    const ops = q.ops;
    let text: string;
    if (q.form === 'COMPARE' || q.form === 'CLOSEST') {
      text =
        q.choices.map((c) => c.display ?? String(c.value)).join(' vs ') +
        (q.target !== undefined ? ` (목표 ${q.target})` : '') +
        ` → ${q.answer}`;
    } else if (q.form === 'SEQUENCE') {
      text = `${q.operands.map((v, k) => (k === q.missingIndex ? '□' : String(v))).join(', ')} → ${q.answer}`;
    } else if (q.form === 'PLACE' && q.target !== undefined) {
      text = `${q.operands[0]}의 ${['일', '십', '백', '천'][q.target]}의 자리 → ${q.answer}`;
    } else {
      const terms = q.operands.map((v, k) => (k === q.missingIndex ? '□' : String(v)));
      const expr = terms.map((t, k) => (k === 0 ? t : `${ops[k - 1] === '-' ? '−' : '+'} ${t}`)).join(' ');
      text =
        q.missingIndex !== undefined && q.missingIndex >= 0
          ? `${expr} = ${q.result} → □=${q.answer}`
          : `${expr} = ${q.answer}`;
    }
    out.push(text);
  }
  return out.join('<br>');
}

export function renderCurriculumDoc(): string {
  const rows = CURRICULUM.map(
    (l) =>
      `| ${l.id} | ${l.band} | ${l.term} | ${l.title} | ${l.skills.join(', ')} | ≤${l.max} | ${l.carry} | ${l.representations.join(', ')} | ${STATUS[l.verified]} | ${l.evidence} | ${sample(l.id)} |`,
  );
  return [
    '# CURRICULUM_VERIFY — 교과 정렬 확인표',
    '',
    '> 자동 생성: `pnpm curriculum:verify` (원본: `src/domain/curriculum/curriculum.ts`). 직접 수정하지 마세요.',
    '> **부모/교사 확인 방법**: 아이 교과서(출판사·개정 연도)의 차례와 아래 "학기·내용"을 대조하고, 맨 아래 서명란에 결과를 적어 주세요(QUALITY96 E2b).',
    '',
    '| 레벨 | 밴드 | 학기 | 내용 | 스킬 | 수 범위 | 받아올림 | 표현 | 확인 상태 | 근거·메모 | 생성 예시 |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
    '## 사람 확인 (E2b)',
    '',
    '| 날짜 | 확인자 | 교과서(출판사/연도) | 일치하지 않는 레벨 | 메모 |',
    '|---|---|---|---|---|',
    '|  |  |  |  |  |',
    '',
  ].join('\n');
}
