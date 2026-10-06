// Versão antiga: backend na porta 3000 e frontend no Vite dev server (porta 5173),
// cada um na sua porta, com hot-reload instantâneo do React. Use "npm run dev:all"
// para o modo padrão (tudo em localhost:3000); use este só se precisar do HMR do Vite.
import { spawn, execSync } from 'node:child_process';
import path from 'node:path';

const raiz = path.resolve(import.meta.dirname, '..');
const windows = process.platform === 'win32';
const npm = windows ? 'npm.cmd' : 'npm';

const processos = [
  { rotulo: 'backend ', cor: '36', cmd: 'node', args: ['--watch', 'src/server.js'], cwd: raiz },
  { rotulo: 'frontend', cor: '35', cmd: npm, args: ['run', 'dev'], cwd: path.join(raiz, 'frontend') },
];

function prefixar(rotulo, cor, texto) {
  const prefixo = `\x1b[${cor}m[${rotulo}]\x1b[0m `;
  return texto
    .toString()
    .split('\n')
    .filter((linha, i, arr) => linha !== '' || i < arr.length - 1)
    .map((linha) => prefixo + linha)
    .join('\n');
}

function matar(filho) {
  if (!filho.pid) return;
  if (windows) {
    try {
      execSync(`taskkill /pid ${filho.pid} /T /F`, { stdio: 'ignore' });
    } catch {
      // processo já tinha encerrado sozinho
    }
    return;
  }
  try {
    process.kill(-filho.pid, 'SIGTERM');
  } catch {
    try {
      filho.kill('SIGKILL');
    } catch {
      // idem
    }
  }
}

let encerrando = false;
const filhos = processos.map(({ rotulo, cor, cmd, args, cwd }) => {
  const filho = spawn(cmd, args, { cwd, shell: windows, detached: !windows });
  filho.stdout.on('data', (d) => process.stdout.write(prefixar(rotulo, cor, d) + '\n'));
  filho.stderr.on('data', (d) => process.stderr.write(prefixar(rotulo, cor, d) + '\n'));
  filho.on('exit', (codigo) => {
    if (encerrando) return;
    console.log(`\n[${rotulo}] saiu (código ${codigo}) — encerrando o outro processo também…`);
    encerrarTodos();
  });
  return filho;
});

function encerrarTodos() {
  if (encerrando) return;
  encerrando = true;
  for (const filho of filhos) matar(filho);
  setTimeout(() => process.exit(0), 300);
}

process.on('SIGINT', encerrarTodos);
process.on('SIGTERM', encerrarTodos);

console.log('Subindo backend (http://localhost:3000) e frontend (http://localhost:5173). Ctrl+C encerra os dois.\n');
