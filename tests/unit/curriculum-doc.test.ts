import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CURRICULUM } from '../../src/domain/curriculum/curriculum';
import { renderCurriculumDoc } from '../../tools/curriculum-doc';

describe('[E2a] 교과 정렬 문서화', () => {
  it('docs/CURRICULUM_VERIFY.md is up to date and lists every level with status + evidence', () => {
    const doc = readFileSync('docs/CURRICULUM_VERIFY.md', 'utf8');
    expect(doc).toBe(renderCurriculumDoc());
    for (const l of CURRICULUM) {
      expect(doc).toContain(`| ${l.id} |`);
      expect(l.evidence.length).toBeGreaterThan(5);
    }
  });
});
