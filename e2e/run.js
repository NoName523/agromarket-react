import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { launchPlans } from './runner-policy.js';
import { loadLocalEnvironment } from './environment.js';

try {
  const plans = launchPlans(process.argv.slice(2), process.env, randomUUID());
  if (plans[0].env.E2E_MODE === 'local') loadLocalEnvironment();
  for (const plan of plans) {
    const code = await new Promise((resolve) => {
      const sensitive = plan.phase === 'sensitive';
      const child = spawn(process.execPath, plan.args, {
        cwd: fileURLToPath(new URL('../', import.meta.url)),
        env: plan.env,
        stdio: sensitive ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      });
      // Sensitive process output may include startup/worker errors before the reporter runs.
      // Print no raw stdout/stderr, even on failure.
      if (sensitive) { child.stdout.resume(); child.stderr.resume(); }
      child.on('error', () => resolve(1));
      child.on('exit', (exitCode) => resolve(exitCode ?? 1));
    });
    if (plan.phase === 'sensitive') console.log(code === 0 ? 'Sensitive E2E: passed.' : 'Sensitive E2E: failed; details suppressed for security.');
    if (code !== 0) process.exitCode = 1;
  }
} catch {
  console.error('E2E refused: check approved arguments and local environment configuration. Values are not displayed.');
  process.exitCode = 1;
}
