import { runApply } from '../lib/apply-stack.js';

runApply({ dryRun: true }).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
