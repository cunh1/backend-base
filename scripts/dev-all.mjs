// Sobe backend e frontend juntos, cada um com seu prefixo colorido no mesmo terminal,
// e derruba os dois se você fechar um deles ou apertar Ctrl+C. Sem depender de nenhum
// pacote novo (tipo "concurrently") nem de && — só child_process puro do Node.
import { spawn } from 'node:child_process';
import path from 'node:path';

const raiz = path.resolve(import.meta.dirname, '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

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

let encerrando = false;
const filhos = processos.map(({ rotulo, cor, cmd, args, cwd }) => {
  const filho = spawn(cmd, args, { cwd, shell: process.platform === 'win32' });
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
  encerrando = true;
  for (const filho of filhos) filho.kill();
  process.exit(0);
}

process.on('SIGINT', encerrarTodos);
process.on('SIGTERM', encerrarTodos);

console.log('Subindo backend (http://localhost:3000) e frontend (http://localhost:5173). Ctrl+C encerra os dois.\n');
