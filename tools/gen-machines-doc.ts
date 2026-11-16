import { writeFileSync } from 'node:fs';
import { renderMachinesDoc } from './machines-doc';

writeFileSync('docs/STATE_MACHINES.md', renderMachinesDoc());
console.log('docs/STATE_MACHINES.md written');
