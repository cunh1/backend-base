-- Autenticação: credenciais, papéis, sessões, tokens de uso único e controle de tentativas.

ALTER TABLE usuarios ADD COLUMN senha_hash TEXT;
ALTER TABLE usuarios ADD COLUMN senha_alterada_em TEXT;
ALTER TABLE usuarios ADD COLUMN email_verificado_em TEXT;
ALTER TABLE usuarios ADD COLUMN papel TEXT NOT NULL DEFAULT 'usuario' CHECK (papel IN ('usuario', 'admin'));

-- Garante e-mail único sem diferenciar maiúsculas/minúsculas.
CREATE UNIQUE INDEX idx_usuarios_email_lower ON usuarios (lower(email));

-- O token da sessão NUNCA é guardado; só o hash SHA-256 dele.
CREATE TABLE sessoes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL UNIQUE,
  criada_em     TEXT NOT NULL,
  ultimo_uso_em TEXT NOT NULL,
  expira_em     TEXT NOT NULL,
  ip            TEXT,
  user_agent    TEXT
);
CREATE INDEX idx_sessoes_usuario ON sessoes (usuario_id);

-- Tokens de uso único (verificar e-mail, redefinir senha). Também só o hash é guardado.
CREATE TABLE tokens_usuario (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo       TEXT NOT NULL CHECK (tipo IN ('verificar_email', 'redefinir_senha')),
  token_hash TEXT NOT NULL UNIQUE,
  criado_em  TEXT NOT NULL,
  expira_em  TEXT NOT NULL,
  usado_em   TEXT
);
CREATE INDEX idx_tokens_usuario ON tokens_usuario (usuario_id, tipo);

-- Registro de tentativas (falhas de login, pedidos de redefinição...) por chave,
-- ex.: 'email:ana@x.com' ou 'ip:203.0.113.5'. Funciona também para e-mails que não existem.
CREATE TABLE tentativas_login (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  chave     TEXT NOT NULL,
  criada_em TEXT NOT NULL
);
CREATE INDEX idx_tentativas_chave ON tentativas_login (chave, criada_em);
