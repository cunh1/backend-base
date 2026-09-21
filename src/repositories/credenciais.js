import { db } from '../db/connection.js';
import { paraSql } from '../auth/tempo.js';

// Uso interno da autenticação: aqui o SELECT * traz senha_hash. Nunca devolva estas linhas em respostas HTTP;
// use paraPublico(). (O repositório de usuarios.js lista campos explícitos e não expõe o hash.)

export function paraPublico(linha) {
  return {
    id: linha.id,
    nome: linha.nome,
    email: linha.email,
    papel: linha.papel,
    emailVerificado: Boolean(linha.email_verificado_em),
  };
}

export const buscarPorEmail = (email) => db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
export const buscarPorId = (id) => db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);

/** Cria o usuário; se o e-mail já existe, não faz nada e devolve { criado: false }. */
export function criarComSenha({ nome, email, senhaHash }) {
  const info = db
    .prepare(
      `INSERT INTO usuarios (nome, email, senha_hash, senha_alterada_em) VALUES (?, ?, ?, ?)
       ON CONFLICT DO NOTHING`,
    )
    .run(nome, email, senhaHash, paraSql());
  return info.changes ? { criado: true, id: Number(info.lastInsertRowid) } : { criado: false };
}

export function definirSenha(id, senhaHash) {
  db.prepare("UPDATE usuarios SET senha_hash = ?, senha_alterada_em = ?, atualizado_em = datetime('now') WHERE id = ?")
    .run(senhaHash, paraSql(), id);
}

/** Troca só o hash (ex.: parâmetros novos), sem contar como "senha alterada". */
export function atualizarHash(id, senhaHash) {
  db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(senhaHash, id);
}

export function marcarEmailVerificado(id) {
  db.prepare('UPDATE usuarios SET email_verificado_em = COALESCE(email_verificado_em, ?) WHERE id = ?').run(paraSql(), id);
}
