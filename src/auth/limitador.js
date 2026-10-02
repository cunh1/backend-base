import { db } from '../db/connection.js';
import { paraSql } from './tempo.js';

// Limitador simples guardado no banco (sobrevive a reinícios e funciona com e-mails inexistentes).

export function contar(chave, janelaMs) {
  return db
    .prepare('SELECT COUNT(*) AS n FROM tentativas_login WHERE chave = ? AND criada_em > ?')
    .get(chave, paraSql(Date.now() - janelaMs)).n;
}

export function registrar(chave) {
  db.prepare('INSERT INTO tentativas_login (chave, criada_em) VALUES (?, ?)').run(chave, paraSql());
}

export function limpar(chave) {
  db.prepare('DELETE FROM tentativas_login WHERE chave = ?').run(chave);
}
