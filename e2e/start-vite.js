import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadLocalEnvironment, safeProcessEnvironment } from './environment.js';

// Re-exec before importing Vite so inherited VITE_*, NODE_OPTIONS, DEBUG and proxy
// settings cannot affect environment loading or expose caller secrets.
if (process.argv[2] !== 'isolated') {
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'isolated'], {
    env: safeProcessEnvironment(process.env),
    stdio: 'inherit',
  });
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
  } catch {
    console.error('Isolated E2E frontend could not start. Configuration values are not displayed.');
    process.exitCode = 1;
  }
}
