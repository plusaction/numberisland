/**
 * QUALITY96 scorer (`pnpm check:score`).
 * - Validates rubric totals (each axis = 100).
 * - Runs vitest (json + coverage) and maps test names tagged `[ID]` / `[ID:stage]` to rubric items.
 * - Evidence rules: no passing tagged test and no evidence file ⇒ 0. Any failing tagged test ⇒ 0.
 * - perStage items scale by stages covered / 8.
 * - Reviewer verdicts (docs/review/verdicts.json, written from adversarial-reviewer output) cap the claim.
 * - HUMAN scores come only from docs/HUMAN_INPUT.md.
 * - Without a GPU, `gpu` items (and `gpuPart` points) move to HUMAN (QUALITY96 §0-5).
 * Writes reports/score.json and the auto section of docs/SCORECARD.md.
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

interface Item {
  id: string;
  axis: string;
  title: string;
  points: number;
  kind: 'AUTO' | 'REVIEW' | 'HUMAN';
  perStage?: boolean;
  files?: string[];
  gpu?: boolean;
  gpuPart?: number;
}
interface Rubric {
  axes: Record<string, string>;
  stages: string[];
  items: Item[];
}
interface VitestJson {
  testResults: { assertionResults: { fullName: string; status: string }[] }[];
}

const rubric = JSON.parse(readFileSync('tools/score/rubric.json', 'utf8')) as Rubric;
const noRun = process.argv.includes('--no-run');
const errors: string[] = [];

// 1. rubric totals
const totals: Record<string, number> = {};
for (const it of rubric.items) totals[it.axis] = (totals[it.axis] ?? 0) + it.points;
for (const axis of Object.keys(rubric.axes))
  if (totals[axis] !== 100) errors.push(`axis ${axis} totals ${totals[axis]} ≠ 100`);

// 2. environment
const hasGpu = process.env.NUMBERISLAND_GPU === '1' || existsSync('/dev/dri');

// 3. run tests
if (!noRun) {
  spawnSync(
    'pnpm',
    [
      'exec',
      'vitest',
      'run',
      '--reporter=json',
      '--outputFile=reports/vitest.json',
      '--coverage',
      '--coverage.reporter=json-summary',
    ],
    { stdio: 'inherit' },
  );
}
const tests: { name: string; ok: boolean }[] = [];
if (existsSync('reports/vitest.json')) {
  const vj = JSON.parse(readFileSync('reports/vitest.json', 'utf8')) as VitestJson;
  for (const f of vj.testResults)
    for (const a of f.assertionResults) tests.push({ name: a.fullName, ok: a.status === 'passed' });
}
const e2e: { name: string; ok: boolean }[] = [];
if (existsSync('reports/e2e.json')) {
  interface PwSpec {
    title: string;
    ok: boolean;
  }
  interface PwSuite {
    title: string;
    specs?: PwSpec[];
    suites?: PwSuite[];
  }
  const walk = (s: PwSuite, prefix: string) => {
    for (const sp of s.specs ?? []) e2e.push({ name: `${prefix} ${s.title} ${sp.title}`, ok: sp.ok });
    for (const c of s.suites ?? []) walk(c, `${prefix} ${s.title}`);
  };
  const pj = JSON.parse(readFileSync('reports/e2e.json', 'utf8')) as { suites: PwSuite[] };
  for (const s of pj.suites) walk(s, '');
}
const allTests = [...tests, ...e2e];

// 4. special checks
function run(cmd: string): boolean {
  try {
    execSync(cmd, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}
const special: Record<string, { ok: boolean; note: string; fraction?: number }> = {};
{
  const offline = existsSync('dist') && run('node tools/check-offline.mjs');
  const csp =
    existsSync('public/_headers') && readFileSync('index.html', 'utf8').includes('Content-Security-Policy');
  special.S1 = {
    ok: offline && csp,
    note: `check-offline ${offline ? 'OK' : 'FAIL/빌드 없음'}, CSP ${csp ? 'OK' : '없음'}`,
  };
}
{
  let cov = 0;
  if (existsSync('reports/coverage/coverage-summary.json')) {
    const c = JSON.parse(readFileSync('reports/coverage/coverage-summary.json', 'utf8')) as {
      total: { lines: { pct: number } };
    };
    cov = c.total.lines.pct;
  }
  const tsc = run('pnpm -s typecheck');
  const cruise = run('pnpm -s boundaries');
  const unitOk = tests.length > 0 && tests.every((t) => t.ok);
  const hasReplay = tests.some((t) => /\[G1:/.test(t.name));
  const hasE2e = e2e.length > 0 && e2e.every((t) => t.ok);
  const parts = [tsc, cruise, unitOk, cov >= 90, hasReplay, hasE2e];
  special.S4 = {
    ok: parts.every(Boolean),
    fraction: parts.filter(Boolean).length / parts.length,
    note: `tsc ${tsc ? 'OK' : 'FAIL'}, 경계 ${cruise ? 'OK' : 'FAIL'}, 단위/속성 ${unitOk ? 'OK' : 'FAIL'} (${tests.length}), domain 커버리지 ${cov.toFixed(1)}%, 리플레이 ${hasReplay ? '있음' : '없음'}, e2e ${hasE2e ? 'OK' : '없음/실패'}`,
  };
}

// 5. reviewer verdicts + human input
const verdicts: Record<string, { score: number; note?: string }> = existsSync('docs/review/verdicts.json')
  ? (JSON.parse(readFileSync('docs/review/verdicts.json', 'utf8')) as Record<
      string,
      { score: number; note?: string }
    >)
  : {};
const human: Record<string, number> = {};
if (existsSync('docs/HUMAN_INPUT.md')) {
  for (const line of readFileSync('docs/HUMAN_INPUT.md', 'utf8').split('\n')) {
    const m = /^\|\s*([A-Z]\d+[a-z]?)\s*\|[^|]*\|[^|]*\|[^|]*\|\s*(\d+(?:\.\d+)?)\s*\|/.exec(line);
    if (m) human[m[1] as string] = Number(m[2]);
  }
}

// 6. score items
interface Row {
  id: string;
  axis: string;
  title: string;
  kind: string;
  points: number;
  claim: number;
  reviewer: number | null;
  final: number;
  human: boolean;
  evidence: string;
}
const rows: Row[] = [];
for (const it of rubric.items) {
  const tagRe = new RegExp(`\\[${it.id}(?::([a-z]+))?\\]`);
  const tagged = allTests.filter((t) => tagRe.test(t.name));
  const files = it.files ?? [];
  const missingFiles = files.filter((f) => !existsSync(f));
  let kind = it.kind;
  let autoPoints = it.points;
  let humanPoints = 0;
  if (!hasGpu && it.gpu) {
    kind = 'HUMAN';
  } else if (!hasGpu && it.gpuPart) {
    autoPoints = it.points - it.gpuPart;
    humanPoints = it.gpuPart;
  }
  let claim = 0;
  let evidence = '';
  if (kind === 'HUMAN') {
    const h = human[it.id];
    claim = h === undefined ? 0 : Math.min(it.points, h);
    evidence = h === undefined ? 'HUMAN 입력 없음 → 0' : 'docs/HUMAN_INPUT.md';
    rows.push({
      id: it.id,
      axis: it.axis,
      title: it.title,
      kind,
      points: it.points,
      claim,
      reviewer: null,
      final: claim,
      human: true,
      evidence,
    });
    continue;
  }
  const sp = special[it.id];
  if (sp) {
    claim = autoPoints * (sp.fraction ?? (sp.ok ? 1 : 0));
    evidence = sp.note;
  } else if (tagged.some((t) => !t.ok)) {
    claim = 0;
    evidence = `실패한 테스트 ${tagged.filter((t) => !t.ok).length}개`;
  } else if (missingFiles.length) {
    claim = 0;
    evidence = `증거 파일 없음: ${missingFiles.join(', ')}`;
  } else if (kind === 'REVIEW') {
    claim = autoPoints;
    evidence = files.length ? `파일 ${files.join(', ')} — 리뷰어 판정 필요` : '리뷰어 판정 필요';
  } else if (tagged.length === 0) {
    claim = 0;
    evidence = '증거 없음';
  } else if (it.perStage) {
    const covered = new Set(tagged.map((t) => tagRe.exec(t.name)?.[1]).filter(Boolean));
    claim = (autoPoints * covered.size) / rubric.stages.length;
    evidence = `테스트 ${tagged.length}개 통과, 스테이지 ${covered.size}/${rubric.stages.length} (${[...covered].join(', ')})`;
  } else {
    claim = autoPoints;
    evidence = `테스트 ${tagged.length}개 통과${files.length ? ` + ${files.join(', ')}` : ''}`;
  }
  const v = verdicts[it.id];
  let reviewer: number | null = v ? v.score : null;
  // REVIEW items count only after a reviewer verdict.
  let final = kind === 'REVIEW' ? Math.min(claim, reviewer ?? 0) : Math.min(claim, reviewer ?? claim);
  if (v?.note) evidence += ` / 리뷰어: ${v.note}`;
  if (humanPoints) {
    const h = human[it.id];
    const hp = h === undefined ? 0 : Math.min(humanPoints, h);
    final += hp;
    reviewer = reviewer === null ? null : reviewer + hp;
    evidence += ` / GPU 부분 ${humanPoints}점 HUMAN(${h === undefined ? '미입력' : h})`;
  }
  rows.push({
    id: it.id,
    axis: it.axis,
    title: it.title,
    kind,
    points: it.points,
    claim: Math.round(claim * 10) / 10,
    reviewer,
    final: Math.round(final * 10) / 10,
    human: false,
    evidence,
  });
}

// 7. axis summary
const summary = Object.entries(rubric.axes).map(([axis, name]) => {
  const r = rows.filter((x) => x.axis === axis);
  const nonHuman = r.filter((x) => !x.human);
  const nhMax = nonHuman.reduce((s, x) => s + x.points, 0);
  const nhFinal = nonHuman.reduce((s, x) => s + x.final, 0);
  const humanFinal = r.filter((x) => x.human).reduce((s, x) => s + x.final, 0);
  const total = Math.round((nhFinal + humanFinal) * 10) / 10;
  const agentGate = nhMax > 0 && nhFinal >= nhMax * 0.97 && nonHuman.every((x) => x.final >= x.points * 0.9);
  return {
    axis,
    name,
    nhMax,
    nhFinal: Math.round(nhFinal * 10) / 10,
    humanFinal,
    total,
    agentGate,
    pass96: total >= 96,
  };
});

writeFileSync('reports/score.json', JSON.stringify({ hasGpu, summary, rows, errors }, null, 2));

const table = [
  `> 자동 생성 \`pnpm check:score\` (${new Date().toISOString().slice(0, 10)}, GPU ${hasGpu ? '있음' : '없음 → F6·S3/S5 일부는 HUMAN'})`,
  '> **점수 부풀림 방지**: 증거(통과한 태그 테스트·파일)가 없으면 0점. REVIEW 항목은 리뷰어 판정 전 0점. HUMAN 항목은 `docs/HUMAN_INPUT.md` 입력 전 0점.',
  '',
  '| 축 | 비-HUMAN 점수 / 만점 | HUMAN 입력 | 확정 점수 | 에이전트 게이트 | 96 달성 |',
  '|---|---|---|---|---|---|',
  ...summary.map(
    (s) =>
      `| ${s.axis} ${s.name} | ${s.nhFinal} / ${s.nhMax} | ${s.humanFinal} | ${s.total} | ${s.agentGate ? '✅' : '❌'} | ${s.pass96 ? '✅' : '❌'} |`,
  ),
  '',
  '| ID | 항목 | 종류 | 배점 | 자동 증거 | 리뷰어 | 확정 | 근거 |',
  '|---|---|---|---|---|---|---|---|',
  ...rows.map(
    (r) =>
      `| ${r.id} | ${r.title} | ${r.kind} | ${r.points} | ${r.human ? '—' : r.claim} | ${r.reviewer ?? '—'} | ${r.final} | ${r.evidence} |`,
  ),
].join('\n');

const path = 'docs/SCORECARD.md';
const START = '<!-- AUTO:START -->';
const END = '<!-- AUTO:END -->';
let doc = existsSync(path) ? readFileSync(path, 'utf8') : `# SCORECARD\n\n${START}\n${END}\n`;
if (!doc.includes(START)) doc += `\n${START}\n${END}\n`;
doc = doc.replace(new RegExp(`${START}[\\s\\S]*${END}`), `${START}\n${table}\n${END}`);
writeFileSync(path, doc);

for (const s of summary) console.log(`${s.axis} ${s.name}: ${s.total} (비-HUMAN ${s.nhFinal}/${s.nhMax})`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
