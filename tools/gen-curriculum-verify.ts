import { writeFileSync } from 'node:fs';
import { renderCurriculumDoc } from './curriculum-doc';

writeFileSync('docs/CURRICULUM_VERIFY.md', renderCurriculumDoc());
console.log('docs/CURRICULUM_VERIFY.md updated');
