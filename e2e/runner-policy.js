import { fileURLToPath } from 'node:url';
import { safeProcessEnvironment } from './environment.js';

export function launchPlans(args, source, runId) {
  if (args.length !== 1 || !['local', 'smoke', 'visual', 'visual-update'].includes(args[0])) throw new Error('Use an approved E2E command without additional CLI arguments.');
  if (!/^[a-zA-Z0-9-]+$/.test(runId)) throw new Error('Invalid E2E run identifier.');
  const selected = args[0];
  const visual = selected === 'visual' || selected === 'visual-update';
  const mode = visual ? 'local' : selected;
  return (visual ? ['diagnostic'] : mode === 'local' ? ['diagnostic', 'sensitive'] : ['smoke']).map((phase) => ({
    phase,
    args: [fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url)), 'test', '--config', fileURLToPath(new URL('../playwright.config.js', import.meta.url)), ...(visual ? ['--project=visual-chromium'] : []), ...(selected === 'visual-update' ? ['--update-snapshots'] : [])],
    env: {
      ...safeProcessEnvironment(source),
      E2E_MODE: mode,
      E2E_PHASE: phase,
      E2E_RUN_ID: runId,
      ...(mode === 'smoke' ? { PRODUCTION_URL: Object.hasOwn(source, 'BASE_URL') ? source.BASE_URL : source.PRODUCTION_URL || '' } : {}),
      ...(phase === 'sensitive' ? { PLAYWRIGHT_NO_COPY_PROMPT: '1' } : {}),
    },
  }));
}

export function validateRunSettings(env) {
  if (!/^[a-zA-Z0-9-]+$/.test(env.E2E_RUN_ID || '') ||
      !(env.E2E_MODE === 'local' && ['diagnostic', 'sensitive'].includes(env.E2E_PHASE) || env.E2E_MODE === 'smoke' && env.E2E_PHASE === 'smoke')) {
    throw new Error('Use the guarded npm E2E commands.');
  }
  return { smoke: env.E2E_MODE === 'smoke', sensitive: env.E2E_PHASE === 'sensitive' };
}
