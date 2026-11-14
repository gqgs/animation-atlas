import { discoverSeeds } from './discovery.mjs';
import { UINT32_MAX } from './field.mjs';

const [start = 2718, count = 256] = process.argv.slice(2).map(Number);
if (!Number.isInteger(start) || start < 0 || start > UINT32_MAX ||
    !Number.isSafeInteger(count) || count < 1) {
  console.error('Usage: node scan.mjs [uint32 starting seed] [positive candidate count]');
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ start, count, candidates: discoverSeeds(start, count) }, null, 2));
}
