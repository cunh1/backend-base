import { db } from '../db/connection.js';
import { config } from '../config.js';
import { paraSql, deSql } from './tempo.js';
import { novoToken, hashToken } from './tokens.js';
import { paraPublico } from '../repositories/credenciais.js';

/** Cria uma sessão nova (sempre um token novo: evita fixação de sessão). Devolve o token, que vai só no cookie. */
export function criarSessao(usuarioId, { ip, userAgent } = {}) {
  const token = novoToken();
  const agora = Date.now();
  db.prepare(
    `INSERT INTO sessoes (usuario_id, token_hash, criada_em, ultimo_uso_em, expira_em, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(usuarioId, hashToken(token), paraSql(agora), paraSql(agora), paraSql(agora + config.auth.sessaoMaxMs), ip ?? null, userAgent ?? null);

  // Mantém só as N sessões mais recentes de cada usuário.
  db.prepare(
    `DELETE FROM sessoes WHERE usuario_id = ?
       AND id NOT IN (SELECT id FROM sessoes WHERE usuario_id = ? ORDER BY id DESC LIMIT ?)`,
  ).run(usuarioId, usuarioId, config.auth.maxSessoesPorUsuario);
  return token;
}

/** Devolve { usuario, sessaoId } se o token é de uma sessão válida; senão null. */
export function validarSessao(token) {
  if (typeof token !== 'string' || token.length > 200) return null;
  const linha = db
    .prepare(
      `SELECT s.id AS sessao_id, s.ultimo_uso_em, s.expira_em,
              u.id, u.nome, u.email, u.papel, u.email_verificado_em
         FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
        WHERE s.token_hash = ?`,
    )
    .get(hashToken(token));
  if (!linha) return null;

  const agora = Date.now();
  const inativa = agora - deSql(linha.ultimo_uso_em) > config.auth.sessaoInatividadeMs;
  if (inativa || deSql(linha.expira_em) <= agora) {
    db.prepare('DELETE FROM sessoes WHERE id = ?').run(linha.sessao_id);
    return null;
  }

  // Renova o "último uso" no máximo uma vez por minuto, para não gravar no banco a cada requisição.
  if (agora - deSql(linha.ultimo_uso_em) > 60 * 1000) {
    db.prepare('UPDATE sessoes SET ultimo_uso_em = ? WHERE id = ?').run(paraSql(agora), linha.sessao_id);
  }
  return { usuario: paraPublico(linha), sessaoId: linha.sessao_id };
}

export function revogarSessao(token) {
  if (typeof token === 'string') db.prepare('DELETE FROM sessoes WHERE token_hash = ?').run(hashToken(token));
}

/** Encerra todas as sessões do usuário (opcionalmente poupando a atual). */
export function revogarTodas(usuarioId, { exceto } = {}) {
  if (exceto) {
    db.prepare('DELETE FROM sessoes WHERE usuario_id = ? AND token_hash != ?').run(usuarioId, hashToken(exceto));
  } else {
    db.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(usuarioId);
  }
}
