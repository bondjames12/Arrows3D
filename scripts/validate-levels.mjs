import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/game.js', import.meta.url), 'utf8');
const hardMilestones = ['Level 6', 'Level 10', 'Level 16', 'Level 20'];
const missing = hardMilestones.filter((levelName) => !source.includes(`name: '${levelName}'`) || !source.includes("tier: 'Hard'"));

if (!source.includes('function isPathClear')) throw new Error('Missing path-blocking movement rule.');
if (!source.includes('function spawnConfetti')) throw new Error('Missing win confetti effect.');
if (!source.includes('function buildCalendar')) throw new Error('Missing daily calendar mode.');
if (missing.length) throw new Error(`Missing hard milestone level(s): ${missing.join(', ')}`);

console.log('Validated Arrows 3D gameplay systems and hard milestone levels.');
