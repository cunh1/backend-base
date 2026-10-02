// Prepara o projeto inteiro (backend + frontend) de uma vez: cria os .env que faltam e
// instala as dependências dos dois lados. Escrito em Node puro para funcionar igual em
// Windows (cmd/PowerShell), Mac e Linux — nada de cp/copy/&& que mudam por terminal.
import { existsSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const raiz = path.resolve(import.meta.dirname, '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function criarEnvSeFaltar(pasta, origem = '.env.example', destino = '.env') {
  const de = path.join(pasta, origem);
  const para = path.join(pasta, destino);
  if (!existsSync(de)) return;
  if (existsSync(para)) {
    console.log(`✓ ${path.join(path.relative(raiz, pasta) || '.', destino)} já existe`);
    return;
  }
  copyFileSync(de, para);
  console.log(`✓ criado ${path.join(path.relative(raiz, pasta) || '.', destino)}`);
}

function instalar(pasta, rotulo) {
  console.log(`\n→ instalando dependências (${rotulo})…`);
  execFileSync(npm, ['install'], { cwd: pasta, stdio: 'inherit' });
}

criarEnvSeFaltar(raiz);
criarEnvSeFaltar(path.join(raiz, 'frontend'), '.env.example', '.env.local');

instalar(raiz, 'backend');
instalar(path.join(raiz, 'frontend'), 'frontend');

console.log('\nTudo pronto. Para rodar os dois juntos: npm run dev:all');
