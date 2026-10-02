import crypto from 'node:crypto';
import { db } from '../db/connection.js';
import { paraSql, deSql } from './tempo.js';

// 256 bits aleatórios: impossível de adivinhar, então SHA-256 basta para guardar (não precisa de scrypt).
export const novoToken = () => crypto.randomBytes(32).toString('base64url');
export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/** Cria um token de uso único e invalida os anteriores, ainda não usados, do mesmo tipo. */
export function criarTokenUsuario(usuarioId, tipo, validadeMs) {
  db.prepare('DELETE FROM tokens_usuario WHERE usuario_id = ? AND tipo = ? AND usado_em IS NULL').run(usuarioId, tipo);
  const token = novoToken();
  const agora = Date.now();
  db.prepare(
    'INSERT INTO tokens_usuario (usuario_id, tipo, token_hash, criado_em, expira_em) VALUES (?, ?, ?, ?, ?)',
  ).run(usuarioId, tipo, hashToken(token), paraSql(agora), paraSql(agora + validadeMs));
  return token;
}

/** Devolve a linha do token se ele existe, não foi usado e não expirou; senão null. */
export function consultarToken(token, tipo) {
  if (typeof token !== 'string' || token.length > 200) return null;
  const linha = db
    .prepare('SELECT id, usuario_id, expira_em, usado_em FROM tokens_usuario WHERE token_hash = ? AND tipo = ?')
    .get(hashToken(token), tipo);
  if (!linha || linha.usado_em || deSql(linha.expira_em) <= Date.now()) return null;
  return linha;
}

/** Marca como usado. Atômico: se duas requisições tentarem ao mesmo tempo, só uma vence. */
export function consumirToken(id) {
  return db.prepare('UPDATE tokens_usuario SET usado_em = ? WHERE id = ? AND usado_em IS NULL').run(paraSql(), id).changes === 1;
}
