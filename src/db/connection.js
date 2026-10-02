import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config.js';

fs.mkdirSync(path.dirname(config.caminhoBanco), { recursive: true });

export const db = new Database(config.caminhoBanco);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/** Executa fn (síncrona) numa transação: tudo é salvo, ou nada. */
export function emTransacao(fn) {
  db.exec('BEGIN');
  try {
    const resultado = fn();
    db.exec('COMMIT');
    return resultado;
  } catch (erro) {
    db.exec('ROLLBACK');
    throw erro;
  }
}
