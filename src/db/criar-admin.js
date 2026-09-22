import { hashSenha } from '../auth/senha.js';
import { db } from './connection.js';
import { paraSql } from '../auth/tempo.js';

/**
 * Cria (ou atualiza) uma conta admin com login e senha fixos, direto no banco —
 * não passa pela validação de senha do cadastro normal (/auth/registrar).
 * Uso: node src/db/criar-admin.js "<login>" "<senha>" ["Nome"]
 */
const [login, senha, nome = 'Administrador'] = process.argv.slice(2);
if (!login || !senha) {
  console.error('Uso: node src/db/criar-admin.js "<login>" "<senha>" ["Nome"]');
  process.exit(1);
}

const senhaHash = await hashSenha(senha);
const agora = paraSql();
const existente = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(login);

if (existente) {
  db.prepare(
    `UPDATE usuarios SET senha_hash = ?, papel = 'admin', email_verificado_em = COALESCE(email_verificado_em, ?),
       senha_alterada_em = ?, atualizado_em = datetime('now') WHERE id = ?`,
  ).run(senhaHash, agora, agora, existente.id);
  console.log(`Conta "${login}" atualizada para admin.`);
} else {
  db.prepare(
    `INSERT INTO usuarios (nome, email, senha_hash, papel, email_verificado_em, senha_alterada_em)
     VALUES (?, ?, ?, 'admin', ?, ?)`,
  ).run(nome, login, senhaHash, agora, agora);
  console.log(`Conta admin "${login}" criada.`);
}
db.close();
