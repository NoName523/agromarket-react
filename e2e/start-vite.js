import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadLocalEnvironment, safeProcessEnvironment } from './environment.js';

// Re-exec before importing Vite so inherited VITE_*, NODE_OPTIONS, DEBUG and proxy
// settings cannot affect environment loading or expose caller secrets.
if (process.argv[2] !== 'isolated') {
  const diagnostic = process.env.E2E_PHASE === 'diagnostic';
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'isolated', diagnostic ? 'diagnostic' : 'quiet'], {
    env: safeProcessEnvironment(process.env),
    stdio: 'inherit',
  });
  if (diagnostic) {
    child.once('spawn', () => console.error('E2E webServer: Vite process spawned.'));
    child.once('exit', () => console.error('E2E webServer: Vite process exited.'));
    child.once('close', () => console.error('E2E webServer: Vite process streams closed.'));
    child.once('error', () => console.error('E2E webServer: Vite process error.'));
    process.once('exit', () => console.error('E2E webServer: launcher exited.'));
  }
  child.on('error', () => { process.exitCode = 1; });
  child.on('exit', (code) => { process.exitCode = code ?? 1; });
} else {
  try {
    const { frontend, api } = loadLocalEnvironment();
    process.env.VITE_API_URL = api.href.replace(/\/$/, '');
    const { createServer } = await import('vite');
    const server = await createServer({
      root: fileURLToPath(new URL('../', import.meta.url)),
      envDir: false,
      mode: 'e2e',
      server: { host: frontend.hostname.replace(/^\[|\]$/g, ''), port: Number(frontend.port || 80), strictPort: true, hmr: false },
    });
    await server.listen();
    if (process.argv[3] === 'diagnostic') {
      console.error('E2E webServer: Vite listening.');
      process.once('exit', () => console.error('E2E webServer: Vite exiting.'));
    }
  } catch {
    console.error('Isolated E2E frontend could not start. Configuration values are not displayed.');
    process.exitCode = 1;
  }
}
