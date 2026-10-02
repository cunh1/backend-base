import { db } from '../db/connection.js';
import { config } from '../config.js';
import { paraSql } from './tempo.js';

/** Apaga sessões, tokens e registros de tentativas que já não servem para mais nada. */
export function limparExpirados() {
  const agora = Date.now();
  const sessoes = db
    .prepare('DELETE FROM sessoes WHERE expira_em <= ? OR ultimo_uso_em <= ?')
    .run(paraSql(agora), paraSql(agora - config.auth.sessaoInatividadeMs)).changes;
  const tokens = db.prepare('DELETE FROM tokens_usuario WHERE expira_em <= ?').run(paraSql(agora)).changes;
  const tentativas = db
    .prepare('DELETE FROM tentativas_login WHERE criada_em <= ?')
    .run(paraSql(agora - 2 * 60 * 60 * 1000)).changes;
  return { sessoes, tokens, tentativas };
}
