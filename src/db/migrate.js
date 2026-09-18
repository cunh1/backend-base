import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

/**
 * Aplica, em ordem, as migrações .sql que ainda não rodaram neste banco.
 * Cada migração roda dentro de uma transação: ou aplica inteira, ou nada.
 * Retorna a lista de arquivos aplicados nesta execução.
 */
export function migrar(db, pasta) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migracoes (
      nome        TEXT PRIMARY KEY,
      checksum    TEXT NOT NULL,
      aplicada_em TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const aplicadas = new Map(
    db.prepare('SELECT nome, checksum FROM _migracoes').all().map((m) => [m.nome, m.checksum]),
  );

  const arquivos = fs.readdirSync(pasta).filter((f) => f.endsWith('.sql')).sort();
  const novas = [];

  for (const arquivo of arquivos) {
    const sql = fs.readFileSync(path.join(pasta, arquivo), 'utf8');
    // Normaliza quebras de linha para o checksum não mudar entre Windows e Linux.
    const checksum = crypto.createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');

    if (aplicadas.has(arquivo)) {
      if (aplicadas.get(arquivo) !== checksum) {
        throw new Error(
          `A migração ${arquivo} já foi aplicada e depois foi alterada. ` +
            'Não edite migrações antigas: crie uma nova (npm run migrate:new).',
        );
      }
      continue;
    }

    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO _migracoes (nome, checksum) VALUES (?, ?)').run(arquivo, checksum);
      db.exec('COMMIT');
    } catch (erro) {
      db.exec('ROLLBACK');
      throw new Error(`Falha na migração ${arquivo}: ${erro.message}`);
    }
    novas.push(arquivo);
  }

  return novas;
}

// Permite rodar direto: npm run migrate
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { db } = await import('./connection.js');
  const { config } = await import('../config.js');
  const novas = migrar(db, config.pastaMigracoes);
  console.log(novas.length ? `Aplicadas: ${novas.join(', ')}` : 'Banco já está atualizado.');
  db.close();
}
