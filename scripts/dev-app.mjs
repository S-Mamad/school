import { spawn } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const node = process.execPath;
const api = spawn(node, ['server/index.mjs'], { cwd: root, stdio: 'inherit' });
const vite = spawn(node, ['node_modules/vite/bin/vite.js', '--config', 'vite.host.config.ts', '--configLoader', 'native', '--host', '127.0.0.1'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, VITE_LIVE: '1' },
});

function stop(code = 0) {
  api.kill();
  vite.kill();
  process.exit(code);
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
api.on('exit', (code) => { if (code) stop(code); });
vite.on('exit', (code) => stop(code ?? 0));
void path;
