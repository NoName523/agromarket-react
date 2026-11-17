import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { launchPlans } from './runner-policy.js';
import { loadLocalEnvironment } from './environment.js';

const SENSITIVE_TIMEOUT_MS = 10 * 60 * 1000;
const sensitiveTests = new Set(['registration', 'incorrect-password', 'buyer-order', 'farmer-setup', 'farmer-product', 'farmer-price', 'other']);
const sensitiveStatuses = new Set(['passed', 'failed', 'timedOut', 'skipped', 'interrupted']);
const farmerSteps = new Set(['farmer-login', 'farmer-form-visible', 'farmer-form-fill', 'farmer-name-fill', 'farmer-price-fill', 'farmer-submit', 'farmer-response', 'farmer-catalog']);

try {
  const plans = launchPlans(process.argv.slice(2), process.env, randomUUID());
  if (plans[0].env.E2E_MODE === 'local') loadLocalEnvironment();
  for (const plan of plans) {
    console.log(`E2E phase ${plan.phase}: started.`);
    const authRoot = resolve('.playwright-auth');
    const authDirectory = resolve(authRoot, plan.env.E2E_RUN_ID);
    let authCreated = false;
    let code;
    try {
      if (plan.phase === 'sensitive') {
        await mkdir(authRoot, { recursive: true, mode: 0o700 });
        await mkdir(authDirectory, { mode: 0o700 });
        authCreated = true;
      }
      code = await new Promise((resolve) => {
      const sensitive = plan.phase === 'sensitive';
      const child = spawn(process.execPath, plan.args, {
        cwd: fileURLToPath(new URL('../', import.meta.url)),
        env: plan.env,
        stdio: sensitive ? ['ignore', 'pipe', 'pipe', 'ipc'] : 'inherit',
        detached: sensitive && process.platform !== 'win32',
      });
      if (!sensitive) {
        child.once('spawn', () => console.log(`E2E phase ${plan.phase}: Playwright spawned.`));
        child.once('exit', (code, signal) => {
          const outcome = Number.isInteger(code) ? `code ${code}` : signal ? 'signal' : 'unknown';
          console.log(`E2E phase ${plan.phase}: Playwright exited (${outcome}).`);
        });
        child.once('close', () => console.log(`E2E phase ${plan.phase}: Playwright streams closed.`));
        child.once('error', () => console.error(`E2E phase ${plan.phase}: Playwright process error.`));
      }
      // Sensitive process output may include startup/worker errors before the reporter runs.
      // Print no raw stdout/stderr, even on failure.
      if (sensitive) { child.stdout?.resume(); child.stderr?.resume(); }
      if (sensitive) child.on('message', (message) => {
        if (!message || typeof message !== 'object') return;
        if (message.event === 'complete') {
          console.log('Sensitive E2E: test execution completed; waiting for process cleanup.');
        } else if (message.event === 'step-start' && farmerSteps.has(message.step)) {
          console.log(`Sensitive E2E ${message.step}: started.`);
        } else if (message.event === 'step-end' && farmerSteps.has(message.step) &&
            ['passed', 'failed'].includes(message.status) && Number.isInteger(message.duration) &&
            message.duration >= 0 && message.duration <= 3600000) {
          console.log(`Sensitive E2E ${message.step}: ${message.status}, ${message.duration} ms.`);
        } else if (message.event === 'start' && sensitiveTests.has(message.test)) {
          console.log(`Sensitive E2E ${message.test}: started.`);
        } else if (message.event === 'end' && sensitiveTests.has(message.test) &&
            sensitiveStatuses.has(message.status) && Number.isInteger(message.duration) &&
            message.duration >= 0 && message.duration <= 3600000) {
          console.log(`Sensitive E2E ${message.test}: ${message.status}, ${message.duration} ms.`);
        }
      });
      let timedOut = false;
      let cleanupTimer;
      const timer = sensitive ? setTimeout(() => {
        timedOut = true;
        console.error('E2E phase sensitive: timed out; stopping its process tree.');
        cleanupTimer = setTimeout(() => {
          console.error('E2E phase sensitive: process cleanup could not be confirmed.');
          child.stdout?.destroy();
          child.stderr?.destroy();
          child.unref();
          resolve(1);
        }, 15000);
        if (!child.pid) return;
        if (process.platform === 'win32') {
          const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
            stdio: 'ignore', windowsHide: true,
          });
          killer.on('error', () => { child.kill(); });
          killer.on('close', (code) => { if (code !== 0 && child.exitCode === null) child.kill(); });
        } else {
          try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill(); }
        }
      }, SENSITIVE_TIMEOUT_MS) : null;
      const finish = (exitCode) => {
        if (timer) clearTimeout(timer);
        if (cleanupTimer) clearTimeout(cleanupTimer);
        resolve(timedOut ? 1 : exitCode ?? 1);
      };
      child.once('error', () => finish(1));
      child.once('close', (exitCode) => finish(exitCode));
      });
    } finally {
      if (authCreated) await rm(authDirectory, { recursive: true, force: true });
    }
    console.log(`E2E phase ${plan.phase}: ${code === 0 ? 'passed' : 'failed'}.`);
    if (code !== 0) process.exitCode = 1;
  }
} catch {
  console.error('E2E refused: check approved arguments and local environment configuration. Values are not displayed.');
  process.exitCode = 1;
}
