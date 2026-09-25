import { db } from '../db/connection.js';

// Toda a conversa com a tabela fica aqui. As rotas nunca escrevem SQL.
// Os prepare() ficam dentro das funções de propósito: assim o módulo pode ser
// importado antes das migrações rodarem (a tabela ainda pode não existir).
// Os campos são listados um a um para que senha_hash jamais vá parar numa resposta.

const CAMPOS = 'id, nome, email, telefone, papel, email_verificado_em, criado_em, atualizado_em';

export function listar() {
  return db.prepare(`SELECT ${CAMPOS} FROM usuarios ORDER BY id`).all();
}

export function buscar(id) {
  return db.prepare(`SELECT ${CAMPOS} FROM usuarios WHERE id = ?`).get(id);
}

export function atualizar(id, { nome, email, telefone = null, papel }) {
  const info = db
    .prepare(
      `UPDATE usuarios
          SET nome = ?, email = ?, telefone = ?, papel = ?, atualizado_em = datetime('now')
        WHERE id = ?`,
    )
    .run(nome, email, telefone, papel, id);
  return info.changes ? buscar(id) : undefined;
}

export function remover(id) {
  return db.prepare('DELETE FROM usuarios WHERE id = ?').run(id).changes > 0;
}

/** Quantos administradores existem — usado para nunca deixar o sistema sem nenhum. */
export function contarAdmins() {
  return db.prepare("SELECT COUNT(*) AS n FROM usuarios WHERE papel = 'admin'").get().n;
}
