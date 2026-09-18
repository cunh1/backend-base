import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

const descricao = process.argv.slice(2).join(' ').trim();
if (!descricao) {
  console.error('Uso: npm run migrate:new -- "descrição da mudança"');
  process.exit(1);
}

const slug = descricao
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_|_$/g, '');

const existentes = fs.readdirSync(config.pastaMigracoes).filter((f) => /^\d+_.*\.sql$/.test(f));
const proximo = existentes.length ? Math.max(...existentes.map((f) => parseInt(f, 10))) + 1 : 1;
const nome = `${String(proximo).padStart(3, '0')}_${slug}.sql`;

fs.writeFileSync(path.join(config.pastaMigracoes, nome), `-- ${descricao}\n\n`);
console.log(`Criada: src/db/migrations/${nome}`);
